import { Router } from "express";
import prisma  from "@v7/db";
import { producer } from "..";
import { Topics } from "@v7/kafka/topics";

export const chat: ReturnType<typeof Router> = Router();

chat.post("/:projectId", async (req, res) => {
    try{
        const { prompt } = req.body;
        if(!prompt){
            return res.json({
                msg: "Error. Please provide the prompt to continue"
            })
        }
        const projectId = req.params.projectId;
        const project = await prisma.project.findFirst({
            where: {
                id: projectId
            }
        })
        if(!project){
            return res.json({
                msg: "Could not find the project"
            })
        }
        await producer.send({
            topic: Topics.CREATE_PROJECT,
            messages: [
                {   
                    key: projectId,
                    value: JSON.stringify({ prompt: prompt })
                }
            ]
        })
    }
    catch(error){
        console.log(error)
        return res.json({
            msg: "Error"
        })
    }
})