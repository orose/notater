// Tastaturmotoren (ADR-007 §2): ren tilstandsmaskin uten DOM.
// DOM-adapteren (lytter på `window`, P7-vakter, preventDefault) ligger i `dom-guard.ts` og i
// kommando-featurens provider.
//
// Et tastetrykk er enten et fullt treff (kjør nå), et prefiks (vent) eller ingenting. Policyen
// (`key-policy.ts`) forbyr at en sekvens er prefiks av en annen, så motoren venter aldri for å *velge*.

import { LEADER_KEY } from './key-notation';
import { DEFAULT_MODE, type KeyMode } from './modes';

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

/**
 * Resultatet av ett tastetrykk. Alt unntatt `unhandled` ⇒ adapteren kaller `preventDefault()`.
 * `suppressed` = auto-repetisjon av en binding uten `repeat` (holdt `G`, holdt `Space`): ingen kommando,
 * ingen tilstandsendring, men heller ingen nettleser-standard (f.eks. Space-rulling).
 */
export type KeyResult =
  | { readonly kind: 'handled'; readonly commandId: string }
  | { readonly kind: 'pending' }
  | { readonly kind: 'cancelled' }
  | { readonly kind: 'suppressed' }
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
  /** Første akkord som gir which-key. Standard: kun leader (F7; `g`/`z` viser ikke hint i v1.1). */
  readonly hintPrefixes?: readonly string[];
  readonly initialMode?: KeyMode;
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

const ESCAPE = 'Escape';

function startsWith(chords: readonly string[], prefix: readonly string[]): boolean {
  return prefix.every((c, i) => chords[i] === c);
}

export function createKeyEngine(options: KeyEngineOptions): KeyEngine {
  const { timers, onCommand, onStateChange } = options;
  const sequenceTimeoutMs = options.sequenceTimeoutMs ?? SEQUENCE_TIMEOUT_MS;
  const whichKeyDelayMs = options.whichKeyDelayMs ?? WHICH_KEY_DELAY_MS;
  const hintPrefixes = options.hintPrefixes ?? [LEADER_KEY];

  let keymap = options.keymap;
  let state: KeyEngineState = { mode: options.initialMode ?? DEFAULT_MODE, pending: null };
  let timeoutHandle: unknown = null;
  let hintHandle: unknown = null;
  let disposed = false;

  function clearTimers(): void {
    if (timeoutHandle !== null) timers.clearTimeout(timeoutHandle);
    if (hintHandle !== null) timers.clearTimeout(hintHandle);
    timeoutHandle = null;
    hintHandle = null;
  }

  function setState(next: KeyEngineState): void {
    state = next;
    onStateChange?.(state);
  }

  function reset(): void {
    clearTimers();
    if (state.pending !== null) setState({ ...state, pending: null });
  }

  function bindingsFor(typing: boolean): readonly EngineBinding[] {
    const all = keymap[state.mode] ?? [];
    return typing ? all.filter((b) => b.inTextFields) : all;
  }

  function continuationsOf(prefix: readonly string[], bindings: readonly EngineBinding[]): PendingSequence['continuations'] {
    const seen = new Set<string>();
    const out: Array<{ chord: string; commandId: string }> = [];
    for (const b of bindings) {
      if (b.chords.length <= prefix.length || !startsWith(b.chords, prefix)) continue;
      const chord = b.chords[prefix.length] as string;
      if (seen.has(chord)) continue;
      seen.add(chord);
      out.push({ chord, commandId: b.commandId });
    }
    return out;
  }

  function begin(chords: readonly string[], bindings: readonly EngineBinding[]): void {
    clearTimers();
    setState({ ...state, pending: { chords, continuations: continuationsOf(chords, bindings), showHints: false } });
    timeoutHandle = timers.setTimeout(() => {
      timeoutHandle = null;
      reset();
    }, sequenceTimeoutMs);
    if (chords.length === 1 && hintPrefixes.includes(chords[0] as string)) {
      hintHandle = timers.setTimeout(() => {
        hintHandle = null;
        // AR-1.1-09: mens which-key vises, løper ikke tidsavbruddet.
        if (timeoutHandle !== null) timers.clearTimeout(timeoutHandle);
        timeoutHandle = null;
        if (state.pending) setState({ ...state, pending: { ...state.pending, showHints: true } });
      }, whichKeyDelayMs);
    }
  }

  function run(commandId: string): KeyResult {
    reset();
    onCommand(commandId);
    return { kind: 'handled', commandId };
  }

  return {
    handle(candidates, flags) {
      if (disposed || candidates.length === 0) return { kind: 'unhandled' };
      const bindings = bindingsFor(flags.typing);

      if (flags.repeat) {
        // Holdt tast: bare `repeat`-bindinger (fra start) gjentas; resten undertrykkes uten tilstandsendring.
        if (state.pending === null) {
          for (const c of candidates) {
            const hit = bindings.find((b) => b.repeat && b.chords.length === 1 && b.chords[0] === c);
            if (hit) return run(hit.commandId);
          }
        }
        const known = bindings.some((b) => candidates.some((c) => b.chords.includes(c)));
        return known || state.pending !== null ? { kind: 'suppressed' } : { kind: 'unhandled' };
      }

      const prefix = state.pending?.chords ?? [];
      if (prefix.length > 0 && candidates.includes(ESCAPE)) {
        reset();
        return { kind: 'cancelled' };
      }

      for (const c of candidates) {
        const seq = [...prefix, c];
        const exact = bindings.find((b) => b.chords.length === seq.length && startsWith(b.chords, seq));
        if (exact) return run(exact.commandId);
        if (bindings.some((b) => b.chords.length > seq.length && startsWith(b.chords, seq))) {
          begin(seq, bindings);
          return { kind: 'pending' };
        }
      }

      if (prefix.length > 0) {
        reset();
        return { kind: 'cancelled' };
      }
      return { kind: 'unhandled' };
    },
    cancel: reset,
    setMode(mode) {
      clearTimers();
      setState({ mode, pending: null });
    },
    setKeymap(next) {
      keymap = next;
      reset();
    },
    getState: () => state,
    dispose() {
      disposed = true;
      clearTimers();
    },
  };
}
