import inquirer from 'inquirer';
import { colors } from './theme.js';
import { DetectedChange, FileOperation, ExportStats } from '../types/index.js';
import { displayCompactStats } from './table.js';

/**
 * Prompt for export mode selection
 */
export async function promptExportMode(
  changesStats: ExportStats,
  fullStats: ExportStats
): Promise<'changes' | 'full' | 'custom'> {
  const changesLabel = `Changes only (${displayCompactStats(changesStats)})`;
  const fullLabel = `Full snapshot (${fullStats.added} files)`;

  const { mode } = await inquirer.prompt([
    {
      type: 'list',
      name: 'mode',
      message: 'Select export mode:',
      choices: [
        { name: changesLabel, value: 'changes' },
        { name: fullLabel, value: 'full' },
        { name: 'Custom selection...', value: 'custom' },
      ],
      default: 'changes',
    },
  ]);

  return mode;
}

/**
 * Prompt for file selection
 */
export async function promptFileSelection(
  changes: DetectedChange[]
): Promise<DetectedChange[]> {
  const choices = changes.map((change) => ({
    name: formatChangeForSelection(change),
    value: change,
    checked: true,
  }));

  const { selected } = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'selected',
      message: 'Select files to include:',
      choices,
      pageSize: 15,
    },
  ]);

  return selected;
}

/**
 * Prompt for confirmation
 */
export async function promptConfirm(
  message: string,
  defaultValue: boolean = true
): Promise<boolean> {
  const { confirmed } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirmed',
      message,
      default: defaultValue,
    },
  ]);

  return confirmed;
}

/**
 * Prompt for conflict resolution
 */
export async function promptConflictResolution(
  path: string,
  reason: string
): Promise<'overwrite' | 'skip' | 'keep'> {
  console.log();
  console.log(`  ${colors.warning('⚠')} Conflict: ${colors.path(path)}`);
  console.log(`    ${colors.dim(reason)}`);
  console.log();

  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'How to resolve?',
      choices: [
        { name: 'Overwrite with archive version', value: 'overwrite' },
        { name: 'Keep local version', value: 'keep' },
        { name: 'Skip this file', value: 'skip' },
      ],
    },
  ]);

  return action;
}

/**
 * Prompt for message input
 */
export async function promptMessage(defaultMessage?: string): Promise<string> {
  const { message } = await inquirer.prompt([
    {
      type: 'input',
      name: 'message',
      message: 'Add a message (optional):',
      default: defaultMessage,
    },
  ]);

  return message.trim();
}

/**
 * Prompt for output path
 */
export async function promptOutputPath(defaultPath: string): Promise<string> {
  const { path } = await inquirer.prompt([
    {
      type: 'input',
      name: 'path',
      message: 'Output path:',
      default: defaultPath,
    },
  ]);

  return path;
}

/**
 * Prompt for target directory
 */
export async function promptTargetDirectory(defaultDir: string): Promise<string> {
  const { dir } = await inquirer.prompt([
    {
      type: 'input',
      name: 'dir',
      message: 'Target directory:',
      default: defaultDir,
    },
  ]);

  return dir;
}

/**
 * Format change for selection display
 */
function formatChangeForSelection(change: DetectedChange): string {
  const typeColors: Record<string, (s: string) => string> = {
    add: colors.added,
    modify: colors.modified,
    delete: colors.deleted,
    rename: colors.renamed,
  };

  const colorFn = typeColors[change.type] || colors.dim;
  const typeLabel = `[${change.type}]`.padEnd(10);

  if (change.type === 'rename' && change.from) {
    return `${colorFn(typeLabel)} ${change.from} → ${change.path}`;
  }

  return `${colorFn(typeLabel)} ${change.path}`;
}
