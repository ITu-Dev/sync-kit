import { describe, it, expect } from 'vitest';
import {
  createManifest,
  calculateStats,
  parseManifest,
  serializeManifest,
} from '../../src/core/manifest.js';
import type { DetectedChange, SourceInfo, HistoryMetadata } from '../../src/types/index.js';

const sourceInfo: SourceInfo = {
  repo: 'sample',
  branch: 'main',
  commit: 'abc1234',
  dirty: false,
};

describe('calculateStats', () => {
  it('counts each operation type and sums sizes (delete excluded from total)', () => {
    const changes: DetectedChange[] = [
      { type: 'add', path: 'a', size: 100 },
      { type: 'add', path: 'b', size: 50 },
      { type: 'modify', path: 'c', size: 200 },
      { type: 'delete', path: 'd', size: 999 }, // size ignored for delete
      { type: 'rename', path: 'e', from: 'old/e', size: 30 },
    ];

    expect(calculateStats(changes)).toEqual({
      added: 2,
      modified: 1,
      deleted: 1,
      renamed: 1,
      totalSize: 100 + 50 + 200 + 30,
    });
  });

  it('returns zeroes on empty input', () => {
    expect(calculateStats([])).toEqual({
      added: 0,
      modified: 0,
      deleted: 0,
      renamed: 0,
      totalSize: 0,
    });
  });
});

describe('createManifest', () => {
  it('builds a manifest with correct mode, message, and operation list', () => {
    const changes: DetectedChange[] = [
      { type: 'add', path: 'src/foo.ts', size: 12, hash: 'sha256:deadbeef' },
    ];

    const manifest = createManifest(changes, sourceInfo, 'changes', 'wip');

    expect(manifest.version).toBe('1.0');
    expect(manifest.mode).toBe('changes');
    expect(manifest.message).toBe('wip');
    expect(manifest.source).toEqual(sourceInfo);
    expect(manifest.operations).toEqual([
      { type: 'add', path: 'src/foo.ts', size: 12, hash: 'sha256:deadbeef' },
    ]);
    expect(manifest.history).toBeUndefined();
  });

  it('omits size on delete operations even when DetectedChange has one', () => {
    const changes: DetectedChange[] = [
      { type: 'delete', path: 'gone.ts', size: 7 },
    ];

    const op = createManifest(changes, sourceInfo, 'changes').operations[0];
    expect(op).toEqual({ type: 'delete', path: 'gone.ts' });
  });

  it('preserves rename `from` field', () => {
    const changes: DetectedChange[] = [
      { type: 'rename', path: 'new/path.ts', from: 'old/path.ts', size: 42 },
    ];

    const op = createManifest(changes, sourceInfo, 'changes').operations[0];
    expect(op).toMatchObject({ type: 'rename', path: 'new/path.ts', from: 'old/path.ts', size: 42 });
  });

  it('attaches history metadata when provided', () => {
    const history: HistoryMetadata = {
      refs: [{ sha: 'a'.repeat(40), name: 'refs/heads/main' }],
      branchCount: 1,
      tagCount: 0,
      complete: true,
      bundleSize: 1234,
    };

    const manifest = createManifest([], sourceInfo, 'history', undefined, history);
    expect(manifest.mode).toBe('history');
    expect(manifest.history).toEqual(history);
    expect(manifest.operations).toEqual([]);
  });
});

describe('parseManifest / serializeManifest round-trip', () => {
  it('round-trips a manifest with history through JSON', () => {
    const original = createManifest(
      [{ type: 'add', path: 'a.txt', size: 5, hash: 'sha256:x' }],
      sourceInfo,
      'changes',
      'msg',
      {
        refs: [{ sha: 'b'.repeat(40), name: 'refs/heads/main' }],
        branchCount: 1,
        tagCount: 0,
        complete: true,
        bundleSize: 256,
      }
    );

    const json = serializeManifest(original);
    const parsed = parseManifest(json);

    expect(parsed).toEqual(original);
  });

  it('rejects manifest without operations array', () => {
    expect(() => parseManifest('{"version":"1.0"}')).toThrow(/Invalid manifest/);
  });

  it('rejects malformed JSON via the JSON parser', () => {
    expect(() => parseManifest('not-json')).toThrow();
  });
});
