import { Router } from "express";
import { randomUUID } from "crypto";
import prisma  from "@v7/db";

export const project: ReturnType<typeof Router> = Router();

project.post("/create", async (req, res) => {
    try {
        const projectId = randomUUID();

        const project = await prisma.project.create({
            data: {
                id: projectId,
            }
        });

        res.status(201).json({ projectId: project.id });
    } catch (err: any) {
        console.error("Failed to create project:", err);
        res.status(500).json({ error: "Failed to create project" });
    }
});