import type { WorkflowState } from "../graph";
import { model } from "@v7/llmclient"
import { SYSTEM_PROMPTS } from "@/utils/prompts";

export async function enhancePromptNode (state: WorkflowState): Promise<Partial<WorkflowState>> {
    const response = await model.invoke(SYSTEM_PROMPTS.PROMPT_ENHANCEMENT_TEMPLATE + "\n\nOriginal Prompt: " + state.prompt);
    state.enhancedPrompt = response.content as string;

    console.log("Enhanced prompt:", state.enhancedPrompt);
    
    return {
        enhancedPrompt: `Enhanced version of: ${state.prompt}`
    }
}