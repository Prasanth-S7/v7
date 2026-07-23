import express from 'express';
import cors from 'cors'
import { project } from './routes/project';
import { env } from '@v7/env/http';
import { createKafkaClient } from '@v7/kafka';

const app = express();

app.use(cors());

const kafka = createKafkaClient("project-service");
export const producer = kafka.producer();

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

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
})

app.use('/project', project);

app.listen(env.HTTP_SERVER_PORT, () => {
    console.log(`HTTP server is running on http://localhost:${env.HTTP_SERVER_PORT}`)
})