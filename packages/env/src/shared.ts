import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    R2_ENDPOINT: z.string(),
    ACCESS_KEY_ID: z.string(),
    SECRET_ACCESS_KEY: z.string(),
    TEMPLATE_BUCKET_NAME: z.string().min(1),
    TEMPLATE_FOLDER_PREFIX: z.string().min(1),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
