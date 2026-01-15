import { join } from 'node:path';
import { readdir } from 'node:fs/promises';
import { FileOperation } from '../types/index.js';
import { ensureDir, copy, fileExists, remove, listFilesRecursive } from '../utils/fs.js';
import { generateTimestamp, resolveSafePath } from '../utils/paths.js';

const BACKUP_DIR = '.sync-backup';

/**
 * Create a backup of files that will be modified
 */
export async function createBackup(
  operations: FileOperation[],
  targetDir: string
): Promise<string> {
  const timestamp = generateTimestamp();
  const backupPath = join(targetDir, BACKUP_DIR, `backup_${timestamp}`);

  await ensureDir(backupPath);

  // Backup files that will be modified or deleted
  const filesToBackup = operations.filter(
    (op) => op.type === 'modify' || op.type === 'delete' || op.type === 'rename'
  );

  for (const op of filesToBackup) {
    // Validate path is safe (prevents path traversal attacks)
    const sourcePath = resolveSafePath(targetDir, op.path);

    // For renames, backup the source file
    if (op.type === 'rename' && op.from) {
      const fromPath = resolveSafePath(targetDir, op.from);
      if (fileExists(fromPath)) {
        const backupFilePath = resolveSafePath(backupPath, op.from);
        await copy(fromPath, backupFilePath);
      }
    } else if (fileExists(sourcePath)) {
      const backupFilePath = resolveSafePath(backupPath, op.path);
      await copy(sourcePath, backupFilePath);
    }
  }

  return backupPath;
}

/**
 * Restore files from a backup
 */
export async function restoreBackup(
  backupPath: string,
  targetDir: string
): Promise<void> {
  const files = await listFilesRecursive(backupPath);

  for (const file of files) {
    // Validate paths are safe
    const sourcePath = resolveSafePath(backupPath, file);
    const targetPath = resolveSafePath(targetDir, file);
    await copy(sourcePath, targetPath);
  }
}

/**
 * Remove a backup
 */
export async function removeBackup(backupPath: string): Promise<void> {
  await remove(backupPath);
}

/**
 * List all backups in a directory
 */
export async function listBackups(targetDir: string): Promise<string[]> {
  const backupDir = join(targetDir, BACKUP_DIR);

  if (!fileExists(backupDir)) {
    return [];
  }

  const entries = await readdir(backupDir, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('backup_'))
    .map((entry) => join(backupDir, entry.name))
    .sort()
    .reverse(); // Most recent first
}

/**
 * Get backup directory path
 */
export function getBackupDir(targetDir: string): string {
  return join(targetDir, BACKUP_DIR);
}

/**
 * Clean old backups, keeping only the most recent N
 */
export async function cleanOldBackups(
  targetDir: string,
  keepCount: number = 5
): Promise<number> {
  const backups = await listBackups(targetDir);

  if (backups.length <= keepCount) {
    return 0;
  }

  const toRemove = backups.slice(keepCount);
  for (const backup of toRemove) {
    await removeBackup(backup);
  }

  return toRemove.length;
}
