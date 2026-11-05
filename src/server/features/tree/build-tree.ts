import type { TreeFile, TreeFolder, TreeNode } from '../../../shared/api-types';
import type { VaultFile } from '../vault-index';

const collator = new Intl.Collator('nb', { sensitivity: 'base', numeric: true });

interface MutableFolder {
  readonly name: string;
  readonly path: string;
  readonly folders: Map<string, MutableFolder>;
  readonly files: TreeFile[];
}

/** Filtre for `GET /tree`: mapper først, så filer; begge sortert med nb-kollasjon (case-insensitiv). */
export function buildTree(files: Iterable<VaultFile>): TreeFolder {
  const root: MutableFolder = { name: '', path: '', folders: new Map(), files: [] };
  for (const file of files) {
    let folder = root;
    if (file.folder !== '') {
      for (const segment of file.folder.split('/')) {
        let next = folder.folders.get(segment);
        if (!next) {
          next = { name: segment, path: folder.path === '' ? segment : `${folder.path}/${segment}`, folders: new Map(), files: [] };
          folder.folders.set(segment, next);
        }
        folder = next;
      }
    }
    folder.files.push({ kind: file.kind, name: file.name, path: file.docPath });
  }
  return freeze(root);
}

function freeze(folder: MutableFolder): TreeFolder {
  const folders = [...folder.folders.values()].sort((a, b) => collator.compare(a.name, b.name)).map(freeze);
  const files = [...folder.files].sort((a, b) => collator.compare(a.name, b.name) || a.path.localeCompare(b.path));
  return { kind: 'folder', name: folder.name, path: folder.path, children: [...folders, ...files] as TreeNode[] };
}
