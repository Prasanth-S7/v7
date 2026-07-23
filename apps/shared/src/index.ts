import { createKafkaClient } from "@v7/kafka";
import { Topics } from "@v7/kafka/topics";
import type { EachMessagePayload } from "kafkajs";
import { cp, mkdir, mkdtemp, readdir, rm, writeFile } from "fs/promises";
import { fileURLToPath } from "url";
import os from "os";
import path from "path";
import { spawn } from "child_process";

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

const templateArchiveUrl =
    process.env.PROJECT_TEMPLATE_ZIP_URL ??
    process.env.PROJECT_TEMPLATE_URL ??
    process.env.R2_TEMPLATE_URL;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectsRoot = path.resolve(__dirname, "../projects");

function runCommand(command: string, args: string[]) {
    return new Promise<void>((resolve, reject) => {
        const child = spawn(command, args, {
            stdio: "inherit",
        });

        child.on("error", reject);
        child.on("close", (code) => {
            if (code === 0) {
                resolve();
                return;
            }

            reject(new Error(`${command} exited with code ${code ?? "unknown"}`));
        });
    });
}

async function extractTemplateArchive(archivePath: string, targetDir: string) {
    const extractDir = await mkdtemp(path.join(os.tmpdir(), "v7-project-template-"));

    try {
        await runCommand("unzip", ["-oq", archivePath, "-d", extractDir]);

        const topLevelEntries = await readdir(extractDir, { withFileTypes: true });
        const sourceDir =
            topLevelEntries.length === 1 && topLevelEntries[0]?.isDirectory()
                ? path.join(extractDir, topLevelEntries[0].name)
                : extractDir;

        const entries = await readdir(sourceDir, { withFileTypes: true });
        await mkdir(targetDir, { recursive: true });

        for (const entry of entries) {
            const sourcePath = path.join(sourceDir, entry.name);
            const destinationPath = path.join(targetDir, entry.name);
            await cp(sourcePath, destinationPath, { recursive: true, force: true });
        }
    } finally {
        await rm(extractDir, { recursive: true, force: true });
    }
}

const handleProjectCreate = async ({ topic, message }: EachMessagePayload) => {
    if (!message.value) {
        throw new Error("Received empty project creation message");
    }

    if (!templateArchiveUrl) {
        throw new Error("Missing project template archive URL. Set PROJECT_TEMPLATE_ZIP_URL, PROJECT_TEMPLATE_URL, or R2_TEMPLATE_URL.");
    }

    const { projectId } = JSON.parse(message.value.toString()) as { projectId?: string };

    if (!projectId) {
        throw new Error("Project creation message did not include a projectId");
    }

    const targetDir = path.join(projectsRoot, projectId);

    console.log(`Received message on topic ${topic}:`, { projectId, targetDir });

    const response = await fetch(templateArchiveUrl);
    if (!response.ok || !response.body) {
        throw new Error(`Failed to fetch project template archive: ${response.status} ${response.statusText}`);
    }

    const archiveDir = await mkdtemp(path.join(os.tmpdir(), "v7-project-archive-"));
    const archivePath = path.join(archiveDir, "template.zip");

    try {
        const archiveBytes = await response.arrayBuffer();
        await writeFile(archivePath, new Uint8Array(archiveBytes));

        await rm(targetDir, { recursive: true, force: true });
        await mkdir(targetDir, { recursive: true });
        await extractTemplateArchive(archivePath, targetDir);

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
    } finally {
        await rm(archiveDir, { recursive: true, force: true });
    }
};

await consumer.run({
    eachMessage: handleProjectCreate,
});
