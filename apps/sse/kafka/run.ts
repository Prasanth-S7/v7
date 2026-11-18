import { Topics } from "@v7/kafka/topics";
import { consumer, sendSse } from "../src";

export const run = async () => {
	console.log("SSE server consumer started...");
	await consumer.run({
		eachMessage: async ({ topic, partition, message }) => {
			const value = message.value?.toString();
			switch (topic) {
				case Topics.SSE_EVENT: {
					const projectId = message.key?.toString();
					if (!projectId) {
						console.log("Project id is missing..");
						return;
					}

					const data = JSON.parse(value!);

					console.log(value, projectId);
					sendSse(projectId, data);
					break;
				}
			}
		},
	});
};
