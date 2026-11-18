import { ChatOpenRouter } from "@langchain/openrouter";
import { env } from "@v7/env/llm";
import {
	deleteFile,
	executeCommand,
	grepSearch,
	readFile,
	renameFile,
	replaceInFile,
	updateFile,
	writeFile,
} from "./tools";

export const model = new ChatOpenRouter({
	model: env.MODEL,
	apiKey: env.API_KEY,
	temperature: 0.8,
});

export const tools = {
	readFile,
	writeFile,
	updateFile,
	replaceInFile,
	deleteFile,
	renameFile,
	grepSearch,
	executeCommand,
};
