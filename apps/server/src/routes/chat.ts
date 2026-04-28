import { Router } from "express";
import type { Request, Response } from "express";
import { z } from "zod";
import { workflow } from "@/agent/graph";

export const chatRouter: ReturnType<typeof Router> = Router();

const PromptInputSchema = z.object({
    projectId: z.string().describe("The ID of the project"),
    prompt: z.string().describe("The prompt to be processed")
})

chatRouter.post("/", (req: Request, res: Response) => {

    const parsed = PromptInputSchema.safeParse(req.body);

    if(!parsed.success) {
        return res.status(400).json({
            error: "Invalid input",
        })
    }

    const { projectId, prompt } = parsed.data;

    workflow.invoke({
        projectId,
        prompt
    })

    return res.status(200).json({
        projectId,
        prompt
    })

})