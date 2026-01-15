import { colors, symbols } from './theme.js';
import { HistoryEntry } from '../types/index.js';

/**
 * Format bytes to human-readable
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

/**
 * Get stats string
 */
function getStatsString(stats: { added?: number; modified?: number; deleted?: number; renamed?: number }): string {
  const parts: string[] = [];
  if (stats.added) parts.push(colors.added(`+${stats.added}`));
  if (stats.modified) parts.push(colors.modified(`~${stats.modified}`));
  if (stats.deleted) parts.push(colors.deleted(`-${stats.deleted}`));
  if (stats.renamed) parts.push(colors.renamed(`→${stats.renamed}`));
  return parts.join(' ');
}

/**
 * Group entries by date
 */
function groupByDate(entries: HistoryEntry[]): Map<string, HistoryEntry[]> {
  const groups = new Map<string, HistoryEntry[]>();

  for (const entry of entries) {
    const date = new Date(entry.timestamp);
    const dateKey = date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    if (!groups.has(dateKey)) {
      groups.set(dateKey, []);
    }
    groups.get(dateKey)!.push(entry);
  }

  return groups;
}

/**
 * Display history with timeline graph
 */
export function displayHistoryGraph(entries: HistoryEntry[]): void {
  if (entries.length === 0) {
    console.log();
    console.log(`  ${colors.dim('No sync history found')}`);
    console.log();
    return;
  }

  const grouped = groupByDate(entries);

  console.log();
  console.log(`  ${colors.bold('Sync History')} ${colors.dim(`(${entries.length} entries)`)}`);
  console.log();

  let isFirstGroup = true;

  for (const [dateKey, dateEntries] of grouped) {
    // Date header
    if (!isFirstGroup) {
      console.log();
    }
    console.log(`  ${colors.dim('─────')} ${colors.bold(dateKey)} ${colors.dim('─'.repeat(40))}`);
    console.log();

    // Entries for this date
    for (let i = 0; i < dateEntries.length; i++) {
      const entry = dateEntries[i];
      const time = new Date(entry.timestamp).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });

      const isExport = entry.type === 'export';
      const typeIcon = isExport ? '▶' : '◀';
      const typeColor = isExport ? colors.added : colors.cyan;
      const typeLabel = isExport ? 'export' : 'import';

      // Main line
      console.log(
        `    ${colors.dim(time)}  ${typeColor(typeIcon)} ${typeColor(typeLabel)}   ${getStatsString(entry.stats)}`
      );

      // Archive path
      const filename = entry.archivePath.split('/').pop() || entry.archivePath;
      console.log(
        `           ${colors.dim('│')} ${colors.dim(filename)}`
      );

      // Message if present
      if (entry.message) {
        console.log(
          `           ${colors.dim('│')} ${colors.dim('"')}${entry.message}${colors.dim('"')}`
        );
      }

      // Connector line (unless last in group)
      if (i < dateEntries.length - 1) {
        console.log(`           ${colors.dim('│')}`);
      }
    }

    isFirstGroup = false;
  }

  console.log();
}

/**
 * Display history in compact list format
 */
export function displayHistoryList(entries: HistoryEntry[]): void {
  if (entries.length === 0) {
    console.log();
    console.log(`  ${colors.dim('No sync history found')}`);
    console.log();
    return;
  }

  console.log();
  console.log(`  ${colors.bold('Recent Syncs')}`);
  console.log();

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const date = new Date(entry.timestamp);
    const isLast = i === entries.length - 1;
    const connector = isLast ? symbols.corner : symbols.tee;

    const isExport = entry.type === 'export';
    const typeIcon = isExport ? '▶' : '◀';
    const typeColor = isExport ? colors.added : colors.cyan;

    const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });

    const filename = entry.archivePath.split('/').pop() || entry.archivePath;
    const stats = getStatsString(entry.stats);

    console.log(
      `  ${colors.dim(connector)} ${typeColor(typeIcon)} ${colors.dim(dateStr)} ${colors.dim(timeStr)}  ${filename}  ${stats}`
    );

    if (entry.message) {
      const prefix = isLast ? ' ' : symbols.vertical;
      console.log(`  ${colors.dim(prefix)}     ${colors.dim('"')}${entry.message}${colors.dim('"')}`);
    }
  }

  console.log();
}

/**
 * Display history entry card
 */
export function displayHistoryEntry(entry: HistoryEntry, index: number): void {
  const date = new Date(entry.timestamp);
  const isExport = entry.type === 'export';
  const borderColor = isExport ? colors.added : colors.cyan;
  const typeIcon = isExport ? '▶' : '◀';
  const typeLabel = isExport ? 'EXPORT' : 'IMPORT';

  console.log();
  console.log(`  ${borderColor('╭────────────────────────────────────────────────────╮')}`);
  console.log(`  ${borderColor('│')} ${borderColor(`${typeIcon} ${typeLabel}`)} ${colors.dim(`#${index + 1}`.padStart(43))} ${borderColor('│')}`);
  console.log(`  ${borderColor('├────────────────────────────────────────────────────┤')}`);
  console.log(`  ${borderColor('│')}                                                    ${borderColor('│')}`);

  // Date/time
  const dateStr = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  console.log(`  ${borderColor('│')}  ${colors.dim('Date')}     ${dateStr} ${timeStr}`.padEnd(56) + `${borderColor('│')}`);

  // Archive
  const filename = entry.archivePath.split('/').pop() || entry.archivePath;
  console.log(`  ${borderColor('│')}  ${colors.dim('Archive')}  ${fitString(filename, 40)}`.padEnd(56) + `${borderColor('│')}`);

  // Stats
  const stats = getStatsString(entry.stats);
  console.log(`  ${borderColor('│')}  ${colors.dim('Changes')}  ${stats}`.padEnd(76) + `${borderColor('│')}`);

  // Message
  if (entry.message) {
    console.log(`  ${borderColor('│')}  ${colors.dim('Message')}  "${fitString(entry.message, 38)}"`.padEnd(56) + `${borderColor('│')}`);
  }

  console.log(`  ${borderColor('│')}                                                    ${borderColor('│')}`);
  console.log(`  ${borderColor('╰────────────────────────────────────────────────────╯')}`);
}

/**
 * Fit string to length
 */
function fitString(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 1) + '…';
}

/**
 * Display history summary stats
 */
export function displayHistorySummary(entries: HistoryEntry[]): void {
  const exports = entries.filter((e) => e.type === 'export').length;
  const imports = entries.filter((e) => e.type === 'import').length;

  const totalAdded = entries.reduce((sum, e) => sum + (e.stats.added || 0), 0);
  const totalModified = entries.reduce((sum, e) => sum + (e.stats.modified || 0), 0);
  const totalDeleted = entries.reduce((sum, e) => sum + (e.stats.deleted || 0), 0);

  console.log();
  console.log(`  ${colors.bold('Summary')}`);
  console.log();
  console.log(`  ${colors.added('▶')} ${exports} exports   ${colors.cyan('◀')} ${imports} imports`);
  console.log();
  console.log(`  ${colors.dim('Total changes:')} ${colors.added(`+${totalAdded}`)} ${colors.modified(`~${totalModified}`)} ${colors.deleted(`-${totalDeleted}`)}`);
  console.log();
}
