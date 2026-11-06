import { createContext } from 'react';

export type OpenSearch = (query?: string) => void;

/** Et kommandovalg slik paletten ser det. Kommer fra `commands` via `PaletteCommandSource` (ingen import av commands). */
export interface PaletteCommandItem {
  /** Unik nøkkel i listen. */
  readonly key: string;
  readonly commandId: string;
  readonly kind: 'command' | 'argument';
  readonly label: string;
  /** Treffområder i `label` til utheving. */
  readonly highlights: ReadonlyArray<readonly [number, number]>;
  /** Undertekst: beskrivelse (kommando) eller forklaring (verdi). */
  readonly detail: string | null;
  /** Hurtigtast, én etikett per akkord. */
  readonly shortcut: readonly string[] | null;
  readonly enabled: boolean;
  /** Begrunnelse når `enabled` er false. */
  readonly reason: string | null;
  /** Gjeldende verdi i en underliste. */
  readonly current: boolean;
  /** Overskrift for gruppen valget hører til (vises når den skifter). */
  readonly group: string | null;
  /** Sett: Enter fyller inn `:` + dette (argumentliste) i stedet for å kjøre. */
  readonly completion: string | null;
  /** Argumentene kommandoen kjøres med (`{ type: 'terminal' }`). */
  readonly args: Readonly<Record<string, string>>;
}

/** Kommandomodus i paletten (F5). Leveres av `CommandProvider`. */
export interface PaletteCommandSource {
  /** Valgene for inndata etter `:`. */
  options(query: string): readonly PaletteCommandItem[];
  /** Kjører valget. Kalles etter at paletten er lukket (ADR-007 §4). */
  run(item: PaletteCommandItem): void;
}

export interface SearchContextValue {
  /** `⌘K`, `/`, tagg-klikk: notatsøk med valgfri forhåndsutfylling. */
  readonly openSearch: OpenSearch;
  /** `:`: kommandomodus; `query` uten kolon (`tema ` åpner argumentlisten). */
  readonly openCommands: (query?: string) => void;
  /** `CommandProvider` registrerer kommandokilden her. */
  readonly setCommandSource: (source: PaletteCommandSource | null) => void;
}

export const SearchContext = createContext<SearchContextValue | null>(null);
