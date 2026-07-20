import { tool } from "langchain";
import { z } from "zod";
import { spawn } from "child_process";
import { parse } from "path";

type ExecuteCommandInput = {
  command: string;
  args?: string[];
  cwd?: string;
  timeoutMs?: number;
};

function runCommand({ command, args = [], cwd = process.cwd(), timeoutMs = 60_000 }: ExecuteCommandInput): Promise<string> {
  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let finished = false;

    console.log('Execute runCommand tool🚨')

    const child = spawn(command, args, {
      cwd,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });

    const timer = setTimeout(() => {
      if (finished) return;
      finished = true;
      child.kill("SIGTERM");
      resolve(
        JSON.stringify({
          success: false,
          command,
          args,
          cwd,
          timeoutMs,
          error: "Command timed out",
          stdout,
          stderr,
        }, null, 2)
      );
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
      resolve(
        JSON.stringify({
          success: false,
          command,
          args,
          cwd,
          error: error.message,
          stdout,
          stderr,
        }, null, 2)
      );
    });

    child.on("close", (code, signal) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      resolve(
        JSON.stringify({
          success: code === 0,
          command,
          args,
          cwd,
          exitCode: code,
          signal,
          stdout,
          stderr,
        }, null, 2)
      );
    });
  });
}

export function executeCommand(projectRoot: string) {
    return tool(
        async ({ command, args = [] }: { command: string; args?: string[] }) => {
            const result = await runCommand({command, args, cwd: projectRoot});
            const parsedResult = JSON.parse(result);
            if (!parsedResult.success) {
                return `ERROR: command failed - ${parsedResult.stderr || parsedResult.error}`;
            }
            return parsedResult.stdout || "Command succeeded";
        },
        {
            name: "execute_command",
            description: "Run a shell command in the project directory (e.g. installing a package). Never use for project scaffolding.",
            schema: z.object({
                command: z.string(),
                args: z.array(z.string()).optional().default([]),
            }),
        }
    );
}