import boxen from 'boxen';
import { colors } from './theme.js';

const VERSION = '1.0.0';

/**
 * Display application banner
 */
export function displayBanner(subtitle?: string): void {
  const title = `sync-kit v${VERSION}`;
  const content = subtitle ? `${title}\n${subtitle}` : title;

  const box = boxen(content, {
    padding: { top: 0, bottom: 0, left: 2, right: 2 },
    margin: { top: 1, bottom: 0, left: 0, right: 0 },
    borderStyle: 'round',
    borderColor: 'cyan',
    title: '',
  });

  console.log(box);
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
