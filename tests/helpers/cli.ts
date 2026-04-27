import { spawn } from 'node:child_process';
import { join } from 'node:path';

const REPO_ROOT = join(import.meta.dirname, '..', '..');
const CLI_ENTRY = join(REPO_ROOT, 'src', 'index.ts');
const TSX_BIN = join(REPO_ROOT, 'node_modules', '.bin', 'tsx');

export interface CliResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Run the sync-kit CLI via tsx in a subprocess. Captures stdout/stderr
 * and exit code without leaking output into the test reporter.
 *
 * Each call is a fresh process — flags / state never leak between tests.
 */
export function runCli(args: string[], cwd: string, env?: Record<string, string>): Promise<CliResult> {
  return new Promise((resolve) => {
    const child = spawn(TSX_BIN, [CLI_ENTRY, ...args], {
      cwd,
      env: { ...process.env, ...env, NO_COLOR: '1', FORCE_COLOR: '0' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('close', (code) => {
      resolve({ stdout, stderr, exitCode: code ?? -1 });
    });
  });
}
