import { model } from "@v7/llmclient";
import { logger } from "@/index";
import { SYSTEM_PROMPTS } from "@/utils/prompts";
import { sendSseEvent } from "@/utils/sse";
import type { WorkflowState } from "../graph";

export async function enhancePromptNode(state: WorkflowState): Promise<Partial<WorkflowState>> {
	sendSseEvent(state.projectId, { message: "Enhancing prompt..." });
	const response = await model.invoke(
		`${SYSTEM_PROMPTS.PROMPT_ENHANCEMENT_TEMPLATE}\n\nOriginal·Prompt:·${state.prompt}`,
	);
	const enhancedPrompt = response.content as string;

	logger.info({ enhancedPrompt }, "Enhanced prompt:");
	sendSseEvent(state.projectId, { message: "Prompt enhanced successfully" });

	return {
		enhancedPrompt,
		planExecuted: false,
	};
}
