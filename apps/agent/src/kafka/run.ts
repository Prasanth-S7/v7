import { consumer } from "..";
import { Topics } from "@v7/kafka/topics";
import { workflow } from "@/agent/graph";
import { checkpointer } from "@/agent/graph";
import { logger } from "..";

export const run = async () => {
    logger.info("Agent service consumer started...")
    await consumer.run({
        eachMessage: async ({ topic, message }) => {
            try {
                switch (topic) {
                    case Topics.PROMPT: {
                        const projectId = message.key?.toString();
                        if (!projectId) {
                            logger.warn("Project id is missing..");
                            return;
                        }
                        const value = message.value?.toString();
                        if (!value) {
                            logger.warn("Message value is missing..");
                            return;
                        }
                        const { prompt } = JSON.parse(value);

                        logger.info({ prompt }, "Received prompt:");

                        if (!prompt) {
                            logger.warn("Prompt is missing..");
                            return;
                        }

                        logger.info("Invoking workflow....");

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

                        // console.dir(checkpoint, { depth: null });
                        break;
                    }
                }
            } catch (error) {
                logger.error({ err: error }, "Error processing message:");
            }
        },
    });
}
