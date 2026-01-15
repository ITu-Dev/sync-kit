import { Manifest, FileOperation, SourceInfo, ExportStats, DetectedChange } from '../types/index.js';

const MANIFEST_VERSION = '1.0';

/**
 * Create a new manifest from detected changes
 */
export function createManifest(
  changes: DetectedChange[],
  source: SourceInfo,
  mode: 'changes' | 'full',
  message?: string
): Manifest {
  const operations: FileOperation[] = changes.map((change) => {
    const op: FileOperation = {
      type: change.type,
      path: change.path,
    };

    if (change.from) {
      op.from = change.from;
    }
    if (change.size !== undefined && change.type !== 'delete') {
      op.size = change.size;
    }
    if (change.hash) {
      op.hash = change.hash;
    }

    return op;
  });

  const stats = calculateStats(changes);

  return {
    version: MANIFEST_VERSION,
    created: new Date().toISOString(),
    source,
    mode,
    message,
    stats,
    operations,
  };
}

/**
 * Calculate statistics from changes
 */
export function calculateStats(changes: DetectedChange[]): ExportStats {
  let added = 0;
  let modified = 0;
  let deleted = 0;
  let renamed = 0;
  let totalSize = 0;

  for (const change of changes) {
    switch (change.type) {
      case 'add':
        added++;
        totalSize += change.size;
        break;
      case 'modify':
        modified++;
        totalSize += change.size;
        break;
      case 'delete':
        deleted++;
        break;
      case 'rename':
        renamed++;
        totalSize += change.size;
        break;
    }
  }

  return { added, modified, deleted, renamed, totalSize };
}

/**
 * Parse manifest from JSON string
 */
export function parseManifest(json: string): Manifest {
  const data = JSON.parse(json);

  // Validate required fields
  if (!data.version || !data.operations || !Array.isArray(data.operations)) {
    throw new Error('Invalid manifest format');
  }

  return data as Manifest;
}

/**
 * Serialize manifest to JSON string
 */
export function serializeManifest(manifest: Manifest): string {
  return JSON.stringify(manifest, null, 2);
}

/**
 * Get human-readable summary of manifest
 */
export function getManifestSummary(manifest: Manifest): string {
  const lines: string[] = [
    `sync-kit Archive`,
    `================`,
    ``,
    `Created: ${new Date(manifest.created).toLocaleString()}`,
    `Mode: ${manifest.mode}`,
    ``,
    `Source Repository:`,
    `  Name: ${manifest.source.repo}`,
    `  Branch: ${manifest.source.branch}`,
    `  Commit: ${manifest.source.commit}`,
    `  Dirty: ${manifest.source.dirty ? 'Yes' : 'No'}`,
    ``,
  ];

  if (manifest.message) {
    lines.push(`Message: ${manifest.message}`, ``);
  }

  lines.push(
    `Statistics:`,
    `  Added: ${manifest.stats.added}`,
    `  Modified: ${manifest.stats.modified}`,
    `  Deleted: ${manifest.stats.deleted}`,
    `  Renamed: ${manifest.stats.renamed}`,
    `  Total Size: ${formatBytes(manifest.stats.totalSize)}`,
    ``,
    `Operations:`,
    ``
  );

  for (const op of manifest.operations) {
    let line: string;
    switch (op.type) {
      case 'add':
        line = `  + ${op.path}`;
        break;
      case 'modify':
        line = `  ~ ${op.path}`;
        break;
      case 'delete':
        line = `  - ${op.path}`;
        break;
      case 'rename':
        line = `  > ${op.from} -> ${op.path}`;
        break;
      default:
        line = `  ? ${op.path}`;
    }
    lines.push(line);
  }

  return lines.join('\n');
}

/**
 * Format bytes to human readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);

  return `${value.toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}
