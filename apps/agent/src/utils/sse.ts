import { Topics } from "@v7/kafka/topics";
import { producer } from "../index";

export async function sendSseEvent(projectId: string, data: { message: string }) {
	try {
		await producer.send({
			topic: Topics.SSE_EVENT,
			messages: [
				{
					key: projectId,
					value: JSON.stringify(data),
				},
			],
		});
	} catch (error) {
		console.error("Failed to send SSE event:", error);
	}
}
