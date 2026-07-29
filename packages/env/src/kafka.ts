import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    KAFKA_BROKER: z.string().default("localhost:9092"),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
