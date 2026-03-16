import { join } from 'node:path';
import { ExportOptions, DetectedChange } from '../types/index.js';
import { initGit, getRepoRoot, getSourceInfo, detectChanges, getAllFiles } from '../core/git.js';
import { createManifest, calculateStats } from '../core/manifest.js';
import { createArchive, getArchiveSize } from '../core/archive.js';
import { filterFiles, findMediaFiles, filterByDirectories } from '../utils/filters.js';
import { generateArchiveName } from '../utils/paths.js';
import { displayBanner, displayRepoInfo, displayExportSuccess } from '../ui/banner.js';
import { displayStats } from '../ui/table.js';
import { displayFileTree, FileEntry } from '../ui/tree.js';
import { startSpinner, succeedSpinner, failSpinner } from '../ui/spinner.js';
import { DetailedProgressTracker } from '../ui/progress.js';
import { promptExportMode, promptFileSelection, promptMessage, promptConfirm, promptDirectorySelection, promptArchiveName } from '../ui/prompts.js';
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

    // Apply filters (media files excluded by default unless --include-media)
    const changedPaths = changes.map((c) => c.path);
    const filteredChangedPaths = filterFiles(changedPaths, options.include, options.exclude, options.includeMedia);
    changes = changes.filter((c) => filteredChangedPaths.includes(c.path));

    const allPaths = allFiles.map((c) => c.path);
    const filteredAllPaths = filterFiles(allPaths, options.include, options.exclude, options.includeMedia);
    allFiles = allFiles.filter((c) => filteredAllPaths.includes(c.path));

    succeedSpinner('Changes detected');

    // Alert about skipped media files
    if (!options.includeMedia) {
      const skippedMediaInChanges = findMediaFiles(changedPaths.filter((p) => !filteredChangedPaths.includes(p)));
      const skippedMediaInAll = findMediaFiles(allPaths.filter((p) => !filteredAllPaths.includes(p)));

      // Show both counts when relevant
      const displaySkipped = (label: string, skipped: string[]) => {
        if (skipped.length === 0) return;
        logger.warn(`${skipped.length} media file(s) skipped in ${label} (images, svg, fonts, etc.)`);
        for (const file of skipped.slice(0, 5)) {
          logger.indent(`${file}`, 2);
        }
        if (skipped.length > 5) {
          logger.indent(`... and ${skipped.length - 5} more`, 2);
        }
      };

      if (skippedMediaInChanges.length > 0 || skippedMediaInAll.length > 0) {
        logger.newline();
        displaySkipped('changes', skippedMediaInChanges);
        if (skippedMediaInAll.length > skippedMediaInChanges.length) {
          displaySkipped('repository', skippedMediaInAll);
        }
        logger.info('Use --include-media to include them');
      }
    }

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
    let mode: 'changes' | 'full' | 'directories' = options.mode || 'changes';
    let selectedChanges: DetectedChange[] = changes;

    if (!options.quick) {
      // Interactive mode
      if (changes.length === 0 && !options.mode) {
        logger.warn('No changes detected');
        const { noChangesMode } = await (await import('inquirer')).default.prompt([{
          type: 'list',
          name: 'noChangesMode',
          message: 'What would you like to export?',
          choices: [
            { name: `Full snapshot (${fullStats.added} files)`, value: 'full' },
            { name: 'Specific directories...', value: 'directories' },
            { name: 'Cancel', value: 'cancel' },
          ],
        }]);
        if (noChangesMode === 'cancel') {
          logger.info('Export cancelled');
          return;
        }
        mode = noChangesMode;
      } else if (!options.mode) {
        const selectedMode = await promptExportMode(changesStats, fullStats);

        if (selectedMode === 'custom') {
          selectedChanges = await promptFileSelection(changes);
          mode = 'changes';
        } else if (selectedMode === 'directories') {
          mode = 'directories';
        } else {
          mode = selectedMode;
        }
      }
    }

    // Handle directory selection mode
    if (mode === 'directories') {
      let selectedDirs = options.directories;

      if (!selectedDirs || selectedDirs.length === 0) {
        // Discover available top-level directories from all files
        const topLevelDirs = [...new Set(
          allFiles
            .map((f) => f.path.split('/')[0])
            .filter((dir) => allFiles.some((f) => f.path.startsWith(dir + '/')))
        )].sort();

        if (topLevelDirs.length === 0) {
          logger.warn('No directories found in repository');
          return;
        }

        selectedDirs = await promptDirectorySelection(topLevelDirs);
      }

      // Filter allFiles to only include files from selected directories
      const dirPaths = allFiles
        .filter((f) => filterByDirectories([f.path], selectedDirs!).length > 0)
        .map((f) => f);
      selectedChanges = dirPaths;

      logger.newline();
      logger.info(`Exporting ${selectedDirs.length} director${selectedDirs.length === 1 ? 'y' : 'ies'}: ${selectedDirs.join(', ')}`);
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
    let archiveName = generateArchiveName(mode);

    if (options.name) {
      archiveName = options.name.endsWith('.zip') ? options.name : `${options.name}.zip`;
    } else if (!options.quick && !options.output) {
      const customName = await promptArchiveName(archiveName);
      if (customName) {
        archiveName = customName.endsWith('.zip') ? customName : `${customName}.zip`;
      }
    }

    const outputPath = options.output || join(repoRoot, archiveName);

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
