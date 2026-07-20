import type { WorkflowState } from "../graph";
import { model } from "@v7/llmclient"
import { SYSTEM_PROMPTS } from "@/utils/prompts";
import { z } from "zod";

const SecurityResponseSchema = z.object({
    isSafe: z.boolean().describe("Indicates if the prompt is safe to execute"),
    reason: z.string().describe("If the prompt is not safe, provide a reason why"),
})

function parseSecurityResponse(raw: unknown) {
    const parsed = SecurityResponseSchema.safeParse(raw);
    if (parsed.success) {
        return parsed.data;
    }

    if (typeof raw === "string") {
        try {
            const json = JSON.parse(raw);
            const parsedJson = SecurityResponseSchema.safeParse(json);
            if (parsedJson.success) {
                return parsedJson.data;
            }
        } catch {
            // Ignore JSON parsing errors and fall through to the unsafe default below.
        }
    }

    if (raw && typeof raw === "object" && "content" in raw) {
        const content = (raw as { content?: unknown }).content;
        if (typeof content === "string") {
            try {
                const json = JSON.parse(content);
                const parsedContent = SecurityResponseSchema.safeParse(json);
                if (parsedContent.success) {
                    return parsedContent.data;
                }
            } catch {
                // Ignore JSON parsing errors and fall through to the unsafe default below.
            }
        }
    }

    return null;
}

export async function checkPromptNode (state: WorkflowState): Promise<Partial<WorkflowState>> {
    const structuredModel = model.withStructuredOutput(SecurityResponseSchema);
    console.log("[checkPromptNode] model info:", {
        modelName: (model as { name?: string }).name,
        modelType: model?.constructor?.name,
    });

    try {
        const prompt = SYSTEM_PROMPTS.SECURITY_ANALYSIS_TEMPLATE + "\n\nOriginal Prompt: " + state.prompt;
        const messages = [
            {
                role: "user",
                content: prompt,
            }
        ];

        console.log("[checkPromptNode] sending security analysis prompt");

        const structuredResponse = await structuredModel.invoke(messages);
        console.log("[checkPromptNode] structured response:", structuredResponse);

        const response =
            parseSecurityResponse(structuredResponse) ??
            parseSecurityResponse(await model.invoke(messages));

        console.log("[checkPromptNode] parsed security response:", response);

        if (!response) {
            return {
                analysis: {
                    isSafe: false,
                    reason: "Security analysis did not return a valid structured response.",
                },
            };
        }

        if(response.isSafe) {
        return {
            analysis: {
                isSafe: true,
                reason: response.reason || "The prompt is safe to execute."
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
    catch (error) {
        console.error("Error during security analysis:", error);
        return {
            analysis: {
                isSafe: false,
                reason: "An error occurred during security analysis. The prompt could not be verified as safe."
            }
        }
    }
    
}
