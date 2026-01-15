import { colors, symbols } from './theme.js';

/**
 * Logger utility for consistent output
 */
export const logger = {
  /**
   * Print a blank line
   */
  newline(): void {
    console.log();
  },

  /**
   * Print regular text
   */
  log(message: string): void {
    console.log(message);
  },

  /**
   * Print indented text
   */
  indent(message: string, level: number = 1): void {
    const indent = '  '.repeat(level);
    console.log(`${indent}${message}`);
  },

  /**
   * Print success message
   */
  success(message: string): void {
    console.log(`  ${colors.success(symbols.success)} ${message}`);
  },

  /**
   * Print warning message
   */
  warn(message: string): void {
    console.log(`  ${colors.warning(symbols.warning)} ${message}`);
  },

  /**
   * Print error message
   */
  error(message: string): void {
    console.log(`  ${colors.error(symbols.error)} ${message}`);
  },

  /**
   * Print info message
   */
  info(message: string): void {
    console.log(`  ${colors.info(symbols.info)} ${message}`);
  },

  /**
   * Print dimmed text
   */
  dim(message: string): void {
    console.log(colors.dim(message));
  },

  /**
   * Print a key-value pair
   */
  keyValue(key: string, value: string, indent: number = 1): void {
    const spaces = '  '.repeat(indent);
    console.log(`${spaces}${colors.muted(key + ':')} ${value}`);
  },

  /**
   * Print a list item
   */
  listItem(message: string, indent: number = 1): void {
    const spaces = '  '.repeat(indent);
    console.log(`${spaces}${colors.dim(symbols.bullet)} ${message}`);
  },

  /**
   * Print a tree item with connector
   */
  treeItem(message: string, isLast: boolean = false, indent: number = 1): void {
    const spaces = '  '.repeat(indent - 1);
    const connector = isLast ? symbols.corner : symbols.tee;
    console.log(`${spaces}${colors.dim(connector)} ${message}`);
  },

  /**
   * Print a section header
   */
  section(title: string): void {
    console.log();
    console.log(`  ${colors.bold(title)}`);
    console.log();
  },

  /**
   * Print a subsection with border
   */
  subsection(title: string): void {
    console.log();
    console.log(`  ${colors.dim('┌─')} ${colors.bold(title)} ${colors.dim('─'.repeat(40 - title.length))}`);
  },

  /**
   * Print bordered content line
   */
  bordered(message: string): void {
    console.log(`  ${colors.dim(symbols.vertical)}  ${message}`);
  },

  /**
   * End bordered section
   */
  borderEnd(): void {
    console.log(`  ${colors.dim(symbols.corner + symbols.horizontal.repeat(45))}`);
  },

  /**
   * Print a divider line
   */
  divider(char: string = '─', length: number = 50): void {
    console.log();
    console.log(colors.dim(char.repeat(length)));
    console.log();
  },

  /**
   * Clear the current line
   */
  clearLine(): void {
    process.stdout.write('\r\x1b[K');
  },

  /**
   * Print on same line (for progress updates)
   */
  sameLine(message: string): void {
    process.stdout.write(`\r${message}`);
  },
};
