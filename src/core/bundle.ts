import { simpleGit } from 'simple-git';
import { mkdir, stat } from 'node:fs/promises';
import { dirname } from 'node:path';
import { existsSync } from 'node:fs';
import { BundleRef, HistoryMetadata, HistoryStrategy } from '../types/index.js';

/**
 * Create a git bundle of the given refs at outputPath.
 * If `refs` is empty, includes all local branches (and tags unless `noTags`).
 * Excludes refs/remotes/* always (they belong to upstream remotes, not us).
 */
export async function createBundle(
  repoRoot: string,
  outputPath: string,
  refs?: string[],
  noTags?: boolean
): Promise<HistoryMetadata> {
  await mkdir(dirname(outputPath), { recursive: true });
  const git = simpleGit(repoRoot);

  const bundleArgs: string[] = ['bundle', 'create', outputPath];
  if (refs && refs.length > 0) {
    // Caller-specified refs: include HEAD too so the receiver can identify
    // the default branch on import.
    bundleArgs.push('HEAD', ...refs);
  } else {
    // Default: HEAD + all local branches + (optionally) tags.
    // HEAD is included explicitly so its SHA is recorded in the bundle and
    // `git bundle verify` lists it — the import flow uses that to pick the
    // correct branch for --init-if-empty / --checkout.
    bundleArgs.push('HEAD', '--branches');
    if (!noTags) bundleArgs.push('--tags');
  }

  await git.raw(bundleArgs);

  return verifyBundle(repoRoot, outputPath);
}

/**
 * Verify a bundle and return its metadata (refs + size).
 * Throws if the bundle is invalid.
 */
export async function verifyBundle(
  cwd: string,
  bundlePath: string
): Promise<HistoryMetadata> {
  const git = simpleGit(cwd);
  const output = await git.raw(['bundle', 'verify', bundlePath]);

  const refs = parseBundleVerifyOutput(output);
  const branchCount = refs.filter((r) => r.name.startsWith('refs/heads/')).length;
  const tagCount = refs.filter((r) => r.name.startsWith('refs/tags/')).length;
  const complete = output.includes('records a complete history');
  const bundleSize = (await stat(bundlePath)).size;

  return { refs, branchCount, tagCount, complete, bundleSize };
}

/**
 * Parse output of `git bundle verify`. Format includes lines like:
 *   <40-hex-sha> <refname>
 */
export function parseBundleVerifyOutput(output: string): BundleRef[] {
  const refs: BundleRef[] = [];
  const refRegex = /^([0-9a-f]{40})\s+(\S.*?)\s*$/gm;
  let match: RegExpExecArray | null;
  while ((match = refRegex.exec(output)) !== null) {
    refs.push({ sha: match[1], name: match[2] });
  }
  return refs;
}

/**
 * Pick the branch ref that the source had checked out at bundle time.
 * The bundle records HEAD as a separate entry; we look up the branch
 * ref (under refs/heads/) whose SHA matches HEAD. Falls back to the
 * first head ref if HEAD is missing or detached.
 */
export function findDefaultBranchRef(refs: BundleRef[]): BundleRef | undefined {
  const headEntry = refs.find((r) => r.name === 'HEAD');
  if (headEntry) {
    const match = refs.find(
      (r) => r.name.startsWith('refs/heads/') && r.sha === headEntry.sha
    );
    if (match) return match;
  }
  return refs.find((r) => r.name.startsWith('refs/heads/'));
}

/**
 * Apply a bundle's refs into an existing repository.
 * Strategy:
 *   - 'safe': fetch into refs/sync-kit/* and refs/sync-kit/tags/*
 *   - 'fast-forward': fetch into refs/heads/* + refs/tags/*, no force
 *   - 'force': same with `+` prefix (overwrite refs)
 */
export async function fetchBundle(
  repoRoot: string,
  bundlePath: string,
  strategy: HistoryStrategy
): Promise<void> {
  const git = simpleGit(repoRoot);
  const refspecs = buildRefspecs(strategy);
  // fast-forward/force strategies update refs/heads/* directly. If the user
  // is currently on one of those branches, git refuses by default — pass
  // --update-head-ok to permit the ref update (working tree is left
  // untouched; pair with --checkout to sync the working tree afterwards).
  const extraArgs = strategy === 'safe' ? [] : ['--update-head-ok'];
  await git.raw(['fetch', ...extraArgs, bundlePath, ...refspecs]);
}

/**
 * Build refspecs for the chosen history strategy.
 */
export function buildRefspecs(strategy: HistoryStrategy): string[] {
  switch (strategy) {
    case 'safe':
      return [
        'refs/heads/*:refs/sync-kit/*',
        'refs/tags/*:refs/sync-kit/tags/*',
      ];
    case 'fast-forward':
      return ['refs/heads/*:refs/heads/*', 'refs/tags/*:refs/tags/*'];
    case 'force':
      return ['+refs/heads/*:refs/heads/*', '+refs/tags/*:refs/tags/*'];
  }
}

/**
 * Clone an empty target directory from a bundle.
 * The target directory must not exist or must be empty.
 */
export async function cloneFromBundle(
  bundlePath: string,
  targetDir: string
): Promise<void> {
  await mkdir(dirname(targetDir), { recursive: true });
  const git = simpleGit();
  await git.raw(['clone', bundlePath, targetDir]);
}

/**
 * Initialise an empty target as a git repo (used before fetching a bundle).
 */
export async function initRepo(targetDir: string): Promise<void> {
  await mkdir(targetDir, { recursive: true });
  const git = simpleGit(targetDir);
  await git.init();
}

/**
 * Check whether a directory is a git repository.
 */
export async function isGitRepo(path: string): Promise<boolean> {
  if (!existsSync(path)) return false;
  try {
    const git = simpleGit(path);
    return await git.checkIsRepo();
  } catch {
    return false;
  }
}
