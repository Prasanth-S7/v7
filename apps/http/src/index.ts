import express from 'express';
import cors from 'cors'
import { project } from './routes/project';
import { env } from '@v7/env/http';
import { createKafkaClient } from '@v7/kafka';
import { Topics } from '@v7/kafka/topics';
import { run } from './kafka/run';
import { chat } from './routes/chat';
import { auth } from "@v7/auth";
import { env as serverEnv } from "@v7/env/server";
import { toNodeHandler } from "better-auth/node";

const app = express();
app.use(express.json())
app.use(
  cors({
    origin: serverEnv.CORS_ORIGIN,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  }),
);

const kafka = createKafkaClient("project-service");
export const producer = kafka.producer();
export const consumer = kafka.consumer({
    groupId: "project-service-group"
});

async function connectKafka(){
    await consumer.connect();
    await consumer.subscribe({
        topic: Topics.PROJECT_CREATED,
    });
    await run();
}
connectKafka();

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

app.all("/api/auth{/*path}", toNodeHandler(auth));

app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
})

app.use('/api/project', project);
app.use('/api/chat', chat);

app.listen(env.HTTP_SERVER_PORT, () => {
    console.log(`HTTP server is running on http://localhost:${env.HTTP_SERVER_PORT}`)
})