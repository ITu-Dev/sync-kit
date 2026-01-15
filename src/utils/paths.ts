import { basename, dirname, join, relative, resolve } from 'node:path';

/**
 * Convert a file path to archive path (.txt extension)
 */
export function toArchivePath(filePath: string): string {
  return `${filePath}.txt`;
}

/**
 * Convert archive path back to original file path
 */
export function fromArchivePath(archivePath: string): string {
  if (archivePath.endsWith('.txt')) {
    return archivePath.slice(0, -4);
  }
  return archivePath;
}

/**
 * Get the files directory path in archive
 */
export function getFilesDir(): string {
  return 'files';
}

/**
 * Get full archive path for a file
 */
export function getArchiveFilePath(filePath: string): string {
  return join(getFilesDir(), toArchivePath(filePath));
}

/**
 * Generate timestamp string for archive names
 */
export function generateTimestamp(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');

  return `${year}${month}${day}-${hours}${minutes}${seconds}`;
}

/**
 * Generate default archive filename
 */
export function generateArchiveName(mode: 'changes' | 'full' = 'changes'): string {
  const timestamp = generateTimestamp();
  const prefix = mode === 'full' ? 'snapshot' : 'sync';
  return `${prefix}_${timestamp}.zip`;
}

/**
 * Get repository name from path
 */
export function getRepoName(repoPath: string): string {
  return basename(resolve(repoPath));
}

/**
 * Normalize path separators to forward slashes
 */
export function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, '/');
}

/**
 * Get relative path from repo root
 */
export function getRelativePath(filePath: string, repoRoot: string): string {
  return normalizePath(relative(repoRoot, filePath));
}

/**
 * Join paths and normalize
 */
export function joinPath(...parts: string[]): string {
  return normalizePath(join(...parts));
}

/**
 * Get directory of a path
 */
export function getDirname(filePath: string): string {
  return normalizePath(dirname(filePath));
}

/**
 * Check if a path is safely within a base directory (prevents path traversal)
 * Returns the resolved safe path or throws if path escapes base
 */
export function resolveSafePath(basePath: string, relativePath: string): string {
  const resolvedBase = resolve(basePath);
  const resolvedFull = resolve(basePath, relativePath);

  if (!resolvedFull.startsWith(resolvedBase + '/') && resolvedFull !== resolvedBase) {
    throw new Error(`Path traversal detected: "${relativePath}" escapes base directory`);
  }

  return resolvedFull;
}

/**
 * Check if path is safe without throwing
 */
export function isPathSafe(basePath: string, relativePath: string): boolean {
  try {
    resolveSafePath(basePath, relativePath);
    return true;
  } catch {
    return false;
  }
}
