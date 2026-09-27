import { createKafkaClient } from "@v7/kafka";
import { Topics } from "@v7/kafka/topics";
import type { EachMessagePayload } from "kafkajs";
import { mkdir, rm, writeFile, readdir, readFile } from "fs/promises";
import path from "path";
import {
    S3Client,
    ListObjectsV2Command,
    GetObjectCommand,
    PutObjectCommand,
} from "@aws-sdk/client-s3";
import { env } from "@v7/env/shared";
import { getProjectDir } from "@v7/env/sharedDir";

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
await consumer.subscribe({
    topic: Topics.UPLOAD_PROJECT,
});

const s3 = new S3Client({
    region: "auto",
    endpoint: env.R2_ENDPOINT,
    credentials: {
        accessKeyId: env.ACCESS_KEY_ID,
        secretAccessKey: env.SECRET_ACCESS_KEY,
    },
});

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

async function uploadS3Folder(bucket: string, prefix: string, sourceDir: string) {
    const normalizedPrefix = normalizePrefix(prefix);

    async function uploadRecursive(currentDir: string, currentPrefix: string) {
        const entries = await readdir(currentDir, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(currentDir, entry.name);
            const s3Key = `${currentPrefix}${entry.name}`;

            if (entry.isDirectory()) {
                await uploadRecursive(fullPath, `${s3Key}/`);
            } else {
                const fileContent = await readFile(fullPath);
                await s3.send(new PutObjectCommand({
                    Bucket: bucket,
                    Key: s3Key,
                    Body: fileContent,
                }));
            }
        }
    }

    await uploadRecursive(sourceDir, normalizedPrefix);
}

const handleProjectCreate = async ({ topic, message }: EachMessagePayload) => {
    if (!message.value) {
        throw new Error("Received empty project creation message");
    }

    const { projectId } = JSON.parse(message.value.toString()) as { projectId?: string };

    if (!projectId) {
        throw new Error("Project creation message did not include a projectId");
    }

    const targetDir = getProjectDir(projectId);

    await rm(targetDir, { recursive: true, force: true });
    await downloadS3Folder(env.TEMPLATE_BUCKET_NAME, env.TEMPLATE_FOLDER_PREFIX, targetDir);

    await producer.send({
        topic: Topics.PROJECT_CREATED,
        messages: [
            {
                value: JSON.stringify({
                    projectId,
                    path: targetDir,
                    success: true
                }),
            },
        ],
    });

    console.log("Project created successfully:", { projectId, targetDir });
};

const handleUploadProject = async ({ topic, message }: EachMessagePayload) => {
    if (!message.key) {
        throw new Error("Project Id is missing");
    }

    const projectId = message.key.toString();

    const targetDir = getProjectDir(projectId);

    await uploadS3Folder(env.TEMPLATE_BUCKET_NAME, `projects/${projectId}`, targetDir);

    console.log("Project uploaded successfully:", { projectId, targetDir });
};

await consumer.run({
    eachMessage: async (payload: EachMessagePayload) => {
        if (payload.topic === Topics.CREATE_PROJECT) {
            await handleProjectCreate(payload);
        }
        if (payload.topic === Topics.UPLOAD_PROJECT) {
            await handleUploadProject(payload);
        }
    },
});
