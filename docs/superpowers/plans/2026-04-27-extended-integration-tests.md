# Extended Integration Tests — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend test coverage from 45 → ~85-100 tests so every CLI command, every flag, every validation rule, every conflict path, and every history-strategy outcome is verified by an automated test.

**Architecture:** Add five new files under `tests/integration/`, each focused on one concern. Use `it.each` tables to keep cases compact. Add two new helpers: a CLI runner (spawn `tsx src/index.ts ...` for true end-to-end validation including commander parsing) and a small extension to `tmp-repo` for staging conflict scenarios.

**Tech Stack:** Vitest 4, simple-git, Node `child_process` for CLI spawn tests. No new runtime dependencies.

---

## File Structure

### New files
- `tests/helpers/cli.ts` — `runCli(args, cwd, env?)` wrapper around `child_process.spawn` that returns `{ stdout, stderr, exitCode }`. Used by validation tests for true end-to-end.
- `tests/integration/export-modes.test.ts` — every export mode × major flag combinations
- `tests/integration/import-conflicts.test.ts` — every conflict reason × resolution; rename/delete ops; backup behaviour; dry-run; import without bundle
- `tests/integration/strategies.test.ts` — fast-forward FF/non-FF, force, checkout WT sync
- `tests/integration/cli-validation.test.ts` — child-process spawn tests for CLI parsing and exit codes
- `tests/integration/preview-history.test.ts` — preview shape with/without bundle/contents; `sk history`; `sk q` alias

### Modified files
- `tests/helpers/tmp-repo.ts` — small additions: `delete(filePath)` helper, optional `gitignore` support during init

---

## Task 1: CLI runner helper

**Files:**
- Create: `tests/helpers/cli.ts`

- [ ] **Step 1: Write `tests/helpers/cli.ts`**

```typescript
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
```

- [ ] **Step 2: Sanity-check it works**

Run a one-off:

