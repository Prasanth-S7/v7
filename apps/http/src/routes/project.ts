import { Router } from "express";
import { randomUUID } from "crypto";
import prisma from "@v7/db";
import { producer } from "..";
import { Topics } from "@v7/kafka/topics";
import { requireAuth } from "../middleware/requireAuth";

export const project: ReturnType<typeof Router> = Router();

project.get("/", requireAuth, async (req, res) => {
    try {
        const projects = await prisma.project.findMany({
            where: {
                userId: req.userId,
            },
            select: {
                id: true,
                name: true,
                projectStatus: true,
                createdAt: true,
            },
            orderBy: { createdAt: "desc" },
        });

        res.status(200).json({ projects });
    } catch (err: any) {
        console.error("Failed to fetch projects:", err);
        res.status(500).json({ error: "Failed to fetch projects" });
    }
});

project.post("/create", requireAuth, async (req, res) => {
    try {
        const { name } = req.body;
        const projectId = randomUUID();

        const project = await prisma.project.create({
            data: {
                id: projectId,
                userId: req.userId!,
                name: name || null,
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