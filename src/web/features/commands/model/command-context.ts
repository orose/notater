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
  /** Kort bekreftelse (toast, `role=status`). */
  toast(message: string): void;
}

export interface CommandContext {
  readonly mode: KeyMode;
  readonly route: CommandRoute;
  readonly view: ViewSnapshot;
  readonly ports: CommandPorts;
}
