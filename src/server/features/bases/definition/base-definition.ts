import type { BaseWarning } from '../../../../shared/api-types';

/** Filtertre slik det står i YAML: et uttrykk eller `and`/`or`/`not` med barn (vilkårlig nøstet). */
export type FilterNode =
  | { readonly kind: 'expr'; readonly source: string }
  | { readonly kind: 'and' | 'or' | 'not'; readonly children: readonly FilterNode[] };

export type SortDirection = 'ASC' | 'DESC';

export interface SortSpec {
  /** Property-referanse slik den står (`priority`, `file.mtime`, `formula.team`). */
  readonly property: string;
  readonly direction: SortDirection;
}

export interface ViewDefinition {
  /** `table`, `kanban`, eller noe vi ikke støtter (`cards`, `gallery` …). */
  readonly type: string;
  readonly name: string;
  readonly filters: FilterNode | null;
  readonly order: readonly string[];
  readonly sort: readonly SortSpec[];
  readonly groupBy: SortSpec | null;
  /** Kanban: kolonnerekkefølge (verdier som tekst). */
  readonly groupOrder: readonly string[];
  /** Nøkler slik de står (`file.name`, `note.status`); normaliseres i query-laget. */
  readonly columnSize: Readonly<Record<string, number>>;
  readonly indentProperties: boolean;
  readonly limit: number | null;
  /** Advarsler som gjelder bare dette viewet (ukjente nøkler o.l.). */
  readonly warnings: readonly BaseWarning[];
}

export interface BaseDefinition {
  readonly filters: FilterNode | null;
  /** Formelnavn → uttrykkstekst, i fil-rekkefølge. */
  readonly formulas: ReadonlyMap<string, string>;
  /** `properties.<id>.displayName` (nøkler slik de står). */
  readonly displayNames: Readonly<Record<string, string>>;
  readonly views: readonly ViewDefinition[];
  /** Advarsler på base-nivå (ukjente nøkler, feil form). */
  readonly warnings: readonly BaseWarning[];
}

/** Resultatet av å lese en base: definisjon, eller feilkort ved ugyldig YAML. */
export type ParsedBase =
  | { readonly ok: true; readonly definition: BaseDefinition }
  | { readonly ok: false; readonly error: BaseWarning };
