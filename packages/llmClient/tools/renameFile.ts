import { tool } from "langchain";
import { z } from "zod";
import fs from "fs/promises";
import path from "path";
import { assertInsideRoot } from "../helpers/guardRail";

export function renameFile(projectRoot: string) {
    return tool(
        async ({ fromPath, toPath }: { fromPath: string; toPath: string }) => {
            const absoluteFromPath = path.resolve(projectRoot, fromPath);
            const absoluteToPath = path.resolve(projectRoot, toPath);

            assertInsideRoot(absoluteFromPath, projectRoot);
            assertInsideRoot(absoluteToPath, projectRoot);

            try {
                await fs.mkdir(path.dirname(absoluteToPath), { recursive: true });
                await fs.rename(absoluteFromPath, absoluteToPath);
                return `Renamed ${fromPath} to ${toPath}`;
            } catch (err: any) {
                return `ERROR: could not rename file "${fromPath}" to "${toPath}" - ${err.message}`;
            }
        },
        {
            name: "rename_file",
            description: "Rename or move a file within the project root",
            schema: z.object({
                fromPath: z.string().describe("Current path to the file, relative to the project root"),
                toPath: z.string().describe("New path for the file, relative to the project root"),
            }),
        }
    );
}
