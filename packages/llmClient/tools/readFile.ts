import { tool } from "langchain";
import { z } from "zod";
import fs from "fs/promises";
import path from "path";

export const readFile = tool(
  async ({ filePath }: {
    filePath: string;
  }) => {
    try {
      const absolutePath = path.resolve(filePath);

      const content = await fs.readFile(absolutePath, "utf-8");

      return content;
    } catch (err: any) {
      return `Error reading file: ${err.message}`;
    }
  },
  {
    name: "read_file",
    description: "Read the contents of a file given its path",
    schema: z.object({
      filePath: z.string().describe("Path to the file to read"),
    }),
  }
);