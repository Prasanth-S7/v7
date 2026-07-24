import path from "path";

const DEFAULT_SHARED_DIR = "/home/prasanth/shared";

export function getSharedDir() {
  const sharedDir = process.env.SHARED_DIR || DEFAULT_SHARED_DIR;
  return path.resolve(sharedDir);
}

export function getProjectDir(projectId: string) {
  return path.join(getSharedDir(), projectId);
}

export function resolveWorkspaceRoot(projectRoot?: string) {
  if (!projectRoot || projectRoot.trim().length === 0) {
    const projectId = process.env.PROJECT_ID || "";
    return projectId ? getProjectDir(projectId) : getSharedDir();
  }

  return path.isAbsolute(projectRoot)
    ? path.resolve(projectRoot)
    : path.resolve(getSharedDir(), projectRoot);
}

export function assertInsideRoot(fullPath: string, projectRoot: string) {
  const resolvedRoot = path.resolve(projectRoot);
  const resolvedTarget = path.resolve(fullPath);

  if (
    resolvedTarget !== resolvedRoot &&
    !resolvedTarget.startsWith(resolvedRoot + path.sep)
  ) {
    throw new Error(`Path "${fullPath}" resolves outside the project root`);
  }
}

export function resolveWorkspacePath(projectRoot: string, targetPath: string) {
  const resolvedRoot = resolveWorkspaceRoot(projectRoot);
  const resolvedTarget = path.isAbsolute(targetPath)
    ? path.resolve(targetPath)
    : path.resolve(resolvedRoot, targetPath);

  assertInsideRoot(resolvedTarget, resolvedRoot);
  return resolvedTarget;
}
