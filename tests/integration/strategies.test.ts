import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { simpleGit } from 'simple-git';
import { executeExport } from '../../src/commands/export.js';
import { executeImport } from '../../src/commands/import.js';
import { resetGit } from '../../src/core/git.js';
import { createTmpRepo, createTmpDir } from '../helpers/tmp-repo.js';

describe('history strategies (fast-forward, force, checkout)', () => {
  const cleanups: Array<() => Promise<void>> = [];
  const originalCwd = process.cwd();

  beforeEach(() => resetGit());

  afterEach(async () => {
    process.chdir(originalCwd);
    resetGit();
    await Promise.all(cleanups.splice(0).map((fn) => fn().catch(() => {})));
  });

  /** Build a history-only archive of the source repo. */
  async function exportHistory(source: { path: string }): Promise<string> {
    process.chdir(source.path);
    const archivePath = join(source.path, 'h.zip');
    await executeExport({
      mode: 'history',
      historyOnly: true,
      quick: true,
      output: archivePath,
    });
    return archivePath;
  }

  it('fast-forward succeeds when target is strict ancestor', async () => {
    // Source: ancestor → newer
    const source = await createTmpRepo('main');
    cleanups.push(() => source.dispose());
    const ancestor = await source.commit('a.txt', 'v1', 'v1');
    const newer = await source.commit('a.txt', 'v2', 'v2');

    // Target: seed main = ancestor (fetch from source with --update-head-ok
    // since main is currently checked out, then hard-reset WT to match).
    const target = await createTmpRepo('main');
    cleanups.push(() => target.dispose());
    await target.commit('seed.txt', 'seed', 'seed');
    await target.raw(['fetch', '--update-head-ok', source.path, `+${ancestor}:refs/heads/main`]);
    await target.raw(['reset', '--hard', 'refs/heads/main']);

    const archivePath = await exportHistory(source);
    process.chdir(target.path);
    await executeImport(archivePath, {
      target: target.path,
      force: true,
      noBackup: true,
      historyStrategy: 'fast-forward',
    });

    const headSha = (await simpleGit(target.path).raw(['rev-parse', 'refs/heads/main'])).trim();
    expect(headSha).toBe(newer);
  });

  it('fast-forward fails when target has divergent history', async () => {
    const source = await createTmpRepo('main');
    cleanups.push(() => source.dispose());
    await source.commit('a.txt', 'source-v1', 'source');

    const target = await createTmpRepo('main');
    cleanups.push(() => target.dispose());
    const targetSha = await target.commit('a.txt', 'target-v1', 'target');

    const archivePath = await exportHistory(source);
    process.chdir(target.path);

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);

    await executeImport(archivePath, {
      target: target.path,
      force: true,
      noBackup: true,
      historyStrategy: 'fast-forward',
    });

    expect(exitSpy).toHaveBeenCalledWith(1);
    const headSha = (await simpleGit(target.path).raw(['rev-parse', 'refs/heads/main'])).trim();
    expect(headSha).toBe(targetSha);

    exitSpy.mockRestore();
  });

  it('force overwrites refs/heads/* even on divergent history', async () => {
    const source = await createTmpRepo('main');
    cleanups.push(() => source.dispose());
    const sourceSha = await source.commit('a.txt', 'source-v1', 'source');

    const target = await createTmpRepo('main');
    cleanups.push(() => target.dispose());
    await target.commit('a.txt', 'target-v1', 'target');

    const archivePath = await exportHistory(source);
    process.chdir(target.path);

    await executeImport(archivePath, {
      target: target.path,
      force: true,
      noBackup: true,
      historyStrategy: 'force',
    });

    const headSha = (await simpleGit(target.path).raw(['rev-parse', 'refs/heads/main'])).trim();
    expect(headSha).toBe(sourceSha);
  });

  it('--checkout syncs working tree to new HEAD after force fetch', async () => {
    const source = await createTmpRepo('main');
    cleanups.push(() => source.dispose());
    await source.commit('a.txt', 'source-content', 'source');

    const target = await createTmpRepo('main');
    cleanups.push(() => target.dispose());
    await target.commit('a.txt', 'target-content', 'target');

    const archivePath = await exportHistory(source);
    process.chdir(target.path);

    await executeImport(archivePath, {
      target: target.path,
      force: true,
      noBackup: true,
      historyStrategy: 'force',
      checkout: true,
    });

    expect(readFileSync(join(target.path, 'a.txt'), 'utf-8')).toBe('source-content');
  });

  it('refuses on non-git target without --init-if-empty when archive has bundle', async () => {
    const source = await createTmpRepo('main');
    cleanups.push(() => source.dispose());
    await source.commit('a.txt', 'v1', 'v1');
    const archivePath = await exportHistory(source);

    const empty = await createTmpDir();
    cleanups.push(empty.dispose);

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);

    await executeImport(archivePath, {
      target: empty.path,
      force: true,
      noBackup: true,
      historyStrategy: 'fast-forward',
    });

    expect(exitSpy).toHaveBeenCalledWith(1);
    exitSpy.mockRestore();
  });
});
