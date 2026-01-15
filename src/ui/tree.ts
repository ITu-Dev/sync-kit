import { colors, symbols, getFileIcon, getFolderIcon, getOperationSymbol, formatSize } from './theme.js';

/**
 * Tree node structure
 */
interface TreeNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children: Map<string, TreeNode>;
  operation?: 'add' | 'modify' | 'delete' | 'rename';
  size?: number;
  from?: string; // for renames
}

/**
 * File entry for tree building
 */
export interface FileEntry {
  path: string;
  type: 'add' | 'modify' | 'delete' | 'rename';
  size?: number;
  from?: string;
}

/**
 * Build a tree structure from file paths
 */
function buildTree(files: FileEntry[]): TreeNode {
  const root: TreeNode = {
    name: '',
    path: '',
    isDirectory: true,
    children: new Map(),
  };

  for (const file of files) {
    const parts = file.path.split('/');
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      const currentPath = parts.slice(0, i + 1).join('/');

      if (!current.children.has(part)) {
        current.children.set(part, {
          name: part,
          path: currentPath,
          isDirectory: !isLast,
          children: new Map(),
        });
      }

      const node = current.children.get(part)!;

      if (isLast) {
        node.operation = file.type;
        node.size = file.size;
        node.from = file.from;
      }

      current = node;
    }
  }

  return root;
}

/**
 * Render tree node recursively
 */
function renderNode(
  node: TreeNode,
  prefix: string,
  isLast: boolean,
  options: TreeOptions,
  lines: string[]
): void {
  const { showIcons = true, showSize = true, showOperations = true } = options;

  // Skip root node
  if (node.name) {
    const connector = isLast ? '└── ' : '├── ';
    const icon = showIcons
      ? node.isDirectory
        ? getFolderIcon() + ' '
        : getFileIcon(node.name) + ' '
      : '';

    let line = `${prefix}${colors.dim(connector)}${icon}${node.name}`;

    // Add operation indicator for files
    if (!node.isDirectory && node.operation && showOperations) {
      const opSymbol = getOperationSymbol(node.operation);
      line += `  ${opSymbol}`;

      // Show rename source
      if (node.operation === 'rename' && node.from) {
        line += ` ${colors.dim(`← ${node.from}`)}`;
      }
    }

    // Add size for files
    if (!node.isDirectory && node.size !== undefined && showSize && node.operation !== 'delete') {
      line += `  ${formatSize(node.size)}`;
    }

    lines.push(line);
  }

  // Sort children: directories first, then files, alphabetically
  const sortedChildren = Array.from(node.children.entries()).sort(([, a], [, b]) => {
    if (a.isDirectory && !b.isDirectory) return -1;
    if (!a.isDirectory && b.isDirectory) return 1;
    return a.name.localeCompare(b.name);
  });

  // Render children
  const childPrefix = node.name ? prefix + (isLast ? '    ' : '│   ') : prefix;

  sortedChildren.forEach(([, child], index) => {
    const isLastChild = index === sortedChildren.length - 1;
    renderNode(child, childPrefix, isLastChild, options, lines);
  });
}

/**
 * Options for tree display
 */
export interface TreeOptions {
  showIcons?: boolean;
  showSize?: boolean;
  showOperations?: boolean;
  indent?: string;
  title?: string;
  maxDepth?: number;
}

/**
 * Display files as a tree structure
 */
export function displayFileTree(files: FileEntry[], options: TreeOptions = {}): void {
  const { indent = '  ', title } = options;

  if (files.length === 0) {
    console.log(`${indent}${colors.dim('No files')}`);
    return;
  }

  // Title
  if (title) {
    console.log();
    console.log(`${indent}${colors.dim('┌─')} ${colors.bold(title)} ${colors.dim('─'.repeat(35))}`);
  }

  // Build and render tree
  const tree = buildTree(files);
  const lines: string[] = [];
  renderNode(tree, indent, true, options, lines);

  // Print lines
  for (const line of lines) {
    console.log(line);
  }

  // Bottom border if title was shown
  if (title) {
    console.log(`${indent}${colors.dim(symbols.corner + symbols.horizontal.repeat(50))}`);
  }

  console.log();
}

/**
 * Get tree as string array (for testing or custom rendering)
 */
export function getFileTreeLines(files: FileEntry[], options: TreeOptions = {}): string[] {
  const tree = buildTree(files);
  const lines: string[] = [];
  renderNode(tree, options.indent || '', true, options, lines);
  return lines;
}

/**
 * Display a simple directory tree from paths
 */
export function displaySimpleTree(paths: string[], options: { indent?: string; title?: string } = {}): void {
  const files: FileEntry[] = paths.map((path) => ({
    path,
    type: 'add' as const,
  }));

  displayFileTree(files, {
    ...options,
    showOperations: false,
    showSize: false,
  });
}

/**
 * Compact tree view - shows only top-level directories with counts
 */
export function displayCompactTree(files: FileEntry[], options: { indent?: string } = {}): void {
  const { indent = '  ' } = options;

  // Group by top-level directory
  const groups = new Map<string, FileEntry[]>();

  for (const file of files) {
    const topDir = file.path.split('/')[0];
    if (!groups.has(topDir)) {
      groups.set(topDir, []);
    }
    groups.get(topDir)!.push(file);
  }

  // Sort groups
  const sortedGroups = Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));

  console.log();
  for (let i = 0; i < sortedGroups.length; i++) {
    const [dir, groupFiles] = sortedGroups[i];
    const isLast = i === sortedGroups.length - 1;
    const connector = isLast ? '└── ' : '├── ';

    // Check if it's a file or directory
    const isFile = groupFiles.length === 1 && groupFiles[0].path === dir;

    if (isFile) {
      const file = groupFiles[0];
      const icon = getFileIcon(dir);
      const opSymbol = getOperationSymbol(file.type);
      console.log(`${indent}${colors.dim(connector)}${icon} ${dir}  ${opSymbol}`);
    } else {
      const icon = getFolderIcon();
      const stats = getGroupStats(groupFiles);
      console.log(`${indent}${colors.dim(connector)}${icon} ${dir}/  ${colors.dim(`(${groupFiles.length} files)`)}  ${stats}`);
    }
  }
  console.log();
}

/**
 * Get stats string for a group of files
 */
function getGroupStats(files: FileEntry[]): string {
  const counts = { add: 0, modify: 0, delete: 0, rename: 0 };

  for (const file of files) {
    counts[file.type]++;
  }

  const parts: string[] = [];
  if (counts.add) parts.push(colors.added(`+${counts.add}`));
  if (counts.modify) parts.push(colors.modified(`~${counts.modify}`));
  if (counts.delete) parts.push(colors.deleted(`-${counts.delete}`));
  if (counts.rename) parts.push(colors.renamed(`→${counts.rename}`));

  return parts.join(' ');
}
