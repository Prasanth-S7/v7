import type { WorkflowState } from "../graph";
import { model } from "@v7/llmclient"
import { SYSTEM_PROMPTS } from "@/utils/prompts";
import { z } from "zod";
import { sendSseEvent } from "@/utils/sse";
import { logger } from "@/index";

const SecurityResponseSchema = z.object({
    isSafe: z.boolean().describe("Indicates if the prompt is safe to execute"),
    reason: z.string().describe("If the prompt is not safe, provide a reason why"),
})

export async function checkPromptNode(state: WorkflowState): Promise<Partial<WorkflowState>> {

    logger.info({
        model: model.lc_kwargs.model,
        modelType: model?.constructor?.name,
    }, "Model Info:");

    const structuredModel = model.withStructuredOutput(SecurityResponseSchema);
    sendSseEvent(state.projectId, { message: "Checking prompt for safety..." })
    

    try {
        const prompt = SYSTEM_PROMPTS.SECURITY_ANALYSIS_TEMPLATE + "\n\nOriginal Prompt: " + state.prompt;
        const messages = [
            {
                role: "user",
                content: prompt,
            }
        ];

        const response = await structuredModel.invoke(messages);

        logger.info({ response }, "Response:");

        if (!response) {
            sendSseEvent(state.projectId, { message: "Security analysis did not return a valid structured response." })
            return {
                analysis: {
                    isSafe: false,
                    reason: "Security analysis did not return a valid structured response.",
                },
            };
        }

        if (response.isSafe) {
            sendSseEvent(state.projectId, { message: "Prompt is safe to execute." })
            return {
                analysis: {
                    isSafe: true,
                    reason: response.reason || "The prompt is safe to execute."
                }
            }
        }
        else {
            sendSseEvent(state.projectId, { message: "Prompt is unsafe to execute." })
            return {
                analysis: {
                    isSafe: false,
                    reason: response.reason || "The prompt was flagged as unsafe, but no reason was provided."
                }
            }
        }
    }
    catch (error) {
        logger.error({ err: error }, "Error during security analysis:");
        sendSseEvent(state.projectId, { message: "An error occurred during security analysis. The prompt could not be verified as safe." })
        return {
            analysis: {
                isSafe: false,
                reason: "An error occurred during security analysis. The prompt could not be verified as safe."
            }
        }
    }

}
