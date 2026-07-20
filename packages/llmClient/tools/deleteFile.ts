import { tool } from "langchain";
import { z } from "zod";
import fs from "fs/promises";
import path from "path";
import { assertInsideRoot } from "../helpers/guardRail";

export function deleteFile(projectRoot: string) {
    return tool(
        async ({ filePath }: { filePath: string }) => {
            const absolutePath = path.resolve(projectRoot, filePath);
            assertInsideRoot(absolutePath, projectRoot);

            try {
                await fs.unlink(absolutePath);
                return `Deleted ${filePath}`;
            } catch (err: any) {
                return `ERROR: could not delete file "${filePath}" - ${err.message}`;
            }
        },
        {
            name: "delete_file",
            description: "Delete a file given its path, relative to the project root",
            schema: z.object({
                filePath: z.string().describe("Path to the file to delete, relative to the project root"),
            }),
        }
    );
}
