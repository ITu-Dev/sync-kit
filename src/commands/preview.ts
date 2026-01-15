import { PreviewOptions } from '../types/index.js';
import { readArchive, getManifestFromArchive, getFileFromArchive, listArchiveEntries, getArchiveSize } from '../core/archive.js';
import { fileExists } from '../utils/fs.js';
import { displayBanner, displayArchiveInfo } from '../ui/banner.js';
import { displayOperationsTable, displayStats } from '../ui/table.js';
import { startSpinner, succeedSpinner, failSpinner } from '../ui/spinner.js';
import { logger } from '../ui/logger.js';
import { colors, symbols } from '../ui/theme.js';

/**
 * Execute preview command
 */
export async function executePreview(
  archivePath: string,
  options: PreviewOptions
): Promise<void> {
  try {
    // Display banner
    displayBanner('Preview Archive');

    // Validate archive exists
    if (!fileExists(archivePath)) {
      throw new Error(`Archive not found: ${archivePath}`);
    }

    // Read archive
    startSpinner('Reading archive...');
    const zip = readArchive(archivePath);
    const manifest = getManifestFromArchive(zip);
    const archiveSize = await getArchiveSize(archivePath);
    succeedSpinner('Archive loaded');

    // Display archive info
    displayArchiveInfo({
      path: archivePath,
      created: manifest.created,
      size: archiveSize,
      message: manifest.message,
    });

    // Display source info
    logger.newline();
    logger.subsection('Source Repository');
    logger.bordered(`Name:   ${manifest.source.repo}`);
    logger.bordered(`Branch: ${manifest.source.branch}`);
    logger.bordered(`Commit: ${manifest.source.commit}`);
    logger.bordered(`Dirty:  ${manifest.source.dirty ? 'Yes' : 'No'}`);
    logger.borderEnd();

    // Display operations
    displayOperationsTable(manifest.operations);
    displayStats(manifest.stats);

    // Show file contents if requested
    if (options.contents) {
      logger.newline();
      logger.subsection('File Contents Preview');

      for (const op of manifest.operations) {
        if (op.type === 'delete') {
          continue;
        }

        const content = getFileFromArchive(zip, op.path);
        if (!content) continue;

        const text = content.toString('utf-8');
        const lines = text.split('\n');
        const previewLines = lines.slice(0, 10);

        logger.newline();
        logger.log(`  ${colors.bold(op.path)}`);
        logger.log(colors.dim('  ' + '─'.repeat(50)));

        for (const line of previewLines) {
          logger.log(`  ${colors.dim(symbols.vertical)} ${line.substring(0, 80)}`);
        }

        if (lines.length > 10) {
          logger.log(colors.dim(`  ${symbols.vertical} ... (${lines.length - 10} more lines)`));
        }

        logger.log(colors.dim(`  ${symbols.corner}${'─'.repeat(49)}`));
      }
    }

    // Show archive structure
    logger.newline();
    logger.subsection('Archive Structure');

    const entries = listArchiveEntries(zip);
    const maxEntries = 20;

    for (let i = 0; i < Math.min(entries.length, maxEntries); i++) {
      const entry = entries[i];
      const isLast = i === Math.min(entries.length, maxEntries) - 1 && entries.length <= maxEntries;
      logger.treeItem(entry, isLast, 2);
    }

    if (entries.length > maxEntries) {
      logger.log(colors.dim(`    ... and ${entries.length - maxEntries} more entries`));
    }

    logger.newline();
  } catch (error) {
    failSpinner('Preview failed');
    logger.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
