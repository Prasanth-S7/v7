import { tool } from "langchain";
import { z } from "zod";
import { spawn } from "child_process";
import { resolveWorkspaceRoot } from "../helpers/guardRail";

type GrepSearchInput = {
    query: string;
    filePattern?: string;
    caseSensitive?: boolean;
    maxResults?: number;
};

function runGrepSearch({
    query,
    filePattern,
    caseSensitive = true,
    maxResults = 50,
    cwd = process.cwd(),
}: GrepSearchInput & { cwd?: string }): Promise<string> {
    return new Promise((resolve) => {
        const args = [
            "--line-number",
            "--column",
            "--no-heading",
            "--color",
            "never",
            "--max-count",
            String(maxResults),
        ];

        if (!caseSensitive) {
            args.push("-i");
        }

        if (filePattern) {
            args.push("-g", filePattern);
        }

        args.push(query, ".");

        let stdout = "";
        let stderr = "";

        const child = spawn("rg", args, {
            cwd,
            shell: false,
            stdio: ["ignore", "pipe", "pipe"],
        });

        child.stdout?.on("data", (chunk) => {
            stdout += chunk.toString();
        });

        child.stderr?.on("data", (chunk) => {
            stderr += chunk.toString();
        });

        child.on("error", (error) => {
            resolve(
                JSON.stringify(
                    {
                        success: false,
                        error: error.message,
                        stdout,
                        stderr,
                    },
                    null,
                    2
                )
            );
        });

        child.on("close", (code) => {
            if (code === 0 || code === 1) {
                resolve(
                    JSON.stringify(
                        {
                            success: true,
                            matches: stdout.trim(),
                            stderr: stderr.trim(),
                        },
                        null,
                        2
                    )
                );
                return;
            }

            resolve(
                JSON.stringify(
                    {
                        success: false,
                        exitCode: code,
                        stdout,
                        stderr,
                    },
                    null,
                    2
                )
            );
        });
    });
}

export function grepSearch(projectRoot: string) {
    return tool(
        async ({
            query,
            filePattern,
            caseSensitive = true,
            maxResults = 50,
        }: GrepSearchInput) => {
            const workspaceRoot = resolveWorkspaceRoot(projectRoot);
            const result = await runGrepSearch({
                query,
                filePattern,
                caseSensitive,
                maxResults,
                cwd: workspaceRoot,
            });

            const parsedResult = JSON.parse(result);

            if (!parsedResult.success) {
                return `ERROR: search failed - ${parsedResult.stderr || parsedResult.error || "unknown error"}`;
            }

            return parsedResult.matches || "No matches found";
        },
        {
            name: "grep_search",
            description: "Search for a string pattern across files in the project directory using ripgrep",
            schema: z.object({
                query: z.string().describe("Text or pattern to search for"),
                filePattern: z
                    .string()
                    .optional()
                    .describe("Optional glob pattern to limit which files are searched, e.g. '*.ts'"),
                caseSensitive: z
                    .boolean()
                    .optional()
                    .default(true)
                    .describe("Whether the search should be case sensitive"),
                maxResults: z
                    .number()
                    .int()
                    .positive()
                    .optional()
                    .default(50)
                    .describe("Maximum number of matches to return"),
            }),
        }
    );
}
