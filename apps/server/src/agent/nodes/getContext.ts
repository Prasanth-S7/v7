import type { WorkflowState } from "../graph";
import fs from "fs";
import path from "path";

export async function getContext(state: WorkflowState): Promise<Partial<WorkflowState>> {
    const targetDir = path.resolve(process.cwd(), "..", "..", "..", "shared", state.projectId);
    if (!fs.existsSync(targetDir)) {
        console.log("project directory doesn't exist at:", targetDir);
    }
    else {
        console.log("project directory already exists at:", targetDir);
    }

    return {
        initProject: false
    }
}
