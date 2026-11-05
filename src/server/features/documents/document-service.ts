import type { Root } from 'hast';
import type {
  Backlink,
  BaseDocument,
  BaseResult,
  DocPath,
  DocumentResponse,
  DocumentWarning,
  NoteDocument,
} from '../../../shared/api-types';
import { isImageExtension } from '../assets';
import type { BaseEvaluator } from '../bases';
import type { RenderedNote } from '../embeds';
import { h } from '../markdown';
import { toPropertyEntries } from '../properties';
import { findByDocPath } from '../vault-index';
import type { VaultFile } from '../vault-index';
import type { VaultState } from '../vault-registry';

/**
 * Bygger `DocumentResponse` for én sti (api.md). Oppslag kun via indeksen (ADR-005): ukjent sti → `null`.
 * Rendret notat caches per revisjon (A20).
 */
export function getDocument(state: VaultState, docPath: DocPath, bases: BaseEvaluator): DocumentResponse | null {
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
      properties: toPropertyEntries(note.meta.frontmatter, (target) => state.links.resolve(target, file.filePath, 'wiki')?.file.docPath ?? null),
      content: rendered.content,
      toc: rendered.toc,
      bases: Object.fromEntries(Object.entries(rendered.bases).map(([id, request]) => [id, bases.evaluate(request, vault)])),
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
    return { type: 'root', children: [h('img', { src: state.renderer.assetUrl(file.docPath), alt: file.name })] };
  }
  const kind = file.kind === 'unsupported' ? (file.unsupportedKind ?? 'other') : 'other';
  return { type: 'root', children: [h('vr-unsupported', { dataKind: kind, dataTarget: file.docPath, dataSource: file.docPath })] };
}

function toBacklinks(state: VaultState, file: VaultFile): Backlink[] {
  return state.backlinks.get(file.filePath).map((entry) => ({
    source: entry.source.docPath,
    sourceTitle: entry.source.title,
    snippet: entry.snippet,
    count: entry.count,
    ...(entry.fromProperty ? { fromProperty: true } : {}),
  }));
}
