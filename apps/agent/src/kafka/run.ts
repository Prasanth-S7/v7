import { consumer } from "..";
import { Topics } from "@v7/kafka/topics";
import { workflow } from "@/agent/graph";
import { checkpointer } from "@/agent/graph";

export const run = async () => {
    console.log("Agent service consumer started listening.......")
    await consumer.run({
    eachMessage: async ({ topic, message }) => {
        switch (topic) {
            case Topics.PROMPT: {
                const projectId = message.key?.toString();

                if (!projectId) {
                    throw new Error("Project ID missing from Kafka message key");
                }

                const { prompt } = JSON.parse(message.value!.toString());

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
    },
});
}
