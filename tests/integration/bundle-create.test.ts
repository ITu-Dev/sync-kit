import { describe, it, expect, afterEach } from 'vitest';
import { join } from 'node:path';
import { createBundle, verifyBundle, fetchBundle, isGitRepo, initRepo, findDefaultBranchRef } from '../../src/core/bundle.js';
import { createTmpRepo, createTmpDir, TmpRepo } from '../helpers/tmp-repo.js';

describe('createBundle (integration with real git)', () => {
  const cleanups: Array<() => Promise<void>> = [];

  afterEach(async () => {
    await Promise.all(cleanups.splice(0).map((fn) => fn().catch(() => {})));
  });

  it('produces a valid bundle and metadata for a single-branch repo', async () => {
    const repo = await createTmpRepo('main');
    cleanups.push(() => repo.dispose());
    const sha = await repo.commit('a.txt', 'hello', 'init');

    const bundlePath = join(repo.path, 'out.bundle');
    const meta = await createBundle(repo.path, bundlePath);

    expect(meta.complete).toBe(true);
    expect(meta.branchCount).toBe(1);
    expect(meta.tagCount).toBe(0);
    expect(meta.bundleSize).toBeGreaterThan(0);
    // refs include main and HEAD (HEAD passed explicitly to git bundle create)
    const names = meta.refs.map((r) => r.name).sort();
    expect(names).toContain('refs/heads/main');
    expect(names).toContain('HEAD');
    // HEAD points at the same commit as main
    const headEntry = meta.refs.find((r) => r.name === 'HEAD');
    expect(headEntry?.sha).toBe(sha);
  });

  it('records all local branches and tags', async () => {
    const repo = await createTmpRepo('main');
    cleanups.push(() => repo.dispose());
    await repo.commit('a.txt', 'v1', 'v1');
    await repo.raw(['tag', 'v0.1']);
    await repo.raw(['checkout', '-b', 'feature/x']);
    await repo.commit('b.txt', 'feat', 'feat');
    await repo.raw(['checkout', 'main']);

    const meta = await createBundle(repo.path, join(repo.path, 'out.bundle'));

    expect(meta.branchCount).toBe(2);
    expect(meta.tagCount).toBe(1);

    // findDefaultBranchRef should pick main (current HEAD), not feature/x
    const def = findDefaultBranchRef(meta.refs);
    expect(def?.name).toBe('refs/heads/main');
  });

  it('respects noTags=true', async () => {
    const repo = await createTmpRepo('main');
    cleanups.push(() => repo.dispose());
    await repo.commit('a.txt', 'v1', 'v1');
    await repo.raw(['tag', 'v0.1']);

    const meta = await createBundle(repo.path, join(repo.path, 'out.bundle'), undefined, true);

    expect(meta.tagCount).toBe(0);
    expect(meta.branchCount).toBe(1);
  });

  it('uses caller-specified refs when provided', async () => {
    const repo = await createTmpRepo('main');
    cleanups.push(() => repo.dispose());
    await repo.commit('a.txt', 'v1', 'v1');
    await repo.raw(['checkout', '-b', 'feature/x']);
    await repo.commit('b.txt', 'feat', 'feat');
    await repo.raw(['checkout', 'main']);

    const meta = await createBundle(
      repo.path,
      join(repo.path, 'out.bundle'),
      ['main'] // only main, not feature/x
    );

    // HEAD + refs/heads/main (no feature/x)
    const branchNames = meta.refs
      .filter((r) => r.name.startsWith('refs/heads/'))
      .map((r) => r.name);
    expect(branchNames).toEqual(['refs/heads/main']);
  });
});

describe('verifyBundle', () => {
  const cleanups: Array<() => Promise<void>> = [];

  afterEach(async () => {
    await Promise.all(cleanups.splice(0).map((fn) => fn().catch(() => {})));
  });

  it('throws on a corrupt/empty bundle', async () => {
    const repo = await createTmpRepo('main');
    cleanups.push(() => repo.dispose());
    await repo.commit('a.txt', 'x', 'x');

    const fakeBundle = join(repo.path, 'fake.bundle');
    await repo.write('fake.bundle', 'not a real bundle');

    await expect(verifyBundle(repo.path, fakeBundle)).rejects.toThrow();
  });
});

describe('fetchBundle round-trip (safe strategy)', () => {
  const cleanups: Array<() => Promise<void>> = [];

  afterEach(async () => {
    await Promise.all(cleanups.splice(0).map((fn) => fn().catch(() => {})));
  });

  it('lands source refs into refs/sync-kit/* on the target without touching refs/heads/*', async () => {
    const source = await createTmpRepo('main');
    cleanups.push(() => source.dispose());
    const sourceSha = await source.commit('a.txt', 'source-v1', 'source-v1');

    const bundlePath = join(source.path, 'src.bundle');
    await createBundle(source.path, bundlePath);

    const target = await createTmpRepo('main');
    cleanups.push(() => target.dispose());
    const targetOriginalSha = await target.commit('a.txt', 'target-v0', 'target-v0');

    await fetchBundle(target.path, bundlePath, 'safe');

    // refs/heads/main on target unchanged
    const targetHeadSha = (await target.raw(['rev-parse', 'refs/heads/main'])).trim();
    expect(targetHeadSha).toBe(targetOriginalSha);

    // refs/sync-kit/main exists and points at source SHA
    const syncKitSha = (await target.raw(['rev-parse', 'refs/sync-kit/main'])).trim();
    expect(syncKitSha).toBe(sourceSha);
  });
});

describe('isGitRepo / initRepo', () => {
  const cleanups: Array<() => Promise<void>> = [];

  afterEach(async () => {
    await Promise.all(cleanups.splice(0).map((fn) => fn().catch(() => {})));
  });

  it('isGitRepo returns false for non-existent dir, true after initRepo', async () => {
    const tmp = await createTmpDir();
    cleanups.push(tmp.dispose);

    const newPath = join(tmp.path, 'fresh');
    expect(await isGitRepo(newPath)).toBe(false);

    await initRepo(newPath);
    expect(await isGitRepo(newPath)).toBe(true);
  });

  it('isGitRepo returns false for an existing non-git directory', async () => {
    const tmp = await createTmpDir();
    cleanups.push(tmp.dispose);

    expect(await isGitRepo(tmp.path)).toBe(false);
  });
});
