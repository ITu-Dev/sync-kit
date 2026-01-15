import { colors } from './theme.js';

const PROGRESS_BAR_WIDTH = 40;

/**
 * Create a progress bar string
 */
export function createProgressBar(current: number, total: number): string {
  const percentage = total > 0 ? current / total : 0;
  const filled = Math.round(PROGRESS_BAR_WIDTH * percentage);
  const empty = PROGRESS_BAR_WIDTH - filled;

  const filledBar = colors.primary('█'.repeat(filled));
  const emptyBar = colors.dim('░'.repeat(empty));
  const percentText = colors.dim(`${Math.round(percentage * 100)}%`);

  return `[${filledBar}${emptyBar}] ${percentText}`;
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
 * Complete progress and move to new line
 */
export function completeProgress(): void {
  console.log();
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
