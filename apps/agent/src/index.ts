import { createKafkaClient } from "@v7/kafka";
import { Topics } from "@v7/kafka/topics";
import { run } from "./kafka/run";

const kafka = createKafkaClient("agent-service");
export const producer = kafka.producer();
export const consumer = kafka.consumer({
    groupId: "agent-service-group"
});

async function connectKafka() {
    await consumer.connect();
    await producer.connect();
    await consumer.subscribe({
        topic: Topics.PROMPT,
        fromBeginning: true
    });
    await run();
}

connectKafka();
