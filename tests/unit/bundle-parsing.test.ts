import { describe, it, expect } from 'vitest';
import {
  parseBundleVerifyOutput,
  findDefaultBranchRef,
  buildRefspecs,
} from '../../src/core/bundle.js';
import type { BundleRef } from '../../src/types/index.js';

describe('parseBundleVerifyOutput', () => {
  it('extracts SHA + name pairs from real `git bundle verify` output', () => {
    const output = `/tmp/test.bundle is okay
The bundle contains these 3 refs:
dc6379a1aebd494cb29197a14afcd3852d75c28c refs/heads/main
e1ef15b87f93e02abd830e58265114bcbf2123ac refs/heads/feature/x
dc6379a1aebd494cb29197a14afcd3852d75c28c HEAD
The bundle records a complete history.
The bundle uses this hash algorithm: sha1`;

    const refs = parseBundleVerifyOutput(output);

    expect(refs).toEqual([
      { sha: 'dc6379a1aebd494cb29197a14afcd3852d75c28c', name: 'refs/heads/main' },
      { sha: 'e1ef15b87f93e02abd830e58265114bcbf2123ac', name: 'refs/heads/feature/x' },
      { sha: 'dc6379a1aebd494cb29197a14afcd3852d75c28c', name: 'HEAD' },
    ]);
  });

  it('returns empty array for output without ref lines', () => {
    expect(parseBundleVerifyOutput('error: bundle is corrupt')).toEqual([]);
  });

  it('handles tags and ref names with slashes', () => {
    const output = `aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa refs/tags/v1.0.0
bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb refs/heads/release/2026-q1`;

    const refs = parseBundleVerifyOutput(output);

    expect(refs).toHaveLength(2);
    expect(refs[0].name).toBe('refs/tags/v1.0.0');
    expect(refs[1].name).toBe('refs/heads/release/2026-q1');
  });

  it('ignores partial-SHA-like text in narrative lines', () => {
    // Line lengths and prefix (e.g. "The bundle contains") shouldn't match
    // the regex anchored on a 40-hex SHA at line start.
    const output = `The bundle contains these abcdef refs:
1234567890123456789012345678901234567890 refs/heads/main`;

    expect(parseBundleVerifyOutput(output)).toEqual([
      { sha: '1234567890123456789012345678901234567890', name: 'refs/heads/main' },
    ]);
  });
});

describe('findDefaultBranchRef', () => {
  const mainSha = 'a'.repeat(40);
  const featureSha = 'b'.repeat(40);

  it('returns the branch matching the HEAD entry SHA', () => {
    const refs: BundleRef[] = [
      { sha: featureSha, name: 'refs/heads/feature/x' },
      { sha: mainSha, name: 'refs/heads/main' },
      { sha: mainSha, name: 'HEAD' },
    ];

    expect(findDefaultBranchRef(refs)).toEqual({ sha: mainSha, name: 'refs/heads/main' });
  });

  it('falls back to first head ref when HEAD is absent', () => {
    const refs: BundleRef[] = [
      { sha: featureSha, name: 'refs/heads/feature/x' },
      { sha: mainSha, name: 'refs/heads/main' },
    ];

    expect(findDefaultBranchRef(refs)).toEqual({ sha: featureSha, name: 'refs/heads/feature/x' });
  });

  it('falls back to first head ref when HEAD is detached (no matching branch)', () => {
    const detachedSha = 'c'.repeat(40);
    const refs: BundleRef[] = [
      { sha: mainSha, name: 'refs/heads/main' },
      { sha: detachedSha, name: 'HEAD' },
    ];

    expect(findDefaultBranchRef(refs)).toEqual({ sha: mainSha, name: 'refs/heads/main' });
  });

  it('returns undefined when there are no head refs at all', () => {
    const refs: BundleRef[] = [
      { sha: 'd'.repeat(40), name: 'refs/tags/v1' },
    ];

    expect(findDefaultBranchRef(refs)).toBeUndefined();
  });
});

describe('buildRefspecs', () => {
  it('safe maps to refs/sync-kit/* (and tags)', () => {
    expect(buildRefspecs('safe')).toEqual([
      'refs/heads/*:refs/sync-kit/*',
      'refs/tags/*:refs/sync-kit/tags/*',
    ]);
  });

  it('fast-forward updates refs/heads/* and refs/tags/* without force', () => {
    expect(buildRefspecs('fast-forward')).toEqual([
      'refs/heads/*:refs/heads/*',
      'refs/tags/*:refs/tags/*',
    ]);
  });

  it('force prepends + to overwrite refs/heads/* and refs/tags/*', () => {
    expect(buildRefspecs('force')).toEqual([
      '+refs/heads/*:refs/heads/*',
      '+refs/tags/*:refs/tags/*',
    ]);
  });
});
