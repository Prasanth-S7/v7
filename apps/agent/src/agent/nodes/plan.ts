import type { WorkflowState } from "../graph";
import { model, tools } from "@v7/llmclient";
import type { StructuredToolInterface } from "@langchain/core/tools";
import { appendFileSync, mkdirSync } from "fs";
import path from "path";
import { resolveWorkspaceRoot } from "@v7/env/sharedDir";
import { sendSseEvent } from "@/utils/sse";

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
        typeof message?.content === "string"
            ? message.content
            : JSON.stringify(message?.content ?? null, null, 2);

    return {
        role: message?.role,
        tool_call_id: message?.tool_call_id,
        content,
    };
}

export function buildInitialPrompt(state: WorkflowState): string {
    const isFixingError = !!state.projectContext.lastError;
    const projectRoot = resolveWorkspaceRoot(state.projectContext.rootPath);

    return `

## Project Context

The project has ALREADY been initialized. Do NOT scaffold, re-run "npm create vite",
"tailwindcss init", or any project setup commands. This project already exists on disk.

Project Directory: ${projectRoot}
Stack: ${JSON.stringify(state.projectContext.stack)}
Installed dependencies: ${JSON.stringify(state.projectContext.dependencies, null, 2)}

Current file tree:
${state.projectContext.fileTree.map((f) => `- ${f}`).join("\n")}

## Your Task

${isFixingError
            ? `The previous attempt failed with this error:\n\n${state.projectContext.lastError}\n\nInvestigate the relevant file(s) using read_file, diagnose the root cause, then fix it using edit_file or write_file. Do not repeat the exact same change that caused this failure.`
            : `User's request: ${state.enhancedPrompt}\n\nOriginal prompt: ${state.prompt}`
        }

## How to work

- You do NOT have the contents of any file yet — the file tree above only shows paths.
  Use read_file to see a file's current contents before editing it. Never guess or
  fabricate what a file currently contains.
- Prefer edit_file (targeted search/replace) over write_file for small changes to
  existing files, to avoid accidentally dropping unrelated code.
- Use write_file only for brand new files, or when a file needs to be substantially
  rewritten.
- Use execute_command only for things that genuinely need a shell command (e.g.
  installing a new npm package). Never use it for project scaffolding.
- Every file you write must contain complete, real, working code. Never use
  placeholder comments like "// your code here" or "// implementation goes here".
- Work through this step by step: read what you need, make one change at a time,
  and verify your understanding of a file before editing it.
- When you have made all the changes needed to satisfy the request, stop calling
  tools and respond with a brief plain-text summary of what you changed.

