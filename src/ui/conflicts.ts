import { colors, symbols, getFileIcon } from './theme.js';
import { Conflict } from '../types/index.js';

/**
 * Conflict reason descriptions
 */
const conflictReasons: Record<string, { title: string; description: string; icon: string }> = {
  already_exists: {
    title: 'File Already Exists',
    description: 'File exists locally with different content',
    icon: '📄',
  },
  modified_locally: {
    title: 'Modified Locally',
    description: 'File has uncommitted local changes',
    icon: '✏️',
  },
  deleted_locally: {
    title: 'Deleted Locally',
    description: 'File was deleted locally',
    icon: '🗑️',
  },
};

/**
 * Display a single conflict with visual styling
 */
export function displayConflict(conflict: Conflict, index: number): void {
  const reason = conflictReasons[conflict.reason] || {
    title: 'Unknown Conflict',
    description: conflict.reason,
    icon: '⚠️',
  };

  const fileIcon = getFileIcon(conflict.path);

  console.log();
  console.log(`  ${colors.warning('╭─')} ${colors.warning(`CONFLICT #${index + 1}`)} ${colors.dim('─'.repeat(40))}`);
  console.log(`  ${colors.warning('│')}`);
  console.log(`  ${colors.warning('│')}  ${fileIcon} ${colors.bold(conflict.path)}`);
  console.log(`  ${colors.warning('│')}`);
  console.log(`  ${colors.warning('│')}  ${reason.icon} ${colors.warning(reason.title)}`);
  console.log(`  ${colors.warning('│')}  ${colors.dim(reason.description)}`);
  console.log(`  ${colors.warning('│')}`);
  console.log(`  ${colors.warning('╰' + '─'.repeat(52))}`);
}

/**
 * Display all conflicts in a summary
 */
export function displayConflictsSummary(conflicts: Conflict[]): void {
  if (conflicts.length === 0) {
    return;
  }

  console.log();
  console.log(`  ${colors.warning('⚠')} ${colors.bold(`${conflicts.length} conflict${conflicts.length > 1 ? 's' : ''} detected`)}`);
  console.log();

  // Group by reason
  const grouped = new Map<string, Conflict[]>();
  for (const conflict of conflicts) {
    if (!grouped.has(conflict.reason)) {
      grouped.set(conflict.reason, []);
    }
    grouped.get(conflict.reason)!.push(conflict);
  }

  // Display grouped
  for (const [reason, groupConflicts] of grouped) {
    const info = conflictReasons[reason] || { title: reason, icon: '⚠️' };
    console.log(`  ${info.icon} ${colors.warning(info.title)} ${colors.dim(`(${groupConflicts.length})`)}`);

    for (const conflict of groupConflicts) {
      const fileIcon = getFileIcon(conflict.path);
      console.log(`     ${colors.dim(symbols.tee)} ${fileIcon} ${conflict.path}`);
    }
    console.log();
  }
}

/**
 * Display conflict with side-by-side comparison
 */
export function displayConflictComparison(options: {
  path: string;
  localContent?: string;
  incomingContent?: string;
  localLabel?: string;
  incomingLabel?: string;
}): void {
  const {
    path,
    localContent,
    incomingContent,
    localLabel = 'Local',
    incomingLabel = 'Incoming',
  } = options;

  const fileIcon = getFileIcon(path);
  const width = 25;

  console.log();
  console.log(`  ${colors.warning('⚠')} ${colors.bold('CONFLICT:')} ${fileIcon} ${path}`);
  console.log();

  // Header
  console.log(
    `  ${colors.dim('┌' + '─'.repeat(width) + '┬' + '─'.repeat(width) + '┐')}`
  );
  console.log(
    `  ${colors.dim('│')} ${colors.cyan(localLabel.padEnd(width - 2))} ${colors.dim('│')} ${colors.secondary(incomingLabel.padEnd(width - 2))} ${colors.dim('│')}`
  );
  console.log(
    `  ${colors.dim('├' + '─'.repeat(width) + '┼' + '─'.repeat(width) + '┤')}`
  );

  // Content preview (first few lines)
  const localLines = (localContent || '(file does not exist)').split('\n').slice(0, 8);
  const incomingLines = (incomingContent || '(no content)').split('\n').slice(0, 8);
  const maxLines = Math.max(localLines.length, incomingLines.length);

  for (let i = 0; i < maxLines; i++) {
    const localLine = truncateLine(localLines[i] || '', width - 2);
    const incomingLine = truncateLine(incomingLines[i] || '', width - 2);

    console.log(
      `  ${colors.dim('│')} ${localLine.padEnd(width - 2)} ${colors.dim('│')} ${incomingLine.padEnd(width - 2)} ${colors.dim('│')}`
    );
  }

  // Show "more lines" indicator
  if (localLines.length < (localContent?.split('\n').length || 0) ||
      incomingLines.length < (incomingContent?.split('\n').length || 0)) {
    console.log(
      `  ${colors.dim('│')} ${colors.dim('...'.padEnd(width - 2))} ${colors.dim('│')} ${colors.dim('...'.padEnd(width - 2))} ${colors.dim('│')}`
    );
  }

  // Footer
  console.log(
    `  ${colors.dim('└' + '─'.repeat(width) + '┴' + '─'.repeat(width) + '┘')}`
  );
  console.log();
}

/**
 * Truncate line for display
 */
function truncateLine(line: string, maxLen: number): string {
  // Remove tabs and normalize whitespace
  const normalized = line.replace(/\t/g, '  ').trimEnd();

  if (normalized.length <= maxLen) {
    return normalized;
  }

  return normalized.slice(0, maxLen - 1) + '…';
}

/**
 * Display conflict resolution options
 */
export function displayConflictOptions(): void {
  console.log();
  console.log(`  ${colors.bold('Resolution options:')}`);
  console.log();
  console.log(`  ${colors.cyan('[o]')} Keep ${colors.cyan('ours')} ${colors.dim('- keep local version')}`);
  console.log(`  ${colors.secondary('[t]')} Take ${colors.secondary('theirs')} ${colors.dim('- use incoming version')}`);
  console.log(`  ${colors.dim('[s]')} ${colors.dim('Skip')} ${colors.dim('- skip this file')}`);
  console.log();
}

/**
 * Display conflict resolution card
 */
export function displayConflictCard(conflict: Conflict, total: number, current: number): void {
  const reason = conflictReasons[conflict.reason] || { title: 'Conflict', icon: '⚠️', description: '' };
  const fileIcon = getFileIcon(conflict.path);
  const progress = `${current}/${total}`;

  console.log();
  console.log(`  ${colors.warning('╭──────────────────────────────────────────────────────╮')}`);
  console.log(`  ${colors.warning('│')} ${colors.warning('⚠ CONFLICT')} ${colors.dim(`[${progress}]`).padStart(42)} ${colors.warning('│')}`);
  console.log(`  ${colors.warning('├──────────────────────────────────────────────────────┤')}`);
  console.log(`  ${colors.warning('│')}                                                      ${colors.warning('│')}`);
  console.log(`  ${colors.warning('│')}  ${fileIcon} ${fitString(conflict.path, 48)}  ${colors.warning('│')}`);
  console.log(`  ${colors.warning('│')}                                                      ${colors.warning('│')}`);
  console.log(`  ${colors.warning('│')}  ${reason.icon} ${fitString(reason.title, 47)}  ${colors.warning('│')}`);
  console.log(`  ${colors.warning('│')}  ${colors.dim(fitString(reason.description, 49))}  ${colors.warning('│')}`);
  console.log(`  ${colors.warning('│')}                                                      ${colors.warning('│')}`);
  console.log(`  ${colors.warning('╰──────────────────────────────────────────────────────╯')}`);
}

/**
 * Fit string to exact length
 */
function fitString(str: string, len: number): string {
  if (str.length <= len) {
    return str.padEnd(len);
  }
  return str.slice(0, len - 1) + '…';
}
