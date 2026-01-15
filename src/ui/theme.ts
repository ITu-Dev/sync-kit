import chalk from 'chalk';

/**
 * Color theme for the CLI
 */
export const colors = {
  // Operation colors
  added: chalk.green,
  modified: chalk.yellow,
  deleted: chalk.red,
  renamed: chalk.cyan,

  // Status colors
  success: chalk.green,
  warning: chalk.yellow,
  error: chalk.red,
  info: chalk.blue,

  // Text colors
  dim: chalk.dim,
  bold: chalk.bold,
  muted: chalk.gray,
  highlight: chalk.cyan,
  path: chalk.white,
  size: chalk.gray,

  // Special
  primary: chalk.cyan,
  secondary: chalk.magenta,
  cyan: chalk.cyan,
};

/**
 * Symbols for different states
 */
export const symbols = {
  // Operations
  add: '✚',
  modify: '●',
  delete: '✖',
  rename: '→',

  // Status
  success: '✔',
  warning: '⚠',
  error: '✘',
  info: 'ℹ',

  // Progress
  bullet: '•',
  pointer: '❯',
  line: '│',
  corner: '└',
  tee: '├',

  // Box drawing
  topLeft: '╭',
  topRight: '╮',
  bottomLeft: '╰',
  bottomRight: '╯',
  horizontal: '─',
  vertical: '│',

  // Misc
  arrow: '→',
  arrowRight: '➜',
  check: '✓',
  cross: '✗',
  star: '★',
  heart: '♥',
  play: '▶',
  square: '■',
  squareSmall: '◼',
  circle: '●',
  circleFilled: '◉',
  circleEmpty: '○',
};

/**
 * Get colored symbol for operation type
 */
export function getOperationSymbol(type: 'add' | 'modify' | 'delete' | 'rename'): string {
  switch (type) {
    case 'add':
      return colors.added(symbols.add);
    case 'modify':
      return colors.modified(symbols.modify);
    case 'delete':
      return colors.deleted(symbols.delete);
    case 'rename':
      return colors.renamed(symbols.rename);
  }
}

/**
 * Get colored label for operation type
 */
export function getOperationLabel(type: 'add' | 'modify' | 'delete' | 'rename'): string {
  switch (type) {
    case 'add':
      return colors.added('added');
    case 'modify':
      return colors.modified('modified');
    case 'delete':
      return colors.deleted('deleted');
    case 'rename':
      return colors.renamed('renamed');
  }
}

/**
 * Format a path with appropriate styling
 */
export function formatPath(path: string): string {
  return colors.path(path);
}

/**
 * Format file size
 */
export function formatSize(bytes: number): string {
  if (bytes === 0) return colors.muted('—');

  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);

  return colors.size(`${value.toFixed(i > 0 ? 1 : 0)} ${units[i]}`);
}

/**
 * Create a horizontal line
 */
export function horizontalLine(length: number = 50): string {
  return colors.dim(symbols.horizontal.repeat(length));
}
