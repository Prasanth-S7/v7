import {
    assertInsideRoot as assertWorkspaceInsideRoot,
    resolveWorkspacePath as resolveSharedWorkspacePath,
    resolveWorkspaceRoot as resolveSharedWorkspaceRoot,
} from "@v7/env/sharedDir";

export function assertInsideRoot(fullPath: string, projectRoot: string) {
    assertWorkspaceInsideRoot(fullPath, projectRoot);
}

export function resolveWorkspaceRoot(projectRoot?: string) {
    return resolveSharedWorkspaceRoot(projectRoot);
}

export function resolveWorkspacePath(projectRoot: string, targetPath: string) {
    return resolveSharedWorkspacePath(projectRoot, targetPath);
}
