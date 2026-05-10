import type { WorkflowState } from "../graph";
import { z } from "zod";
import { model, toolModel } from "@v7/llmclient";
import { SYSTEM_PROMPTS } from "@/utils/prompts";


export async function planNode (state: WorkflowState): Promise<Partial<WorkflowState>> {

    // getting a list of tool calls that need to be made

    const finalPrompt = `${SYSTEM_PROMPTS.TOOL_LIST}\n\nOriginal Prompt: ${state.prompt}\n\nEnhanced Prompt: ${state.enhancedPrompt}\n\nAnalysis: ${state.analysis ? JSON.stringify(state.analysis) : "No analysis available."}\n\nBased on the above information, create a step-by-step plan to address the prompt. Include any necessary tool calls and their parameters. In case if some of the tools that you need arent mentioned in the tool list, you can still call them but make sure to specify the tool name and parameters correctly.`

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
