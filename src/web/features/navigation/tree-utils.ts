import type { DocPath, TreeFile, TreeFolder, TreeNode } from '../../../shared/api-types';

const counts = new WeakMap<TreeFolder, number>();

export function countNotes(folder: TreeFolder): number {
  const cached = counts.get(folder);
  if (cached !== undefined) return cached;
  let n = 0;
  for (const child of folder.children) {
    if (child.kind === 'folder') n += countNotes(child);
    else if (child.kind === 'note') n += 1;
  }
  counts.set(folder, n);
  return n;
}

/** Mappestiene som må være åpne for at `path` skal synes. */
export function ancestorFolders(path: DocPath): string[] {
  const parts = path.split('/');
  const out: string[] = [];
  for (let i = 1; i < parts.length; i++) out.push(parts.slice(0, i).join('/'));
  return out;
}

export function flattenFiles(folder: TreeFolder, predicate: (file: TreeFile) => boolean): TreeFile[] {
  const out: TreeFile[] = [];
  const walk = (nodes: readonly TreeNode[]) => {
    for (const node of nodes) {
      if (node.kind === 'folder') walk(node.children);
      else if (predicate(node)) out.push(node);
    }
  };
  walk(folder.children);
  return out;
}

export function findFile(folder: TreeFolder, path: DocPath): TreeFile | undefined {
  return flattenFiles(folder, (f) => f.path === path)[0];
}
