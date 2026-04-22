import { auth } from "@v7/auth";
import { env } from "@v7/env/server";
import { toNodeHandler } from "better-auth/node";
import cors from "cors";
import express from "express";
import { chatRouter } from "./routes/chat";

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

app.get("/", (_req, res) => {
  res.status(200).send("OK");
});

app.use("/api/project/", chatRouter);

app.listen(3000, () => {
  console.log("Server is running on http://localhost:3000");
});
