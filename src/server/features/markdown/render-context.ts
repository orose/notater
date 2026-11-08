/**
 * Grensesnittene render-pipelinen trenger fra omverdenen (DIP, ADR-002). markdown-featuren kjenner
 * ikke vault-indeksen; `documents`/`embeds` implementerer disse.
 */
import type { ElementContent } from 'hast';
import type { DocPath } from '../../../shared/api-types';
import type { CodeHighlighter } from '../code-highlight';

export type LinkSyntax = 'wiki' | 'markdown';

export interface LinkRequest {
  /** Sti-del; `''` = samme dokument. Markdown-lenker er allerede URL-dekodet. */
  readonly path: string;
  readonly anchor: string | null;
  readonly syntax: LinkSyntax;
}

export type LinkTarget =
  | {
      readonly status: 'internal';
      readonly docPath: DocPath;
      readonly title: string;
      /** Overskrift-id eller `^blokkid`. */
      readonly anchorId: string | null;
      /** Ankeret var oppgitt, men finnes ikke i målet. */
      readonly anchorMissing: boolean;
      /** Det oppgitte ankeret (siste ledd, uten `#`) når `anchorMissing` er sann; sendes som `data-vr-anchor`. */
      readonly missingAnchor?: string;
      /** Andre kandidater ved tvetydig lenke (PO-8). */
      readonly alternatives: readonly DocPath[];
    }
  | {
      readonly status: 'unresolved';
      /** Notat med matchende alias (PO-7). */
      readonly suggestion: { readonly docPath: DocPath; readonly title: string } | null;
    };

export interface EmbedRequest {
  readonly path: string;
  readonly anchor: string | null;
  /** Alias-delen av `![[x|alias]]` (alt-tekst/størrelse for bilder) eller alt-tekst fra `![alt](x)`. */
  readonly alias: string | null;
  readonly syntax: LinkSyntax;
  /** Rå tekst, f.eks. `![[x#y]]`, for «mangler»-kort. */
  readonly raw: string;
  /** Eksplisitt størrelse fra `<img width height>` (markdown/HTML-bilder). */
  readonly width?: number | null;
  readonly height?: number | null;
}

export interface RenderContext {
  readonly highlighter: CodeHighlighter;
  resolveLink(request: LinkRequest): LinkTarget;
  /** Ferdig (sanert) HAST for en embed: `vr-embed`, `img`, `vr-base` eller `vr-unsupported`. */
  renderEmbed(request: EmbedRequest): ElementContent[];
  /** Registrerer en ` ```base `-blokk og returnerer id-en som settes i `data-base-id`. */
  registerInlineBase(source: string): string;
  /** URL til et dokument i klienten, f.eks. `/v/test/domene/Kunde#mål`. */
  documentUrl(docPath: DocPath, anchor: string | null): string;
}
