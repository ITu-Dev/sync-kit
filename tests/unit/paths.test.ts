import { describe, it, expect } from 'vitest';
import {
  normalizePath,
  toArchivePath,
  fromArchivePath,
  getArchiveFilePath,
  generateArchiveName,
  resolveSafePath,
  isPathSafe,
  getRepoName,
} from '../../src/utils/paths.js';

describe('normalizePath', () => {
  it('replaces backslashes with forward slashes', () => {
    expect(normalizePath('a\\b\\c')).toBe('a/b/c');
  });

  it('leaves already-normalized paths unchanged', () => {
    expect(normalizePath('a/b/c')).toBe('a/b/c');
  });

  it('handles mixed separators', () => {
    expect(normalizePath('a\\b/c\\d')).toBe('a/b/c/d');
  });
});

describe('toArchivePath / fromArchivePath', () => {
  it('appends .txt going in', () => {
    expect(toArchivePath('src/foo.ts')).toBe('src/foo.ts.txt');
  });

  it('strips .txt going out', () => {
    expect(fromArchivePath('src/foo.ts.txt')).toBe('src/foo.ts');
  });

  it('leaves paths without .txt unchanged on the way out', () => {
    expect(fromArchivePath('manifest.json')).toBe('manifest.json');
  });
});

describe('getArchiveFilePath', () => {
  it('puts the file under files/ with .txt suffix', () => {
    expect(getArchiveFilePath('src/Foo.tsx')).toBe('files/src/Foo.tsx.txt');
  });
});

describe('generateArchiveName', () => {
  it('uses the right prefix per mode', () => {
    expect(generateArchiveName('changes')).toMatch(/^sync_\d{8}-\d{6}\.zip$/);
    expect(generateArchiveName('full')).toMatch(/^snapshot_\d{8}-\d{6}\.zip$/);
    expect(generateArchiveName('directories')).toMatch(/^dirs_\d{8}-\d{6}\.zip$/);
    expect(generateArchiveName('history')).toMatch(/^history_\d{8}-\d{6}\.zip$/);
  });
});

describe('resolveSafePath / isPathSafe (path traversal protection)', () => {
  const base = '/tmp/sync-kit-test-base';

  it('allows a normal subpath', () => {
    expect(resolveSafePath(base, 'a/b.txt')).toBe(`${base}/a/b.txt`);
    expect(isPathSafe(base, 'a/b.txt')).toBe(true);
  });

  it('blocks ..-based escape', () => {
    expect(() => resolveSafePath(base, '../escape')).toThrow(/Path traversal/);
    expect(isPathSafe(base, '../escape')).toBe(false);
  });

  it('blocks absolute paths that fall outside base', () => {
    expect(() => resolveSafePath(base, '/etc/passwd')).toThrow(/Path traversal/);
    expect(isPathSafe(base, '/etc/passwd')).toBe(false);
  });

  it('allows the base directory itself', () => {
    expect(resolveSafePath(base, '.')).toBe(base);
  });
});

describe('getRepoName', () => {
  it('returns the basename of the path', () => {
    expect(getRepoName('/foo/bar/baz')).toBe('baz');
    expect(getRepoName('/foo/bar/baz/')).toBe('baz');
  });
});
