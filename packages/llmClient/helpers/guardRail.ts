import path from "path";

export function assertInsideRoot(fullPath: string, projectRoot: string) {
    const resolvedRoot = path.resolve(projectRoot);
    const resolvedTarget = path.resolve(fullPath);
    if (resolvedTarget !== resolvedRoot && !resolvedTarget.startsWith(resolvedRoot + path.sep)) {
        throw new Error(`Path "${fullPath}" resolves outside the project root`);
    }
}
