import { Command } from 'commander';
import { executeExport } from './commands/export.js';
import { executeImport } from './commands/import.js';
import { executePreview } from './commands/preview.js';
import { executeHistory } from './commands/history.js';

const VERSION = '1.0.0';

/**
 * Create and configure the CLI program
 */
export function createProgram(): Command {
  const program = new Command();

  program
    .name('sync-kit')
    .description('CLI utility for transferring code changes between computers via text archives')
    .version(VERSION);

  // Export command
  program
    .command('export')
    .description('Export changes to an archive')
    .option('-c, --changes', 'Export only changed files (default)')
    .option('-f, --full', 'Export full repository snapshot')
    .option('-q, --quick', 'Quick mode - no interactive prompts')
    .option('-o, --output <path>', 'Output archive path')
    .option('-n, --name <name>', 'Custom archive name (auto-appends .zip)')
    .option('-m, --message <text>', 'Add a description message')
    .option('-e, --exclude <pattern...>', 'Exclude files matching pattern')
    .option('-i, --include <pattern...>', 'Include only files matching pattern')
    .option('--include-media', 'Include media files (images, svg, fonts — excluded by default)')
    .option('-D, --dirs <dirs...>', 'Export only specific directories')
    .action(async (opts) => {
      await executeExport({
        mode: opts.dirs ? 'directories' : opts.full ? 'full' : opts.changes ? 'changes' : undefined,
        quick: opts.quick,
        output: opts.output,
        name: opts.name,
        message: opts.message,
        exclude: opts.exclude,
        include: opts.include,
        includeMedia: opts.includeMedia,
        directories: opts.dirs,
      });
    });

  // Import command
  program
    .command('import <archive>')
    .description('Import changes from an archive')
    .option('-t, --target <dir>', 'Target directory (default: current directory)')
    .option('-d, --dry-run', 'Preview changes without applying')
    .option('-n, --no-backup', 'Skip creating backup before import')
    .option('-f, --force', 'Force import without confirmations')
    .action(async (archive, opts) => {
      await executeImport(archive, {
        target: opts.target,
        dryRun: opts.dryRun,
        noBackup: opts.noBackup,
        force: opts.force,
      });
    });

  // Preview command
  program
    .command('preview <archive>')
    .description('Preview contents of an archive')
    .option('-c, --contents', 'Show file contents preview')
    .action(async (archive, opts) => {
      await executePreview(archive, {
        contents: opts.contents,
      });
    });

  // History command
  program
    .command('history')
    .description('Show sync history')
    .option('--clear', 'Clear all history')
    .action(async (opts) => {
      await executeHistory({
        clear: opts.clear,
      });
    });

  // Quick export alias
  program
    .command('q')
    .description('Quick export (alias for: export --quick --changes)')
    .action(async () => {
      await executeExport({
        mode: 'changes',
        quick: true,
      });
    });

  return program;
}
