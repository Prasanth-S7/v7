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
import { initProjectNode } from "../nodes/initProject";
import { loadContextNode } from "../nodes/loadContext";
import { MemorySaver } from "@langchain/langgraph";
import { logger } from "@/index";

export const checkpointer = new MemorySaver();

const graphStateSchema = new StateSchema({
    prompt: z.string().describe("The prompt to be processed"),
    projectId: z.string().describe("The Id of the project"),
    analysis: z.any().optional(),
    planExecuted: z.boolean().describe("Indicates if the plan has been executed"),
    initProject: z.boolean().describe("Indicates if the project has been initialized"),
    enhancedPrompt: z.string().describe("The enhanced prompt after processing"),
    buildStatus: z.enum(["pending", "processing", "completed", "failed"]).describe("The status of the build process"),
    uploadStatus: z.enum(["pending", "processing", "completed", "failed"]).describe("The status of the upload process"),
    fixAttempts: z.number().describe("The number of attempts made to fix"),
    toolCalls: z.array(z.any()).describe("List of tool calls made during execution"),
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

const MAX_INIT_ATTEMPTS = 3;
const MAX_FIX_ATTEMPTS = 5;

const routeAfterLoadContext = (state: WorkflowState) => {
    if (!state.initProject) {
        if (state.fixAttempts >= MAX_INIT_ATTEMPTS) return "end";
        return "initProjectNode";
    }

    logger.info({ planExecuted: state.planExecuted }, "Plan execution result:");

    if (state.projectContext.lastError) {
        if (state.fixAttempts >= MAX_FIX_ATTEMPTS) return "end";
        return "plan";
    }

    if (!state.planExecuted) {
        return "plan";
    }

    return "build";
};


const routeAfterEnhancePrompt = (state: WorkflowState) => {
    logger.info({ initProject: state.initProject }, "Project initialization status:");
    if (state.initProject) {
        logger.info("Project already initialized, proceeding to load context");
    }
    else {
        logger.info("Project not initialized. Skipping load context and proceeding to initialize project");
    }

    return state.initProject
        ? "loadContext"
        : "initProjectNode";
};

const graph = new StateGraph(graphStateSchema)
    .addNode("checkPrompt", checkPromptNode)
    .addNode("enhancePrompt", enhancePromptNode)
    .addNode("initProjectNode", initProjectNode)
    .addNode("loadContext", loadContextNode)
    // .addNode("plan", planNode)
    // .addNode("execute", executeNode)
    // .addNode("upload", uploadNode)

    .addEdge(START, "checkPrompt")
    .addConditionalEdges("checkPrompt", routeAfterCheck, {
        enhancePrompt: "enhancePrompt",
        end: END,
    })


    .addConditionalEdges(
        "enhancePrompt",
        routeAfterEnhancePrompt,
        {
            loadContext: "loadContext",
            initProjectNode: "initProjectNode",
        }
    )

    // .addEdge("initProjectNode", "execute")
    // .addEdge("execute", "loadContext")

    // .addConditionalEdges("loadContext", routeAfterLoadContext, {
    //     initProjectNode: "initProjectNode",
    //     plan: "plan",
    //     upload: "upload",
    //     end: END,
    // })
    // .addEdge("plan", "execute")
    // .addEdge("upload", END)
    .addEdge("enhancePrompt", END)


export const workflow = graph.compile({
    checkpointer,
});
