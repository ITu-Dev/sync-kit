/**
 * Animation utilities for CLI output
 */

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Print lines with staggered animation
 */
export async function printLinesAnimated(
  lines: string[],
  options: { delay?: number; indent?: string } = {}
): Promise<void> {
  const { delay = 25, indent = '' } = options;

  for (const line of lines) {
    console.log(`${indent}${line}`);
    await sleep(delay);
  }
}

/**
 * Typewriter effect for text
 */
export async function typewrite(
  text: string,
  options: { charDelay?: number; indent?: string } = {}
): Promise<void> {
  const { charDelay = 15, indent = '' } = options;

  process.stdout.write(indent);
  for (const char of text) {
    process.stdout.write(char);
    await sleep(charDelay);
  }
  console.log();
}

/**
 * Print with fade-in effect (character by character reveal)
 */
export async function fadeIn(
  text: string,
  options: { duration?: number; indent?: string } = {}
): Promise<void> {
  const { duration = 300, indent = '' } = options;
  const charDelay = duration / text.length;

  process.stdout.write(indent);
  for (const char of text) {
    process.stdout.write(char);
    await sleep(charDelay);
  }
  console.log();
}

/**
 * Animate list items appearing one by one
 */
export async function animateList<T>(
  items: T[],
  renderItem: (item: T, index: number) => string,
  options: { delay?: number; indent?: string; maxItems?: number } = {}
): Promise<void> {
  const { delay = 30, indent = '  ', maxItems = 50 } = options;
  const displayItems = items.slice(0, maxItems);

  for (let i = 0; i < displayItems.length; i++) {
    console.log(`${indent}${renderItem(displayItems[i], i)}`);
    await sleep(delay);
  }

  if (items.length > maxItems) {
    await sleep(delay);
    console.log(`${indent}... and ${items.length - maxItems} more`);
  }
}

/**
 * Countdown animation
 */
export async function countdown(
  seconds: number,
  message: string = 'Starting in'
): Promise<void> {
  for (let i = seconds; i > 0; i--) {
    process.stdout.write(`\r  ${message} ${i}...`);
    await sleep(1000);
  }
  process.stdout.write('\r' + ' '.repeat(50) + '\r');
}

/**
 * Flash text effect
 */
export async function flash(text: string, times: number = 3): Promise<void> {
  for (let i = 0; i < times; i++) {
    process.stdout.write(`\r  ${text}`);
    await sleep(200);
    process.stdout.write(`\r  ${' '.repeat(text.length)}`);
    await sleep(100);
  }
  console.log(`  ${text}`);
}

/**
 * Reveal text from left to right with a cursor
 */
export async function revealText(
  text: string,
  options: { charDelay?: number; cursor?: string; indent?: string } = {}
): Promise<void> {
  const { charDelay = 20, cursor = '▌', indent = '' } = options;

  for (let i = 0; i <= text.length; i++) {
    const revealed = text.slice(0, i);
    const cursorChar = i < text.length ? cursor : '';
    process.stdout.write(`\r${indent}${revealed}${cursorChar}`);
    await sleep(charDelay);
  }
  console.log();
}

/**
 * Animate progress through stages
 */
export async function animateStages(
  stages: Array<{ label: string; action: () => Promise<void> }>,
  options: { successSymbol?: string; indent?: string } = {}
): Promise<void> {
  const { successSymbol = '✔', indent = '  ' } = options;

  for (const stage of stages) {
    process.stdout.write(`${indent}${stage.label}...`);
    await stage.action();
    console.log(` ${successSymbol}`);
  }
}
