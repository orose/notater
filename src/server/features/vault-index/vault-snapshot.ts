import { createHash } from 'node:crypto';
import type { DocPath, FileChange, FilePath } from '../../../shared/api-types';
import { canReadImageSize, readImageSizeFromFile } from '../image-size';
import type { ImageSize } from '../image-size';
import { splitFrontmatter } from '../markdown-syntax';
import type { MetaExtractor } from './meta-extractor';
import type { NoteMeta } from './note-meta';
import { mapWithConcurrency, readVaultText, resolveInsideVault, scanVault, statVaultFile } from './scan-vault';
import type { ScannedFile } from './scan-vault';
import { describeVaultPath, isIgnoredPath, normalizeVaultPath } from './vault-paths';
import type { VaultPathInfo } from './vault-paths';

export interface VaultFile extends VaultPathInfo {
  /** Vault-relativ sti slik den ligger på disk (kan være NFD). Brukes kun til fil-I/O. */
  readonly diskPath: string;
  readonly size: number;
  readonly mtimeMs: number;
  readonly ctimeMs: number;
  /** Inode fra disk (0/utelatt hvis ukjent). Brukes til å kjenne igjen omdøpinger (PO-49). */
  readonly ino?: number;
  /** SHA-1 av innholdet for tekstfiler (.md/.base) – kjenner igjen «slett + ny fil med samme innhold». */
  readonly contentHash?: string;
  /**
   * Bildedimensjoner fra filheaderen (PO-71), kun for bildevedlegg vi kan lese (png, jpg, gif, webp, svg).
   * `null` = ukjent/ødelagt. Leses ved indeksering og på nytt når fila endres (ny mtime/størrelse).
   */
  readonly imageSize?: ImageSize | null;
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

export interface BuildSnapshotOptions {
  /**
   * Kjøres parallelt med metadata-uttrekket (workerne), når hovedtråden ellers er ledig. Får filene slik
   * de ble skannet. Brukes til å starte filovervåkeren uten å konkurrere med lesingen (BUG-012).
   */
  readonly whileExtracting?: (files: ReadonlyMap<FilePath, VaultFile>) => Promise<void>;
  /** Fremdrift i metadata-uttrekket: notater ferdige av totalt (oppstartsskjermen i terminalen, SV3). */
  readonly onProgress?: (done: number, total: number) => void;
}

export async function buildSnapshot(
  root: string,
  ignore: readonly string[],
  extractor: MetaExtractor,
  options: BuildSnapshotOptions = {},
): Promise<VaultSnapshot> {
  const scanned = await scanVault(root, ignore);
  const files = new Map<FilePath, VaultFile>();
  for (const s of scanned) {
    const file = toVaultFile(s);
    files.set(file.filePath, file);
  }
  const textFiles = [...files.values()].filter((f) => f.ext === 'md' || f.kind === 'base');
  const imageFiles = [...files.values()].filter(hasReadableImageSize);
  const [texts, imageSizes] = await Promise.all([
    mapWithConcurrency(textFiles, READ_CONCURRENCY, (f) => readVaultText(root, f.diskPath)),
    mapWithConcurrency(imageFiles, READ_CONCURRENCY, (f) => readImageSize(root, f)),
  ]);
  imageFiles.forEach((file, i) => files.set(file.filePath, { ...file, imageSize: imageSizes[i]! }));
  textFiles.forEach((file, i) => {
    const withHash = { ...file, contentHash: hashText(texts[i]!) };
    files.set(file.filePath, withHash);
    textFiles[i] = withHash;
  });

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
  const total = noteSources.length;
  options.onProgress?.(0, total);
  const progress = options.onProgress ? (done: number) => options.onProgress?.(done, total) : undefined;
  const [metas] = await Promise.all([extractor.extractMany(noteSources, progress), options.whileExtracting?.(files)]);
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

  const removedFiles: VaultFile[] = [];
  const addedFiles: VaultFile[] = [];
  const remove = (filePath: FilePath, docPath: DocPath): void => {
    const old = files.get(filePath);
    if (old) removedFiles.push(old);
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
    let file = toVaultFile(scanned);
    if (existing && existing.mtimeMs === file.mtimeMs && existing.size === file.size) continue;
    // PO-71: dimensjonene caches på VaultFile og leses på nytt bare når fila faktisk er endret.
    if (hasReadableImageSize(file)) file = { ...file, imageSize: await readImageSize(root, file) };
    files.set(file.filePath, file);
    if (file.ext === 'md' || file.kind === 'base') {
      const text = await readVaultText(root, file.diskPath);
      file = { ...file, contentHash: hashText(text) };
      files.set(file.filePath, file);
      if (file.kind === 'base') baseSources.set(file.filePath, text);
      else {
        const [meta] = await extractor.extractMany([text]);
        notes.set(file.filePath, { file, meta: meta!, body: splitFrontmatter(text).body });
      }
    }
    changes.push({ type: existing ? 'changed' : 'added', path: file.docPath });
    if (!existing) addedFiles.push(file);
  }

  // PO-49: `removed` + `added` beholdes (bakoverkompatibelt); en omdøping får i tillegg `renamed`.
  changes.push(...detectRenames(removedFiles, addedFiles));
  if (changes.length === 0) return { snapshot, changes };
  return { snapshot: { files, notes, baseSources }, changes };
}

/** Oppslag av `DocPath` (api.md): eksakt fil, ellers `DocPath + '.md'`. NFC-normalisert. */
export function findByDocPath(snapshot: VaultSnapshot, docPath: DocPath): VaultFile | null {
  const key = docPath.normalize('NFC');
  return snapshot.files.get(key) ?? snapshot.files.get(`${key}.md`) ?? null;
}

function hasReadableImageSize(file: VaultFile): boolean {
  return file.kind === 'asset' && canReadImageSize(file.ext);
}

function readImageSize(root: string, file: VaultFile): Promise<ImageSize | null> {
  try {
    return readImageSizeFromFile(resolveInsideVault(root, file.diskPath), file.ext);
  } catch {
    return Promise.resolve(null);
  }
}

/** SHA-1 av tekstinnhold (`VaultFile.contentHash`). */
export function hashText(text: string): string {
  return createHash('sha1').update(text).digest('hex');
}

/**
 * Par av slettet + ny fil i samme batch som er samme fil: samme inode (fs-omdøping/flytting) eller samme
 * innhold (f.eks. kopi + sletting fra synkverktøy). Hver fil inngår i høyst ett par.
 */
export function detectRenames(removed: readonly VaultFile[], added: readonly VaultFile[]): FileChange[] {
  const renames: FileChange[] = [];
  const free = [...added];
  const take = (match: (a: VaultFile) => boolean): VaultFile | null => {
    const index = free.findIndex(match);
    return index === -1 ? null : free.splice(index, 1)[0]!;
  };
  for (const old of removed) {
    const sameInode = old.ino ? take((a) => a.ino === old.ino && a.size === old.size) : null;
    const target = sameInode ?? (old.contentHash ? take((a) => a.contentHash === old.contentHash) : null);
    if (target) renames.push({ type: 'renamed', path: target.docPath, from: old.docPath, to: target.docPath });
  }
  return renames;
}

export function toVaultFile(scanned: ScannedFile): VaultFile {
  return { ...describeVaultPath(scanned.diskPath), ...scanned };
}
