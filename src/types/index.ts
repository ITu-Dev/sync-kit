/**
 * Operation types for file changes
 */
export type OperationType = 'add' | 'modify' | 'delete' | 'rename';

/**
 * Single file operation in the manifest
 */
export interface FileOperation {
  type: OperationType;
  path: string;
  /** Original path for rename operations */
  from?: string;
  /** File size in bytes (not present for delete operations) */
  size?: number;
  /** SHA-256 hash of file content */
  hash?: string;
}

/**
 * Source repository information
 */
export interface SourceInfo {
  /** Repository name (from folder) */
  repo: string;
  /** Current branch name */
  branch: string;
  /** Current commit hash (short) */
  commit: string;
  /** Whether there are uncommitted changes */
  dirty: boolean;
}

/**
 * Statistics about the export
 */
export interface ExportStats {
  added: number;
  modified: number;
  deleted: number;
  renamed: number;
  /** Total size of all files in bytes */
  totalSize: number;
}

/**
 * Manifest file structure
 */
export interface Manifest {
  /** Manifest format version */
  version: string;
  /** ISO timestamp of creation */
  created: string;
  /** Source repository info */
  source: SourceInfo;
  /** Export mode */
  mode: 'changes' | 'full';
  /** Optional user message */
  message?: string;
  /** Statistics */
  stats: ExportStats;
  /** List of file operations */
  operations: FileOperation[];
}

/**
 * Export command options
 */
export interface ExportOptions {
  /** Export only changes (default) or full snapshot */
  mode?: 'changes' | 'full';
  /** Output file path */
  output?: string;
  /** Quick mode - no prompts */
  quick?: boolean;
  /** Glob patterns to exclude */
  exclude?: string[];
  /** Glob patterns to include */
  include?: string[];
  /** User message to attach */
  message?: string;
}

/**
 * Import command options
 */
export interface ImportOptions {
  /** Target directory */
  target?: string;
  /** Dry run - show what would be done */
  dryRun?: boolean;
  /** Skip backup creation */
  noBackup?: boolean;
  /** Force - no confirmations */
  force?: boolean;
}

/**
 * Preview command options
 */
export interface PreviewOptions {
  /** Show file contents */
  contents?: boolean;
}

/**
 * Git file status from diff
 */
export interface GitFileStatus {
  path: string;
  /** Index status */
  index: string;
  /** Working tree status */
  workingDir: string;
}

/**
 * Detected file change with metadata
 */
export interface DetectedChange {
  type: OperationType;
  path: string;
  from?: string;
  size: number;
  hash?: string;
}

/**
 * Conflict information during import
 */
export interface Conflict {
  path: string;
  reason: 'modified_locally' | 'deleted_locally' | 'already_exists';
}

/**
 * Import result
 */
export interface ImportResult {
  applied: FileOperation[];
  skipped: FileOperation[];
  conflicts: Conflict[];
  backupPath?: string;
}

/**
 * History entry
 */
export interface HistoryEntry {
  timestamp: string;
  type: 'export' | 'import';
  archivePath: string;
  stats: ExportStats;
  message?: string;
}

/**
 * Application configuration
 */
export interface Config {
  /** Default exclude patterns */
  defaultExcludes: string[];
  /** History file location */
  historyFile: string;
  /** Backup directory */
  backupDir: string;
}
