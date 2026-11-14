import { type WorkflowState } from "../graph";
import fs from "fs/promises";
import path from "path";
import { getProjectDir, resolveWorkspaceRoot } from "@v7/env/sharedDir";
import { sendSseEvent } from "@/utils/sse";
import { logger } from "@/index";

type ListFilesOptions = {
    ignore?: string[];
    maxFiles?: number;
};

export async function listFilesRecursive(
    rootPath: string,
    options: ListFilesOptions = {}
): Promise<string[]> {
    const ignore = new Set(options.ignore ?? ["node_modules", "dist", "build", ".git", ".next", "coverage"]);
    const maxFiles = options.maxFiles ?? 2000;

    const results: string[] = [];

    async function walk(currentDir: string): Promise<void> {
        if (results.length >= maxFiles) return;

        let entries;
        try {
            entries = await fs.readdir(currentDir, { withFileTypes: true });
        } catch (err) {
            return;
        }

        for (const entry of entries) {
            if (results.length >= maxFiles) return;

            if (ignore.has(entry.name)) continue;
            if (entry.name.startsWith(".") && !ALLOWED_DOTFILES.has(entry.name)) continue;

            const fullPath = path.join(currentDir, entry.name);

            if (entry.isDirectory()) {
                await walk(fullPath);
            } else if (entry.isFile()) {
                const relativePath = path.relative(rootPath, fullPath);
                results.push(relativePath);
            }
        }
    }

    const ALLOWED_DOTFILES = new Set([".env.example", ".gitignore", ".eslintrc"]);

    await walk(rootPath);
    return results;
}


export async function loadContextNode(state: WorkflowState): Promise<Partial<WorkflowState>> {

    logger.info({ projectContext: state.projectContext }, "Reaches loadContext Node");

    // On the very first graph invocation for a project, state.projectContext hasn't
    // been seeded by anything yet (there is no dedicated init node anymore) — derive
    // the root path straight from the project id and default the stack here instead.
    const rootPath = state.projectContext?.rootPath
        ? resolveWorkspaceRoot(state.projectContext.rootPath)
        : getProjectDir(state.projectId);

    const fileTree = await listFilesRecursive(rootPath, { ignore: ["node_modules", "dist", ".git"] });

    const pkgJsonPath = path.join(rootPath, "package.json");
    let dependencies: Record<string, string> = {};
    try {
        const pkgJson = JSON.parse(await fs.readFile(pkgJsonPath, "utf-8"));
        dependencies = { ...pkgJson.dependencies, ...pkgJson.devDependencies };
    } catch (err) {
        logger.warn({ err, pkgJsonPath }, "Could not read package.json, assuming none exists yet");
    }

    const dependenciesInstalled = await fs
        .stat(path.join(rootPath, "node_modules"))
        .then((stat) => stat.isDirectory())
        .catch(() => false);

    logger.info({
        rootPath,
        fileTreeCount: fileTree.length,
        dependenciesCount: Object.keys(dependencies).length,
        dependenciesInstalled,
    }, "Loaded project context:");

    sendSseEvent(state.projectId, { message: "Project context loaded successfully" })

    return {
        projectContext: {
            ...state.projectContext,
            stack: state.projectContext?.stack ?? {
                bundler: "vite",
                language: "typescript",
                styling: "tailwindcss-v4",
            },
            rootPath,
            fileTree,
            dependencies,
            dependenciesInstalled,
        },
    }
}
