import { tool } from "langchain";
import { z } from "zod";
import fs from "fs/promises";
import {
    assertInsideRoot,
    resolveWorkspacePath,
    resolveWorkspaceRoot,
} from "../helpers/guardRail";

type ReplaceInFileInput = {
    filePath: string;
    search: string;
    replaceWith: string;
    replaceAll?: boolean;
};

function replaceSimpleStrings(content: string, search: string, replaceWith: string, replaceAll: boolean) {
    if (search === "") {
        return { content, replacedCount: 0 };
    }

    if (replaceAll) {
        let replacedCount = 0;
        let nextContent = content;
        while (nextContent.includes(search)) {
            nextContent = nextContent.replace(search, replaceWith);
            replacedCount += 1;
        }
        return { content: nextContent, replacedCount };
    }

    const index = content.indexOf(search);
    if (index === -1) {
        return { content, replacedCount: 0 };
    }

    return {
        content: content.slice(0, index) + replaceWith + content.slice(index + search.length),
        replacedCount: 1,
    };
}

export function replaceInFile(projectRoot: string) {
    return tool(
        async ({ filePath, search, replaceWith, replaceAll = false }: ReplaceInFileInput) => {
            const workspaceRoot = resolveWorkspaceRoot(projectRoot);
            const absolutePath = resolveWorkspacePath(workspaceRoot, filePath);
            assertInsideRoot(absolutePath, workspaceRoot);

            try {
                const currentContent = await fs.readFile(absolutePath, "utf-8");
                const { content: nextContent, replacedCount } = replaceSimpleStrings(
                    currentContent,
                    search,
                    replaceWith,
                    replaceAll
                );

                if (replacedCount === 0) {
                    return `No matches for "${search}" in ${filePath}`;
                }

                await fs.writeFile(absolutePath, nextContent, "utf-8");
                return `Updated ${filePath} (${replacedCount} replacement${replacedCount === 1 ? "" : "s"})`;
            } catch (err: any) {
                return `ERROR: could not replace in file "${filePath}" - ${err.message}`;
            }
        },
        {
            name: "replace_in_file",
            description: "Replace simple string text inside a file, relative to the project root",
            schema: z.object({
                filePath: z.string().describe("Path to the file to modify, relative to the project root"),
                search: z.string().describe("Exact string to search for"),
                replaceWith: z.string().describe("String to replace it with"),
                replaceAll: z.boolean().optional().default(false).describe("Whether to replace every match instead of only the first"),
            }),
        }
    );
}
