import type { WorkflowState } from "../graph";
import { z } from "zod";
import { model } from "@v7/llmclient"

export async function planNode (state: WorkflowState): Promise<Partial<WorkflowState>> {

    // getting a list of tool calls that need to be made

    const finalPrompt = `Original Prompt: ${state.prompt}\n\nEnhanced Prompt: ${state.enhancedPrompt}\n\nAnalysis: ${state.analysis ? JSON.stringify(state.analysis) : "No analysis available."}\n\nBased on the above information, create a step-by-step plan to address the prompt. Include any necessary tool calls and their parameters.`

    const ToolCallResponseSchema = z.object({
        toolCalls: z.array(z.object({
            tool: z.string().describe("The name of the tool to call"),
            parameters: z.record(z.string(), z.any()).describe("A JSON object of parameters to pass to the tool"),
        })).describe("List of tool calls with their parameters. Each tool call should include the tool name and a JSON object of parameters."),
    })

    const structuredModel = model.withStructuredOutput(ToolCallResponseSchema);
    const response = await structuredModel.invoke(finalPrompt);

    console.log("Planning node response with tool calls:", response);

    return {
        buildStatus: "pending",
    }
}   
