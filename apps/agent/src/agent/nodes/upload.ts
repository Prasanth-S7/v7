import type { WorkflowState } from "../graph";
import { producer } from "@/index";
import { Topics } from "@v7/kafka/topics";

export async function uploadNode(_state: WorkflowState): Promise<Partial<WorkflowState>> {
    console.log("Uploading to S3")

    try {
        await producer.send({
            topic: Topics.UPLOAD_PROJECT,
            messages: [
                {
                    key: _state.projectId,
                    value: JSON.stringify({
                        path: _state.projectContext.rootPath,
                    }),
                },
            ],
        });
    }
    catch (error) {
        console.error("Error uploading to S3", error);
        return {
            uploadStatus: "failed",
        }
    }

    return {
        uploadStatus: "completed",
    }
}
