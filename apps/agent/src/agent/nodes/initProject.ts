import type { WorkflowState } from "../graph";
import { getProjectDir, resolveWorkspacePath } from "@v7/env/sharedDir";
import { sendSseEvent } from "@/utils/sse";
import { logger } from "@/index";

export async function initProjectNode(
    state: WorkflowState
): Promise<Partial<WorkflowState>> {
    logger.info("Initializing Project...")

    const targetDir = getProjectDir(state.projectId);

    logger.info({targetDir: targetDir}, "Target Directory")

    sendSseEvent(state.projectId, {
        message: "Installing project dependencies...",
    });

    return {
        toolCalls: [
            {
                tool: "execute_command",
                parameters: {
                    command: "pnpm",
                    args: ["install"],
                    cwd: resolveWorkspacePath(targetDir, "."),
                },
                reason: "Install project dependencies",
            },
        ],

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
        },
    };
}