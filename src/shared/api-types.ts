/**
 * HTTP/SSE-kontrakten mellom server og web.
 *
 * NORMATIV: Denne fila er sannheten for JSON-formene. docs/arkitektur/api.md beskriver
 * endepunkter og semantikk og speiler typene her. Endringer krever at både server- og
 * web-utvikler er enige (og at api.md oppdateres i samme leveranse).
 *
 * Kun typer – ingen runtime-kode – slik at fila trygt kan importeres fra begge sider.
 */

import type { Root as HastRoot } from 'hast';

// ---------------------------------------------------------------------------
// Felles
// ---------------------------------------------------------------------------

/** Vault-id fra konfig, f.eks. "jobb". Kun [a-z0-9-]. */
export type VaultId = string;

/**
 * Dokumentsti: vault-relativ POSIX-sti. For markdown uten `.md` («domene/Kunde»),
 * for alle andre filer med filendelse («Oppgaver.base», «bilder/arkitektur.png»).
 * Dette er også stien som brukes i nettleser-URL-en (`/v/:vaultId/<docPath>`).
 */
export type DocPath = string;

/** Vault-relativ POSIX-sti MED filendelse, f.eks. «domene/Kunde.md». */
export type FilePath = string;

/** ISO-8601 tidsstempel (UTC), f.eks. «2026-11-05T14:03:00.000Z». */
export type IsoDateTime = string;

/** Monotont økende teller per vault; øker ved hver indeksendring. */
export type Revision = number;

export type ApiErrorCode =
  | 'BAD_REQUEST'
  | 'VAULT_NOT_FOUND'
  | 'DOCUMENT_NOT_FOUND'
  | 'ASSET_NOT_FOUND'
  | 'FORBIDDEN'
  | 'INTERNAL';

/** Alle feilsvar (4xx/5xx) har denne formen. */
export interface ApiError {
  readonly error: {
    readonly code: ApiErrorCode;
    /** Norsk, menneskelesbar melding. */
    readonly message: string;
  };
}

// ---------------------------------------------------------------------------
// Verdier (brukes av properties og Bases)
// ---------------------------------------------------------------------------

/** Typet verdi slik den skal vises. Serveren har gjort all tolkning. */
export type VaultValue =
  | { readonly type: 'null' }
  | { readonly type: 'string'; readonly value: string }
  | { readonly type: 'number'; readonly value: number }
  | { readonly type: 'boolean'; readonly value: boolean }
  /** `hasTime=false` betyr ren dato (vises uten klokkeslett). */
  | { readonly type: 'date'; readonly value: IsoDateTime; readonly hasTime: boolean }
  | { readonly type: 'list'; readonly value: readonly VaultValue[] }
  | { readonly type: 'tag'; readonly value: string }
  /** `target=null` betyr brutt lenke. */
  | { readonly type: 'link'; readonly target: DocPath | null; readonly display: string };

// ---------------------------------------------------------------------------
// GET /api/health
// ---------------------------------------------------------------------------

export interface HealthResponse {
  readonly status: 'ok';
  readonly version: string;
}

// ---------------------------------------------------------------------------
// GET /api/vaults
// ---------------------------------------------------------------------------

export interface VaultSummary {
  readonly id: VaultId;
  readonly name: string;
  readonly status: 'not-indexed' | 'indexing' | 'ready' | 'error';
  /** null før indeksering er ferdig. */
  readonly noteCount: number | null;
  readonly revision: Revision | null;
  /**
   * Tillegg (bakoverkompatibelt): tid i ms fra indekseringsstart til indeks klar (AK17).
   * Satt når status er `ready`.
   */
  readonly indexMs?: number;
  /** Kun satt ved status `error`. */
  readonly errorMessage?: string;
}

export interface VaultsResponse {
  readonly vaults: readonly VaultSummary[];
  readonly defaultVaultId: VaultId;
}

// ---------------------------------------------------------------------------
// GET /api/vaults/:vaultId/tree
// ---------------------------------------------------------------------------

export type TreeNode = TreeFolder | TreeFile;

