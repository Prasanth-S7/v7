import type { WorkflowState } from "../graph";
import { tools } from "@v7/llmclient";
import { resolveWorkspaceRoot } from "@v7/env/sharedDir";
import { sendSseEvent } from "@/utils/sse";
import { logger } from "@/index";

type ToolCall = {
    tool: string;
    parameters?: Record<string, unknown>;
    reason?: string;
};

// This node is the sole place where tool calls proposed by `planNode` are actually
// executed. `planNode` only produces data (state.toolCalls); it never runs anything
// itself. Every tool here is the same real implementation the model was shown during
// planning (read_file, write_file, update_file, replace_in_file, delete_file,
// rename_file, grep_search, execute_command), so there is exactly one source of truth
// for what each tool does.
//
// Failures are NEVER thrown out of this node. They are captured into
// `projectContext.lastError` and `fixAttempts` is incremented, so the graph-level
// routing (`routeAfterLoadContext`) can decide to loop back to `plan` with the error
// as fresh grounding, or give up once `MAX_FIX_ATTEMPTS` is reached. This is the
// graph-level ("Shape B") retry loop: plan -> execute -> loadContext -> plan -> ...
export async function executeNode(state: WorkflowState): Promise<Partial<WorkflowState>> {
    logger.info("Reaches execute Node");
    sendSseEvent(state.projectId, { message: "Executing planned actions..." });

    const toolCalls = (state.toolCalls ?? []) as ToolCall[];
    const workspaceRoot = resolveWorkspaceRoot(state.projectContext.rootPath);

    const availableTools: any[] = [
        tools.readFile(workspaceRoot),
        tools.writeFile(workspaceRoot),
        tools.updateFile(workspaceRoot),
        tools.replaceInFile(workspaceRoot),
        tools.deleteFile(workspaceRoot),
        tools.renameFile(workspaceRoot),
        tools.grepSearch(workspaceRoot),
        tools.executeCommand(workspaceRoot),
    ];

    const filesChanged = new Set<string>();
    const toolResults: { tool: string; parameters?: Record<string, unknown>; result: string }[] = [];
    let lastError: string | null = null;

    for (const call of toolCalls) {
        const matchedTool = availableTools.find((t) => t.name === call.tool);

        if (!matchedTool) {
            lastError = `ERROR: unknown tool "${call.tool}" requested by plan`;
            logger.error({ tool: call.tool }, lastError);
            break;
        }

        try {
            logger.info({ tool: call.tool, parameters: call.parameters }, "Executing tool call");

            const result = await matchedTool.invoke((call.parameters ?? {}) as any);
            const resultText = typeof result === "string" ? result : JSON.stringify(result);

            logger.info({ tool: call.tool, result: resultText }, "Tool call result");

            toolResults.push({ tool: call.tool, parameters: call.parameters, result: resultText });

            if (resultText.startsWith("ERROR:")) {
                lastError = resultText;
                break;
            }

            const filePath = (call.parameters as any)?.filePath;
            if (typeof filePath === "string") {
                filesChanged.add(filePath);
            }
        } catch (error: any) {
            lastError = `ERROR: tool "${call.tool}" failed - ${error?.message ?? String(error)}`;
            logger.error({ tool: call.tool, error }, "Tool call threw unexpectedly");
            toolResults.push({ tool: call.tool, parameters: call.parameters, result: lastError });
            break;
        }
    }

    sendSseEvent(state.projectId, {
        message: lastError
            ? "Execution hit an error, will retry"
            : "Execution completed successfully",
    });

    return {
        fixAttempts: (state.fixAttempts ?? 0) + 1,
        toolCalls: [],
        toolResults,
        changeSummary: {
            filesChanged: Array.from(filesChanged),
            linesAdded: 0,
            linesRemoved: 0,
        },
        projectContext: {
            ...state.projectContext,
            lastError,
        },
    };
}
