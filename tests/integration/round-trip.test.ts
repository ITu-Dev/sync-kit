import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { join } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { simpleGit } from 'simple-git';
import { executeExport } from '../../src/commands/export.js';
import { executeImport } from '../../src/commands/import.js';
import { resetGit } from '../../src/core/git.js';
import { createTmpRepo, createTmpDir } from '../helpers/tmp-repo.js';

/**
 * End-to-end tests of the export → import flow.
 *
 * executeExport / executeImport call process.cwd() as their default target,
 * so each test temporarily chdir's into the relevant repo. resetGit() clears
 * the simple-git singleton between scenarios so a stale instance from one
 * test doesn't leak into the next.
 */
describe('export → import round-trip with history', () => {
  const cleanups: Array<() => Promise<void>> = [];
  const originalCwd = process.cwd();

  beforeEach(() => {
    resetGit();
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    resetGit();
    await Promise.all(cleanups.splice(0).map((fn) => fn().catch(() => {})));
  });

  it('--with-history then --init-if-empty reproduces source state in empty target', async () => {
    // --- Source: two branches, source HEAD on main, dirty edit in WT ---
    const source = await createTmpRepo('main');
    cleanups.push(() => source.dispose());
    const v1Sha = await source.commit('a.txt', 'v1', 'v1');
    const v2Sha = await source.commit('a.txt', 'v2', 'v2');
    await source.raw(['checkout', '-b', 'feature/x']);
    const featSha = await source.commit('b.txt', 'feature', 'feat');
    await source.raw(['checkout', 'main']);
    await source.write('a.txt', 'wip'); // dirty

    // Export
    process.chdir(source.path);
    const archivePath = join(source.path, 'archive.zip');
    await executeExport({
      mode: 'changes',
      withHistory: true,
      quick: true,
      output: archivePath,
    });
    expect(existsSync(archivePath)).toBe(true);

    // --- Target: empty dir ---
    const target = await createTmpDir();
    cleanups.push(target.dispose);
    process.chdir(target.path);

    await executeImport(archivePath, {
      target: target.path,
      force: true,
      noBackup: true,
      initIfEmpty: true,
      historyStrategy: 'fast-forward',
    });

    // --- Assertions ---
    const targetGit = simpleGit(target.path);

    // All three commits present
    const log = (await targetGit.raw(['log', '--all', '--format=%H'])).trim().split('\n');
    expect(log.sort()).toEqual([v1Sha, v2Sha, featSha].sort());

    // Both branches exist
    const branches = (await targetGit.raw(['branch'])).split('\n').map((b) => b.trim().replace(/^\*\s*/, ''));
    expect(branches).toContain('main');
    expect(branches).toContain('feature/x');

    // Currently checked out: main (source HEAD), NOT feature/x (alphabetical first)
    const current = (await targetGit.raw(['branch', '--show-current'])).trim();
    expect(current).toBe('main');

    // Dirty edit applied on top
    expect(readFileSync(join(target.path, 'a.txt'), 'utf-8')).toBe('wip');
  });

  it('--history-only produces an archive with bundle and no files/', async () => {
    const source = await createTmpRepo('main');
    cleanups.push(() => source.dispose());
    await source.commit('a.txt', 'v1', 'v1');

    process.chdir(source.path);
    const archivePath = join(source.path, 'history.zip');

    await executeExport({
      mode: 'history',
      historyOnly: true,
      quick: true,
      output: archivePath,
    });

    expect(existsSync(archivePath)).toBe(true);

    // Inspect zip contents via adm-zip directly
    const AdmZip = (await import('adm-zip')).default;
    const zip = new AdmZip(archivePath);
    const entries = zip.getEntries().map((e) => e.entryName);
    expect(entries).toContain('manifest.json');
    expect(entries).toContain('meta/repo.pack');
    expect(entries.some((e) => e.startsWith('files/'))).toBe(false);
  });

  it('--no-history skips bundle apply on import even when archive carries one', async () => {
    const source = await createTmpRepo('main');
    cleanups.push(() => source.dispose());
    await source.commit('a.txt', 'source-v1', 'source-v1');
    await source.write('a.txt', 'source-wip');

    process.chdir(source.path);
    const archivePath = join(source.path, 'archive.zip');
    await executeExport({
      mode: 'changes',
      withHistory: true,
      quick: true,
      output: archivePath,
    });

    const target = await createTmpRepo('main');
    cleanups.push(() => target.dispose());
    const targetSha = await target.commit('a.txt', 'target-v0', 'target-v0');

    process.chdir(target.path);
    await executeImport(archivePath, {
      target: target.path,
      force: true,
      noBackup: true,
      noHistory: true,
    });

    // Target still on its original commit — no refs/sync-kit/* created
    const refs = await simpleGit(target.path).raw(['for-each-ref', '--format=%(refname)']);
    expect(refs).not.toContain('refs/sync-kit/');
    const headSha = (await simpleGit(target.path).raw(['rev-parse', 'HEAD'])).trim();
    expect(headSha).toBe(targetSha);

    // But the file overlay still applied
    expect(readFileSync(join(target.path, 'a.txt'), 'utf-8')).toBe('source-wip');
  });

  it('safe strategy puts refs in refs/sync-kit/* and leaves refs/heads/* alone', async () => {
    const source = await createTmpRepo('main');
    cleanups.push(() => source.dispose());
    const sourceSha = await source.commit('a.txt', 'source', 'source-v1');

    process.chdir(source.path);
    const archivePath = join(source.path, 'history.zip');
    await executeExport({
      mode: 'history',
      historyOnly: true,
      quick: true,
      output: archivePath,
    });

    const target = await createTmpRepo('main');
    cleanups.push(() => target.dispose());
    const targetSha = await target.commit('a.txt', 'target', 'target-v0');

    process.chdir(target.path);
    await executeImport(archivePath, {
      target: target.path,
      force: true,
      noBackup: true,
      historyStrategy: 'safe',
    });

    const targetGit = simpleGit(target.path);
    const headsSha = (await targetGit.raw(['rev-parse', 'refs/heads/main'])).trim();
    const syncKitSha = (await targetGit.raw(['rev-parse', 'refs/sync-kit/main'])).trim();
    expect(headsSha).toBe(targetSha);
    expect(syncKitSha).toBe(sourceSha);
  });
});
