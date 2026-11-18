import prisma from "@v7/db";
import { Topics } from "@v7/kafka/topics";
import { Router } from "express";
import { producer } from "..";
import { requireAuth } from "../middleware/requireAuth";

export const chat: ReturnType<typeof Router> = Router();

chat.post<{ projectId: string }>("/:projectId", requireAuth, async (req, res) => {
	try {
		const { prompt } = req.body;
		if (!prompt) {
			return res.json({
				msg: "Error. Please provide the prompt to continue",
			});
		}
		const projectId = req.params.projectId;
		const project = await prisma.project.findFirst({
			where: {
				id: projectId,
				userId: req.userId,
			},
		});
		if (!project) {
			return res.json({
				msg: "Could not find the project",
			});
		}
		if (project.projectStatus !== "GENERATING") {
			await producer.send({
				topic: Topics.PROMPT,
				messages: [
					{
						key: projectId,
						value: JSON.stringify({ prompt: prompt }),
					},
				],
			});
		} else {
			return res.json({
				msg: "Previous request is not completed",
			});
		}
		return res.json({
			msg: "Running the workflow.....",
		});
	} catch (error) {
		console.log(error);
		return res.json({
			msg: "Error",
		});
	}
});