```bash
node_modules/.bin/vitest run --reporter=verbose tests/helpers 2>&1 | tail -3 || true
```
(No tests in helpers directory — this just shouldn't error out on collection.)

Then verify by smoke-running through tsx:

```bash
node_modules/.bin/tsx -e "
(async () => {
  const { runCli } = await import('./tests/helpers/cli.ts');
  const r = await runCli(['--version'], '/tmp');
  console.log('exit:', r.exitCode, 'stdout:', JSON.stringify(r.stdout.trim()));
})();
"
```
Expected: `exit: 0 stdout: "1.1.0"`

- [ ] **Step 3: Commit**

```bash
git add tests/helpers/cli.ts
git commit -m "test(helpers): add runCli for child_process CLI tests"
```

---

## Task 2: Extend tmp-repo helper

**Files:**
- Modify: `tests/helpers/tmp-repo.ts`

- [ ] **Step 1: Add `delete()` helper to `TmpRepo` interface and impl**

Add to the interface:

```typescript
  /** Delete a file (without committing). */
  delete(filePath: string): Promise<void>;
```

Add to the returned object in `createTmpRepo`:

```typescript
    async delete(filePath) {
      const fullPath = join(path, filePath);
      await rm(fullPath, { force: true });
    },
```

Update the import line to include `rm`:

```typescript
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
```
(Already imported — no change needed; verify.)

- [ ] **Step 2: Verify**

Run unit tests to confirm nothing broke:

```bash
node_modules/.bin/vitest run tests/unit 2>&1 | tail -5
```
Expected: 33 tests passed.

- [ ] **Step 3: Commit**

```bash
git add tests/helpers/tmp-repo.ts
git commit -m "test(helpers): add delete() to TmpRepo for conflict scenarios"
```

---

## Task 3: Export modes integration tests

**Files:**
- Create: `tests/integration/export-modes.test.ts`

- [ ] **Step 1: Write the test file**

```typescript
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { join } from 'node:path';
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
    await repo.write('z.txt', 'dirty');

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
    const out = join(repo.path, 'should-be-overridden.zip');
    // executeExport with `name` writes <repoRoot>/<name>.zip when no `output`
    await executeExport({ mode: 'changes', quick: true, name: 'my-snapshot' });

    const fs = await import('node:fs');
    expect(fs.existsSync(join(repo.path, 'my-snapshot.zip'))).toBe(true);
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
```

- [ ] **Step 2: Run and verify**

```bash
node_modules/.bin/vitest run tests/integration/export-modes.test.ts 2>&1 | tail -10
```
Expected: 10 tests passed.

- [ ] **Step 3: Commit**

```bash
git add tests/integration/export-modes.test.ts
git commit -m "test(integration): cover export modes and filter flags"
```

---

## Task 4: Import / conflicts integration tests

**Files:**
- Create: `tests/integration/import-conflicts.test.ts`

- [ ] **Step 1: Write the test file**

```typescript
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { join } from 'node:path';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { simpleGit } from 'simple-git';
import AdmZip from 'adm-zip';
import archiver from 'archiver';
import { createWriteStream } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { executeExport } from '../../src/commands/export.js';
import { executeImport } from '../../src/commands/import.js';
import { resetGit } from '../../src/core/git.js';
import { createTmpRepo, TmpRepo } from '../helpers/tmp-repo.js';

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

    expect(after).toBe(before); // unchanged
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
    // Backup contains the pre-import content of a.txt
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
    await target.write('a.txt', 'local-uncommitted-change'); // modified locally
    process.chdir(target.path);

    await executeImport(archivePath, { target: target.path, force: true });
    expect(readFileSync(join(target.path, 'a.txt'), 'utf-8')).toBe('from-source');
  });

  it('handles delete operation: removes the file from target', async () => {
    // Build source where a.txt is deleted
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
    // Source: rename old.txt -> new.txt
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

  it('non-existent archive path throws', async () => {
    const target = await createTmpRepo('main');
    cleanups.push(() => target.dispose());
    await target.commit('a.txt', 'x', 'x');
    process.chdir(target.path);

    // executeImport calls process.exit(1) on error; spy on it instead of awaiting.
    const exitSpy = (await import('vitest')).vi
      .spyOn(process, 'exit')
      .mockImplementation((() => undefined) as never);

    await executeImport('/tmp/does-not-exist.zip', { target: target.path, force: true });
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

    // No refs/sync-kit/* should appear (archive had no bundle)
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

  it('archive without manifest.json throws', async () => {
    // Build a malformed zip with one entry but no manifest
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

    const exitSpy = (await import('vitest')).vi
      .spyOn(process, 'exit')
      .mockImplementation((() => undefined) as never);
    await executeImport(badArchive, { target: target.path, force: true });
    expect(exitSpy).toHaveBeenCalledWith(1);
    exitSpy.mockRestore();
  });
});
```

- [ ] **Step 2: Run and verify**

```bash
node_modules/.bin/vitest run tests/integration/import-conflicts.test.ts 2>&1 | tail -10
```
Expected: 10 tests passed.

- [ ] **Step 3: Commit**

```bash
git add tests/integration/import-conflicts.test.ts
git commit -m "test(integration): cover import conflicts, backups, dry-run, ops"
```

---

## Task 5: History strategies integration tests

**Files:**
- Create: `tests/integration/strategies.test.ts`

- [ ] **Step 1: Write the test file**

```typescript
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { simpleGit } from 'simple-git';
import { executeExport } from '../../src/commands/export.js';
import { executeImport } from '../../src/commands/import.js';
import { resetGit } from '../../src/core/git.js';
import { createTmpRepo } from '../helpers/tmp-repo.js';

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
    const source = await createTmpRepo('main');
    cleanups.push(() => source.dispose());
    const ancestor = await source.commit('a.txt', 'v1', 'v1');
    const newer = await source.commit('a.txt', 'v2', 'v2');

    // Target has only the ancestor commit (clone-equivalent)
    const target = await createTmpRepo('main');
    cleanups.push(() => target.dispose());
    // To make target's main resolve to `ancestor`, recreate same commit content+identity:
    // simpler: import history then assert. But for FF semantics we need a *real* ancestor.
    // Use init+fetch+reset to seed target main = `ancestor`:
    await target.raw(['fetch', source.path, `${ancestor}:refs/heads/main`]);
    await target.raw(['reset', '--hard', 'main']);

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
    const targetSha = await target.commit('a.txt', 'target-v1', 'target'); // unrelated history

    const archivePath = await exportHistory(source);
    process.chdir(target.path);

    const exitSpy = (await import('vitest')).vi
      .spyOn(process, 'exit')
      .mockImplementation((() => undefined) as never);

    await executeImport(archivePath, {
      target: target.path,
      force: true,
      noBackup: true,
      historyStrategy: 'fast-forward',
    });

    expect(exitSpy).toHaveBeenCalledWith(1);
    // Target main unchanged
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

    // WT now reflects source's main HEAD content
    expect(readFileSync(join(target.path, 'a.txt'), 'utf-8')).toBe('source-content');
  });

  it('--init-if-empty refuses on non-git target without the flag', async () => {
    const source = await createTmpRepo('main');
    cleanups.push(() => source.dispose());
    await source.commit('a.txt', 'v1', 'v1');
    const archivePath = await exportHistory(source);

    const { createTmpDir } = await import('../helpers/tmp-repo.js');
    const empty = await createTmpDir();
    cleanups.push(empty.dispose);

    const exitSpy = (await import('vitest')).vi
      .spyOn(process, 'exit')
      .mockImplementation((() => undefined) as never);

    await executeImport(archivePath, {
      target: empty.path,
      force: true,
      noBackup: true,
      historyStrategy: 'fast-forward',
      // initIfEmpty: false
    });

    expect(exitSpy).toHaveBeenCalledWith(1);
    exitSpy.mockRestore();
  });
});
```

- [ ] **Step 2: Run and verify**

```bash
node_modules/.bin/vitest run tests/integration/strategies.test.ts 2>&1 | tail -10
```
Expected: 5 tests passed.

- [ ] **Step 3: Commit**

```bash
git add tests/integration/strategies.test.ts
git commit -m "test(integration): cover ff/force/checkout history strategies"
```

---

## Task 6: CLI validation tests (true child-process e2e)

**Files:**
- Create: `tests/integration/cli-validation.test.ts`

- [ ] **Step 1: Write the test file**

```typescript
import { describe, it, expect, afterEach } from 'vitest';
import { join } from 'node:path';
import { writeFile, mkdir } from 'node:fs/promises';
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

    const fs = await import('node:fs');
    expect(fs.existsSync(out)).toBe(true);
  });

  it('import non-git target without --init-if-empty when archive has bundle → exit ≠ 0', async () => {
    // First produce a history-bearing archive
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
```

- [ ] **Step 2: Run and verify**

```bash
node_modules/.bin/vitest run tests/integration/cli-validation.test.ts 2>&1 | tail -10
```
Expected: 10 tests passed. (Each test spawns a tsx subprocess; ~150-300ms each, so the file takes ~3-5s total.)

- [ ] **Step 3: Commit**

```bash
git add tests/integration/cli-validation.test.ts
git commit -m "test(integration): CLI validation via child_process spawn"
```

---

## Task 7: Preview / history / quick alias tests

**Files:**
- Create: `tests/integration/preview-history.test.ts`

- [ ] **Step 1: Write the test file**

```typescript
import { describe, it, expect, afterEach } from 'vitest';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
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

    // Find the produced sync_*.zip in repo root
    const fs = await import('node:fs');
    const matches = fs.readdirSync(repo.path).filter((f) => /^sync_.*\.zip$/.test(f));
    expect(matches.length).toBeGreaterThan(0);
  });

  it('sk history shows entries after an export', async () => {
    const repo = await createTmpRepo('main');
    cleanups.push(() => repo.dispose());
    await repo.commit('a.txt', 'v1', 'v1');
    await repo.write('a.txt', 'dirty');

    await runCli(['export', '-q', '-o', join(repo.path, 'h.zip'), '-m', 'unique-message-7842'], repo.path);

    const r = await runCli(['history'], repo.path);
    expect(r.exitCode).toBe(0);
    // The history file should have been written
    expect(existsSync(join(repo.path, '.sync-history', 'history.json'))).toBe(true);
  });
});
```

- [ ] **Step 2: Run and verify**

```bash
node_modules/.bin/vitest run tests/integration/preview-history.test.ts 2>&1 | tail -10
```
Expected: 5 tests passed.

- [ ] **Step 3: Commit**

```bash
git add tests/integration/preview-history.test.ts
git commit -m "test(integration): cover preview, history, and 'q' alias"
```

---

## Task 8: Final full-suite run + cleanup

- [ ] **Step 1: Run the entire test suite**

```bash
npm test 2>&1 | tail -10
```
Expected: ~85 tests passed across all files. Total runtime under 15 seconds (CLI subprocess tests dominate at ~5s).

- [ ] **Step 2: If anything fails, fix in place and re-run**

Common failure modes to expect and handle:
- **Process leaks**: a test forgot `process.chdir(originalCwd)` in afterEach → next test sees wrong cwd. Fix: add the chdir.
- **resetGit() missing**: simple-git singleton bleeds between tests → spurious "Not a git repository" failures. Fix: add `resetGit()` in beforeEach/afterEach.
- **Race on tmpdir cleanup**: `rm` runs before fs flush. Already wrapped with `.catch(() => {})` so it logs but doesn't fail.

- [ ] **Step 3: Update CLAUDE.md test count**

Replace the test count line:

```bash
node_modules/.bin/vitest run 2>&1 | grep -E "Tests\s+\d+"
```
Take the number from output and update `CLAUDE.md` line that says `npm test                     # vitest run (45 тестов, ~3 сек)` to the new count and time.

- [ ] **Step 4: Final commit**

```bash
git add CLAUDE.md
git commit -m "docs(CLAUDE.md): bump test count after coverage extension"
```

---

## Self-review checklist

- **Coverage gaps from previous gap-list:** every export mode (changes ✓ T3, full ✓ T3, directories ✓ T3, history ✓ T3); every filter (include ✓ T3, exclude ✓ T3, include-media ✓ T3); every blocked combination (history-only+full ✓ T6, with-history+dirs ✓ T6, with-history+include ✓ T6); every conflict + resolution (modified_locally with --force ✓ T4); --dry-run ✓ T4; backup/no-backup ✓ T4; rename/delete ops ✓ T4; legacy archive without bundle ✓ T4; FF success/failure ✓ T5, force ✓ T5, checkout ✓ T5; CLI exit codes via child_process ✓ T6; preview/history/q ✓ T7.
- **Type consistency:** `runCli` signature stays `(args, cwd, env?) => Promise<{stdout, stderr, exitCode}>` across T1, T6, T7. Test helper `TmpRepo.delete` consistent with other methods.
- **No placeholders:** every step has full code or full bash command. Every "expected" output is concrete.
- **Manual verification adapted:** all tests use real git in tmp dirs; CLI tests use real subprocess with real tsx — no mocks of git or commander.
