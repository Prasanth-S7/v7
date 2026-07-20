import { tool } from "langchain";
import { z } from "zod";
import fs from "fs/promises";
import path from "path";
import { assertInsideRoot } from "../helpers/guardRail";

export function writeFile(projectRoot: string) {
    return tool(
        async ({ filePath, content }: { filePath: string; content: string }) => {
            const absolutePath = path.resolve(projectRoot, filePath);
            assertInsideRoot(absolutePath, projectRoot);
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