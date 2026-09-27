import { consumer, producer } from "..";
import { Topics } from "@v7/kafka/topics";
import prisma from "@v7/db";

export const run = async () => {
    console.log("Run function triggerssssssss")
    await consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
            const value = message.value?.toString();
            switch (topic) {
                case Topics.PROJECT_CREATED: {
                    if (!value) {
                        console.log("Project creation failed..")
                        await producer.send({
                            topic: Topics.SSE_EVENT,
                            messages: [{
                                key: "",
                                value: JSON.stringify({ message: "Project creation failed" })
                            }]
                        });
                        return
                    }
                    const msg = JSON.parse(value!);
                    if (msg.success) {
                        const res = await prisma.project.update({
                            where: {
                                id: msg.projectId
                            },
                            data: {
                                initialised: true
                            }
                        })
                    }
                    await producer.send({
                        topic: Topics.SSE_EVENT,
                        messages: [{
                            key: msg.projectId,
                            value: JSON.stringify({ message: "Project created successfully" })
                        }]
                    })
                }
            }
        },
    })
}
