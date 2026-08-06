import { consumer } from "..";
import { Topics } from "@v7/kafka/topics";
import { workflow } from "@/agent/graph";
import { checkpointer } from "@/agent/graph";

export const run = async () => {
    console.log("Agent service consumer started listening.......")
    await consumer.run({
        eachMessage: async ({ topic, message }) => {
            try {
                console.log("Received a message", topic, message)
                switch (topic) {
                    case Topics.PROMPT: {
                        const projectId = message.key?.toString();
                        if (!projectId) {
                            console.log("Project id is missing..");
                            return;
                        }
                        const value = message.value?.toString();
                        if (!value) {
                            console.log("Message value is missing..");
                            return;
                        }
                        const { prompt } = JSON.parse(value);
                        if (!prompt) {
                            console.log("Prompt is missing..");
                            return;
                        }

                        console.log("Invoking workflow....")

                        await workflow.invoke({
                            projectId,
                            prompt,
                        }, {
                            configurable: {
                                thread_id: projectId
                            }
                        });

                        const checkpoint = await checkpointer.getTuple({
                            configurable: {
                                thread_id: projectId,
                            },
                        });

                        console.dir(checkpoint, { depth: null });
                        break;
                    }
                }
            } catch (error) {
                console.error("Error processing message:", error);
            }
        },
    });
}
