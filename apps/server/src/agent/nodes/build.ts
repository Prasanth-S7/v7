import type { WorkflowState } from "../graph";

export async function buildNode (_state: WorkflowState): Promise<Partial<WorkflowState>> {
    console.log("Reaches build step")
    return {
        buildStatus: "completed",
    }
}
