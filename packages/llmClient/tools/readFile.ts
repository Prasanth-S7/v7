import { tool } from "langchain";
import { z } from "zod";
import fs from "fs/promises";
import path from "path";
import { assertInsideRoot } from "../helpers/guardRail";

export function readFile(projectRoot: string) {
    return tool(
        async ({ filePath }: { filePath: string }) => {
            const absolutePath = path.resolve(projectRoot, filePath);
            assertInsideRoot(absolutePath, projectRoot);

            try {
                return await fs.readFile(absolutePath, "utf-8");
            } catch (err: any) {
                return `ERROR: could not read file "${filePath}" - ${err.message}`;
            }
        },
        {
            name: "read_file",
            description: "Read the contents of a file given its path, relative to the project root",
            schema: z.object({
                filePath: z.string().describe("Path to the file to read, relative to the project root"),
            }),
        }
    );
}