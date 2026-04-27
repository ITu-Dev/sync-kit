import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import AdmZip from 'adm-zip';
import { executeExport } from '../../src/commands/export.js';
import { resetGit } from '../../src/core/git.js';
import { createTmpRepo, TmpRepo } from '../helpers/tmp-repo.js';

describe('executeExport modes and flags', () => {
  const cleanups: Array<() => Promise<void>> = [];
  const originalCwd = process.cwd();
  let repo: TmpRepo;

  beforeEach(async () => {
    resetGit();
    repo = await createTmpRepo('main');
    cleanups.push(() => repo.dispose());
    await repo.commit('a.txt', 'v1', 'v1');
    process.chdir(repo.path);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    resetGit();
    await Promise.all(cleanups.splice(0).map((fn) => fn().catch(() => {})));
  });

  function readManifest(archivePath: string) {
    const zip = new AdmZip(archivePath);
    const entry = zip.getEntry('manifest.json');
    if (!entry) throw new Error('no manifest.json');
    return JSON.parse(zip.readAsText(entry));
  }

  function archiveFiles(archivePath: string): string[] {
    return new AdmZip(archivePath).getEntries().map((e) => e.entryName).sort();
  }

  it('--changes captures only modified files', async () => {
    await repo.commit('b.txt', 'b', 'b');
    await repo.write('a.txt', 'modified');

    const out = join(repo.path, 'out.zip');
    await executeExport({ mode: 'changes', quick: true, output: out });

    const manifest = readManifest(out);
    expect(manifest.mode).toBe('changes');
    expect(manifest.operations).toEqual([
      expect.objectContaining({ type: 'modify', path: 'a.txt' }),
    ]);
    expect(archiveFiles(out)).toContain('files/a.txt.txt');
    expect(archiveFiles(out)).not.toContain('files/b.txt.txt');
  });

  it('--full captures all tracked + untracked files', async () => {
    await repo.commit('b.txt', 'b', 'b');
    await repo.write('untracked.txt', 'u');

    const out = join(repo.path, 'out.zip');
    await executeExport({ mode: 'full', quick: true, output: out });

    const manifest = readManifest(out);
    expect(manifest.mode).toBe('full');
    const paths = manifest.operations.map((op: { path: string }) => op.path).sort();
    expect(paths).toEqual(['a.txt', 'b.txt', 'untracked.txt']);
  });

  it('--dirs filters by top-level directory', async () => {
    await repo.commit('src/foo.ts', 'foo', 'foo');
    await repo.commit('docs/readme.md', 'readme', 'docs');

    const out = join(repo.path, 'out.zip');
    await executeExport({
      mode: 'directories',
      directories: ['src'],
      quick: true,
      output: out,
    });

    const paths = readManifest(out).operations.map((op: { path: string }) => op.path);
    expect(paths).toContain('src/foo.ts');
    expect(paths).not.toContain('docs/readme.md');
  });

  it('--include filters to matching glob', async () => {
    await repo.commit('src/foo.ts', 'foo', 'foo');
    await repo.commit('src/bar.md', 'bar', 'bar');
    await repo.write('untracked.ts', 'u');

    const out = join(repo.path, 'out.zip');
    await executeExport({
      mode: 'full',
      include: ['**/*.ts'],
      quick: true,
      output: out,
    });

    const paths = readManifest(out).operations.map((op: { path: string }) => op.path).sort();
    expect(paths).toEqual(['src/foo.ts', 'untracked.ts']);
  });

  it('--exclude removes matching glob from default set', async () => {
    await repo.commit('src/foo.ts', 'foo', 'foo');
    await repo.commit('src/foo.test.ts', 'test', 'test');

    const out = join(repo.path, 'out.zip');
    await executeExport({
      mode: 'full',
      exclude: ['**/*.test.ts'],
      quick: true,
      output: out,
    });

    const paths = readManifest(out).operations.map((op: { path: string }) => op.path);
    expect(paths).toContain('src/foo.ts');
    expect(paths).not.toContain('src/foo.test.ts');
  });

  it('default behaviour excludes media files', async () => {
    await repo.commit('logo.png', 'fake-png', 'png');
    await repo.commit('icon.svg', 'fake-svg', 'svg');
    await repo.commit('a.ts', 'code', 'code');

    const out = join(repo.path, 'out.zip');
    await executeExport({ mode: 'full', quick: true, output: out });

    const paths = readManifest(out).operations.map((op: { path: string }) => op.path);
    expect(paths).not.toContain('logo.png');
    expect(paths).not.toContain('icon.svg');
    expect(paths).toContain('a.ts');
  });

  it('--include-media keeps media files', async () => {
    await repo.commit('logo.png', 'fake-png', 'png');
    await repo.commit('a.ts', 'code', 'code');

    const out = join(repo.path, 'out.zip');
    await executeExport({
      mode: 'full',
      includeMedia: true,
      quick: true,
      output: out,
    });

    const paths = readManifest(out).operations.map((op: { path: string }) => op.path);
    expect(paths).toContain('logo.png');
  });

  it('--name uses custom archive name and appends .zip', async () => {
    await repo.write('a.txt', 'dirty');
    await executeExport({ mode: 'changes', quick: true, name: 'my-snapshot' });

    expect(existsSync(join(repo.path, 'my-snapshot.zip'))).toBe(true);
  });

  it('--message is stored in manifest', async () => {
    await repo.write('a.txt', 'dirty');
    const out = join(repo.path, 'out.zip');
    await executeExport({ mode: 'changes', quick: true, message: 'fix: bug', output: out });

    expect(readManifest(out).message).toBe('fix: bug');
  });

  it('--branches in --history-only includes only specified refs', async () => {
    await repo.raw(['checkout', '-b', 'feature/x']);
    await repo.commit('b.txt', 'feat', 'feat');
    await repo.raw(['checkout', 'main']);

    const out = join(repo.path, 'history.zip');
    await executeExport({
      mode: 'history',
      historyOnly: true,
      branches: ['main'],
      quick: true,
      output: out,
    });

    const manifest = readManifest(out);
    const branchRefs = manifest.history.refs
      .filter((r: { name: string }) => r.name.startsWith('refs/heads/'))
      .map((r: { name: string }) => r.name);
    expect(branchRefs).toEqual(['refs/heads/main']);
  });
});
