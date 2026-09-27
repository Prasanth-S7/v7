import { type WorkflowState } from "../graph";
import fs from "fs/promises";
import path from "path";
import { resolveWorkspaceRoot } from "@v7/env/sharedDir";
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
    const rootPath = resolveWorkspaceRoot(state.projectContext.rootPath);
    const fileTree = await listFilesRecursive(rootPath, { ignore: ["node_modules", "dist", ".git"] });

    const pkgJsonPath = path.join(rootPath, "package.json");
    const pkgJson = JSON.parse(await fs.readFile(pkgJsonPath, "utf-8"));
    const dependencies = { ...pkgJson.dependencies, ...pkgJson.devDependencies };

    const isProjectInit = fileTree.length > 0 && Object.keys(dependencies).length > 0;

    logger.info({
        rootPath,
        fileTreeCount: fileTree.length,
        dependenciesCount: Object.keys(dependencies).length,
    }, "Loaded project context:");

    sendSseEvent(state.projectId, { message: "Project context loaded successfully" })

    return {
        initProject: isProjectInit,
        projectContext: {
            ...state.projectContext,
            fileTree,
            dependencies,
        },
    }
}
