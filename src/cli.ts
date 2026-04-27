import { Command } from 'commander';
import { executeExport } from './commands/export.js';
import { executeImport } from './commands/import.js';
import { executePreview } from './commands/preview.js';
import { executeHistory } from './commands/history.js';

const VERSION = '1.1.0';

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
    .description('Export changes to an archive (optionally with git history)')
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
    .option('--with-history', 'Embed git history bundle (all local branches + tags) alongside files')
    .option('--history-only', 'Bundle only — no working-tree files (mutually exclusive with -c/-f/-D)')
    .option('--branches <list...>', 'Specific branches/tags for the bundle (default: all local heads + tags)')
    .option('--no-tags', 'Skip tags in the bundle')
    .action(async (opts) => {
      if (opts.historyOnly && (opts.full || opts.changes || opts.dirs)) {
        console.error('Error: --history-only is mutually exclusive with -c/--changes, -f/--full, -D/--dirs');
        process.exit(1);
      }
      await executeExport({
        mode: opts.historyOnly
          ? 'history'
          : opts.dirs
          ? 'directories'
          : opts.full
          ? 'full'
          : opts.changes
          ? 'changes'
          : undefined,
        quick: opts.quick,
        output: opts.output,
        name: opts.name,
        message: opts.message,
        exclude: opts.exclude,
        include: opts.include,
        includeMedia: opts.includeMedia,
        directories: opts.dirs,
        withHistory: opts.withHistory,
        historyOnly: opts.historyOnly,
        branches: opts.branches,
        noTags: opts.tags === false,
      });
    });

  // Import command
  program
    .command('import <archive>')
    .description('Import changes from an archive (and optionally apply embedded history)')
    .option('-t, --target <dir>', 'Target directory (default: current directory)')
    .option('-d, --dry-run', 'Preview changes without applying')
    .option('-n, --no-backup', 'Skip creating backup before import')
    .option('-f, --force', 'Force import without confirmations')
    .option('--no-history', 'Ignore embedded bundle even if present')
    .option('--history-strategy <mode>', 'How to apply refs from bundle: safe | fast-forward | force', 'safe')
    .option('--checkout', 'After fetching bundle, run `git checkout <branch>` to sync working tree')
    .option('--init-if-empty', 'If target is empty / not a git repo, init or clone from bundle')
    .action(async (archive, opts) => {
      await executeImport(archive, {
        target: opts.target,
        dryRun: opts.dryRun,
        noBackup: opts.noBackup,
        force: opts.force,
        noHistory: opts.history === false,
        historyStrategy: opts.historyStrategy,
        checkout: opts.checkout,
        initIfEmpty: opts.initIfEmpty,
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
