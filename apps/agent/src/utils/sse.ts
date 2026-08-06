import { producer } from "../index";
import { Topics } from "@v7/kafka/topics";

export async function sendSseEvent(projectId: string, data: any) {
    try {
        await producer.send({
            topic: Topics.SSE_EVENT,
            messages: [{
                key: projectId,
                value: JSON.stringify(data)
            }]
        });
    } catch (error) {
        console.error("Failed to send SSE event:", error);
    }
}