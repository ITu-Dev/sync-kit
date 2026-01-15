import archiver from 'archiver';
import AdmZip from 'adm-zip';
import { createWriteStream } from 'node:fs';
import { writeFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { Manifest, FileOperation } from '../types/index.js';
import { serializeManifest, parseManifest, getManifestSummary } from './manifest.js';
import { getArchiveFilePath } from '../utils/paths.js';
import { ensureParentDir } from '../utils/fs.js';

/**
 * Create a zip archive with manifest and files
 */
export async function createArchive(
  outputPath: string,
  manifest: Manifest,
  repoRoot: string,
  onProgress?: (current: number, total: number) => void
): Promise<void> {
  await ensureParentDir(outputPath);

  return new Promise((resolve, reject) => {
    const output = createWriteStream(outputPath);
    const archive = archiver('zip', {
      zlib: { level: 9 }, // Maximum compression
    });

    output.on('close', () => resolve());
    archive.on('error', (err) => reject(err));

    archive.pipe(output);

    // Add manifest.json
    archive.append(serializeManifest(manifest), { name: 'manifest.json' });

    // Add human-readable info
    archive.append(getManifestSummary(manifest), { name: 'meta/info.txt' });

    // Add files
    const filesToAdd = manifest.operations.filter((op) => op.type !== 'delete');
    let processed = 0;

    for (const op of filesToAdd) {
      const sourcePath = join(repoRoot, op.path);
      const archivePath = getArchiveFilePath(op.path);

      archive.file(sourcePath, { name: archivePath });

      processed++;
      onProgress?.(processed, filesToAdd.length);
    }

    archive.finalize();
  });
}

/**
 * Extract archive and read manifest
 */
export function readArchive(archivePath: string): AdmZip {
  return new AdmZip(archivePath);
}

/**
 * Get manifest from archive
 */
export function getManifestFromArchive(zip: AdmZip): Manifest {
  const manifestEntry = zip.getEntry('manifest.json');

  if (!manifestEntry) {
    throw new Error('Archive does not contain manifest.json');
  }

  const manifestContent = zip.readAsText(manifestEntry);
  return parseManifest(manifestContent);
}

/**
 * Get file content from archive
 */
export function getFileFromArchive(zip: AdmZip, filePath: string): Buffer | null {
  const archivePath = getArchiveFilePath(filePath);
  const entry = zip.getEntry(archivePath);

  if (!entry) {
    return null;
  }

  return zip.readFile(entry);
}

/**
 * Extract all files from archive to target directory
 */
export async function extractArchive(
  zip: AdmZip,
  manifest: Manifest,
  targetDir: string,
  onProgress?: (current: number, total: number, operation: FileOperation) => void
): Promise<void> {
  const operations = manifest.operations;
  let processed = 0;

  for (const op of operations) {
    const targetPath = join(targetDir, op.path);

    if (op.type === 'delete') {
      // Delete operations are handled separately
      continue;
    }

    // Get file content from archive
    const content = getFileFromArchive(zip, op.path);

    if (content) {
      await ensureParentDir(targetPath);
      await writeFile(targetPath, content, { mode: 0o644 });
    }

    processed++;
    onProgress?.(processed, operations.length, op);
  }
}

/**
 * List all entries in archive
 */
export function listArchiveEntries(zip: AdmZip): string[] {
  return zip.getEntries().map((entry) => entry.entryName);
}

/**
 * Get archive size in bytes
 */
export async function getArchiveSize(archivePath: string): Promise<number> {
  const stats = await stat(archivePath);
  return stats.size;
}