export interface TreeFolder {
  readonly kind: 'folder';
  readonly name: string;
  /** Vault-relativ mappesti, «» for rot. */
  readonly path: string;
  /** Sortert: mapper først, deretter filer; alfabetisk (nb-NO, case-insensitiv). */
  readonly children: readonly TreeNode[];
}

export interface TreeFile {
  readonly kind: 'note' | 'base' | 'asset' | 'unsupported';
  /** Visningsnavn: filnavn uten `.md` for notater, ellers med endelse. */
  readonly name: string;
  readonly path: DocPath;
}

export interface TreeResponse {
  readonly vaultId: VaultId;
  readonly revision: Revision;
  readonly root: TreeFolder;
}

// ---------------------------------------------------------------------------
// GET /api/vaults/:vaultId/document?path=<DocPath>
// ---------------------------------------------------------------------------

export interface TocEntry {
  /** 1–6 */
  readonly depth: number;
  readonly text: string;
  /** id-attributtet på overskriften i `content`. */
  readonly id: string;
}

export interface Backlink {
  readonly source: DocPath;
  readonly sourceTitle: string;
  /** Kort tekstutdrag rundt lenken (ren tekst, maks ~160 tegn). */
  readonly snippet: string;
  /** Antall lenker fra kilden til dette dokumentet. */
  readonly count: number;
  /**
   * Tillegg (bakoverkompatibelt): true når minst én av lenkene står i en frontmatter-property
   * (PO-9, vises som «fra egenskap»). Utelatt = kun lenker i brødtekst.
   */
  readonly fromProperty?: boolean;
}

/** Tillegg (bakoverkompatibelt): diskret advarsel om dokumentet, f.eks. ugyldig frontmatter. */
export interface DocumentWarning {
  /** `invalid-frontmatter` (QA-IDX-07). */
  readonly code: string;
  /** Norsk melding, f.eks. «Egenskapene kunne ikke leses …». */
  readonly message: string;
}

export interface PropertyEntry {
  readonly key: string;
  readonly value: VaultValue;
}

interface DocumentBase {
  readonly vaultId: VaultId;
  readonly revision: Revision;
  readonly path: DocPath;
  readonly filePath: FilePath;
  /** Filnavn uten endelse (som Obsidian). */
  readonly title: string;
  readonly mtime: IsoDateTime;
  readonly ctime: IsoDateTime;
  readonly backlinks: readonly Backlink[];
}

export interface NoteDocument extends DocumentBase {
  readonly kind: 'note';
  readonly aliases: readonly string[];
  /** Normalisert uten «#», inkl. frontmatter- og inline-tagger. */
  readonly tags: readonly string[];
  /** Frontmatter i rekkefølge, ferdig typet. Tom liste hvis ingen frontmatter. */
  readonly properties: readonly PropertyEntry[];
  /** Sanitert HAST. Se «HAST-kontrakt» i api.md for egendefinerte elementer. */
  readonly content: HastRoot;
  readonly toc: readonly TocEntry[];
  /** Resultat for hvert `vr-base`-element i `content`, nøkkel = `data-base-id`. */
  readonly bases: Readonly<Record<string, BaseResult>>;
  /** Tillegg (bakoverkompatibelt): utelatt når det ikke er noe å advare om. */
  readonly warnings?: readonly DocumentWarning[];
}

export interface BaseDocument extends DocumentBase {
  readonly kind: 'base';
  readonly result: BaseResult;
}

export type DocumentResponse = NoteDocument | BaseDocument;

// ---------------------------------------------------------------------------
// Bases-resultat (evaluert på serveren)
// ---------------------------------------------------------------------------

export interface BaseWarning {
  /** Maskinlesbar kode, f.eks. `unknown-function`, `unknown-view-type`, `parse-error`. */
  readonly code: string;
  /** Norsk melding som kan vises diskret i viewet. */
  readonly message: string;
  /** Uttrykket/nøkkelen det gjelder, hvis relevant. */
  readonly source?: string;
}

export interface BaseColumn {
  /** Kanonisk property-id: `file.name`, `note.status`, `formula.team`. */
  readonly id: string;
  /** Visningsnavn (fra `properties.<id>.displayName` eller utledet). */
  readonly label: string;
  /** Fra `columnSize`, i px. */
  readonly width?: number;
}

