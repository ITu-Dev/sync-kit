import { colors, symbols } from './theme.js';

const PROGRESS_BAR_WIDTH = 25;

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

/**
 * Truncate string with ellipsis
 */
function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return '…' + str.slice(-(maxLength - 1));
}

/**
 * Create a progress bar string
 */
export function createProgressBar(current: number, total: number): string {
  const percentage = total > 0 ? current / total : 0;
  const filled = Math.round(PROGRESS_BAR_WIDTH * percentage);
  const empty = PROGRESS_BAR_WIDTH - filled;

  const filledBar = colors.primary('█'.repeat(filled));
  const emptyBar = colors.dim('░'.repeat(empty));
  const percentText = `${Math.round(percentage * 100)}%`.padStart(4);

  return `${filledBar}${emptyBar} ${colors.bold(percentText)}`;
}

/**
 * Create enhanced progress bar with details
 */
export function createDetailedProgressBar(options: {
  current: number;
  total: number;
  currentFile?: string;
  processedSize?: number;
  totalSize?: number;
}): string {
  const { current, total, currentFile, processedSize, totalSize } = options;
  const percentage = total > 0 ? current / total : 0;
  const filled = Math.round(PROGRESS_BAR_WIDTH * percentage);
  const empty = PROGRESS_BAR_WIDTH - filled;

  const filledBar = colors.cyan('█'.repeat(filled));
  const emptyBar = colors.dim('░'.repeat(empty));
  const percentText = `${Math.round(percentage * 100)}%`.padStart(4);

  // Build parts
  const parts: string[] = [];

  // Progress bar
  parts.push(`${filledBar}${emptyBar}`);

  // Percentage
  parts.push(colors.bold(percentText));

  // File counter
  parts.push(colors.dim('│'));
  parts.push(colors.dim(`${current}/${total}`));

  // Size info
  if (processedSize !== undefined && totalSize !== undefined && totalSize > 0) {
    parts.push(colors.dim('│'));
    parts.push(colors.dim(`${formatBytes(processedSize)}`));
  }

  return parts.join(' ');
}

/**
 * Display progress bar on same line
 */
export function showProgress(current: number, total: number, message?: string): void {
  const bar = createProgressBar(current, total);
  const suffix = message ? ` ${colors.dim(message)}` : '';

  process.stdout.write(`\r  ${bar}${suffix}`);
}

/**
 * Display detailed progress with current file
 */
export function showDetailedProgress(options: {
  current: number;
  total: number;
  currentFile?: string;
  processedSize?: number;
  totalSize?: number;
  label?: string;
}): void {
  const { currentFile, label } = options;
  const bar = createDetailedProgressBar(options);

  // Clear line and show progress
  process.stdout.write('\x1b[2K\r');
  process.stdout.write(`  ${bar}`);

  // Show current file on next line if provided
  if (currentFile) {
    const truncatedFile = truncate(currentFile, 45);
    process.stdout.write(`\n\x1b[2K\r  ${colors.dim(symbols.pointer)} ${colors.dim(truncatedFile)}`);
    process.stdout.write('\x1b[1A'); // Move cursor up
  }
}

/**
 * Complete progress and move to new line
 */
export function completeProgress(showNewline: boolean = true): void {
  process.stdout.write('\x1b[2K\r'); // Clear current line
  if (showNewline) {
    console.log();
  }
}

/**
 * Progress tracker class for more complex progress scenarios
 */
export class ProgressTracker {
  private current: number = 0;
  private total: number;
  private message: string;
  private startTime: number;

  constructor(total: number, message: string = '') {
    this.total = total;
    this.message = message;
    this.startTime = Date.now();
  }

  /**
   * Increment progress by one
   */
  tick(message?: string): void {
    this.current++;
    if (message) {
      this.message = message;
    }
    this.render();
  }

  /**
   * Set progress to specific value
   */
  update(current: number, message?: string): void {
    this.current = current;
    if (message) {
      this.message = message;
    }
    this.render();
  }

  /**
   * Render progress bar
   */
  private render(): void {
    showProgress(this.current, this.total, this.message);
  }

  /**
   * Complete progress
   */
  complete(): void {
    this.current = this.total;
    this.render();
    completeProgress();
  }

  /**
   * Get elapsed time in ms
   */
  getElapsed(): number {
    return Date.now() - this.startTime;
  }

  /**
   * Get formatted elapsed time
   */
  getElapsedFormatted(): string {
    const elapsed = this.getElapsed();

    if (elapsed < 1000) {
      return `${elapsed}ms`;
    } else if (elapsed < 60000) {
      return `${(elapsed / 1000).toFixed(1)}s`;
    } else {
      const minutes = Math.floor(elapsed / 60000);
      const seconds = Math.round((elapsed % 60000) / 1000);
      return `${minutes}m ${seconds}s`;
    }
  }
}

/**
 * Create a simple counter display
 */
export function displayCounter(current: number, total: number): string {
  return colors.dim(`[${current}/${total}]`);
}

/**
 * Enhanced progress tracker with detailed display
 */
export class DetailedProgressTracker {
  private current: number = 0;
  private total: number;
  private processedSize: number = 0;
  private totalSize: number;
  private currentFile: string = '';
  private startTime: number;
  private label: string;

  constructor(options: { total: number; totalSize?: number; label?: string }) {
    this.total = options.total;
    this.totalSize = options.totalSize || 0;
    this.label = options.label || '';
    this.startTime = Date.now();
  }

  /**
   * Increment progress with file info
   */
  tick(file: string, fileSize: number = 0): void {
    this.current++;
    this.currentFile = file;
    this.processedSize += fileSize;
    this.render();
  }

  /**
   * Update progress
   */
  update(current: number, file?: string): void {
    this.current = current;
    if (file) {
      this.currentFile = file;
    }
    this.render();
  }

  /**
   * Render detailed progress
   */
  private render(): void {
    showDetailedProgress({
      current: this.current,
      total: this.total,
      currentFile: this.currentFile,
      processedSize: this.processedSize,
      totalSize: this.totalSize,
      label: this.label,
    });
  }

  /**
   * Complete and clear
   */
  complete(): void {
    this.current = this.total;
    process.stdout.write('\x1b[2K\r'); // Clear progress line
    if (this.currentFile) {
      process.stdout.write('\n\x1b[2K\r'); // Clear file line
      process.stdout.write('\x1b[1A'); // Move up
    }
  }

  /**
   * Get elapsed time in ms
   */
  getElapsed(): number {
    return Date.now() - this.startTime;
  }

  /**
   * Get formatted elapsed time
   */
  getElapsedFormatted(): string {
    const elapsed = this.getElapsed();
    if (elapsed < 1000) {
      return `${elapsed}ms`;
    } else if (elapsed < 60000) {
      return `${(elapsed / 1000).toFixed(1)}s`;
    } else {
      const minutes = Math.floor(elapsed / 60000);
      const seconds = Math.round((elapsed % 60000) / 1000);
      return `${minutes}m ${seconds}s`;
    }
  }
}
