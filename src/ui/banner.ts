import { colors } from './theme.js';

const VERSION = '1.0.0';

/**
 * ASCII art logo for sync-kit
 */
function getLogo(): string {
  const c = colors.cyan;
  const m = colors.secondary;
  const d = colors.dim;

  return [
    '',
    `   ${c('┌─┐┬ ┬┌┐┌┌─┐')}${d('─')}${m('┬┌─┬┌┬┐')}`,
    `   ${c('└─┐└┬┘││││   ')}${m('├┴┐│ │ ')}`,
    `   ${c('└─┘ ┴ ┘└┘└─┘')}${d('─')}${m('┴ ┴┴ ┴ ')}`,
    '',
  ].join('\n');
}

const LOGO_COMPACT = `  ${colors.cyan('⟳')} ${colors.bold('sync-kit')} ${colors.dim(`v${VERSION}`)}`;

/**
 * Display application banner with ASCII logo
 */
export function displayBanner(subtitle?: string, compact: boolean = false): void {
  console.log();

  if (compact) {
    console.log(LOGO_COMPACT);
  } else {
    console.log(getLogo());
    console.log(`   ${colors.dim(`v${VERSION}`)} ${colors.dim('─')} ${colors.dim('Transfer code changes without git remote')}`);
  }

  if (subtitle) {
    console.log();
    console.log(`  ${colors.dim(subtitle)}`);
  }

  console.log();
}

/**
 * Display minimal one-line banner
 */
export function displayMiniBanner(): void {
  console.log();
  console.log(`  ${colors.cyan('⟳')} ${colors.bold('sync-kit')}`);
}

/**
 * Display a simple header
 */
export function displayHeader(text: string): void {
  console.log();
  console.log(`  ${colors.bold(text)}`);
  console.log();
}

/**
 * Display repository info section
 */
export function displayRepoInfo(info: {
  repo: string;
  branch: string;
  commit: string;
  dirty?: boolean;
}): void {
  console.log();
  console.log(`  ${colors.dim('Repository:')} ${info.repo}`);
  console.log(
    `  ${colors.dim('Branch:')}     ${info.branch} ${colors.dim(`(${info.commit})`)}`
  );
  if (info.dirty !== undefined) {
    const status = info.dirty
      ? colors.warning('uncommitted changes')
      : colors.success('clean');
    console.log(`  ${colors.dim('Status:')}     ${status}`);
  }
}

/**
 * Display archive info section
 */
export function displayArchiveInfo(info: {
  path: string;
  created: string;
  size?: number;
  message?: string;
}): void {
  console.log();
  console.log(`  ${colors.dim('Archive:')}  ${info.path}`);
  console.log(`  ${colors.dim('Created:')}  ${new Date(info.created).toLocaleString()}`);

  if (info.size !== undefined) {
    const sizeStr = formatBytes(info.size);
    console.log(`  ${colors.dim('Size:')}     ${sizeStr}`);
  }

  if (info.message) {
    console.log(`  ${colors.dim('Message:')}  "${info.message}"`);
  }
}

/**
 * Display success footer
 */
export function displaySuccessFooter(message: string, details?: string): void {
  console.log();
  console.log(`  ${colors.success('✔')} ${colors.bold(message)}`);
  if (details) {
    console.log(`    ${colors.dim(details)}`);
  }
  console.log();
}

/**
 * Display error footer
 */
export function displayErrorFooter(message: string, details?: string): void {
  console.log();
  console.log(`  ${colors.error('✘')} ${colors.bold(message)}`);
  if (details) {
    console.log(`    ${colors.dim(details)}`);
  }
  console.log();
}

/**
 * Display warning message
 */
export function displayWarning(message: string): void {
  console.log();
  console.log(`  ${colors.warning('⚠')} ${message}`);
}

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
 * Display a result card with box drawing
 */
export interface ResultCardOptions {
  type: 'success' | 'error' | 'warning';
  title: string;
  fields: Array<{ label: string; value: string }>;
  stats?: { added?: number; modified?: number; deleted?: number; renamed?: number };
  footer?: string;
}

