import { appendFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { resolveWorkspaceRoot } from "@v7/env/sharedDir";
import { model, tools } from "@v7/llmclient";
import { buildPlanPrompt } from "@/utils/buildPlanPrompt";
import { sendSseEvent } from "@/utils/sse";
import type { WorkflowState } from "../graph";

function safeSerialize(details: unknown): string {
	if (typeof details === "string") {
		return details;
	}

	try {
		return JSON.stringify(details, null, 2);
	} catch {
		return String(details);
	}
}

function createPlanLogger(logFilePath: string) {
	return (title: string, details?: unknown) => {
		const timestamp = new Date().toISOString();
		const header = `[${timestamp}] [planNode] ${title}`;
		const body = details === undefined ? "" : safeSerialize(details);
		const chunk = body ? `${header}\n${body}\n\n` : `${header}\n\n`;

		console.log(`\n${header}`);
		if (details !== undefined) {
			console.log(details);
		}

		try {
			appendFileSync(logFilePath, chunk, "utf8");
		} catch (error) {
			console.warn("[planNode] Failed to write plan log file:", error);
		}
	};
}

function summarizeMessage(message: any) {
	const content =
		typeof message?.content === "string" ? message.content : JSON.stringify(message?.content ?? null, null, 2);

	return {
		role: message?.role,
		tool_call_id: message?.tool_call_id,
		content,
	};
}

export async function planNode(state: WorkflowState): Promise<Partial<WorkflowState>> {
	sendSseEvent(state.projectId, { message: "Planning..." });
	const projectRoot = resolveWorkspaceRoot(state.projectContext.rootPath);
	const logDir = path.join(projectRoot, ".codex", "logs");
	mkdirSync(logDir, { recursive: true });
	const logFilePath = path.join(logDir, `plan-${new Date().toISOString().replace(/[:.]/g, "-")}.log`);
	const logSection = createPlanLogger(logFilePath);

	logSection("Entered plan node", {
		projectId: state.projectId,
		rootPath: state.projectContext.rootPath,
		lastError: state.projectContext.lastError,
		fileCount: state.projectContext.fileTree.length,
		dependencyCount: Object.keys(state.projectContext.dependencies ?? {}).length,
	});
	const boundTools = [
		tools.readFile(projectRoot),
		tools.writeFile(projectRoot),
		tools.executeCommand(projectRoot),
		tools.deleteFile(projectRoot),
		tools.renameFile(projectRoot),
		tools.grepSearch(projectRoot),
		tools.replaceInFile(projectRoot),
		tools.updateFile(projectRoot),
	];

	const toolModel = model.bindTools(boundTools);

	const initialPrompt = buildPlanPrompt({
		projectRoot,
		stack: state.projectContext.stack,
		dependenciesInstalled: state.projectContext.dependenciesInstalled,
		dependencies: state.projectContext.dependencies,
		fileTree: state.projectContext.fileTree,
		lastError: state.projectContext.lastError,
		enhancedPrompt: state.enhancedPrompt,
		prompt: state.prompt,
		recentToolResults: state.toolResults,
	});
	const messages = [{ role: "user", content: initialPrompt }];

	logSection("Initial LLM prompt", initialPrompt);
	logSection("Plan log file path", logFilePath);

	const response = await toolModel.invoke(messages);

	logSection("LLM response", {
		content: response?.content,
		toolCalls: response?.tool_calls ?? [],
	});

	const proposedToolCalls = (response.tool_calls ?? []).map((toolCall) => ({
		tool: toolCall.name,
		parameters: toolCall.args as Record<string, unknown>,
		reason: summarizeMessage(response).content,
	}));

	logSection("Plan turn finished", {
		toolCallCount: proposedToolCalls.length,
		toolCalls: proposedToolCalls,
		finalAssistantMessage: response?.content,
	});

	sendSseEvent(state.projectId, {
		message:
			proposedToolCalls.length > 0 ? `Planned ${proposedToolCalls.length} action(s)` : "No further actions planned",
	});

	// planExecuted means "the model has declared the task complete", which only
	// happens once it stops requesting tool calls. If it still has tool calls to
	// make, the task is not done yet, no matter how many turns have already run.
	return {
		planExecuted: proposedToolCalls.length === 0,
		toolCalls: proposedToolCalls,
	};
}
