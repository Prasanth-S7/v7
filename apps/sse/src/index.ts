import type { Request, Response } from "express";
import express from "express";
import { createKafkaClient } from "@v7/kafka";
import { Topics } from "@v7/kafka/topics";
import { run } from "../kafka/run";
import { env } from "@v7/env/sse"

const app = express();

const connections = new Map<string, Set<Response>>();

const kafka = createKafkaClient("sse-service");

export function sendSse(projectId: string, data: unknown) {
  const clients = connections.get(projectId);
  if (!clients) return;
  for (const client of clients) {
    client.write(`data: ${JSON.stringify(data)}\n\n`);
  }
}

export const consumer = kafka.consumer({
    groupId: "sse-service-group",
});

await consumer.connect();

await consumer.subscribe({
    topic: Topics.SSE_EVENT,
});

run();

app.get("/events", (req: Request, res: Response) => {
  const projectId = req.query.projectId as string;

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  if (!connections.has(projectId)) {
    connections.set(projectId, new Set());
  }
  connections.get(projectId)!.add(res);

  req.on("close", () => {
    const clients = connections.get(projectId);
    if (!clients) return;
    clients.delete(res);
    if (clients.size === 0) {
      connections.delete(projectId);
    }
  });
});

app.post("/emit", (req: Request, res: Response) => {
  const projectId = req.query.projectId as string;
  const { event, data } = req.body || {};

  const clients = connections.get(projectId);
  if (!clients) {
    res.status(404).json({ error: "No clients for this project" });
    return;
  }

  for (const client of clients) {
    client.write(`event: ${event ?? "message"}\ndata: ${JSON.stringify(data)}\n\n`);
  }

  res.json({ sent: clients.size });
});

app.get("/", (_req: Request, res: Response) => {
  res.json({ msg: "SSE server is healthy" });
});

app.listen(env.SSE_SERVER_PORT, () => {
  console.log(`SSE server running at http://localhost:${env.SSE_SERVER_PORT}`);
});
