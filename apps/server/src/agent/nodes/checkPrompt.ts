import type { WorkflowState } from "../graph";
import { model } from "@v7/llmclient"
import { SYSTEM_PROMPTS } from "@/utils/prompts";
import { z } from "zod";

const SecurityResponseSchema = z.object({
    isSafe: z.boolean().describe("Indicates if the prompt is safe to execute"),
    reason: z.string().describe("If the prompt is not safe, provide a reason why"),
})

export async function checkPromptNode (state: WorkflowState): Promise<Partial<WorkflowState>> {
    const structuredModel = model.withStructuredOutput(SecurityResponseSchema);
    const response = await structuredModel.invoke([
        {
            role: "user",
            content: SYSTEM_PROMPTS.SECURITY_ANALYSIS_TEMPLATE + "\n\nOriginal Prompt: " + state.prompt
        }
    ]);

    console.log("Security analysis response:", response);
    
    if(response.isSafe) {
        return {
            analysis: {
                isSafe: true,
                reason: "The prompt is safe to execute."
            }
        }
    }
    else {
        return {
            analysis: {
                isSafe: false,
                reason: response.reason || "The prompt was flagged as unsafe, but no reason was provided."
            }
        }
    }
}