export interface BaseRow {
  /** Dokumentet raden representerer (lenkemål). */
  readonly path: DocPath;
  /** Verdi per kolonne-id. Mangler nøkkel = `{ type: 'null' }`. */
  readonly cells: Readonly<Record<string, VaultValue>>;
}

export interface BaseGroup {
  /** Grupperingsverdi; `null` for «(ingen)»-gruppen og for views uten groupBy. */
  readonly key: VaultValue | null;
  /** Ferdig visningstekst, f.eks. «doing» eller «(ingen)». Tom streng uten groupBy. */
  readonly label: string;
  readonly rows: readonly BaseRow[];
}

interface BaseViewCommon {
  readonly name: string;
  readonly columns: readonly BaseColumn[];
  /** Ferdig filtrert, sortert og gruppert, i visningsrekkefølge. */
  readonly groups: readonly BaseGroup[];
  readonly totalRows: number;
  readonly warnings: readonly BaseWarning[];
}

export interface BaseTableView extends BaseViewCommon {
  readonly type: 'table';
  readonly indentProperties: boolean;
  /** true hvis viewet har groupBy (styrer om gruppeoverskrifter vises). */
  readonly grouped: boolean;
}

export interface BaseKanbanView extends BaseViewCommon {
  readonly type: 'kanban';
  /** Property-id kortene grupperes på. */
  readonly groupBy: string;
}

export interface BaseUnsupportedView {
  readonly type: 'unsupported';
  readonly name: string;
  /** Typen fra `.base`-fila, f.eks. «cards». */
  readonly originalType: string;
  readonly warnings: readonly BaseWarning[];
}

export type BaseView = BaseTableView | BaseKanbanView | BaseUnsupportedView;

export interface BaseResult {
  /** Én fane per view, i fila sin rekkefølge. */
  readonly views: readonly BaseView[];
  /** Advarsler på base-nivå (globale filtre, formler, parse-feil). */
  readonly warnings: readonly BaseWarning[];
}

// ---------------------------------------------------------------------------
// GET /api/vaults/:vaultId/search?q=<tekst>&limit=<n>
// ---------------------------------------------------------------------------

export interface SearchSnippet {
  readonly text: string;
  /** Tegnintervaller [start, slutt) i `text` som skal utheves. */
  readonly highlights: readonly (readonly [number, number])[];
}

export interface SearchHit {
  readonly path: DocPath;
  readonly title: string;
  readonly kind: 'note' | 'base';
  /**
   * Hvilket felt som ga best treff. `tag` (tillegg, bakoverkompatibelt) = treff fra taggsøk
   * (`q` starter med `#`); da er verken `alias` eller `snippet` satt.
   */
  readonly matchedField: 'title' | 'alias' | 'content' | 'tag';
  /** Satt når `matchedField === 'alias'`. */
  readonly alias?: string;
  /** Satt når `matchedField === 'content'`. */
  readonly snippet?: SearchSnippet;
  readonly score: number;
}

export interface SearchResponse {
  readonly query: string;
  readonly revision: Revision;
  readonly hits: readonly SearchHit[];
}

// ---------------------------------------------------------------------------
// GET /api/events?vault=<VaultId>  (Server-Sent Events)
// ---------------------------------------------------------------------------

export interface FileChange {
  readonly type: 'added' | 'changed' | 'removed';
  readonly path: DocPath;
}

/** SSE `event: ready` – sendes én gang rett etter tilkobling. */
export interface ReadyEvent {
  readonly vaultId: VaultId;
  readonly revision: Revision;
}

/** SSE `event: changed` – én eller flere filer endret (debouncet, samlet). */
export interface ChangedEvent {
  readonly vaultId: VaultId;
  readonly revision: Revision;
  readonly changes: readonly FileChange[];
}

/** Map fra SSE-hendelsesnavn til data-type (JSON i `data:`-feltet). */
export interface ServerEvents {
  readonly ready: ReadyEvent;
  readonly changed: ChangedEvent;
}
