import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().min(1),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.url(),
    CORS_ORIGIN: z.url(),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    OLLAMA_BASE_URL: z.url().default("http://localhost:11434"),
    MODEL: z.string(),
    API_KEY: z.string().min(1),
    SHARED_DIR: z.string().default("/home/prasanth/shared"),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
