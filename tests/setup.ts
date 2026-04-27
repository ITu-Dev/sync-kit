import { beforeEach, afterEach, vi } from 'vitest';

/**
 * Suppress sync-kit UI output (spinners/banners/logger) during tests so
 * the test reporter stays readable. Restored automatically per-test.
 *
 * If a test needs to assert on stdout/stderr, it can opt out by spying
 * with `mockImplementation(...)` after this setup runs.
 */

let stdoutSpy: ReturnType<typeof vi.spyOn>;
let stderrSpy: ReturnType<typeof vi.spyOn>;
let consoleLogSpy: ReturnType<typeof vi.spyOn>;
let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  stdoutSpy.mockRestore();
  stderrSpy.mockRestore();
  consoleLogSpy.mockRestore();
  consoleErrorSpy.mockRestore();
});
