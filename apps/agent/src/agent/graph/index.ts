import {
    START,
    END,
    StateGraph,
    StateSchema
} from "@langchain/langgraph";

import { z } from "zod";
import { uploadNode } from "../nodes/upload";
import { enhancePromptNode } from "../nodes/enhancePrompt";
import { executeNode } from "../nodes/execute";
import { planNode } from "../nodes/plan";
import { checkPromptNode } from "../nodes/checkPrompt";
import { loadContextNode } from "../nodes/loadContext";
import { MemorySaver } from "@langchain/langgraph";
import { logger } from "@/index";

export const checkpointer = new MemorySaver();

const graphStateSchema = new StateSchema({
    prompt: z.string().describe("The prompt to be processed"),
    projectId: z.string().describe("The Id of the project"),
    analysis: z.any().optional(),
    planExecuted: z.boolean().describe("Indicates if the plan has been executed"),
    enhancedPrompt: z.string().describe("The enhanced prompt after processing"),
    buildStatus: z.enum(["pending", "processing", "completed", "failed"]).describe("The status of the build process"),
    uploadStatus: z.enum(["pending", "processing", "completed", "failed"]).describe("The status of the upload process"),
    fixAttempts: z.number().describe("The number of attempts made to fix"),
    toolCalls: z.array(z.any()).describe("List of tool calls made during execution"),
    toolResults: z.array(z.object({
        tool: z.string(),
        parameters: z.record(z.string(), z.any()).optional(),
        result: z.string(),
    })).default([]).describe(
        "Output of the most recently executed tool calls (e.g. file contents from read_file, " +
        "grep matches), fed back into the next plan turn so the model doesn't have to re-read " +
        "the same files blindly and can see what it just did"
    ),
    changeSummary: z.object({
        filesChanged: z.array(z.string()).describe("List of files changed"),
        linesAdded: z.number().describe("Number of lines added"),
        linesRemoved: z.number().describe("Number of lines removed"),
    }),
    projectContext: z.object({
        rootPath: z.string().describe("Absolute path to the project root on disk"),
        stack: z.object({
            bundler: z.string().default("vite"),
            language: z.string().default("javascript"),
            styling: z.string().default("tailwindcss-v4")
        }).describe("Fixed stack info, set once at init"),
        fileTree: z.array(z.string()).describe(
            "Flat list of relative file paths in the project, refreshed before each LLM turn"
        ),
        dependencies: z.record(z.string(), z.string()).describe(
            "Parsed package.json dependencies + devDependencies, name -> version"
        ),
        dependenciesInstalled: z.boolean().default(false).describe(
            "Whether node_modules exists on disk for this project, used to tell the planning LLM whether it needs to run an install before anything else"
        ),
        lastError: z.string().nullable().default(null).describe(
            "Most recent build/runtime error, if any, to give the fix loop grounding"
        ),
    }).describe("Current known state of the project on disk, used to give the LLM grounding without re-reading everything"),
})

export type WorkflowState = typeof graphStateSchema.State;

const routeAfterCheck = (state: WorkflowState) => {
    if (!state.analysis?.isSafe) {
        return "end";
    }
    return "enhancePrompt"
}

const MAX_FIX_ATTEMPTS = 5;

const routeAfterLoadContext = (state: WorkflowState) => {
    logger.info({ planExecuted: state.planExecuted }, "Plan execution result:");

    if (state.projectContext.lastError) {
        if (state.fixAttempts >= MAX_FIX_ATTEMPTS) return "end";
        return "plan";
    }

    // planExecuted is only true once the model responds with zero tool calls,
    // i.e. it has explicitly declared the task complete. Otherwise, even if the
    // last batch of tool calls succeeded (e.g. a batch of read_file calls), we
    // loop back to plan so the model can act on what it just learned.
    if (!state.planExecuted) {
        return "plan";
    }

    return "upload";
};

const graph = new StateGraph(graphStateSchema)
    .addNode("checkPrompt", checkPromptNode)
    .addNode("enhancePrompt", enhancePromptNode)
    .addNode("loadContext", loadContextNode)
    .addNode("plan", planNode)
    .addNode("execute", executeNode)
    .addNode("upload", uploadNode)

    .addEdge(START, "checkPrompt")
    .addConditionalEdges("checkPrompt", routeAfterCheck, {
        enhancePrompt: "enhancePrompt",
        end: END,
    })

    .addEdge("enhancePrompt", "loadContext")

    .addConditionalEdges("loadContext", routeAfterLoadContext, {
        plan: "plan",
        upload: "upload",
        end: END,
    })
    .addEdge("plan", "execute")
    .addEdge("execute", "loadContext")
    .addEdge("upload", END)


export const workflow = graph.compile({
    checkpointer,
});
