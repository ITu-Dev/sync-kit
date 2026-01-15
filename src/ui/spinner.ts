import ora, { Ora } from 'ora';
import { colors } from './theme.js';

let currentSpinner: Ora | null = null;

/**
 * Start a spinner with a message
 */
export function startSpinner(message: string): Ora {
  if (currentSpinner) {
    currentSpinner.stop();
  }

  currentSpinner = ora({
    text: message,
    color: 'cyan',
    indent: 2,
  }).start();

  return currentSpinner;
}

/**
 * Update spinner text
 */
export function updateSpinner(message: string): void {
  if (currentSpinner) {
    currentSpinner.text = message;
  }
}

/**
 * Stop spinner with success
 */
export function succeedSpinner(message?: string): void {
  if (currentSpinner) {
    currentSpinner.succeed(message);
    currentSpinner = null;
  }
}

/**
 * Stop spinner with failure
 */
export function failSpinner(message?: string): void {
  if (currentSpinner) {
    currentSpinner.fail(message);
    currentSpinner = null;
  }
}

/**
 * Stop spinner with warning
 */
export function warnSpinner(message?: string): void {
  if (currentSpinner) {
    currentSpinner.warn(message);
    currentSpinner = null;
  }
}

/**
 * Stop spinner with info
 */
export function infoSpinner(message?: string): void {
  if (currentSpinner) {
    currentSpinner.info(message);
    currentSpinner = null;
  }
}

/**
 * Stop spinner without any symbol
 */
export function stopSpinner(): void {
  if (currentSpinner) {
    currentSpinner.stop();
    currentSpinner = null;
  }
}

/**
 * Run an async function with a spinner
 */
export async function withSpinner<T>(
  message: string,
  fn: () => Promise<T>,
  successMessage?: string
): Promise<T> {
  const spinner = startSpinner(message);

  try {
    const result = await fn();
    spinner.succeed(successMessage || message);
    return result;
  } catch (error) {
    spinner.fail(`${message} - failed`);
    throw error;
  }
}
