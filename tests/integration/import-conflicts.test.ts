import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { join } from 'node:path';
import { existsSync, readFileSync, readdirSync, createWriteStream } from 'node:fs';
import { simpleGit } from 'simple-git';
import archiver from 'archiver';
import { executeExport } from '../../src/commands/export.js';
import { executeImport } from '../../src/commands/import.js';
import { resetGit } from '../../src/core/git.js';
import { createTmpRepo } from '../helpers/tmp-repo.js';

describe('executeImport: conflicts, backups, dry-run, ops', () => {
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

  /** Create source archive with a single modify op against `a.txt`. */
  async function makeChangesArchive(content: string): Promise<{ archivePath: string }> {
    const source = await createTmpRepo('main');
    cleanups.push(() => source.dispose());
    await source.commit('a.txt', 'baseline', 'baseline');
    await source.write('a.txt', content);
    process.chdir(source.path);
    const archivePath = join(source.path, 'archive.zip');
    await executeExport({ mode: 'changes', quick: true, output: archivePath });
    return { archivePath };
  }

  it('--dry-run prints plan but writes nothing', async () => {
    const { archivePath } = await makeChangesArchive('source-edit');

    const target = await createTmpRepo('main');
    cleanups.push(() => target.dispose());
    await target.commit('a.txt', 'baseline', 'baseline');
    process.chdir(target.path);

    const before = readFileSync(join(target.path, 'a.txt'), 'utf-8');
    await executeImport(archivePath, { target: target.path, dryRun: true });
    const after = readFileSync(join(target.path, 'a.txt'), 'utf-8');

    expect(after).toBe(before);
    expect(existsSync(join(target.path, '.sync-backup'))).toBe(false);
  });

  it('creates a backup directory by default', async () => {
    const { archivePath } = await makeChangesArchive('source-edit');

    const target = await createTmpRepo('main');
    cleanups.push(() => target.dispose());
    await target.commit('a.txt', 'baseline', 'baseline');
    process.chdir(target.path);

    await executeImport(archivePath, { target: target.path, force: true });

    const backups = readdirSync(join(target.path, '.sync-backup'));
    expect(backups.length).toBeGreaterThan(0);
    const backupFile = join(target.path, '.sync-backup', backups[0], 'a.txt');
    expect(readFileSync(backupFile, 'utf-8')).toBe('baseline');
  });

  it('--no-backup skips backup creation', async () => {
    const { archivePath } = await makeChangesArchive('source-edit');

    const target = await createTmpRepo('main');
    cleanups.push(() => target.dispose());
    await target.commit('a.txt', 'baseline', 'baseline');
    process.chdir(target.path);

    await executeImport(archivePath, { target: target.path, force: true, noBackup: true });
    expect(existsSync(join(target.path, '.sync-backup'))).toBe(false);
  });

  it('--force overwrites locally-modified files (modified_locally conflict)', async () => {
    const { archivePath } = await makeChangesArchive('from-source');

    const target = await createTmpRepo('main');
    cleanups.push(() => target.dispose());
    await target.commit('a.txt', 'baseline', 'baseline');
    await target.write('a.txt', 'local-uncommitted-change');
    process.chdir(target.path);

    await executeImport(archivePath, { target: target.path, force: true });
    expect(readFileSync(join(target.path, 'a.txt'), 'utf-8')).toBe('from-source');
  });

  it('handles delete operation: removes the file from target', async () => {
    const source = await createTmpRepo('main');
    cleanups.push(() => source.dispose());
    await source.commit('a.txt', 'will-be-deleted', 'init');
    await source.delete('a.txt');
    process.chdir(source.path);
    const archivePath = join(source.path, 'archive.zip');
    await executeExport({ mode: 'changes', quick: true, output: archivePath });

    const target = await createTmpRepo('main');
    cleanups.push(() => target.dispose());
    await target.commit('a.txt', 'will-be-deleted', 'init');
    process.chdir(target.path);

    expect(existsSync(join(target.path, 'a.txt'))).toBe(true);
    await executeImport(archivePath, { target: target.path, force: true, noBackup: true });
    expect(existsSync(join(target.path, 'a.txt'))).toBe(false);
  });

  it('handles rename operation', async () => {
    const source = await createTmpRepo('main');
    cleanups.push(() => source.dispose());
    await source.commit('old.txt', 'content', 'init');
    await source.raw(['mv', 'old.txt', 'new.txt']);
    process.chdir(source.path);
    const archivePath = join(source.path, 'archive.zip');
    await executeExport({ mode: 'changes', quick: true, output: archivePath });

    const target = await createTmpRepo('main');
    cleanups.push(() => target.dispose());
    await target.commit('old.txt', 'content', 'init');
    process.chdir(target.path);

    await executeImport(archivePath, { target: target.path, force: true, noBackup: true });

    expect(existsSync(join(target.path, 'old.txt'))).toBe(false);
    expect(existsSync(join(target.path, 'new.txt'))).toBe(true);
    expect(readFileSync(join(target.path, 'new.txt'), 'utf-8')).toBe('content');
  });

  it('non-existent archive path exits with code 1', async () => {
    const target = await createTmpRepo('main');
    cleanups.push(() => target.dispose());
    await target.commit('a.txt', 'x', 'x');
    process.chdir(target.path);

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);

    await executeImport('/tmp/does-not-exist-12345.zip', { target: target.path, force: true });
    expect(exitSpy).toHaveBeenCalledWith(1);
    exitSpy.mockRestore();
  });

  it('imports legacy archive without bundle (no history flow triggers)', async () => {
    const { archivePath } = await makeChangesArchive('plain-edit');

    const target = await createTmpRepo('main');
    cleanups.push(() => target.dispose());
    await target.commit('a.txt', 'baseline', 'baseline');
    process.chdir(target.path);

    await executeImport(archivePath, { target: target.path, force: true, noBackup: true });

    const refs = await simpleGit(target.path).raw(['for-each-ref', '--format=%(refname)']);
    expect(refs).not.toContain('refs/sync-kit');
    expect(readFileSync(join(target.path, 'a.txt'), 'utf-8')).toBe('plain-edit');
  });

  it('multi-file changes: add + modify + delete in one archive', async () => {
    const source = await createTmpRepo('main');
    cleanups.push(() => source.dispose());
    await source.commit('keep.txt', 'k', 'init');
    await source.commit('to-delete.txt', 'd', 'init2');
    await source.write('keep.txt', 'modified');
    await source.write('new.txt', 'added');
    await source.delete('to-delete.txt');
    process.chdir(source.path);
    const archivePath = join(source.path, 'archive.zip');
    await executeExport({ mode: 'changes', quick: true, output: archivePath });

    const target = await createTmpRepo('main');
    cleanups.push(() => target.dispose());
    await target.commit('keep.txt', 'k', 'init');
    await target.commit('to-delete.txt', 'd', 'init2');
    process.chdir(target.path);

    await executeImport(archivePath, { target: target.path, force: true, noBackup: true });

    expect(readFileSync(join(target.path, 'keep.txt'), 'utf-8')).toBe('modified');
    expect(readFileSync(join(target.path, 'new.txt'), 'utf-8')).toBe('added');
    expect(existsSync(join(target.path, 'to-delete.txt'))).toBe(false);
  });

  it('archive without manifest.json exits with code 1', async () => {
    const target = await createTmpRepo('main');
    cleanups.push(() => target.dispose());
    await target.commit('a.txt', 'x', 'x');
    process.chdir(target.path);

    const badArchive = join(target.path, 'bad.zip');
    await new Promise<void>((resolve, reject) => {
      const out = createWriteStream(badArchive);
      const arc = archiver('zip');
      out.on('close', () => resolve());
      arc.on('error', reject);
      arc.pipe(out);
      arc.append('not a manifest', { name: 'random.txt' });
      arc.finalize();
    });

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
    await executeImport(badArchive, { target: target.path, force: true });
    expect(exitSpy).toHaveBeenCalledWith(1);
    exitSpy.mockRestore();
  });
});
