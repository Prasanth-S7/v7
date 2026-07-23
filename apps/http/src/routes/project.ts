import { Router } from "express";
import { randomUUID } from "crypto";
import prisma  from "@v7/db";
import { producer } from "..";
import { Topics } from "@v7/kafka/topics";

export const project: ReturnType<typeof Router> = Router();

project.post("/create", async (req, res) => {
    try {
        const projectId = randomUUID();

        const project = await prisma.project.create({
            data: {
                id: projectId,
            }
        });

        await producer.send({
            topic: Topics.CREATE_PROJECT,
            messages: [
                { value: JSON.stringify({ projectId }) }
            ]
        })

        res.status(201).json({ projectId: project.id });
    } catch (err: any) {
        console.error("Failed to create project:", err);
        res.status(500).json({ error: "Failed to create project" });
    }
});