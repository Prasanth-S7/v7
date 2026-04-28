import { tool } from "langchain";
import { z } from "zod";
import fs from "fs/promises";
import path from "path";

export const writeFile = tool(
  async ({ filePath, content }: {
    filePath: string;
    content: string;
  }) => {
    try {
      const absolutePath = path.resolve(filePath);

      await fs.writeFile(absolutePath, content, "utf-8");

      return `File written successfully: ${absolutePath}`;
    } catch (err: any) {
      return `Error writing file: ${err.message}`;
    }
  },
  {
    name: "write_file",
    description: "Write content to a file given its path",
    schema: z.object({
      filePath: z.string().describe("Path to the file to write"),
      content: z.string().describe("Content to write to the file"),
    }),
  }
);