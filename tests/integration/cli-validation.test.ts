import { describe, it, expect, afterEach } from 'vitest';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { createTmpRepo, createTmpDir } from '../helpers/tmp-repo.js';
import { runCli } from '../helpers/cli.js';

describe('CLI validation and parsing (child_process)', () => {
  const cleanups: Array<() => Promise<void>> = [];

  afterEach(async () => {
    await Promise.all(cleanups.splice(0).map((fn) => fn().catch(() => {})));
  });

  it('--version prints 1.1.0 and exits 0', async () => {
    const r = await runCli(['--version'], '/tmp');
    expect(r.exitCode).toBe(0);
    expect(r.stdout.trim()).toBe('1.1.0');
  });

  it('export --help lists history flags', async () => {
    const r = await runCli(['export', '--help'], '/tmp');
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toContain('--with-history');
    expect(r.stdout).toContain('--history-only');
    expect(r.stdout).toContain('--branches');
  });

  it('import --help lists strategy flags', async () => {
    const r = await runCli(['import', '--help'], '/tmp');
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toContain('--history-strategy');
    expect(r.stdout).toContain('--init-if-empty');
    expect(r.stdout).toContain('--checkout');
  });

  it('export --history-only --full → exit ≠ 0 (mutually exclusive)', async () => {
    const repo = await createTmpRepo('main');
    cleanups.push(() => repo.dispose());
    await repo.commit('a.txt', 'x', 'x');

    const r = await runCli(['export', '--history-only', '--full'], repo.path);
    expect(r.exitCode).not.toBe(0);
    expect(r.stderr + r.stdout).toMatch(/mutually exclusive/);
  });

  it('export --with-history --dirs → exit ≠ 0 (block)', async () => {
    const repo = await createTmpRepo('main');
    cleanups.push(() => repo.dispose());
    await repo.commit('a.txt', 'x', 'x');

    const r = await runCli(['export', '--with-history', '--dirs', 'src'], repo.path);
    expect(r.exitCode).not.toBe(0);
    expect(r.stderr + r.stdout).toMatch(/Cannot combine --with-history with --dirs/);
  });

  it('export --with-history --include "*.ts" → exit ≠ 0 (block)', async () => {
    const repo = await createTmpRepo('main');
    cleanups.push(() => repo.dispose());
    await repo.commit('a.txt', 'x', 'x');

    const r = await runCli(['export', '--with-history', '--include', '*.ts'], repo.path);
    expect(r.exitCode).not.toBe(0);
    expect(r.stderr + r.stdout).toMatch(/--include\/--exclude/);
  });

  it('import non-existent.zip → exit ≠ 0 (file not found)', async () => {
    const repo = await createTmpRepo('main');
    cleanups.push(() => repo.dispose());
    await repo.commit('a.txt', 'x', 'x');

    const r = await runCli(['import', '/tmp/does-not-exist-12345.zip', '-f'], repo.path);
    expect(r.exitCode).not.toBe(0);
    expect(r.stderr + r.stdout).toMatch(/Archive not found/);
  });

  it('export -q -o creates archive and exits 0', async () => {
    const repo = await createTmpRepo('main');
    cleanups.push(() => repo.dispose());
    await repo.commit('a.txt', 'baseline', 'baseline');
    await repo.write('a.txt', 'dirty');

    const out = join(repo.path, 'cli-out.zip');
    const r = await runCli(['export', '-q', '-o', out], repo.path);
    expect(r.exitCode).toBe(0);
    expect(existsSync(out)).toBe(true);
  });

  it('import non-git target without --init-if-empty when archive has bundle → exit ≠ 0', async () => {
    const source = await createTmpRepo('main');
    cleanups.push(() => source.dispose());
    await source.commit('a.txt', 'v1', 'v1');
    const archivePath = join(source.path, 'h.zip');
    const exportR = await runCli(['export', '--history-only', '-q', '-o', archivePath], source.path);
    expect(exportR.exitCode).toBe(0);

    const empty = await createTmpDir();
    cleanups.push(empty.dispose);

    const r = await runCli(
      ['import', archivePath, '-t', empty.path, '-f', '--history-strategy', 'fast-forward'],
      empty.path
    );
    expect(r.exitCode).not.toBe(0);
    expect(r.stderr + r.stdout).toMatch(/--init-if-empty/);
  });

  it('export --history-only -q from non-git directory → exit ≠ 0', async () => {
    const empty = await createTmpDir();
    cleanups.push(empty.dispose);

    const r = await runCli(['export', '--history-only', '-q'], empty.path);
    expect(r.exitCode).not.toBe(0);
    expect(r.stderr + r.stdout).toMatch(/git/i);
  });
});
