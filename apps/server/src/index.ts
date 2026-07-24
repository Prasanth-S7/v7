import { auth } from "@v7/auth";
import { env } from "@v7/env/server";
import { toNodeHandler } from "better-auth/node";
import cors from "cors";
import express from "express";
import { createKafkaClient } from "@v7/kafka";
import { Topics } from "@v7/kafka/topics";
import { run } from "./kafka/run";

const app = express();

app.use(
  cors({
    origin: env.CORS_ORIGIN,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  }),
);

app.all("/api/auth{/*path}", toNodeHandler(auth));

app.use(express.json());

const kafka = createKafkaClient("agent-service");
export const producer = kafka.producer();
export const consumer = kafka.consumer({
    groupId: "agent-service-group"
});

await consumer.connect();

await consumer.subscribe({
    topic: Topics.PROMPT
});

run();

app.get("/", (_req, res) => {
  res.status(200).send("OK");
});

app.listen(3000, () => {
  console.log("Server is running on http://localhost:3000");
});
