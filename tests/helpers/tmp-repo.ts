import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { simpleGit, SimpleGit } from 'simple-git';

/**
 * Test helper: a real temporary git repo with a deterministic identity,
 * cleaned up automatically by the caller via dispose().
 */
export interface TmpRepo {
  path: string;
  git: SimpleGit;
  /** Add (and stage) a file, then commit. Returns the new commit SHA. */
  commit(filePath: string, content: string, message: string): Promise<string>;
  /** Write a file without staging/committing. */
  write(filePath: string, content: string): Promise<void>;
  /** Run an arbitrary git command and return stdout. */
  raw(args: string[]): Promise<string>;
  /** Delete a file (without committing). */
  delete(filePath: string): Promise<void>;
  /** Cleanup: remove the temp directory. */
  dispose(): Promise<void>;
}

/**
 * Create a fresh temp git repo on disk and return a handle to it.
 * `initialBranch` defaults to 'main'. The repo gets a fixed user
 * identity so commit SHAs are deterministic across runs.
 */
export async function createTmpRepo(initialBranch = 'main'): Promise<TmpRepo> {
  const path = await mkdtemp(join(tmpdir(), 'sk-test-'));
  const git = simpleGit(path);
  await git.init(['-b', initialBranch]);
  // Fixed identity for deterministic SHAs (combined with fixed dates below).
  await git.addConfig('user.email', 'test@sync-kit.test');
  await git.addConfig('user.name', 'sync-kit-test');
  await git.addConfig('commit.gpgsign', 'false');

  let commitCounter = 0;

  return {
    path,
    git,

    async commit(filePath, content, message) {
      const fullPath = join(path, filePath);
      await mkdir(dirname(fullPath), { recursive: true });
      await writeFile(fullPath, content);
      await git.add(filePath);
      // Fixed timestamps make SHAs reproducible for the same content sequence.
      commitCounter += 1;
      const fixedDate = `2026-01-01T00:00:${String(commitCounter).padStart(2, '0')}Z`;
      const env = {
        GIT_AUTHOR_DATE: fixedDate,
        GIT_COMMITTER_DATE: fixedDate,
      };
      await git.env(env).commit(message);
      return (await git.revparse(['HEAD'])).trim();
    },

    async write(filePath, content) {
      const fullPath = join(path, filePath);
      await mkdir(dirname(fullPath), { recursive: true });
      await writeFile(fullPath, content);
    },

    async raw(args) {
      return git.raw(args);
    },

    async delete(filePath) {
      const fullPath = join(path, filePath);
      await rm(fullPath, { force: true });
    },

    async dispose() {
      await rm(path, { recursive: true, force: true });
    },
  };
}

/**
 * Create an empty temporary directory (no git init). Useful for testing
 * --init-if-empty / clone-from-bundle flows.
 */
export async function createTmpDir(): Promise<{ path: string; dispose: () => Promise<void> }> {
  const path = await mkdtemp(join(tmpdir(), 'sk-test-empty-'));
  return {
    path,
    dispose: async () => rm(path, { recursive: true, force: true }),
  };
}
