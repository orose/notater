import type { Root } from 'hast';
import type {
  Backlink,
  BaseDocument,
  BacklinksResponse,
  BaseResult,
  DocPath,
  DocumentResponse,
  DocumentWarning,
  NoteDocument,
} from '../../../shared/api-types';
import { isImageExtension } from '../assets';
import type { BaseEvaluator } from '../bases';
import type { RenderedNote } from '../embeds';
import { fitImageSize } from '../image-size';
import { unresolvedTargetKey } from '../links';
import type { BacklinkEntry } from '../links';
import { parseWikiLinkInner } from '../markdown-syntax';
import { h } from '../markdown';
import { toPropertyEntries } from '../properties';
import { findByDocPath } from '../vault-index';
import type { VaultFile } from '../vault-index';
import type { VaultState } from '../vault-registry';

/** PO-22: skjules alltid i egenskapspanelet. */
export const ALWAYS_HIDDEN_PROPERTIES: readonly string[] = ['cssclasses', 'publish', 'position'];

export interface DocumentOptions {
  /** Ekstra skjulte property-nøkler fra vault-konfig (`hiddenProperties`). */
  readonly hiddenProperties?: readonly string[];
}

/**
 * Bygger `DocumentResponse` for én sti (api.md). Oppslag kun via indeksen (ADR-005): ukjent sti → `null`.
 * Rendret notat caches per revisjon (A20).
 */
export function getDocument(state: VaultState, docPath: DocPath, bases: BaseEvaluator, options: DocumentOptions = {}): DocumentResponse | null {
  const hidden = new Set([...ALWAYS_HIDDEN_PROPERTIES, ...(options.hiddenProperties ?? [])].map((k) => k.toLowerCase()));
  const file = findByDocPath(state.snapshot, docPath);
  if (!file) return null;
  const common = {
    vaultId: state.vaultId,
    revision: state.revision,
    path: file.docPath,
    filePath: file.filePath,
    title: file.title,
    mtime: new Date(file.mtimeMs).toISOString(),
    ctime: new Date(file.ctimeMs).toISOString(),
    backlinks: toBacklinks(state, file),
  };
  const vault = { snapshot: state.snapshot, links: state.links };

  if (file.kind === 'base') {
    const result: BaseResult = bases.evaluate({ kind: 'file', filePath: file.filePath, view: null }, vault);
    return { kind: 'base', ...common, result } satisfies BaseDocument;
  }

  const note = state.snapshot.notes.get(file.filePath);
  if (file.kind === 'note' && note) {
    const rendered = renderCached(state, file);
    const warnings: DocumentWarning[] = note.meta.frontmatterError
      ? [{ code: 'invalid-frontmatter', message: note.meta.frontmatterError }]
      : [];
    return {
      kind: 'note',
      ...common,
      aliases: note.meta.aliases,
      tags: note.meta.tags,
      properties: toPropertyEntries(note.meta.frontmatter, (target) => state.links.resolve(target, file.filePath, 'wiki')?.file.docPath ?? null).filter(
        (entry) => !hidden.has(entry.key.toLowerCase()),
      ),
      wordCount: countWords(note.meta.text),
      content: rendered.content,
      toc: rendered.toc,
      bases: Object.fromEntries(Object.entries(rendered.bases).map(([id, request]) => [id, bases.evaluate(request, vault)])),
      frontmatterError: note.meta.frontmatterError,
      ...(warnings.length > 0 ? { warnings } : {}),
    } satisfies NoteDocument;
  }

  return {
    kind: 'note',
    ...common,
    aliases: note?.meta.aliases ?? [],
    tags: note?.meta.tags ?? [],
    properties: [],
    content: staticContent(state, file),
    toc: [],
    bases: {},
  } satisfies NoteDocument;
}

function renderCached(state: VaultState, file: VaultFile): RenderedNote {
  const cached = state.renderCache.get(file.filePath);
  if (cached) return cached;
  const rendered = state.renderer.renderNote(file);
  state.renderCache.set(file.filePath, rendered);
  return rendered;
}

/** Innhold for filer som ikke er markdown: bilder vises, alt annet er «ikke støttet». */
function staticContent(state: VaultState, file: VaultFile): Root {
  if (file.kind === 'asset' && isImageExtension(file.ext)) {
    return { type: 'root', children: [h('img', { src: state.renderer.assetUrl(file.docPath), alt: file.name, ...fitImageSize(file.imageSize ?? null) })] };
  }
  const kind = file.kind === 'unsupported' ? (file.unsupportedKind ?? 'other') : 'other';
  return { type: 'root', children: [h('vr-unsupported', { dataKind: kind, dataTarget: file.docPath, dataSource: file.docPath })] };
}

function toBacklinks(state: VaultState, file: VaultFile): Backlink[] {
  return toBacklinkDtos(state.backlinks.get(file.filePath));
}

function toBacklinkDtos(entries: readonly BacklinkEntry[]): Backlink[] {
  return entries.map((entry) => ({
    source: entry.source.docPath,
    sourceTitle: entry.source.title,
    snippet: entry.snippet,
    count: entry.count,
    ...(entry.fromProperty ? { fromProperty: true } : {}),
  }));
}

/** Antall ord i brødteksten (for lesetid, PO-23). */
export function countWords(text: string): number {
  return text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

/**
 * «Lenket fra» for et mål (PO-28). Finnes målet som dokument, gis dokumentets tilbakelenker; ellers
 * kildene som har en brutt lenke dit. `target` kan være en DocPath eller rå lenketekst (`x#y|z`).
 */
export function getBacklinks(state: VaultState, target: string): BacklinksResponse {
  const file = findByDocPath(state.snapshot, target);
  const common = { vaultId: state.vaultId, revision: state.revision, path: target };
  if (file) return { ...common, exists: true, backlinks: toBacklinks(state, file) };
  const linkTarget = parseWikiLinkInner(target).target;
  return { ...common, exists: false, backlinks: toBacklinkDtos(state.backlinks.getUnresolved(unresolvedTargetKey(linkTarget))) };
}
