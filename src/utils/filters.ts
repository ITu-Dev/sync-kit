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
 * Media file patterns excluded by default (use --include-media to override)
 */
export const MEDIA_EXCLUDES = [
  // Images
  '*.png',
  '*.jpg',
  '*.jpeg',
  '*.gif',
  '*.webp',
  '*.bmp',
  '*.tiff',
  '*.tif',
  '*.ico',
  '*.icns',
  // Vector graphics
  '*.svg',
  // Fonts
  '*.woff',
  '*.woff2',
  '*.ttf',
  '*.otf',
  '*.eot',
  // Video
  '*.mp4',
  '*.webm',
  '*.avi',
  '*.mov',
  // Audio
  '*.mp3',
  '*.wav',
  '*.ogg',
  '*.flac',
  // PSD / design
  '*.psd',
  '*.sketch',
  '*.fig',
];

/**
 * Create a file filter function based on include/exclude patterns
 */
export function createFileFilter(
  include?: string[],
  exclude?: string[],
  includeMedia?: boolean
): (path: string) => boolean {
  const excludePatterns = [
    ...DEFAULT_EXCLUDES,
    ...(includeMedia ? [] : MEDIA_EXCLUDES),
    ...(exclude || []),
  ];
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
  exclude?: string[],
  includeMedia?: boolean
): string[] {
  const filter = createFileFilter(include, exclude, includeMedia);
  return files.filter(filter);
}

/**
 * Check if a file path matches media patterns
 */
export function isMediaFile(filePath: string): boolean {
  const matcher = picomatch(MEDIA_EXCLUDES);
  return matcher(filePath);
}

/**
 * Count media files in a list and return their paths
 */
export function findMediaFiles(files: string[]): string[] {
  return files.filter(isMediaFile);
}

/**
 * Filter files by directory prefixes
 */
export function filterByDirectories(
  files: string[],
  directories: string[]
): string[] {
  return files.filter((filePath) =>
    directories.some((dir) => {
      const normalized = dir.endsWith('/') ? dir : dir + '/';
      return filePath.startsWith(normalized);
    })
  );
}
