import { Kafka } from "kafkajs";

export type { Consumer, Producer } from "kafkajs";

import { env } from "@v7/env/kafka";

export const createKafkaClient = (clientId: string) => {
	return new Kafka({
		clientId,
		brokers: [env.KAFKA_BROKER],
	});
};
