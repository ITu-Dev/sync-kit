import picomatch from 'picomatch';

/**
 * Default patterns to always exclude
 */
export const DEFAULT_EXCLUDES = [
  'node_modules/**',
  '.git/**',
  'dist/**',
  'build/**',
  '.next/**',
  '.nuxt/**',
  'coverage/**',
  '.nyc_output/**',
  '*.log',
  '.DS_Store',
  'Thumbs.db',
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'bun.lockb',
  '.env',
  '.env.*',
  '*.zip',
  '.sync-backup/**',
  '.sync-history/**',
];

/**
 * Create a file filter function based on include/exclude patterns
 */
export function createFileFilter(
  include?: string[],
  exclude?: string[]
): (path: string) => boolean {
  const excludePatterns = [...DEFAULT_EXCLUDES, ...(exclude || [])];
  const excludeMatcher = picomatch(excludePatterns);
  const includeMatcher = include?.length ? picomatch(include) : null;

  return (filePath: string) => {
    // First check excludes
    if (excludeMatcher(filePath)) {
      return false;
    }
    // Then check includes if specified
    if (includeMatcher) {
      return includeMatcher(filePath);
    }
    return true;
  };
}

/**
 * Filter an array of file paths
 */
export function filterFiles(
  files: string[],
  include?: string[],
  exclude?: string[]
): string[] {
  const filter = createFileFilter(include, exclude);
  return files.filter(filter);
}
