import { ChatOpenRouter } from "@langchain/openrouter";
import {
  readFile,
  writeFile,
  updateFile,
  replaceInFile,
  deleteFile,
  renameFile,
  grepSearch,
  executeCommand,
} from "./tools";
import { env } from "@v7/env/server";

export const model = new ChatOpenRouter(
  {
    model: env.MODEL,
    apiKey: env.API_KEY,
    temperature: 0.8
  }
);

export const tools = {
  readFile,
  writeFile,
  updateFile,
  replaceInFile,
  deleteFile,
  renameFile,
  grepSearch,
  executeCommand,
}
