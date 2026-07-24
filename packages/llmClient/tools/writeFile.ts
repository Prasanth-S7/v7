import { tool } from "langchain";
import { z } from "zod";
import fs from "fs/promises";
import path from "path";
import {
    assertInsideRoot,
    resolveWorkspacePath,
    resolveWorkspaceRoot,
} from "../helpers/guardRail";

export function writeFile(projectRoot: string) {
    return tool(
        async ({ filePath, content }: { filePath: string; content: string }) => {
            const workspaceRoot = resolveWorkspaceRoot(projectRoot);
            const absolutePath = resolveWorkspacePath(workspaceRoot, filePath);
            assertInsideRoot(absolutePath, workspaceRoot);
            await fs.mkdir(path.dirname(absolutePath), { recursive: true });
            await fs.writeFile(absolutePath, content, "utf-8");
            return `Wrote ${filePath} (${content.length} chars)`;
        },
        {
            name: "write_file",
            description: "Create or overwrite a file with the given content, relative to the project root",
            schema: z.object({
                filePath: z.string().describe("Path to the file, relative to the project root"),
                content: z.string().describe("Full content to write to the file"),
            }),
        }
    );
}
