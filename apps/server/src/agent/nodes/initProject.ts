import type { WorkflowState } from "../graph";
import { mkdir } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { z } from "zod";
import { model } from "@v7/llmclient";
import { SYSTEM_PROMPTS } from "@/utils/prompts";

export async function initProjectNode(state: WorkflowState): Promise<Partial<WorkflowState>> {
    console.log("initializing project with id:", state.projectId);
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const targetDir = path.resolve(__dirname, "../../../../shared", state.projectId);

    await mkdir(targetDir, { recursive: true });
    console.log("Ensured project directory exists at:", targetDir);

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

        Return the exact commands needed to initialize the project in the shared project directory.
        Ensure the cwd values point to the project directory or the correct subdirectory for each command.
        Do not use "cd" as a command. Use the cwd field to select the working directory instead.
    `;

    const structuredModel = model.withStructuredOutput(ProjectInitSchema);
    const response = await structuredModel.invoke(projectInitPrompt);

    console.log("Project init command plan:", response);

    return {
        initProject: true,
        toolCalls: response.executeCommands.map((item) => ({
            tool: "execute_command",
            parameters: {
                command: item.command,
                args: item.args ?? [],
                cwd: item.cwd ?? targetDir,
            },
            reason: item.reason,
        })),
    }
}
