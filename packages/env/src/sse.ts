import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    SSE_SERVER_PORT: z.string().default("3002"),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
