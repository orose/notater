/**
 * Rendering av et notat med embeds (ADR-002 «Embeds og syklusvern»). Implementerer markdown-
 * featurens `RenderContext` mot indeksen: lenkeoppløsning, ankre, bilder, baser og rekursive
 * notat-embeds med stakk-basert syklusvern og maks dybde (PO-15: 5).
 */
import type { ElementContent, Root } from 'hast';
import type { DocPath, FilePath, TocEntry } from '../../../shared/api-types';
import { isImageExtension } from '../assets';
import type { BaseRequest } from '../bases';
import type { CodeHighlighter } from '../code-highlight';
import { resolveAnchor } from '../links';
import type { LinkResolver } from '../links';
import { h, renderMarkdown } from '../markdown';
import type { EmbedRequest, LinkRequest, LinkTarget, RenderContext, SectionSelector } from '../markdown';
import { parseImageAlias } from '../markdown-syntax';
import type { IndexedNote, VaultFile } from '../vault-index';

/** PO-15: maks embed-dybde. */
export const MAX_EMBED_DEPTH = 5;

export interface RenderedNote {
  readonly content: Root;
  readonly toc: TocEntry[];
  /** Baser som skal evalueres; nøkkel = `data-base-id`. */
  readonly bases: Readonly<Record<string, BaseRequest>>;
}

export interface NoteRendererDeps {
  readonly vaultId: string;
  readonly highlighter: CodeHighlighter;
  readonly links: LinkResolver;
  getNote(filePath: FilePath): IndexedNote | null;
  readonly maxDepth?: number;
}

export interface NoteRenderer {
  renderNote(file: VaultFile): RenderedNote;
  documentUrl(docPath: DocPath, anchor: string | null): string;
  assetUrl(docPath: DocPath): string;
}

export function createNoteRenderer(deps: NoteRendererDeps): NoteRenderer {
  const maxDepth = deps.maxDepth ?? MAX_EMBED_DEPTH;
  const documentUrl = (docPath: DocPath, anchor: string | null): string =>
    `/v/${encodeURIComponent(deps.vaultId)}/${encodeSegments(docPath)}${anchor ? `#${encodeURIComponent(anchor).replace(/%5E/g, '^')}` : ''}`;
  const assetUrl = (docPath: DocPath): string =>
    `/api/vaults/${encodeURIComponent(deps.vaultId)}/assets?path=${encodeURIComponent(docPath)}`;

  return {
    documentUrl,
    assetUrl,
    renderNote(file) {
      const note = deps.getNote(file.filePath);
      const bases: Record<string, BaseRequest> = {};
      if (!note) return { content: { type: 'root', children: [] }, toc: [], bases };
      const registerBase = (request: BaseRequest): string => {
        const id = `base-${Object.keys(bases).length + 1}`;
        bases[id] = request;
        return id;
      };
      const frame = (current: VaultFile, stack: readonly string[]): RenderContext => ({
        highlighter: deps.highlighter,
        documentUrl,
        resolveLink: (request) => resolveLinkTarget(request, current),
        registerInlineBase: (source) => registerBase({ kind: 'inline', source, hostFilePath: current.filePath }),
        renderEmbed: (request) => renderEmbed(request, current, stack),
      });

      const resolveLinkTarget = (request: LinkRequest, from: VaultFile): LinkTarget => {
        const resolved = deps.links.resolve(request.path, from.filePath, request.syntax);
        if (!resolved) {
          const suggestion = request.syntax === 'wiki' ? deps.links.suggestByAlias(request.path) : null;
          return { status: 'unresolved', suggestion: suggestion ? { docPath: suggestion.docPath, title: suggestion.title } : null };
        }
        const target = deps.getNote(resolved.file.filePath);
        const anchor = target
          ? resolveAnchor(target.meta, request.anchor)
          : { id: null, missing: request.anchor !== null && request.anchor !== '' };
        return {
          status: 'internal',
          docPath: resolved.file.docPath,
          title: resolved.file.title,
          anchorId: anchor.id,
          anchorMissing: anchor.missing,
          alternatives: resolved.alternatives.map((f) => f.docPath),
        };
      };

      const renderEmbed = (request: EmbedRequest, from: VaultFile, stack: readonly string[]): ElementContent[] => {
        const missing = (): ElementContent[] => [h('vr-embed', { dataStatus: 'missing', dataRaw: request.raw })];
        const resolved = deps.links.resolve(request.path, from.filePath, request.syntax);
        if (!resolved) return missing();
        const target = resolved.file;

        if (target.kind === 'asset') {
          if (!isImageExtension(target.ext)) {
            return [h('vr-unsupported', { dataKind: 'other', dataTarget: target.docPath, dataSource: target.docPath })];
          }
          const size = request.syntax === 'wiki' ? parseImageAlias(request.alias) : { alt: request.alias, width: null, height: null };
          const width = size.width ?? request.width ?? null;
          const height = size.height ?? request.height ?? null;
          return [
            h('img', {
              src: assetUrl(target.docPath),
              alt: size.alt ?? target.name,
              ...(width ? { width } : {}),
              ...(height ? { height } : {}),
            }),
          ];
        }
        if (target.kind === 'base') {
          const view = request.anchor?.trim() || null;
          const id = registerBase({ kind: 'file', filePath: target.filePath, view });
          return [h('vr-base', { dataBaseId: id, dataSourcePath: target.docPath, ...(view ? { dataView: view } : {}) })];
        }
        if (target.kind === 'unsupported') {
          return [h('vr-unsupported', { dataKind: target.unsupportedKind ?? 'other', dataTarget: target.docPath, dataSource: target.docPath })];
        }

        const note = deps.getNote(target.filePath);
        if (!note) return missing();
        const anchor = resolveAnchor(note.meta, request.anchor);
        if (anchor.missing) return missing();
        const section: SectionSelector | null = anchor.id
          ? anchor.id.startsWith('^')
            ? { type: 'block', id: anchor.id.slice(1) }
            : { type: 'heading', id: anchor.id }
          : null;
        const headingText = section?.type === 'heading' ? note.meta.headings.find((x) => x.id === section.id)?.text : null;
        const props = {
          dataTarget: target.docPath,
          ...(anchor.id ? { dataAnchor: anchor.id } : {}),
          dataTitle: headingText ? `${target.title} › ${headingText}` : target.title,
        };
        const key = `${target.filePath}#${anchor.id ?? ''}`;
        if (stack.includes(key)) return [h('vr-embed', { dataStatus: 'cycle', ...props })];
        if (stack.length > maxDepth) return [h('vr-embed', { dataStatus: 'depth-limit', ...props })];

        const rendered = renderMarkdown(note.body, frame(target, [...stack, key]), { section, embedded: true });
        return [h('vr-embed', { dataStatus: 'ok', ...props }, rendered.content.children as ElementContent[])];
      };

      const result = renderMarkdown(note.body, frame(file, [`${file.filePath}#`]));
      return { content: result.content, toc: result.toc, bases };
    },
  };
}

function encodeSegments(docPath: DocPath): string {
  return docPath.split('/').map(encodeURIComponent).join('/');
}
