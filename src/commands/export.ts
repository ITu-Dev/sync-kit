import { join } from 'node:path';
import { ExportOptions, DetectedChange } from '../types/index.js';
import { initGit, getRepoRoot, getSourceInfo, detectChanges, getAllFiles } from '../core/git.js';
import { createManifest, calculateStats } from '../core/manifest.js';
import { createArchive, getArchiveSize } from '../core/archive.js';
import { filterFiles, DEFAULT_EXCLUDES } from '../utils/filters.js';
import { generateArchiveName } from '../utils/paths.js';
import { displayBanner, displayRepoInfo, displayExportSuccess } from '../ui/banner.js';
import { displayStats } from '../ui/table.js';
import { displayFileTree, FileEntry } from '../ui/tree.js';
import { startSpinner, succeedSpinner, failSpinner } from '../ui/spinner.js';
import { DetailedProgressTracker } from '../ui/progress.js';
import { promptExportMode, promptFileSelection, promptMessage, promptConfirm } from '../ui/prompts.js';
import { logger } from '../ui/logger.js';
import { addHistoryEntry } from './history.js';

/**
 * Execute export command
 */
export async function executeExport(options: ExportOptions): Promise<void> {
  try {
    // Display banner
    displayBanner('Export Changes');

    // Initialize git
    startSpinner('Scanning repository...');
    await initGit(process.cwd());
    const repoRoot = getRepoRoot();
    const sourceInfo = await getSourceInfo();
    succeedSpinner('Repository scanned');

    // Display repo info
    displayRepoInfo(sourceInfo);

    // Detect changes
    startSpinner('Detecting changes...');
    let changes = await detectChanges();
    let allFiles = await getAllFiles();

    // Apply filters
    const changedPaths = changes.map((c) => c.path);
    const filteredChangedPaths = filterFiles(changedPaths, options.include, options.exclude);
    changes = changes.filter((c) => filteredChangedPaths.includes(c.path));

    const allPaths = allFiles.map((c) => c.path);
    const filteredAllPaths = filterFiles(allPaths, options.include, options.exclude);
    allFiles = allFiles.filter((c) => filteredAllPaths.includes(c.path));

    succeedSpinner('Changes detected');

    // Calculate stats
    const changesStats = calculateStats(changes);
    const fullStats = calculateStats(allFiles);

    // Display changes as tree
    const fileEntries: FileEntry[] = changes.map((c) => ({
      path: c.path,
      type: c.type,
      size: c.size,
      from: c.from,
    }));
    displayFileTree(fileEntries, { title: 'Changes Found', showIcons: true });
    displayStats(changesStats);

    // Determine mode
    let mode: 'changes' | 'full' = options.mode || 'changes';
    let selectedChanges: DetectedChange[] = changes;

    if (!options.quick) {
      // Interactive mode
      if (changes.length === 0 && !options.mode) {
        const proceed = await promptConfirm('No changes detected. Export full snapshot?', true);
        if (!proceed) {
          logger.info('Export cancelled');
          return;
        }
        mode = 'full';
      } else if (!options.mode) {
        const selectedMode = await promptExportMode(changesStats, fullStats);

        if (selectedMode === 'custom') {
          selectedChanges = await promptFileSelection(changes);
          mode = 'changes';
        } else {
          mode = selectedMode;
        }
      }
    }

    // Get final list of changes
    const finalChanges = mode === 'full' ? allFiles : selectedChanges;

    if (finalChanges.length === 0) {
      logger.warn('No files to export');
      return;
    }

    // Get message
    let message = options.message;
    if (!options.quick && !message) {
      message = await promptMessage();
    }

    // Create manifest
    const manifest = createManifest(finalChanges, sourceInfo, mode, message || undefined);

    // Determine output path
    const outputPath = options.output || join(repoRoot, generateArchiveName(mode));

    // Create archive with detailed progress
    logger.newline();
    const totalSize = finalChanges.reduce((sum, c) => sum + (c.size || 0), 0);
    const progress = new DetailedProgressTracker({
      total: finalChanges.length,
      totalSize,
      label: 'Packing files',
    });

    await createArchive(outputPath, manifest, repoRoot, (current: number, total: number) => {
      const file = finalChanges[current - 1];
      progress.tick(file?.path || '', file?.size || 0);
    });

    progress.complete();
    succeedSpinner('Archive created');

    // Get archive size
    const archiveSize = await getArchiveSize(outputPath);
    const stats = calculateStats(finalChanges);

    // Try to copy to clipboard
    let copiedToClipboard = false;
    try {
      const clipboardy = await import('clipboardy');
      await clipboardy.default.write(outputPath);
      copiedToClipboard = true;
    } catch {
      // Clipboard not available
    }

    // Display success card
    displayExportSuccess({
      archivePath: outputPath,
      archiveSize,
      fileCount: finalChanges.length,
      stats: {
        added: stats.added,
        modified: stats.modified,
        deleted: stats.deleted,
        renamed: stats.renamed,
      },
      copiedToClipboard,
      elapsed: progress.getElapsedFormatted(),
    });

    // Add to history
    await addHistoryEntry('export', outputPath, stats, message || undefined);
  } catch (error) {
    failSpinner('Export failed');
    logger.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