export function displayResultCard(options: ResultCardOptions): void {
  const { type, title, fields, stats, footer } = options;

  const borderColor = type === 'success' ? colors.success : type === 'error' ? colors.error : colors.warning;
  const icon = type === 'success' ? '✔' : type === 'error' ? '✘' : '⚠';
  const width = 52;

  // Top border
  console.log();
  console.log(`  ${borderColor('╭' + '─'.repeat(width) + '╮')}`);

  // Title
  const titleWithIcon = `${icon} ${title}`;
  const titlePadding = width - titleWithIcon.length - 1;
  console.log(`  ${borderColor('│')} ${type === 'success' ? colors.success(titleWithIcon) : type === 'error' ? colors.error(titleWithIcon) : colors.warning(titleWithIcon)}${' '.repeat(titlePadding)}${borderColor('│')}`);

  // Separator
  console.log(`  ${borderColor('├' + '─'.repeat(width) + '┤')}`);

  // Empty line
  console.log(`  ${borderColor('│')}${' '.repeat(width)}${borderColor('│')}`);

  // Fields
  const maxLabelLen = Math.max(...fields.map((f) => f.label.length));
  const maxValueLen = width - maxLabelLen - 6; // 6 = 2 (left padding) + 2 (between label and value) + 2 (right padding)

  for (const field of fields) {
    const label = field.label.padEnd(maxLabelLen);
    const rawValue = stripAnsi(field.value);
    const truncatedValue = truncatePath(rawValue, maxValueLen);
    const displayValue = rawValue === truncatedValue ? field.value : truncatedValue;
    const line = `${colors.dim(label)}  ${displayValue}`;
    const visibleLen = label.length + 2 + stripAnsi(displayValue).length;
    const padding = width - visibleLen - 2;
    console.log(`  ${borderColor('│')}  ${line}${' '.repeat(Math.max(0, padding))}${borderColor('│')}`);
  }

  // Stats line
  if (stats && (stats.added || stats.modified || stats.deleted || stats.renamed)) {
    console.log(`  ${borderColor('│')}${' '.repeat(width)}${borderColor('│')}`);

    const statParts: string[] = [];
    if (stats.added) statParts.push(colors.added(`+${stats.added}`));
    if (stats.modified) statParts.push(colors.modified(`~${stats.modified}`));
    if (stats.deleted) statParts.push(colors.deleted(`-${stats.deleted}`));
    if (stats.renamed) statParts.push(colors.renamed(`→${stats.renamed}`));

    const statsLine = statParts.join(colors.dim(' · '));
    const statsVisibleLen = statParts.reduce((acc, s) => acc + stripAnsi(s).length, 0) + (statParts.length - 1) * 3;
    const statsPadding = width - statsVisibleLen - 2;
    console.log(`  ${borderColor('│')}  ${statsLine}${' '.repeat(Math.max(0, statsPadding))}${borderColor('│')}`);
  }

  // Empty line
  console.log(`  ${borderColor('│')}${' '.repeat(width)}${borderColor('│')}`);

  // Footer
  if (footer) {
    const footerPadding = width - stripAnsi(footer).length - 2;
    console.log(`  ${borderColor('│')}  ${colors.dim(footer)}${' '.repeat(Math.max(0, footerPadding))}${borderColor('│')}`);
    console.log(`  ${borderColor('│')}${' '.repeat(width)}${borderColor('│')}`);
  }

  // Bottom border
  console.log(`  ${borderColor('╰' + '─'.repeat(width) + '╯')}`);
  console.log();
}

/**
 * Strip ANSI escape codes from string
 */
function stripAnsi(str: string): string {
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

/**
 * Truncate path to fit within maxLength, keeping filename visible
 */
function truncatePath(path: string, maxLength: number): string {
  if (path.length <= maxLength) return path;

  const sep = path.includes('/') ? '/' : '\\';
  const parts = path.split(sep);
  const filename = parts.pop() || '';

  // Always show filename, truncate directory part
  const ellipsis = '…';
  const availableForDir = maxLength - filename.length - ellipsis.length - 1;

  if (availableForDir <= 0) {
    // Filename itself is too long
    return ellipsis + filename.slice(-(maxLength - 1));
  }

  const dirPath = parts.join(sep);
  if (dirPath.length <= availableForDir) {
    return path;
  }

  // Show end of directory path
  const truncatedDir = dirPath.slice(-availableForDir);
  return ellipsis + truncatedDir + sep + filename;
}

/**
 * Display export success card
 */
export function displayExportSuccess(options: {
  archivePath: string;
  archiveSize: number;
  fileCount: number;
  stats: { added?: number; modified?: number; deleted?: number; renamed?: number };
  copiedToClipboard?: boolean;
  elapsed?: string;
}): void {
  const { archivePath, archiveSize, fileCount, stats, copiedToClipboard, elapsed } = options;

  displayResultCard({
    type: 'success',
    title: 'EXPORT COMPLETE',
    fields: [
      { label: 'Archive', value: archivePath },
      { label: 'Size', value: formatBytes(archiveSize) },
      { label: 'Files', value: `${fileCount} files` },
      ...(elapsed ? [{ label: 'Time', value: elapsed }] : []),
    ],
    stats,
    footer: copiedToClipboard ? '📋 Path copied to clipboard' : undefined,
  });
}

/**
 * Display import success card
 */
export function displayImportSuccess(options: {
  archivePath: string;
  appliedCount: number;
  stats: { added?: number; modified?: number; deleted?: number; renamed?: number };
  backupPath?: string;
  elapsed?: string;
}): void {
  const { archivePath, appliedCount, stats, backupPath, elapsed } = options;

  displayResultCard({
    type: 'success',
    title: 'IMPORT COMPLETE',
    fields: [
      { label: 'Archive', value: archivePath },
      { label: 'Applied', value: `${appliedCount} operations` },
      ...(backupPath ? [{ label: 'Backup', value: backupPath }] : []),
      ...(elapsed ? [{ label: 'Time', value: elapsed }] : []),
    ],
    stats,
  });
}
