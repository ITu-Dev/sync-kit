import { join } from 'node:path';
import { writeFile, unlink, rename } from 'node:fs/promises';
import { ImportOptions, FileOperation, Conflict } from '../types/index.js';
import { readArchive, getManifestFromArchive, getFileFromArchive } from '../core/archive.js';
import { detectConflicts, sortOperationsForApply } from '../core/diff.js';
import { createBackup } from '../core/backup.js';
import { initGit, getRepoRoot } from '../core/git.js';
import { fileExists, ensureParentDir, remove } from '../utils/fs.js';
import { displayBanner, displayArchiveInfo, displayWarning, displayImportSuccess } from '../ui/banner.js';
import { displayStats } from '../ui/table.js';
import { displayFileTree, FileEntry } from '../ui/tree.js';
import { displayConflictsSummary, displayConflictCard } from '../ui/conflicts.js';
import { startSpinner, succeedSpinner, failSpinner, warnSpinner } from '../ui/spinner.js';
import { DetailedProgressTracker } from '../ui/progress.js';
import { promptConfirm, promptConflictResolution } from '../ui/prompts.js';
import { logger } from '../ui/logger.js';
import { addHistoryEntry } from './history.js';

/**
 * Execute import command
 */
export async function executeImport(
  archivePath: string,
  options: ImportOptions
): Promise<void> {
  try {
    // Display banner
    displayBanner('Import Changes');

    // Validate archive exists
    if (!fileExists(archivePath)) {
      throw new Error(`Archive not found: ${archivePath}`);
    }

    // Read archive
    startSpinner('Reading archive...');
    const zip = readArchive(archivePath);
    const manifest = getManifestFromArchive(zip);
    succeedSpinner('Archive loaded');

    // Display archive info
    displayArchiveInfo({
      path: archivePath,
      created: manifest.created,
      message: manifest.message,
    });

    // Display operations as tree
    const fileEntries: FileEntry[] = manifest.operations.map((op) => ({
      path: op.path,
      type: op.type,
      size: op.size,
      from: op.from,
    }));
    displayFileTree(fileEntries, { title: 'Operations to Apply', showIcons: true });
    displayStats(manifest.stats);

    // Determine target directory
    let targetDir = options.target || process.cwd();

    // Try to initialize git if in a repo
    try {
      await initGit(targetDir);
      targetDir = getRepoRoot();
    } catch {
      // Not a git repo, use target as-is
    }

    logger.newline();
    logger.keyValue('Target', targetDir);

    // Dry run mode
    if (options.dryRun) {
      displayWarning('Dry run mode - no changes will be made');
      logger.newline();
      logger.info('The following operations would be performed:');

      for (const op of manifest.operations) {
        const targetPath = join(targetDir, op.path);
        switch (op.type) {
          case 'add':
            logger.listItem(`Create: ${op.path}`);
            break;
          case 'modify':
            logger.listItem(`Update: ${op.path}`);
            break;
          case 'delete':
            logger.listItem(`Delete: ${op.path}`);
            break;
          case 'rename':
            logger.listItem(`Rename: ${op.from} → ${op.path}`);
            break;
        }
      }

      logger.newline();
      return;
    }

    // Detect conflicts
    startSpinner('Checking for conflicts...');
    const conflicts = await detectConflicts(manifest.operations, targetDir);

    if (conflicts.length > 0) {
      warnSpinner(`${conflicts.length} conflict(s) detected`);

      // Display conflicts summary
      displayConflictsSummary(conflicts);

      // Resolve conflicts
      const resolutions = new Map<string, 'overwrite' | 'skip' | 'keep'>();

      if (!options.force) {
        for (let i = 0; i < conflicts.length; i++) {
          const conflict = conflicts[i];
          displayConflictCard(conflict, conflicts.length, i);
          const resolution = await promptConflictResolution(
            conflict.path,
            getConflictReason(conflict)
          );
          resolutions.set(conflict.path, resolution);
        }
      } else {
        // Force mode - overwrite all
        for (const conflict of conflicts) {
          resolutions.set(conflict.path, 'overwrite');
        }
      }

      // Filter out skipped operations
      manifest.operations = manifest.operations.filter((op) => {
        const resolution = resolutions.get(op.path);
        return resolution !== 'skip' && resolution !== 'keep';
      });
    } else {
      succeedSpinner('No conflicts detected');
    }

    // Confirm import
    if (!options.force) {
      const confirmed = await promptConfirm(
        `Apply ${manifest.operations.length} operations?`,
        true
      );
      if (!confirmed) {
        logger.info('Import cancelled');
        return;
      }
    }

    // Create backup
    let backupPath: string | undefined;
    if (!options.noBackup) {
      startSpinner('Creating backup...');
      backupPath = await createBackup(manifest.operations, targetDir);
      succeedSpinner(`Backup created: ${backupPath}`);
    }

    // Apply operations with detailed progress
    logger.newline();
    const sortedOps = sortOperationsForApply(manifest.operations);
    const progress = new DetailedProgressTracker({
      total: sortedOps.length,
      label: 'Applying changes',
    });

    let applied = 0;
    const errors: Array<{ op: FileOperation; error: string }> = [];

    for (const op of sortedOps) {
      try {
        await applyOperation(zip, op, targetDir);
        applied++;
        progress.tick(op.path);
      } catch (error) {
        errors.push({
          op,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    progress.complete();

    if (errors.length > 0) {
      warnSpinner(`Applied with ${errors.length} error(s)`);

      for (const { op, error } of errors) {
        logger.error(`${op.path}: ${error}`);
      }
    } else {
      succeedSpinner('All changes applied');
    }

    // Display success card
    displayImportSuccess({
      archivePath: archivePath,
      appliedCount: applied,
      stats: {
        added: manifest.stats.added,
        modified: manifest.stats.modified,
        deleted: manifest.stats.deleted,
        renamed: manifest.stats.renamed,
      },
      backupPath,
      elapsed: progress.getElapsedFormatted(),
    });

    // Add to history
    await addHistoryEntry('import', archivePath, manifest.stats, manifest.message);
  } catch (error) {
    failSpinner('Import failed');
    logger.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

/**
 * Apply a single operation
 */
async function applyOperation(
  zip: ReturnType<typeof readArchive>,
  op: FileOperation,
  targetDir: string
): Promise<void> {
  const targetPath = join(targetDir, op.path);

  switch (op.type) {
    case 'add':
    case 'modify': {
      const content = getFileFromArchive(zip, op.path);
      if (!content) {
        throw new Error(`File not found in archive: ${op.path}`);
      }
      await ensureParentDir(targetPath);
      await writeFile(targetPath, content, { mode: 0o644 });
      break;
    }

    case 'delete': {
      if (fileExists(targetPath)) {
        await remove(targetPath);
      }
      break;
    }

    case 'rename': {
      if (op.from) {
        const fromPath = join(targetDir, op.from);

        // Get content from archive (it has the new content)
        const content = getFileFromArchive(zip, op.path);

        if (content) {
          // Delete old file
          if (fileExists(fromPath)) {
            await remove(fromPath);
          }
          // Write new file
          await ensureParentDir(targetPath);
          await writeFile(targetPath, content, { mode: 0o644 });
        } else if (fileExists(fromPath)) {
          // Just rename if no content in archive
          await ensureParentDir(targetPath);
          await rename(fromPath, targetPath);
        }
      }
      break;
    }
  }
}

/**
 * Get human-readable conflict reason
 */
function getConflictReason(conflict: Conflict): string {
  switch (conflict.reason) {
    case 'modified_locally':
      return 'File has been modified locally';
    case 'deleted_locally':
      return 'File has been deleted locally';
    case 'already_exists':
      return 'File already exists with different content';
    default:
      return 'Unknown conflict';
  }
}
