import {
    START,
    END,
    StateGraph,
    StateSchema
} from "@langchain/langgraph";

import { z } from "zod";
import { buildNode } from "../nodes/build";
import { enhancePromptNode } from "../nodes/enhancePrompt";
import { executeNode } from "../nodes/execute";
import { planNode } from "../nodes/plan";
import { checkPromptNode } from "../nodes/checkPrompt";
import { initProjectNode } from "../nodes/initProject";
import { getContext } from "../nodes/getContext";

const graphStateSchema = new StateSchema({
    prompt: z.string().describe("The prompt to be processed"),
    projectId: z.string().describe("The Id of the project"),
    analysis: z.any().optional(),
    initProject: z.boolean().describe("Indicates if the project has been initialized"),
    enhancedPrompt: z.string().describe("The enhanced prompt after processing"),
    buildStatus: z.enum(["pending", "processing", "completed", "failed"]).describe("The status of the build process"),
    fixAttempts: z.number().describe("The number of attempts made to fix"),
    toolCalls: z.array(z.any()).describe("List of tool calls made during execution"),
    changeSummary: z.object({
        filesChanged: z.array(z.string()).describe("List of files changed"),
        linesAdded: z.number().describe("Number of lines added"),
        linesRemoved: z.number().describe("Number of lines removed"),
    })
})

export type WorkflowState = typeof graphStateSchema.State;

const routeAfterCheck = (state: WorkflowState) => {
    if(!state.analysis?.isSafe) {
        return "end";
    }
    return "enhancePrompt"
}

const graph = new StateGraph(graphStateSchema)
.addNode("checkPrompt", checkPromptNode)
.addNode("enhancePrompt", enhancePromptNode)
.addNode("getContext", getContext)
.addNode("initProjectNode", initProjectNode)
.addNode("plan", planNode)
.addNode("execute", executeNode)
.addNode("build", buildNode)

.addEdge(START, "checkPrompt")
.addConditionalEdges("checkPrompt", routeAfterCheck, {
    enhancePrompt: "enhancePrompt",
    end: END,
})
.addEdge("enhancePrompt", "getContext")
.addConditionalEdges("getContext", (state) => {
    if(state.initProject) {
        return "plan";
    }
    else {
        return "initProjectNode";
    }
})
.addEdge("initProjectNode", "plan")
.addEdge("plan", "execute")
.addEdge("execute", "build")


export const workflow = graph.compile();