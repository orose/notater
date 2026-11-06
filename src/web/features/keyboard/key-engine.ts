// Tastaturmotoren (ADR-007 §2): ren tilstandsmaskin uten DOM. Skjelett – implementeres i slice 1.1-a.
// DOM-adapteren (lytter på `window`, P7-vakter, preventDefault) ligger i `dom-guard.ts` og i
// kommando-featurens provider.

import type { KeyMode } from './modes';

/** P7-sekvenser: avbrytes etter dette uten neste tast (spesifikasjonen: ~1 s). */
export const SEQUENCE_TIMEOUT_MS = 1000;
/** F7: which-key vises etter dette uten neste tast etter leader. Mens den vises, løper ikke tidsavbruddet. */
export const WHICH_KEY_DELAY_MS = 400;

/** Én binding slik motoren ser den: ferdig parset og knyttet til en kommando-id. */
export interface EngineBinding {
  readonly commandId: string;
  /** Kanoniske akkord-id-er i rekkefølge, f.eks. `['Space', 'w']` (se `chordId`). */
  readonly chords: readonly string[];
  /** Tillat auto-repetisjon (holdt tast), f.eks. `j`/`k`. Ellers ignoreres `event.repeat`. */
  readonly repeat: boolean;
  /** Virker også når fokus er i et tekstfelt (kun Mod/Ctrl-akkorder, P7). */
  readonly inTextFields: boolean;
}

export type EngineKeymap = Readonly<Record<KeyMode, readonly EngineBinding[]>>;

/** Påbegynt sekvens (f.eks. etter `g` eller `Space`). */
export interface PendingSequence {
  readonly chords: readonly string[];
  /** Mulige fortsettelser (til which-key): neste akkord → kommando-id. */
  readonly continuations: ReadonlyArray<{ readonly chord: string; readonly commandId: string }>;
  /** Sann når which-key-hintet skal vises (leader + WHICH_KEY_DELAY_MS uten tast). */
  readonly showHints: boolean;
}

export interface KeyEngineState {
  readonly mode: KeyMode;
  readonly pending: PendingSequence | null;
}

/** Resultatet av ett tastetrykk. `handled`/`pending` ⇒ adapteren kaller `preventDefault()`. */
export type KeyResult =
  | { readonly kind: 'handled'; readonly commandId: string }
  | { readonly kind: 'pending' }
  | { readonly kind: 'cancelled' }
  | { readonly kind: 'unhandled' };

/** Klokke injiseres for testbarhet (falske tidtakere i Vitest). */
export interface EngineTimers {
  setTimeout(callback: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

export interface KeyEngineOptions {
  readonly keymap: EngineKeymap;
  readonly timers: EngineTimers;
  readonly onCommand: (commandId: string) => void;
  readonly onStateChange?: (state: KeyEngineState) => void;
  readonly sequenceTimeoutMs?: number;
  readonly whichKeyDelayMs?: number;
}

export interface KeyEngine {
  /**
   * Mater inn ett tastetrykk som kandidat-id-er fra `chordCandidates`. `typing` = fokus i tekstfelt
   * (da matches kun bindinger med `inTextFields`). Esc avbryter en påbegynt sekvens (`cancelled`).
   */
  handle(candidates: readonly string[], flags: { readonly repeat: boolean; readonly typing: boolean }): KeyResult;
  /** Avbryt påbegynt sekvens (Esc, blur, navigasjon, modal åpnes). */
  cancel(): void;
  setMode(mode: KeyMode): void;
  /** Bytt tastaturkart (registeret endret seg); avbryter påbegynt sekvens. */
  setKeymap(keymap: EngineKeymap): void;
  getState(): KeyEngineState;
  dispose(): void;
}
