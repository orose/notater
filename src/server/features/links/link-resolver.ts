import { posix } from 'node:path';
import type { FilePath } from '../../../shared/api-types';
import type { VaultFile } from '../vault-index';

/** `wiki` = `[[…]]`/`![[…]]`/property-lenker. `markdown` = `[t](…)`/`![a](…)` (allerede URL-dekodet). */
export type LinkSyntax = 'wiki' | 'markdown';

export interface ResolvedLink {
  readonly file: VaultFile;
  /** Andre filer som også matchet (tvetydig lenke, PO-8), i rangert rekkefølge. Tom = entydig. */
  readonly alternatives: readonly VaultFile[];
}

export interface LinkResolver {
  /** Løser en lenke slik Obsidian gjør (ADR-004, README-QA §4). `null` = brutt lenke. */
  resolve(linkPath: string, fromFilePath: FilePath, syntax: LinkSyntax): ResolvedLink | null;
  /** Notat med et alias som matcher lenketeksten (for hint «Mente du X?», PO-7). Aliaser løser aldri lenker. */
  suggestByAlias(linkPath: string): VaultFile | null;
}

const key = (value: string): string => value.normalize('NFC').toLowerCase();

/**
 * Bygger oppslagstabeller én gang (O(n)); hver oppløsning er deretter noen få Map-oppslag.
 * `aliases`: filePath → aliaser (kun til forslag).
 */
export function createLinkResolver(
  files: Iterable<VaultFile>,
  aliases: ReadonlyMap<FilePath, readonly string[]> = new Map(),
): LinkResolver {
  const byPath = new Map<string, VaultFile>();
  const byName = new Map<string, VaultFile[]>();
  const all = new Map<FilePath, VaultFile>();
  const addName = (name: string, file: VaultFile): void => {
    const list = byName.get(name);
    if (list) list.push(file);
    else byName.set(name, [file]);
  };

  for (const file of files) {
    all.set(file.filePath, file);
    const pathKey = key(file.filePath);
    byPath.set(pathKey, file);
    const fileName = pathKey.slice(pathKey.lastIndexOf('/') + 1);
    addName(fileName, file);
    if (file.ext === 'md') {
      byPath.set(pathKey.slice(0, -3), file);
      addName(fileName.slice(0, -3), file);
    }
  }

  const aliasIndex = new Map<string, VaultFile>();
  for (const [filePath, list] of aliases) {
    const file = all.get(filePath);
    if (!file) continue;
    for (const alias of list) if (!aliasIndex.has(key(alias))) aliasIndex.set(key(alias), file);
  }

  const exact = (path: string | null): VaultFile | null => (path === null ? null : (byPath.get(key(path)) ?? null));

  const bySuffix = (path: string, fromFolder: string): ResolvedLink | null => {
    const wanted = key(path);
    const name = wanted.slice(wanted.lastIndexOf('/') + 1);
    const candidates = (byName.get(name) ?? []).filter((file) => {
      const full = key(file.filePath);
      const stem = file.ext === 'md' ? full.slice(0, -3) : null;
      return [full, stem].some((k) => k !== null && (k === wanted || k.endsWith(`/${wanted}`)));
    });
    if (candidates.length === 0) return null;
    const ranked = [...candidates].sort((a, b) => compareCandidates(a, b, fromFolder));
    return { file: ranked[0]!, alternatives: ranked.slice(1) };
  };

  return {
    resolve(linkPath, fromFilePath, syntax) {
      if (linkPath.includes('\0')) return null;
      const path = linkPath.normalize('NFC').replace(/\\/g, '/').trim();
      if (path === '') {
        const self = all.get(fromFilePath);
        return self ? { file: self, alternatives: [] } : null;
      }
      const fromFolder = posix.dirname(fromFilePath) === '.' ? '' : posix.dirname(fromFilePath);
      const single = (file: VaultFile | null): ResolvedLink | null => (file ? { file, alternatives: [] } : null);

      if (path.startsWith('/')) return single(exact(insideVault('', path.slice(1))));
      if (syntax === 'markdown') {
        return single(exact(insideVault(fromFolder, path)) ?? exact(insideVault('', path))) ?? bySuffix(path, fromFolder);
      }
      if (path.startsWith('./') || path.startsWith('../')) return single(exact(insideVault(fromFolder, path)));
      return single(exact(insideVault('', path))) ?? bySuffix(path, fromFolder);
    },
    suggestByAlias(linkPath) {
      return aliasIndex.get(key(linkPath.trim())) ?? null;
    },
  };
}

/** Slår sammen mappe + relativ sti; `null` hvis resultatet havner utenfor vaultet. */
function insideVault(folder: string, path: string): string | null {
  const joined = posix.normalize(posix.join(folder || '.', path));
  if (joined === '..' || joined.startsWith('../') || posix.isAbsolute(joined)) return null;
  return joined;
}

/** PO-8 / README-QA regel 6: samme mappe som kilden → færrest mapper → alfabetisk sti. */
function compareCandidates(a: VaultFile, b: VaultFile, fromFolder: string): number {
  const sameA = a.folder === fromFolder ? 0 : 1;
  const sameB = b.folder === fromFolder ? 0 : 1;
  if (sameA !== sameB) return sameA - sameB;
  const depth = (f: VaultFile): number => (f.folder === '' ? 0 : f.folder.split('/').length);
  if (depth(a) !== depth(b)) return depth(a) - depth(b);
  return a.filePath.localeCompare(b.filePath, 'nb');
}
