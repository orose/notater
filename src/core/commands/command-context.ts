// Konteksten kommandoene ser (ADR-007 §1). Kun typer. Portene implementeres i React-laget
// (CommandProvider) mot eksisterende kontekster: router, søk/palett, tema, visningstilstand, disposisjon.

import type { KeyMode } from '../../keyboard';
import type { ArgumentValue } from './command-types';

export type RouteKind = 'home' | 'note' | 'base' | 'asset' | 'missing' | 'loading';

export interface CommandRoute {
  readonly kind: RouteKind;
  readonly vaultId: string | null;
  readonly docPath: string | null;
}

/** Øyeblikksbilde av visningstilstanden (ADR-008), til `isEnabled` og veksle-kommandoer. */
export interface ViewSnapshot {
  readonly width: 'readable' | 'full';
  /** Diskré embedding for gjeldende notat. */
  readonly discreet: boolean;
  readonly zen: boolean;
  /** Antall notat-embeds (`vr-embed[data-status=ok]` til notat) i gjeldende dokument. */
  readonly noteEmbeds: number;
  /** Antall foldbare overskrifter i gjeldende dokument. */
  readonly foldableHeadings: number;
}

/** Et gyldig lysbildenivå for notatet som vises (argumentlisten til `:presenter`). */
export interface PresentationLevelInfo {
  readonly level: number;
  /** Agendanivået det gir (`null` = ingen agenda). */
  readonly agendaLevel: number | null;
  readonly slides: number;
}

/**
 * Presentasjonen slik kommandoene ser den (ADR-010 §3). Implementeres av `PresentationProvider`; strukturelt lik
 * `PresentationControl`, så denne rene modellen ikke importerer presentasjonsfeaturen.
 */
export interface PresentationPort {
  readonly active: boolean;
  /** Lysbildenivået som brukes nå (lagret overstyring eller automatisk), `null` uten overskrifter. */
  readonly slideLevel: number | null;
  /** Lagret overstyring for notatet (`null` = auto). */
  readonly storedLevel: number | null;
  readonly transitions: boolean;
  readonly overviewOpen: boolean;
  readonly blackout: boolean;
  readonly fullscreen: boolean;
  /** Nivåene notatet har overskrifter på (beregnes ved behov). */
  levels(): readonly PresentationLevelInfo[];
  start(level?: number | 'auto'): void;
  next(): void;
  previous(): void;
  first(): void;
  last(): void;
  /** Ruller en for stor blokk på lysbildet (PO-94). */
  scroll(direction: 1 | -1): void;
  toggleOverview(): void;
  toggleBlackout(): void;
  setTransitions(on: boolean): void;
  toggleFullscreen(): void;
  /** Esc i present-modus; `false` når ingen presentasjon vises. */
  escape(): boolean;
  stop(): void;
}

export interface CommandPorts {
  readonly scroll: {
    /** Linjer à ca. én linjehøyde brødtekst; negativ = opp. Respekterer prefers-reduced-motion. */
    by(lines: number): void;
    halfPage(direction: 1 | -1): void;
    toTop(): void;
    toBottom(): void;
  };
  readonly history: { back(): void; forward(): void };
  readonly palette: {
    /** `⌘K` og `/`: notatsøk (valgfri forhåndsutfylling, f.eks. `#tag`). */
    openSearch(query?: string): void;
    /** `:`: kommandomodus; `query` uten kolon (`tema ` åpner argumentlisten for tema). */
    openCommands(query?: string): void;
  };
  readonly help: { openShortcuts(): void };
  readonly appearance: { open(): void };
  readonly theme: {
    /** Modusen som vises nå (system løst opp). */
    readonly resolvedMode: 'light' | 'dark';
    toggleMode(): void;
    setMode(mode: 'light' | 'dark' | 'system'): void;
    setType(type: string): void;
    setPalette(palette: string): void;
    readonly types: readonly ArgumentValue[];
    readonly palettes: readonly ArgumentValue[];
  };
  readonly view: {
    toggleWidth(): void;
    toggleDiscreet(): void;
    toggleZen(): void;
    /** Går ut av zen; `false` hvis zen ikke var på. */
    exitZen(): boolean;
  };
  readonly outline: {
    /** `za`: fokusert overskrift, ellers seksjonen ved leseposisjon (ADR-007 §6). */
    toggleAtReadingPosition(): void;
    foldAll(): void;
    unfoldAll(): void;
  };
  readonly presentation: PresentationPort;
  /** Kort bekreftelse (toast, `role=status`), valgfritt med tasttegn (én etikett per akkord, `['Space', 'w']`). */
  toast(message: string, keys?: readonly string[]): void;
}

export interface CommandContext {
  readonly mode: KeyMode;
  readonly route: CommandRoute;
  readonly view: ViewSnapshot;
  readonly ports: CommandPorts;
}
