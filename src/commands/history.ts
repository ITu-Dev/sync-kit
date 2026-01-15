import { join } from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
import { HistoryEntry, ExportStats } from '../types/index.js';
import { fileExists, ensureDir, remove } from '../utils/fs.js';
import { displayBanner } from '../ui/banner.js';
import { displayHistoryGraph, displayHistorySummary } from '../ui/history.js';
import { startSpinner, succeedSpinner, failSpinner } from '../ui/spinner.js';
import { promptConfirm } from '../ui/prompts.js';
import { logger } from '../ui/logger.js';

const HISTORY_DIR = '.sync-history';
const HISTORY_FILE = 'history.json';

interface HistoryOptions {
  clear?: boolean;
}

/**
 * Execute history command
 */
export async function executeHistory(options: HistoryOptions): Promise<void> {
  try {
    // Display banner
    displayBanner('Sync History');

    const historyPath = join(process.cwd(), HISTORY_DIR, HISTORY_FILE);

    // Clear history if requested
    if (options.clear) {
      const confirmed = await promptConfirm('Clear all history?', false);

      if (confirmed) {
        await remove(join(process.cwd(), HISTORY_DIR));
        logger.success('History cleared');
      } else {
        logger.info('Cancelled');
      }
      return;
    }

    // Load history
    const entries = await loadHistory(historyPath);

    if (entries.length === 0) {
      logger.newline();
      logger.info('No sync history found');
      logger.newline();
      return;
    }

    // Display history with graph
    displayHistoryGraph(entries);

    // Display summary
    displayHistorySummary(entries);
  } catch (error) {
    failSpinner('Failed to load history');
    logger.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

/**
 * Load history from file
 */
async function loadHistory(historyPath: string): Promise<HistoryEntry[]> {
  if (!fileExists(historyPath)) {
    return [];
  }

  const content = await readFile(historyPath, 'utf-8');
  return JSON.parse(content);
}

/**
 * Save history to file
 */
async function saveHistory(historyPath: string, entries: HistoryEntry[]): Promise<void> {
  const dir = join(process.cwd(), HISTORY_DIR);
  await ensureDir(dir);
  await writeFile(historyPath, JSON.stringify(entries, null, 2));
}

/**
 * Add entry to history
 */
export async function addHistoryEntry(
  type: 'export' | 'import',
  archivePath: string,
  stats: ExportStats,
  message?: string
): Promise<void> {
  const historyPath = join(process.cwd(), HISTORY_DIR, HISTORY_FILE);
  const entries = await loadHistory(historyPath);

  entries.unshift({
    timestamp: new Date().toISOString(),
    type,
    archivePath,
    stats,
    message,
  });

  // Keep only last 50 entries
  const trimmed = entries.slice(0, 50);

  await saveHistory(historyPath, trimmed);
}
