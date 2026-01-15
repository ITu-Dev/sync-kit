import Table from 'cli-table3';
import { DetectedChange, FileOperation, ExportStats } from '../types/index.js';
import { colors, symbols, getOperationSymbol, formatSize } from './theme.js';

/**
 * Display changes in a formatted table
 */
export function displayChangesTable(changes: DetectedChange[]): void {
  if (changes.length === 0) {
    console.log(colors.dim('  No changes detected'));
    return;
  }

  console.log();
  console.log(`  ${colors.dim('┌─')} ${colors.bold('Changes Found')} ${colors.dim('─'.repeat(35))}`);

  for (const change of changes) {
    const symbol = getOperationSymbol(change.type);
    const label = change.type.padEnd(8);
    const path = formatChangePath(change);
    const size = change.type !== 'delete' ? formatSize(change.size) : colors.dim('—');

    console.log(`  ${colors.dim(symbols.vertical)}  ${symbol} ${colors.dim(label)} ${path}  ${size}`);
  }

  console.log(`  ${colors.dim(symbols.corner + symbols.horizontal.repeat(50))}`);
  console.log();
}

/**
 * Display operations from manifest
 */
export function displayOperationsTable(operations: FileOperation[]): void {
  if (operations.length === 0) {
    console.log(colors.dim('  No operations'));
    return;
  }

  console.log();
  console.log(`  ${colors.dim('┌─')} ${colors.bold('Operations to Apply')} ${colors.dim('─'.repeat(30))}`);

  for (const op of operations) {
    const symbol = getOperationSymbol(op.type);
    const label = op.type.padEnd(8);
    let path: string;

    if (op.type === 'rename' && op.from) {
      path = `${colors.dim(op.from)} ${colors.cyan('→')} ${op.path}`;
    } else {
      path = op.path;
    }

    console.log(`  ${colors.dim(symbols.vertical)}  ${symbol} ${colors.dim(label)} ${path}`);
  }

  console.log(`  ${colors.dim(symbols.corner + symbols.horizontal.repeat(50))}`);
  console.log();
}

/**
 * Display statistics summary
 */
export function displayStats(stats: ExportStats): void {
  const parts: string[] = [];

  if (stats.added > 0) {
    parts.push(colors.added(`+${stats.added} added`));
  }
  if (stats.modified > 0) {
    parts.push(colors.modified(`~${stats.modified} modified`));
  }
  if (stats.deleted > 0) {
    parts.push(colors.deleted(`-${stats.deleted} deleted`));
  }
  if (stats.renamed > 0) {
    parts.push(colors.renamed(`→${stats.renamed} renamed`));
  }

  if (parts.length === 0) {
    console.log(colors.dim('  No changes'));
  } else {
    console.log(`  ${colors.bold('Summary:')} ${parts.join(colors.dim(' · '))}`);
  }
}

/**
 * Display compact stats line
 */
export function displayCompactStats(stats: ExportStats): string {
  const parts: string[] = [];

  if (stats.added > 0) parts.push(colors.added(`+${stats.added}`));
  if (stats.modified > 0) parts.push(colors.modified(`~${stats.modified}`));
  if (stats.deleted > 0) parts.push(colors.deleted(`-${stats.deleted}`));
  if (stats.renamed > 0) parts.push(colors.renamed(`→${stats.renamed}`));

  return parts.join(colors.dim(' · '));
}

/**
 * Format change path for display
 */
function formatChangePath(change: DetectedChange): string {
  if (change.type === 'rename' && change.from) {
    return `${colors.dim(change.from)} ${colors.cyan('→')} ${change.path}`;
  }
  return change.path;
}

/**
 * Display a simple key-value table
 */
export function displayKeyValueTable(data: Record<string, string>): void {
  const maxKeyLength = Math.max(...Object.keys(data).map((k) => k.length));

  for (const [key, value] of Object.entries(data)) {
    const paddedKey = key.padEnd(maxKeyLength);
    console.log(`  ${colors.dim(paddedKey + ':')}  ${value}`);
  }
}

/**
 * Display file list with icons
 */
export function displayFileList(files: string[], maxItems: number = 10): void {
  const displayFiles = files.slice(0, maxItems);

  for (const file of displayFiles) {
    console.log(`  ${colors.dim(symbols.bullet)} ${file}`);
  }

  if (files.length > maxItems) {
    console.log(colors.dim(`  ... and ${files.length - maxItems} more`));
  }
}
