import type { WorkflowState } from "../graph";
import { mkdir } from "fs/promises";
import { z } from "zod";
import { model } from "@v7/llmclient";
import { SYSTEM_PROMPTS } from "@/utils/prompts";
import { getProjectDir, resolveWorkspacePath } from "@v7/env/sharedDir";

function parseProjectInitResponse(raw: unknown) {
    const ProjectInitSchema = z.object({
        executeCommands: z.array(z.object({
            command: z.string().describe("The command to execute"),
            args: z.array(z.string()).default([]).describe("Arguments to pass to the command"),
            cwd: z.string().describe("Working directory for the command"),
            reason: z.string().describe("Why this command should be run"),
        })).describe("Ordered list of execute_command prompts to run"),
    });

    const parsed = ProjectInitSchema.safeParse(raw);
    if (parsed.success) {
        return parsed.data;
    }

    if (typeof raw === "string") {
        try {
            const json = JSON.parse(raw);
            const parsedJson = ProjectInitSchema.safeParse(json);
            if (parsedJson.success) {
                return parsedJson.data;
            }
        } catch (error) {
            console.error("Error parsing JSON in parseProjectInitResponse:", error);
        }
    }

    if (raw && typeof raw === "object" && "content" in raw) {
        const content = (raw as { content?: unknown }).content;
        if (typeof content === "string") {
            try {
                const json = JSON.parse(content);
                const parsedContent = ProjectInitSchema.safeParse(json);
                if (parsedContent.success) {
                    return parsedContent.data;
                }
            } catch (error) {
                console.error("Error parsing JSON in parseProjectInitResponse:", error);
            }
        }
    }

    return null;
}

export async function initProjectNode(state: WorkflowState): Promise<Partial<WorkflowState>> {
    console.log("initializing project with id:", state.projectId);
    const targetDir = getProjectDir(state.projectId);

    const ProjectInitSchema = z.object({
        executeCommands: z.array(z.object({
            command: z.string().describe("The command to execute"),
            args: z.array(z.string()).default([]).describe("Arguments to pass to the command"),
            cwd: z.string().describe("Working directory for the command"),
            reason: z.string().describe("Why this command should be run"),
        })).describe("Ordered list of execute_command prompts to run"),
    });

    const projectInitPrompt = `
        ${SYSTEM_PROMPTS.PROJECT_INIT_TEMPLATE}

        ${SYSTEM_PROMPTS.TOOL_LIST}

        Project ID: ${state.projectId}
        Project Directory: ${targetDir}
        Original Prompt: ${state.prompt}

        Return the exact commands needed to set up the project in the shared project directory.
        Ensure the cwd values point to the project directory or the correct subdirectory for each command.
        Do not use "cd" as a command. Use the cwd field to select the working directory instead.
    `;

    const structuredModel = model.withStructuredOutput(ProjectInitSchema);
    console.log("[initProjectNode] model info:", {
        modelName: (model as { name?: string }).name,
        modelType: model?.constructor?.name,
    });

    const structuredResponse = await structuredModel.invoke(projectInitPrompt);
    console.log("[initProjectNode] structured response:", structuredResponse);

    const response =
        parseProjectInitResponse(structuredResponse) ??
        parseProjectInitResponse(await model.invoke(projectInitPrompt));

    if (!response) {
        throw new Error("Project initialization did not return a valid command plan.");
    }

    console.log("[initProjectNode] parsed project init command plan:", response);

    return {
        toolCalls: response.executeCommands.map((item) => ({
            tool: "execute_command",
            parameters: {
                command: item.command,
                args: item.args ?? [],
                cwd: resolveWorkspacePath(targetDir, item.cwd ?? "."),
            },
            reason: item.reason,
        })),
        projectContext: {
            stack: {
                bundler: "vite",
                language: "typescript",
                styling: "tailwindcss-v4",
            },
            rootPath: targetDir,
            fileTree: [],
            dependencies: {},
            lastError: null,
        }
    }
}
