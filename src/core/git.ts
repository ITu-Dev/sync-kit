import { simpleGit, SimpleGit, StatusResult } from 'simple-git';
import { SourceInfo, DetectedChange, OperationType } from '../types/index.js';
import { getRepoName, normalizePath } from '../utils/paths.js';
import { hashFile, getFileSize, isFile } from '../utils/fs.js';

let git: SimpleGit | null = null;
let repoRoot: string | null = null;

interface InitializedGit {
  git: SimpleGit;
  root: string;
}

/**
 * Get initialized git instance and repo root
 * Throws if not initialized
 */
function getInitialized(): InitializedGit {
  if (!git || !repoRoot) {
    throw new Error('Git not initialized. Call initGit() first.');
  }
  return { git, root: repoRoot };
}

/**
 * Initialize git instance for a repository
 */
export async function initGit(path: string = process.cwd()): Promise<void> {
  git = simpleGit(path);

  // Verify it's a git repo
  const isRepo = await git.checkIsRepo();
  if (!isRepo) {
    throw new Error('Not a git repository');
  }

  repoRoot = await git.revparse(['--show-toplevel']);
  repoRoot = normalizePath(repoRoot.trim());
}

/**
 * Reset git state (for testing purposes)
 */
export function resetGit(): void {
  git = null;
  repoRoot = null;
}

/**
 * Check if git is initialized
 */
export function isGitInitialized(): boolean {
  return git !== null && repoRoot !== null;
}

/**
 * Get the repository root path
 */
export function getRepoRoot(): string {
  const { root } = getInitialized();
  return root;
}

/**
 * Get source information about the repository
 */
export async function getSourceInfo(): Promise<SourceInfo> {
  const { git, root } = getInitialized();
  const [branch, commit, status] = await Promise.all([
    git.revparse(['--abbrev-ref', 'HEAD']),
    git.revparse(['--short', 'HEAD']),
    git.status(),
  ]);

  return {
    repo: getRepoName(root),
    branch: branch.trim(),
    commit: commit.trim(),
    dirty: !status.isClean(),
  };
}

/**
 * Get status of all files in the repo
 */
export async function getStatus(): Promise<StatusResult> {
  const { git } = getInitialized();
  return git.status();
}

/**
 * Get all tracked files in the repository
 */
export async function getTrackedFiles(): Promise<string[]> {
  const { git } = getInitialized();
  const result = await git.raw(['ls-files']);
  return result
    .trim()
    .split('\n')
    .filter(Boolean)
    .map(normalizePath);
}

/**
 * Get untracked files (not in .gitignore)
 */
export async function getUntrackedFiles(): Promise<string[]> {
  const { git } = getInitialized();
  const result = await git.raw(['ls-files', '--others', '--exclude-standard']);
  return result
    .trim()
    .split('\n')
    .filter(Boolean)
    .map(normalizePath);
}

/**
 * Get list of submodule paths (gitlinks with mode 160000)
 */
export async function getSubmodules(): Promise<Set<string>> {
  const { git } = getInitialized();
  try {
    const result = await git.raw(['ls-files', '--stage']);
    const submodules = new Set<string>();

    for (const line of result.split('\n')) {
      // Format: <mode> <hash> <stage>\t<path>
      const match = line.match(/^(\d+)\s+\S+\s+\d+\t(.+)$/);
      if (match) {
        const [, mode, path] = match;
        // 160000 is gitlink (submodule)
        if (mode === '160000') {
          submodules.add(normalizePath(path));
        }
      }
    }

    return submodules;
  } catch {
    return new Set();
  }
}

/**
 * Detect all changes (staged, unstaged, untracked)
 */
export async function detectChanges(): Promise<DetectedChange[]> {
  const { git, root } = getInitialized();
  const status = await git.status();
  const changes: DetectedChange[] = [];
  const processedPaths = new Set<string>();

  // Get submodules to exclude
  const submodules = await getSubmodules();

  // Helper to add change with metadata
  async function addChange(
    type: OperationType,
    path: string,
    from?: string
  ): Promise<void> {
    if (processedPaths.has(path)) return;

    // Skip submodules
    if (submodules.has(path)) return;

    processedPaths.add(path);

    const fullPath = `${root}/${path}`;

    // For non-delete operations, only add if it's actually a file
    if (type !== 'delete') {
      if (!isFile(fullPath)) return;
      const size = await getFileSize(fullPath);
      const hash = await hashFile(fullPath);
      changes.push({ type, path, from, size, hash });
    } else {
      changes.push({ type, path, from, size: 0 });
    }
  }

  // Process renamed files
  for (const file of status.renamed) {
    const fromPath = normalizePath(file.from);
    const toPath = normalizePath(file.to);
    await addChange('rename', toPath, fromPath);
  }

  // Process created files (staged)
  for (const file of status.created) {
    await addChange('add', normalizePath(file));
  }

  // Process modified files (staged and unstaged)
  for (const file of [...status.modified, ...status.staged]) {
    const normalizedPath = normalizePath(file);
    if (!processedPaths.has(normalizedPath)) {
      await addChange('modify', normalizedPath);
    }
  }

  // Process deleted files
  for (const file of status.deleted) {
    await addChange('delete', normalizePath(file));
  }

  // Process untracked files (new files not yet staged)
  for (const file of status.not_added) {
    const normalizedPath = normalizePath(file);
    if (!processedPaths.has(normalizedPath)) {
      await addChange('add', normalizedPath);
    }
  }

  return changes;
}

/**
 * Get all files for full snapshot
 */
export async function getAllFiles(): Promise<DetectedChange[]> {
  const { root } = getInitialized();
  const [trackedFiles, untrackedFiles] = await Promise.all([
    getTrackedFiles(),
    getUntrackedFiles(),
  ]);

  const allFiles = [...new Set([...trackedFiles, ...untrackedFiles])];
  const changes: DetectedChange[] = [];

  for (const filePath of allFiles) {
    const fullPath = `${root}/${filePath}`;

    if (isFile(fullPath)) {
      const size = await getFileSize(fullPath);
      const hash = await hashFile(fullPath);
      changes.push({ type: 'add', path: filePath, size, hash });
    }
  }

  return changes;
}

/**
 * Check if a file is modified locally (has uncommitted changes)
 */
export async function isFileModifiedLocally(filePath: string): Promise<boolean> {
  const { git } = getInitialized();
  const status = await git.status();
  const normalizedPath = normalizePath(filePath);

  return (
    status.modified.some((f) => normalizePath(f) === normalizedPath) ||
    status.staged.some((f) => normalizePath(f) === normalizedPath) ||
    status.not_added.some((f) => normalizePath(f) === normalizedPath)
  );
}

/**
 * Get the currently checked-out branch (returns 'HEAD' if detached).
 */
export async function getCurrentBranch(): Promise<string> {
  const { git } = getInitialized();
  return (await git.revparse(['--abbrev-ref', 'HEAD'])).trim();
}

/**
 * Checkout a branch (or any ref) by name in the initialised repo.
 * `force=true` resets the working tree to the ref's tip even when we
 * are already on the same branch (e.g. after a force-fetch updated the
 * ref under our feet).
 */
export async function checkoutRef(ref: string, force = false): Promise<void> {
  const { git } = getInitialized();
  const args = ['checkout'];
  if (force) args.push('-f');
  args.push(ref);
  await git.raw(args);
}
