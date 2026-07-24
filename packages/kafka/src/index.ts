import { Kafka } from "kafkajs";
export type { Producer, Consumer } from "kafkajs";

export const createKafkaClient = (clientId: string) => {
    return new Kafka({
        clientId,
        brokers: ["localhost:9092"]
    })
}