Begin.
    `.trim();
}

export async function planNode(state: WorkflowState): Promise<Partial<WorkflowState>> {
    // This node is the core "reasoning + tool use" loop.
    // It keeps the LLM grounded with the current project context, lets it choose tools,
    // sends tool outputs back to the model, and repeats until the model stops requesting tools.
    sendSseEvent(state.projectId, { message: "Planning..." })
    const projectRoot = resolveWorkspaceRoot(state.projectContext.rootPath);
    const logDir = path.join(projectRoot, ".codex", "logs");
    mkdirSync(logDir, { recursive: true });
    const logFilePath = path.join(
        logDir,
        `plan-${state.projectId}-${new Date().toISOString().replace(/[:.]/g, "-")}.log`
    );
    const logSection = createPlanLogger(logFilePath);

    logSection("Entered plan node", {
        projectId: state.projectId,
        rootPath: state.projectContext.rootPath,
        lastError: state.projectContext.lastError,
        fileCount: state.projectContext.fileTree.length,
        dependencyCount: Object.keys(state.projectContext.dependencies ?? {}).length,
    });

    // Bind only the tools that are allowed during planning so every model tool call
    // can be traced and executed against the current project root.
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

    const initialPrompt = buildInitialPrompt(state);
    let messages: any[] = [{ role: "user", content: initialPrompt }];
    const changeLog: { tool: string; path?: string }[] = [];

    // The initial prompt is the first message sent to the model.
    logSection("Initial LLM prompt", initialPrompt);
    logSection("Plan log file path", logFilePath);

    const MAX_ITERATIONS = 20;
    let finalError: string | null = null;
    let hitIterationCap = true;

    for (let i = 0; i < MAX_ITERATIONS; i++) {
        // Each iteration is one LLM turn, followed by zero or more tool executions.
        logSection(`LLM turn ${i + 1} input`, {
            messageCount: messages.length,
            lastMessage: summarizeMessage(messages[messages.length - 1]),
        });

        const response = await toolModel.invoke(messages);
        messages.push(response);

        logSection(`LLM turn ${i + 1} response`, {
            content: response?.content,
            toolCalls: response?.tool_calls ?? [],
        });

        if (!response.tool_calls || response.tool_calls.length === 0) {
            logSection(`LLM turn ${i + 1} requested no tools, stopping`, {
                finalAssistantMessage: response?.content,
            });
            hitIterationCap = false;
            break;
        }

        for (const toolCall of response.tool_calls) {
            logSection("Dispatching tool call", {
                toolCallId: toolCall.id,
                toolName: toolCall.name,
                args: toolCall.args,
            });

            const result = await dispatchTool(toolCall, boundTools);

            if (typeof result === "string" && result.startsWith("ERROR:")) {
                finalError = result;
            }

            changeLog.push({ tool: toolCall.name, path: (toolCall.args as any).path });

            logSection("Tool result", {
                toolCallId: toolCall.id,
                toolName: toolCall.name,
                result,
            });

            // Feed the tool output back into the conversation so the model can decide
            // what to do next with fresh, grounded information.
            messages.push({
                role: "tool",
                tool_call_id: toolCall.id,
                content: result,
            });

            logSection("Next LLM input after tool result", {
                messageCount: messages.length,
                appendedMessage: summarizeMessage(messages[messages.length - 1]),
                conversationTail: messages.slice(-3).map(summarizeMessage),
            });
        }
    }

    if (hitIterationCap) {
        logSection("Plan loop reached iteration cap", {
            maxIterations: MAX_ITERATIONS,
            lastAssistantMessage: summarizeMessage(messages[messages.length - 1]),
        });
    }

    logSection("Plan loop finished", {
        planExecuted: true,
        filesTouched: changeLog.map((c) => c.path).filter(Boolean),
        finalError,
    });
    sendSseEvent(state.projectId, { message: "Plan executed successfully" })

    return {
        planExecuted: true,
        toolCalls: [],
        changeSummary: {
            filesChanged: changeLog.map((c) => c.path).filter(Boolean) as string[],
            linesAdded: 0,
            linesRemoved: 0,
        },
        projectContext: {
            ...state.projectContext,
            lastError: finalError,
        },
    };
}



async function dispatchTool(
    toolCall: { name: string; args: Record<string, unknown>; id?: string },
    boundTools: StructuredToolInterface[]
): Promise<string> {
    const matchedTool = boundTools.find((t) => t.name === toolCall.name);

    if (!matchedTool) {
        console.error("[planNode] Unknown tool requested by model:", toolCall.name);
        return `ERROR: unknown tool "${toolCall.name}"`;
    }

    try {
        console.log("[planNode] Invoking tool implementation:", {
            toolName: toolCall.name,
            args: toolCall.args,
        });

        const result = await matchedTool.invoke(toolCall.args);

        // LangChain tools generally return strings already (per your read_file/write_file/executeCommand impls),
        // but we normalize non-string outputs so the next LLM turn always receives a string payload.
        return typeof result === "string" ? result : JSON.stringify(result);
    } catch (err: any) {
        console.error("[planNode] Tool invocation failed:", {
            toolName: toolCall.name,
            error: err?.message ?? String(err),
        });
        return `ERROR: tool "${toolCall.name}" failed - ${err?.message ?? String(err)}`;
    }
}
