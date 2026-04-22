import * as z from "zod"
import { tool } from "langchain"
import * as fs from "fs/promises"

const ReadFileInputSchema = z.object({
    filePath: z.string().describe("The path to file to be read")
})

export const readFile = tool(
    async ({ filePath }: z.infer<typeof ReadFileInputSchema>) => {
        try {
            const content = await fs.readFile(filePath, "utf-8")
            return content
        } catch (error) {
            return `Error reading file: ${error instanceof Error ? error.message : String(error)}`
        }
    },
    {
        name: "readFile",
        description: "Reads the content of a file given its path",
        schema: ReadFileInputSchema
    }
)