import express from 'express';
import cors from 'cors'
import { project } from './routes/project';
import { env } from '@v7/env/http';
import { createKafkaClient } from '@v7/kafka';
import { Topics } from '@v7/kafka/topics';
import { run } from './kafka/run';

const app = express();

app.use(cors());

const kafka = createKafkaClient("project-service");
export const producer = kafka.producer();
export const consumer = kafka.consumer({
    groupId: "project-service-group"
});

await consumer.connect();

await consumer.subscribe({
    topic: Topics.PROJECT_CREATED,
});

run();

const createConnection = async () => {
    try {
        await producer.connect();
        console.log("Kafka producer connected");
    }
    catch (err) {
        console.error("Failed to connect Kafka producer:", err);
    }
}
createConnection();

app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
})

app.use('/api/project', project);

app.listen(env.HTTP_SERVER_PORT, () => {
    console.log(`HTTP server is running on http://localhost:${env.HTTP_SERVER_PORT}`)
})