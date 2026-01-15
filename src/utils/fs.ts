import { createHash } from 'node:crypto';
import { readFile, stat, mkdir, rm, cp, readdir, lstat } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import { dirname } from 'node:path';

/**
 * Check if path is a file (not directory)
 */
export function isFile(filePath: string): boolean {
  try {
    return existsSync(filePath) && statSync(filePath).isFile();
  } catch {
    return false;
  }
}

/**
 * Calculate SHA-256 hash of file content
 */
export async function hashFile(filePath: string): Promise<string> {
  if (!isFile(filePath)) {
    throw new Error(`Not a file: ${filePath}`);
  }
  const content = await readFile(filePath);
  const hash = createHash('sha256').update(content).digest('hex');
  return `sha256:${hash}`;
}

/**
 * Calculate SHA-256 hash of a buffer
 */
export function hashBuffer(buffer: Buffer): string {
  const hash = createHash('sha256').update(buffer).digest('hex');
  return `sha256:${hash}`;
}

/**
 * Get file size in bytes
 */
export async function getFileSize(filePath: string): Promise<number> {
  const stats = await stat(filePath);
  return stats.size;
}

/**
 * Check if a file exists
 */
export function fileExists(filePath: string): boolean {
  return existsSync(filePath);
}

/**
 * Ensure directory exists, creating it if necessary
 */
export async function ensureDir(dirPath: string): Promise<void> {
  if (!existsSync(dirPath)) {
    await mkdir(dirPath, { recursive: true });
  }
}

/**
 * Ensure parent directory exists for a file path
 */
export async function ensureParentDir(filePath: string): Promise<void> {
  const dir = dirname(filePath);
  await ensureDir(dir);
}

/**
 * Remove a file or directory
 */
export async function remove(path: string): Promise<void> {
  if (existsSync(path)) {
    await rm(path, { recursive: true, force: true });
  }
}

/**
 * Copy file or directory
 */
export async function copy(src: string, dest: string): Promise<void> {
  await ensureParentDir(dest);
  await cp(src, dest, { recursive: true });
}

/**
 * Read file as string
 */
export async function readFileContent(filePath: string): Promise<string> {
  return readFile(filePath, 'utf-8');
}

/**
 * Read file as buffer
 */
export async function readFileBuffer(filePath: string): Promise<Buffer> {
  return readFile(filePath);
}

/**
 * List all files in directory recursively
 */
export async function listFilesRecursive(dirPath: string): Promise<string[]> {
  const files: string[] = [];

  async function walk(dir: string, prefix: string = ''): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;

      if (entry.isDirectory()) {
        await walk(`${dir}/${entry.name}`, relativePath);
      } else if (entry.isFile()) {
        files.push(relativePath);
      }
    }
  }

  await walk(dirPath);
  return files;
}
