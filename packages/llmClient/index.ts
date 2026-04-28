import { ChatOllama } from '@langchain/ollama';
import { env } from '@v7/env/server';
import { readFile } from './tools/readFile';
import { writeFile } from './tools/writeFile';

export const model = new ChatOllama({
  baseUrl: env.OLLAMA_BASE_URL,
  model: env.MODEL,
  temperature: 0,
});

const TOOLS = [
    readFile,
    writeFile
]

export const toolModel = model.bindTools(TOOLS);