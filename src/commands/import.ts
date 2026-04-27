import { join, dirname } from 'node:path';
import { writeFile, unlink, rename, rm, mkdir } from 'node:fs/promises';
import { simpleGit } from 'simple-git';
import { ImportOptions, FileOperation, Conflict, HistoryStrategy } from '../types/index.js';
import {
  readArchive,
  getManifestFromArchive,
  getFileFromArchive,
  hasBundleInArchive,
  extractBundleFromArchive,
} from '../core/archive.js';
import { detectConflicts, sortOperationsForApply } from '../core/diff.js';
import { createBackup } from '../core/backup.js';
import { initGit, getRepoRoot, checkoutRef } from '../core/git.js';
import { fetchBundle, isGitRepo, initRepo, findDefaultBranchRef } from '../core/bundle.js';
import { fileExists, ensureParentDir, remove } from '../utils/fs.js';
import { displayBanner, displayArchiveInfo, displayWarning, displayImportSuccess, displayBundleInfo } from '../ui/banner.js';
import { displayStats } from '../ui/table.js';
import { displayFileTree, FileEntry } from '../ui/tree.js';
import { displayConflictsSummary, displayConflictCard } from '../ui/conflicts.js';
import { startSpinner, succeedSpinner, failSpinner, warnSpinner } from '../ui/spinner.js';
import { DetailedProgressTracker } from '../ui/progress.js';
import { promptConfirm, promptConflictResolution, promptHistoryStrategy } from '../ui/prompts.js';
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

    // Display operations as tree (only if there are file ops)
    if (manifest.operations.length > 0) {
      const fileEntries: FileEntry[] = manifest.operations.map((op) => ({
        path: op.path,
        type: op.type,
        size: op.size,
        from: op.from,
      }));
      displayFileTree(fileEntries, { title: 'Operations to Apply', showIcons: true });
      displayStats(manifest.stats);
    }

    // Display embedded history bundle info, if any
    if (manifest.history) {
      displayBundleInfo(manifest.history);
    }

    // Determine target directory
    let targetDir = options.target || process.cwd();

    // --init-if-empty: when target is not a git repo and the archive
    // carries history, initialise the target and seed it from the bundle
    // BEFORE the main flow tries to initGit() the (still non-existent) repo.
    let bundleAlreadyApplied = false;
    if (
      hasBundleInArchive(zip) &&
      !options.noHistory &&
      options.initIfEmpty &&
      !(await isGitRepo(targetDir))
    ) {
      await mkdir(targetDir, { recursive: true });

      startSpinner('Initialising target repository...');
      await initRepo(targetDir);
      succeedSpinner('Target repository initialised');

      const bundlePath = await extractBundleFromArchive(zip);
      const bundleTmpDir = dirname(bundlePath);

      startSpinner('Fetching history from bundle...');
      try {
        await fetchBundle(targetDir, bundlePath, 'fast-forward');
        succeedSpinner('History fetched');
      } catch (err) {
        failSpinner(`Failed to fetch bundle: ${(err as Error).message}`);
        await rm(bundleTmpDir, { recursive: true, force: true });
        throw err;
      } finally {
        await rm(bundleTmpDir, { recursive: true, force: true });
      }

      // Checkout the source's HEAD branch (or fall back to first head ref)
      const branchRef = manifest.history ? findDefaultBranchRef(manifest.history.refs) : undefined;
      if (branchRef) {
        const branch = branchRef.name.replace('refs/heads/', '');
        startSpinner(`Checking out ${branch}...`);
        try {
          await simpleGit(targetDir).raw(['checkout', branch]);
          succeedSpinner(`Checked out ${branch}`);
        } catch (err) {
          failSpinner(`Failed to checkout ${branch}: ${(err as Error).message}`);
        }
      }

      bundleAlreadyApplied = true;
    }

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

    const hasFileOps = manifest.operations.length > 0;
    const archiveHasBundle = hasBundleInArchive(zip);
    const shouldApplyBundle = archiveHasBundle && !options.noHistory && !bundleAlreadyApplied;

    let backupPath: string | undefined;

    if (hasFileOps) {
      // Detect conflicts
      startSpinner('Checking for conflicts...');
      const conflicts = await detectConflicts(manifest.operations, targetDir);

      if (conflicts.length > 0) {
        warnSpinner(`${conflicts.length} conflict(s) detected`);

        displayConflictsSummary(conflicts);

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
          for (const conflict of conflicts) {
            resolutions.set(conflict.path, 'overwrite');
          }
        }

        manifest.operations = manifest.operations.filter((op) => {
          const resolution = resolutions.get(op.path);
          return resolution !== 'skip' && resolution !== 'keep';
        });
      } else {
        succeedSpinner('No conflicts detected');
      }

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

      if (!options.noBackup) {
        startSpinner('Creating backup...');
        backupPath = await createBackup(manifest.operations, targetDir);
        succeedSpinner(`Backup created: ${backupPath}`);
      }
    }

    // Apply bundle BEFORE file operations:
    // 1. fetch refs into the .git/ store (no working tree changes yet)
    // 2. optional checkout to sync working tree with new HEAD
    // 3. file operations overlay as dirty edits in step below
    let bundleTmpDir: string | undefined;
    if (shouldApplyBundle) {
      if (!(await isGitRepo(targetDir))) {
        logger.error('Target is not a git repository. Re-run with --init-if-empty to initialise.');
        process.exit(1);
      }

      const bundlePath = await extractBundleFromArchive(zip);
      bundleTmpDir = dirname(bundlePath);

      let strategy: HistoryStrategy = options.historyStrategy ?? 'safe';
      // Only prompt when running interactively and the user did not pass an explicit strategy.
      if (!options.force && !options.historyStrategy) {
        strategy = await promptHistoryStrategy();
      }

      startSpinner(`Applying bundle (strategy: ${strategy})...`);
      try {
        await fetchBundle(targetDir, bundlePath, strategy);
        succeedSpinner(`Bundle applied (${strategy})`);
      } catch (err) {
        failSpinner(`Failed to apply bundle: ${(err as Error).message}`);
        await rm(bundleTmpDir, { recursive: true, force: true });
        throw err;
      }

      if (options.checkout && manifest.history) {
        const branchRef = findDefaultBranchRef(manifest.history.refs);
        if (branchRef) {
          const branch = branchRef.name.replace('refs/heads/', '');
          startSpinner(`Checking out ${branch}...`);
          try {
            // Force checkout: when fast-forward/force fetched into the
            // currently checked-out branch, the ref moved but WT didn't —
            // a plain `git checkout` is a no-op. `-f` syncs WT to the ref.
            await checkoutRef(branch, true);
            succeedSpinner(`Checked out ${branch}`);
          } catch (err) {
            failSpinner(`Failed to checkout ${branch}: ${(err as Error).message}`);
          }
        }
      }

      await rm(bundleTmpDir, { recursive: true, force: true });
    }

    // Apply file operations (after bundle, so they overlay as dirty edits)
    let applied = 0;
    let elapsed = '';
    if (hasFileOps) {
      logger.newline();
      const sortedOps = sortOperationsForApply(manifest.operations);
      const progress = new DetailedProgressTracker({
        total: sortedOps.length,
        label: 'Applying changes',
      });

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
      elapsed = progress.getElapsedFormatted();

      if (errors.length > 0) {
        warnSpinner(`Applied with ${errors.length} error(s)`);

        for (const { op, error } of errors) {
          logger.error(`${op.path}: ${error}`);
        }
      } else {
        succeedSpinner('All changes applied');
      }
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
      elapsed,
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
