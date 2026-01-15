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

/**
 * File type icons mapping
 */
const fileIcons: Record<string, string> = {
  // JavaScript/TypeScript
  js: '󰌞',
  jsx: '⚛',
  ts: '󰛦',
  tsx: '⚛',
  mjs: '󰌞',
  cjs: '󰌞',

  // Web
  html: '󰌝',
  htm: '󰌝',
  css: '󰌜',
  scss: '󰌜',
  sass: '󰌜',
  less: '󰌜',
  svg: '󰜡',

  // Data
  json: '󰘦',
  yaml: '󰈙',
  yml: '󰈙',
  xml: '󰗀',
  toml: '󰈙',

  // Config
  env: '󰒓',
  gitignore: '󰊢',
  eslintrc: '󰱺',
  prettierrc: '󰬗',
  editorconfig: '󰒓',

  // Docs
  md: '󰍔',
  mdx: '󰍔',
  txt: '󰈙',
  pdf: '󰈦',
  doc: '󰈬',
  docx: '󰈬',

  // Images
  png: '󰋩',
  jpg: '󰋩',
  jpeg: '󰋩',
  gif: '󰋩',
  webp: '󰋩',
  ico: '󰋩',

  // Other languages
  py: '󰌠',
  rb: '󰴭',
  go: '󰟓',
  rs: '󱘗',
  java: '󰬷',
  kt: '󱈙',
  swift: '󰛥',
  php: '󰌟',
  c: '󰙱',
  cpp: '󰙲',
  h: '󰙲',
  cs: '󰌛',

  // Shell
  sh: '󰆍',
  bash: '󰆍',
  zsh: '󰆍',
  fish: '󰆍',

  // Package
  lock: '󰌾',

  // Build
  dockerfile: '󰡨',
  makefile: '󱁤',

  // Default
  default: '󰈔',
  folder: '󰉋',
};

/**
 * Simple fallback icons (ASCII-safe)
 */
const simpleFileIcons: Record<string, string> = {
  // JavaScript/TypeScript
  js: '📜',
  jsx: '⚛️',
  ts: '📘',
  tsx: '⚛️',

  // Web
  html: '🌐',
  css: '🎨',
  scss: '🎨',

  // Data
  json: '📋',
  yaml: '📋',
  yml: '📋',
  xml: '📋',

  // Config
  env: '⚙️',
  gitignore: '🚫',

  // Docs
  md: '📝',
  txt: '📄',
  pdf: '📕',

  // Images
  png: '🖼️',
  jpg: '🖼️',
  jpeg: '🖼️',
  gif: '🖼️',
  svg: '🎨',

  // Languages
  py: '🐍',
  rb: '💎',
  go: '🐹',
  rs: '🦀',
  java: '☕',
  php: '🐘',
  sh: '🐚',

  // Package/Lock
  lock: '🔒',

  // Build
  dockerfile: '🐳',

  // Default
  default: '📄',
  folder: '📁',
};

/**
 * Get file icon by extension or filename
 */
export function getFileIcon(filename: string, useNerdFont: boolean = false): string {
  const icons = useNerdFont ? fileIcons : simpleFileIcons;
  const lowerName = filename.toLowerCase();

  // Check for special filenames
  if (lowerName === 'dockerfile') return icons.dockerfile || icons.default;
  if (lowerName === 'makefile') return icons.makefile || icons.default;
  if (lowerName.startsWith('.env')) return icons.env || icons.default;
  if (lowerName === '.gitignore') return icons.gitignore || icons.default;
  if (lowerName.includes('eslint')) return icons.eslintrc || icons.default;
  if (lowerName.includes('prettier')) return icons.prettierrc || icons.default;
  if (lowerName.endsWith('.lock') || lowerName.endsWith('-lock.json') || lowerName.endsWith('.lockb')) {
    return icons.lock || icons.default;
  }

  // Get extension
  const ext = filename.split('.').pop()?.toLowerCase() || '';

  return icons[ext] || icons.default;
}

/**
 * Get folder icon
 */
export function getFolderIcon(useNerdFont: boolean = false): string {
  return useNerdFont ? fileIcons.folder : simpleFileIcons.folder;
}
