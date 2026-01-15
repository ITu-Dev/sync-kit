import { join } from 'node:path';
import { ExportOptions, DetectedChange } from '../types/index.js';
import { initGit, getRepoRoot, getSourceInfo, detectChanges, getAllFiles } from '../core/git.js';
import { createManifest, calculateStats } from '../core/manifest.js';
import { createArchive, getArchiveSize } from '../core/archive.js';
import { filterFiles, DEFAULT_EXCLUDES } from '../utils/filters.js';
import { generateArchiveName } from '../utils/paths.js';
import { displayBanner, displayRepoInfo, displaySuccessFooter } from '../ui/banner.js';
import { displayChangesTable, displayStats } from '../ui/table.js';
import { startSpinner, succeedSpinner, failSpinner } from '../ui/spinner.js';
import { showProgress, completeProgress } from '../ui/progress.js';
import { promptExportMode, promptFileSelection, promptMessage, promptConfirm } from '../ui/prompts.js';
import { logger } from '../ui/logger.js';
import { colors } from '../ui/theme.js';

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

    // Display changes
    displayChangesTable(changes);
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

    // Create archive
    logger.newline();
    startSpinner('Creating archive...');

    await createArchive(outputPath, manifest, repoRoot, (current, total) => {
      showProgress(current, total, `${current}/${total} files`);
    });

    completeProgress();
    succeedSpinner('Archive created');

    // Get archive size
    const archiveSize = await getArchiveSize(outputPath);
    const sizeStr = formatBytes(archiveSize);

    // Try to copy to clipboard
    try {
      const clipboardy = await import('clipboardy');
      await clipboardy.default.write(outputPath);
      displaySuccessFooter(
        `Archive created: ${outputPath}`,
        `Size: ${sizeStr} · Path copied to clipboard`
      );
    } catch {
      displaySuccessFooter(`Archive created: ${outputPath}`, `Size: ${sizeStr}`);
    }
  } catch (error) {
    failSpinner('Export failed');
    logger.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

/**
 * Format bytes to human readable
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);

  return `${value.toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}
