import type { DocPath, FilePath } from '../../../shared/api-types';

export type FileKind = 'note' | 'base' | 'asset' | 'unsupported';
export type UnsupportedFileKind = 'canvas' | 'excalidraw' | 'other';

export interface FileClassification {
  readonly kind: FileKind;
  readonly unsupportedKind: UnsupportedFileKind | null;
}

/** Sti-beskrivelse avledet kun fra den vault-relative stien (ingen I/O). */
export interface VaultPathInfo extends FileClassification {
  /** NFC, POSIX, med endelse. */
  readonly filePath: FilePath;
  /** Uten `.md` for markdown, ellers med endelse. */
  readonly docPath: DocPath;
  /** Visningsnavn i treet: filnavn uten `.md` for markdown, ellers med endelse. */
  readonly name: string;
  /** Filnavn uten endelse (Obsidian-tittel). */
  readonly title: string;
  /** Endelse i små bokstaver uten punktum (`md`, `base`, `png`). */
  readonly ext: string;
  /** Mappesti, `''` for rot. */
  readonly folder: string;
}

const ALWAYS_IGNORED_SEGMENTS = new Set(['node_modules']);

/** NFC + POSIX-separatorer, uten ledende `./` eller `/`. */
export function normalizeVaultPath(path: string): string {
  return path.normalize('NFC').replace(/\\/g, '/').replace(/^(\.\/)+/, '').replace(/^\/+/, '');
}

/** Alle segmenter som starter med `.` ignoreres (QA-IDX-03/04), pluss konfigurerte prefikser. */
export function isIgnoredPath(relativePath: string, ignorePrefixes: readonly string[]): boolean {
  const path = normalizeVaultPath(relativePath);
  const segments = path.split('/');
  if (segments.some((s) => s.startsWith('.') || ALWAYS_IGNORED_SEGMENTS.has(s))) return true;
  return ignorePrefixes.some((raw) => {
    const prefix = normalizeVaultPath(raw).replace(/\/+$/, '');
    return prefix !== '' && (path === prefix || path.startsWith(`${prefix}/`));
  });
}

export function classifyFile(filePath: string): FileClassification {
  const lower = filePath.toLowerCase();
  if (lower.endsWith('.excalidraw.md')) return { kind: 'unsupported', unsupportedKind: 'excalidraw' };
  if (lower.endsWith('.md')) return { kind: 'note', unsupportedKind: null };
  if (lower.endsWith('.base')) return { kind: 'base', unsupportedKind: null };
  if (lower.endsWith('.canvas')) return { kind: 'unsupported', unsupportedKind: 'canvas' };
  return { kind: 'asset', unsupportedKind: null };
}

export function describeVaultPath(relativePath: string): VaultPathInfo {
  const filePath = normalizeVaultPath(relativePath);
  const slash = filePath.lastIndexOf('/');
  const fileName = filePath.slice(slash + 1);
  const folder = slash === -1 ? '' : filePath.slice(0, slash);
  const dot = fileName.lastIndexOf('.');
  const ext = dot > 0 ? fileName.slice(dot + 1).toLowerCase() : '';
  const title = dot > 0 ? fileName.slice(0, dot) : fileName;
  const isMarkdown = ext === 'md';
  return {
    ...classifyFile(filePath),
    filePath,
    docPath: isMarkdown ? filePath.slice(0, -3) : filePath,
    name: isMarkdown ? title : fileName,
    title,
    ext,
    folder,
  };
}
