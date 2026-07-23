import { createKafkaClient } from "@v7/kafka";
import { Topics } from "@v7/kafka/topics";
import type { EachMessagePayload } from "kafkajs";
import { mkdir, rm, writeFile } from "fs/promises";
import { fileURLToPath } from "url";
import path from "path";
import {
	S3Client,
	ListObjectsV2Command,
	GetObjectCommand,
} from "@aws-sdk/client-s3";
import { env } from "@v7/env/shared";

const kafka = createKafkaClient("workspace-service");

const consumer = kafka.consumer({
    groupId: "workspace-service-group",
});

const producer = kafka.producer();

await producer.connect();
await consumer.connect();

await consumer.subscribe({
    topic: Topics.CREATE_PROJECT,
});

const s3 = new S3Client({
	region: "auto",
	endpoint: env.R2_ENDPOINT,
	credentials: {
		accessKeyId: env.ACCESS_KEY_ID,
		secretAccessKey: env.SECRET_ACCESS_KEY,
	},
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectsRoot = path.resolve(__dirname, "../projects");

function normalizePrefix(prefix: string) {
    const trimmed = prefix.trim().replace(/^\/+/, "").replace(/\/+$/, "");
    return trimmed.length > 0 ? `${trimmed}/` : "";
}

async function downloadS3Folder(bucket: string, prefix: string, targetDir: string) {
    const normalizedPrefix = normalizePrefix(prefix);
    let continuationToken: string | undefined;

    await mkdir(targetDir, { recursive: true });

    do {
        const listed = await s3.send(new ListObjectsV2Command({
            Bucket: bucket,
            Prefix: normalizedPrefix,
            ContinuationToken: continuationToken,
        }));

        continuationToken = listed.NextContinuationToken;

        for (const item of listed.Contents ?? []) {
            const key = item.Key;
            if (!key || key.endsWith("/")) {
                continue;
            }

            const relativePath = key.startsWith(normalizedPrefix)
                ? key.slice(normalizedPrefix.length)
                : key;

            if (!relativePath) {
                continue;
            }

            const destinationPath = path.join(targetDir, relativePath);
            await mkdir(path.dirname(destinationPath), { recursive: true });

            const object = await s3.send(new GetObjectCommand({
                Bucket: bucket,
                Key: key,
            }));

            const body = object.Body as { transformToByteArray?: () => Promise<Uint8Array> } | undefined;
            if (!body?.transformToByteArray) {
                throw new Error(`Failed to read S3 object body for ${key}`);
            }

            const bytes = await body.transformToByteArray();
            await writeFile(destinationPath, bytes);
        }
    } while (continuationToken);
}

const handleProjectCreate = async ({ topic, message }: EachMessagePayload) => {
    if (!message.value) {
        throw new Error("Received empty project creation message");
    }

    const { projectId } = JSON.parse(message.value.toString()) as { projectId?: string };

    if (!projectId) {
        throw new Error("Project creation message did not include a projectId");
    }

    const targetDir = path.join(projectsRoot, projectId);

    console.log(`Received message on topic ${topic}:`, { projectId, targetDir });

    await rm(targetDir, { recursive: true, force: true });
    await downloadS3Folder(env.TEMPLATE_BUCKET_NAME, env.TEMPLATE_FOLDER_PREFIX, targetDir);

    await producer.send({
        topic: Topics.PROJECT_CREATED,
        messages: [
            {
                value: JSON.stringify({
                    projectId,
                    path: targetDir,
                }),
            },
        ],
    });

    console.log("Project created successfully:", { projectId, targetDir });
};

await consumer.run({
    eachMessage: handleProjectCreate,
});
