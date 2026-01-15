import { FileOperation, Conflict, DetectedChange } from '../types/index.js';
import { fileExists, hashFile, readFileContent } from '../utils/fs.js';
import { isFileModifiedLocally } from './git.js';
import { getFileFromArchive } from './archive.js';
import AdmZip from 'adm-zip';

/**
 * Detect conflicts between archive operations and local state
 */
export async function detectConflicts(
  operations: FileOperation[],
  targetDir: string
): Promise<Conflict[]> {
  const conflicts: Conflict[] = [];

  for (const op of operations) {
    const localPath = `${targetDir}/${op.path}`;
    const localExists = fileExists(localPath);

    switch (op.type) {
      case 'add':
        // Conflict if file already exists locally
        if (localExists) {
          const localHash = await hashFile(localPath);
          if (localHash !== op.hash) {
            conflicts.push({
              path: op.path,
              reason: 'already_exists',
            });
          }
        }
        break;

      case 'modify':
        if (localExists) {
          // Check if file was modified locally
          const isModified = await isFileModifiedLocally(op.path);
          if (isModified) {
            conflicts.push({
              path: op.path,
              reason: 'modified_locally',
            });
          }
        }
        break;

      case 'delete':
        if (!localExists) {
          conflicts.push({
            path: op.path,
            reason: 'deleted_locally',
          });
        }
        break;

      case 'rename':
        if (op.from) {
          const fromExists = fileExists(`${targetDir}/${op.from}`);
          if (!fromExists) {
            conflicts.push({
              path: op.from,
              reason: 'deleted_locally',
            });
          }
        }
        break;
    }
  }

  return conflicts;
}

/**
 * Compare file content between archive and local
 */
export async function compareFileContent(
  zip: AdmZip,
  filePath: string,
  localDir: string
): Promise<{ matches: boolean; localContent?: string; archiveContent?: string }> {
  const archiveContent = getFileFromArchive(zip, filePath);
  const localPath = `${localDir}/${filePath}`;

  if (!archiveContent) {
    return { matches: false };
  }

  if (!fileExists(localPath)) {
    return {
      matches: false,
      archiveContent: archiveContent.toString('utf-8'),
    };
  }

  const localContent = await readFileContent(localPath);
  const archiveString = archiveContent.toString('utf-8');

  return {
    matches: localContent === archiveString,
    localContent,
    archiveContent: archiveString,
  };
}

/**
 * Filter changes by type
 */
export function filterChangesByType(
  changes: DetectedChange[],
  types: DetectedChange['type'][]
): DetectedChange[] {
  return changes.filter((change) => types.includes(change.type));
}

/**
 * Sort changes for optimal application order
 * Order: deletes first, then renames, then adds/modifies
 */
export function sortOperationsForApply(operations: FileOperation[]): FileOperation[] {
  const typeOrder: Record<FileOperation['type'], number> = {
    delete: 0,
    rename: 1,
    modify: 2,
    add: 3,
  };

  return [...operations].sort((a, b) => typeOrder[a.type] - typeOrder[b.type]);
}

/**
 * Group operations by type
 */
export function groupOperationsByType(
  operations: FileOperation[]
): Record<FileOperation['type'], FileOperation[]> {
  const groups: Record<FileOperation['type'], FileOperation[]> = {
    add: [],
    modify: [],
    delete: [],
    rename: [],
  };

  for (const op of operations) {
    groups[op.type].push(op);
  }

  return groups;
}
