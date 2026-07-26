import { checkpointer } from "../graph";
import { type RunnableConfig } from "@langchain/core/runnables";

export const loadMemory = async (projectId: string): Promise<any> => {
    const config: RunnableConfig = {
        configurable: {
            thread_id: projectId,
        },
    };

    try {
        const checkpointTuple = await checkpointer.getTuple(config);

        if (!checkpointTuple) {
            console.log(`[loadMemory] No existing memory found for project: ${projectId}`);
            return null;
        }

        console.log(`[loadMemory] Successfully loaded memory for project: ${projectId}`);
        console.log(checkpointTuple)
        return checkpointTuple;
    } catch (error) {
        console.error(`[loadMemory] Error loading memory for project ${projectId}:`, error);
        return null;
    }
};