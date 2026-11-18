import { createKafkaClient } from "@v7/kafka";
import { Topics } from "@v7/kafka/topics";
import pino from "pino";
import { run } from "./kafka/run";

export const logger = pino({
	level: "info",
	transport: {
		target: "pino-pretty",
		options: {
			colorize: true,
			translateTime: "yyyy-mm-dd HH:MM:ss",
			ignore: "pid,hostname",
		},
	},
});

const kafka = createKafkaClient("agent-service");
export const producer = kafka.producer();
export const consumer = kafka.consumer({
	groupId: "agent-service-group",
});

async function connectKafka() {
	await consumer.connect();
	await producer.connect();
	await consumer.subscribe({
		topic: Topics.PROMPT,
		fromBeginning: true,
	});
	await run();
}

connectKafka();
