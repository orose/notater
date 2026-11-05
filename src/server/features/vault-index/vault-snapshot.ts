import type { DocPath, FileChange, FilePath } from '../../../shared/api-types';
import { splitFrontmatter } from '../markdown-syntax';
import type { MetaExtractor } from './meta-extractor';
import type { NoteMeta } from './note-meta';
import { mapWithConcurrency, readVaultText, scanVault, statVaultFile } from './scan-vault';
import type { ScannedFile } from './scan-vault';
import { describeVaultPath, isIgnoredPath, normalizeVaultPath } from './vault-paths';
import type { VaultPathInfo } from './vault-paths';

export interface VaultFile extends VaultPathInfo {
  /** Vault-relativ sti slik den ligger på disk (kan være NFD). Brukes kun til fil-I/O. */
  readonly diskPath: string;
  readonly size: number;
  readonly mtimeMs: number;
  readonly ctimeMs: number;
}

export interface IndexedNote {
  readonly file: VaultFile;
  readonly meta: NoteMeta;
  /** Brødtekst uten frontmatter (input til rendering). */
  readonly body: string;
}

/** Uforanderlig øyeblikksbilde av et vault. Oppdateringer gir et nytt snapshot. */
export interface VaultSnapshot {
  readonly files: ReadonlyMap<FilePath, VaultFile>;
  /** Markdown-filer (også excalidraw, som klassifiseres `unsupported`). */
  readonly notes: ReadonlyMap<FilePath, IndexedNote>;
  /** Rå YAML for `.base`-filer (evalueres i slice 3). */
  readonly baseSources: ReadonlyMap<FilePath, string>;
}

const READ_CONCURRENCY = 32;

export async function buildSnapshot(
  root: string,
  ignore: readonly string[],
  extractor: MetaExtractor,
): Promise<VaultSnapshot> {
  const scanned = await scanVault(root, ignore);
  const files = new Map<FilePath, VaultFile>();
  for (const s of scanned) {
    const file = toVaultFile(s);
    files.set(file.filePath, file);
  }
  const textFiles = [...files.values()].filter((f) => f.ext === 'md' || f.kind === 'base');
  const texts = await mapWithConcurrency(textFiles, READ_CONCURRENCY, (f) => readVaultText(root, f.diskPath));

  const notes = new Map<FilePath, IndexedNote>();
  const baseSources = new Map<FilePath, string>();
  const noteFiles: VaultFile[] = [];
  const noteSources: string[] = [];
  textFiles.forEach((file, i) => {
    if (file.kind === 'base') baseSources.set(file.filePath, texts[i]!);
    else {
      noteFiles.push(file);
      noteSources.push(texts[i]!);
    }
  });
  const metas = await extractor.extractMany(noteSources);
  noteFiles.forEach((file, i) => {
    notes.set(file.filePath, { file, meta: metas[i]!, body: splitFrontmatter(noteSources[i]!).body });
  });
  return { files, notes, baseSources };
}

export interface SnapshotUpdate {
  readonly snapshot: VaultSnapshot;
  readonly changes: readonly FileChange[];
}

/**
 * Inkrementell oppdatering: les og parse kun de berørte stiene (vault-relative disk-stier, filer
 * eller mapper). Returnerer samme snapshot-objekt hvis ingenting faktisk endret seg.
 */
export async function updateSnapshot(
  snapshot: VaultSnapshot,
  root: string,
  ignore: readonly string[],
  diskPaths: readonly string[],
  extractor: MetaExtractor,
): Promise<SnapshotUpdate> {
  const files = new Map(snapshot.files);
  const notes = new Map(snapshot.notes);
  const baseSources = new Map(snapshot.baseSources);
  const changes: FileChange[] = [];

  const remove = (filePath: FilePath, docPath: DocPath): void => {
    files.delete(filePath);
    notes.delete(filePath);
    baseSources.delete(filePath);
    changes.push({ type: 'removed', path: docPath });
  };

  for (const diskPath of [...new Set(diskPaths)]) {
    if (isIgnoredPath(diskPath, ignore)) continue;
    const filePath = normalizeVaultPath(diskPath);
    const existing = files.get(filePath);
    const scanned = await statVaultFile(root, diskPath);
    if (!scanned) {
      if (existing) remove(existing.filePath, existing.docPath);
      else {
        const prefix = `${filePath.replace(/\/+$/, '')}/`;
        for (const file of [...files.values()]) if (file.filePath.startsWith(prefix)) remove(file.filePath, file.docPath);
      }
      continue;
    }
    const file = toVaultFile(scanned);
    if (existing && existing.mtimeMs === file.mtimeMs && existing.size === file.size) continue;
    files.set(file.filePath, file);
    if (file.ext === 'md' || file.kind === 'base') {
      const text = await readVaultText(root, file.diskPath);
      if (file.kind === 'base') baseSources.set(file.filePath, text);
      else {
        const [meta] = await extractor.extractMany([text]);
        notes.set(file.filePath, { file, meta: meta!, body: splitFrontmatter(text).body });
      }
    }
    changes.push({ type: existing ? 'changed' : 'added', path: file.docPath });
  }

  if (changes.length === 0) return { snapshot, changes };
  return { snapshot: { files, notes, baseSources }, changes };
}

/** Oppslag av `DocPath` (api.md): eksakt fil, ellers `DocPath + '.md'`. NFC-normalisert. */
export function findByDocPath(snapshot: VaultSnapshot, docPath: DocPath): VaultFile | null {
  const key = docPath.normalize('NFC');
  return snapshot.files.get(key) ?? snapshot.files.get(`${key}.md`) ?? null;
}

function toVaultFile(scanned: ScannedFile): VaultFile {
  return { ...describeVaultPath(scanned.diskPath), ...scanned };
}
