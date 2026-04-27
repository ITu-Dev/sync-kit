import { describe, it, expect, afterEach } from 'vitest';
import { join } from 'node:path';
import { existsSync, readdirSync } from 'node:fs';
import { createTmpRepo } from '../helpers/tmp-repo.js';
import { runCli } from '../helpers/cli.js';

describe('preview / history / quick alias', () => {
  const cleanups: Array<() => Promise<void>> = [];

  afterEach(async () => {
    await Promise.all(cleanups.splice(0).map((fn) => fn().catch(() => {})));
  });

  it('sk preview shows "Git history bundle" section when archive has bundle', async () => {
    const repo = await createTmpRepo('main');
    cleanups.push(() => repo.dispose());
    await repo.commit('a.txt', 'v1', 'v1');

    const archive = join(repo.path, 'h.zip');
    await runCli(['export', '--history-only', '-q', '-o', archive], repo.path);

    const r = await runCli(['preview', archive], repo.path);
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toMatch(/Git history bundle/);
    expect(r.stdout).toMatch(/Branches:\s*1/);
    expect(r.stdout).toMatch(/refs\/heads\/main/);
  });

  it('sk preview does NOT show bundle section for plain (non-history) archive', async () => {
    const repo = await createTmpRepo('main');
    cleanups.push(() => repo.dispose());
    await repo.commit('a.txt', 'v1', 'v1');
    await repo.write('a.txt', 'dirty');

    const archive = join(repo.path, 'plain.zip');
    await runCli(['export', '-q', '-o', archive], repo.path);

    const r = await runCli(['preview', archive], repo.path);
    expect(r.exitCode).toBe(0);
    expect(r.stdout).not.toMatch(/Git history bundle/);
  });

  it('sk preview --contents shows file content preview', async () => {
    const repo = await createTmpRepo('main');
    cleanups.push(() => repo.dispose());
    await repo.commit('a.txt', 'v1', 'v1');
    await repo.write('a.txt', 'line-one\nline-two\nline-three');

    const archive = join(repo.path, 'plain.zip');
    await runCli(['export', '-q', '-o', archive], repo.path);

    const r = await runCli(['preview', archive, '--contents'], repo.path);
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toMatch(/line-one/);
  });

  it('sk q (quick alias) creates a sync_*.zip and exits 0', async () => {
    const repo = await createTmpRepo('main');
    cleanups.push(() => repo.dispose());
    await repo.commit('a.txt', 'v1', 'v1');
    await repo.write('a.txt', 'dirty');

    const r = await runCli(['q'], repo.path);
    expect(r.exitCode).toBe(0);

    const matches = readdirSync(repo.path).filter((f) => /^sync_.*\.zip$/.test(f));
    expect(matches.length).toBeGreaterThan(0);
  });

  it('sk history records an entry after an export', async () => {
    const repo = await createTmpRepo('main');
    cleanups.push(() => repo.dispose());
    await repo.commit('a.txt', 'v1', 'v1');
    await repo.write('a.txt', 'dirty');

    await runCli(
      ['export', '-q', '-o', join(repo.path, 'h.zip'), '-m', 'unique-message-7842'],
      repo.path
    );

    const r = await runCli(['history'], repo.path);
    expect(r.exitCode).toBe(0);
    expect(existsSync(join(repo.path, '.sync-history', 'history.json'))).toBe(true);
  });
});
