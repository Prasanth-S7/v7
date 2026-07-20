import type { WorkflowState } from "../graph";
import { spawn } from "child_process";
import { mkdir, writeFile as writeFileToDisk } from "fs/promises";
import path from "path";

type ToolCall = {
    tool: string;
    parameters?: {
        command?: string;
        args?: string[];
        cwd?: string;
        timeoutMs?: number;
        [key: string]: unknown;
    };
    reason?: string;
};

function runCommand(command: string, args: string[] = [], cwd = process.cwd(), timeoutMs = 60_000) {
    return new Promise<{
        success: boolean;
        command: string;
        args: string[];
        cwd: string;
        timeoutMs: number;
        exitCode?: number | null;
        signal?: NodeJS.Signals | null;
        stdout: string;
        stderr: string;
        error?: string;
    }>((resolve) => {
        let stdout = "";
        let stderr = "";
        let finished = false;

        const child = spawn(command, args, {
            cwd,
            shell: false,
            stdio: ["ignore", "pipe", "pipe"],
        });

        const timer = setTimeout(() => {
            if (finished) return;
            finished = true;
            child.kill("SIGTERM");
            resolve({
                success: false,
                command,
                args,
                cwd,
                timeoutMs,
                error: "Command timed out",
                stdout,
                stderr,
            });
        }, timeoutMs);

        child.stdout?.on("data", (chunk) => {
            stdout += chunk.toString();
        });

        child.stderr?.on("data", (chunk) => {
            stderr += chunk.toString();
        });

        child.on("error", (error) => {
            if (finished) return;
            finished = true;
            clearTimeout(timer);
            resolve({
                success: false,
                command,
                args,
                cwd,
                timeoutMs,
                error: error.message,
                stdout,
                stderr,
            });
        });

        child.on("close", (code, signal) => {
            if (finished) return;
            finished = true;
            clearTimeout(timer);
            resolve({
                success: code === 0,
                command,
                args,
                cwd,
                timeoutMs,
                exitCode: code,
                signal,
                stdout,
                stderr,
            });
        });
    });
}

async function runWriteFile(
    filePath: string,
    content: string,
    cwd = process.cwd(),
    timeoutMs = 60_000
) {
    const targetPath = path.isAbsolute(filePath) ? filePath : path.resolve(cwd, filePath);
    await mkdir(path.dirname(targetPath), { recursive: true });
    await writeFileToDisk(targetPath, content, "utf-8");

    return {
        success: true,
        command: "write_file",
        args: [targetPath, content],
        cwd,
        timeoutMs,
        exitCode: 0,
        stdout: "",
        stderr: "",
        targetPath,
    };
}

export async function executeNode (state: WorkflowState): Promise<Partial<WorkflowState>> {
    console.log("Reaches execute Node")
    const toolCalls = (state.toolCalls ?? []) as ToolCall[];
    const commandCalls = toolCalls.filter((call) => call.tool === "execute_command");
    let currentCwd = process.cwd();

    const results = [];
    for (const call of commandCalls) {
        const parameters = call.parameters ?? {};
        const command = parameters.command;
        if (!command) {
            results.push({
                success: false,
                error: "Missing command for execute_command tool call",
                call,
            });
            continue;
        }

        const args = Array.isArray(parameters.args) ? parameters.args : [];
        const cwd = typeof parameters.cwd === "string" && parameters.cwd.length > 0
            ? parameters.cwd
            : currentCwd;
        const timeoutMs = typeof parameters.timeoutMs === "number" ? parameters.timeoutMs : 60_000;

        if (command === "write_file") {
            const filePath = args[0];
            const content = args[1];

            if (!filePath || typeof filePath !== "string") {
                const result = {
                    success: false,
                    command,
                    args,
                    cwd,
                    timeoutMs,
                    error: "write_file requires a target file path",
                    stdout: "",
                    stderr: "",
                };
                results.push(result);
                console.error("Command failed:", result);
                throw new Error("Command failed: write_file requires a target file path");
            }

            if (typeof content !== "string") {
                const result = {
                    success: false,
                    command,
                    args,
                    cwd,
                    timeoutMs,
                    error: "write_file requires file contents",
                    stdout: "",
                    stderr: "",
                };
                results.push(result);
                console.error("Command failed:", result);
                throw new Error("Command failed: write_file requires file contents");
            }

            console.log("Writing file:", { filePath, cwd, timeoutMs, reason: call.reason });
            const result = await runWriteFile(filePath, content, cwd, timeoutMs);
            results.push(result);
            console.log("File write completed:", result.targetPath);
            continue;
        }

        if (command === "cd") {
            const target = args[0];
            if (!target) {
                const result = {
                    success: false,
                    command,
                    args,
                    cwd,
                    timeoutMs,
                    error: "cd requires a target directory",
                    stdout: "",
                    stderr: "",
                };
                results.push(result);
                console.error("Command failed:", result);
                throw new Error("Command failed: cd requires a target directory");
            }

            currentCwd = path.resolve(cwd, target);
            const result = {
                success: true,
                command,
                args,
                cwd,
                timeoutMs,
                stdout: "",
                stderr: "",
                exitCode: 0,
            };
            results.push(result);
            console.log("Updated working directory:", currentCwd);
            continue;
        }

        console.log("Running command:", { command, args, cwd, timeoutMs, reason: call.reason });
        const result = await runCommand(command, args, cwd, timeoutMs);
        results.push(result);

        if (!result.success) {
            console.error("Command failed:", result);
            throw new Error(
                `Command failed: ${command} ${args.join(" ")} in ${cwd}${result.error ? ` - ${result.error}` : ""}`
            );
        }
    }

    console.log("Execution results:", results);

    return {
        fixAttempts: (state.fixAttempts ?? 0) + 1,
        changeSummary: {
            filesChanged: [],
            linesAdded: 0,
            linesRemoved: 0,
        },
        toolCalls: [],
    }
}
