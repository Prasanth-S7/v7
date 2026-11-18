import { resolveWorkspaceRoot } from "@v7/env/sharedDir";
import { tools } from "@v7/llmclient";
import { logger } from "@/index";
import { sendSseEvent } from "@/utils/sse";
import type { WorkflowState } from "../graph";

type ToolCall = {
	tool: string;
	parameters?: Record<string, unknown>;
	reason?: string;
};

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
		} catch (error) {
			lastError = `ERROR: tool "${call.tool}" failed - ${error instanceof Error ? error.message : String(error)}`;
			logger.error({ tool: call.tool, error }, "Tool call threw unexpectedly");
			toolResults.push({ tool: call.tool, parameters: call.parameters, result: lastError });
			break;
		}
	}

	sendSseEvent(state.projectId, {
		message: lastError ? "Execution hit an error, will retry" : "Execution completed successfully",
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
