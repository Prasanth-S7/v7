import { tool } from "langchain";
import { z } from "zod";
import { spawn } from "child_process";

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

export const executeCommand = tool(
  async ({ command, args, cwd, timeoutMs }: ExecuteCommandInput) => {
    try {
      return await runCommand({ command, args, cwd, timeoutMs });
    } catch (err: any) {
      return JSON.stringify(
        {
          success: false,
          command,
          args,
          cwd,
          error: err?.message ?? "Unknown error running command",
        },
        null,
        2
      );
    }
  },
  {
    name: "execute_command",
    description: "Execute a shell command with optional arguments and return stdout, stderr, and exit status",
    schema: z.object({
      command: z.string().min(1).describe("The command to execute, for example: npm"),
      args: z.array(z.string()).optional().describe("Arguments to pass to the command"),
      cwd: z.string().optional().describe("Working directory to run the command in"),
      timeoutMs: z.number().int().positive().optional().describe("Maximum time to wait before killing the command"),
    }),
  }
);
