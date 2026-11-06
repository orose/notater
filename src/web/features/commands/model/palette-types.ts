// Felles palett (F5, ADR-007 §4): typer for kommandomodus. Ren TS. Valgene lages i `palette-options.ts`.

import type { CommandId } from './catalog';
import type { ArgumentValue, CommandGroup } from './command-types';

/** Hva paletten viser, avledet av inndata: uten prefiks notatsøk, med `:` kommandoer. */
export type PaletteMode = { readonly kind: 'search'; readonly query: string } | { readonly kind: 'commands'; readonly query: string };

/** `':tema ter'` → kommandomodus med `tema ter`; alt annet → søk. Ledende mellomrom ignoreres ikke. */
export function paletteModeOf(input: string): PaletteMode {
  return input.startsWith(':') ? { kind: 'commands', query: input.slice(1) } : { kind: 'search', query: input };
}

export type Highlights = ReadonlyArray<readonly [number, number]>;

export interface PaletteCommandOption {
  readonly kind: 'command';
  readonly commandId: CommandId;
  readonly name: string;
  readonly description: string;
  readonly group: CommandGroup;
  /** `:`-ordet som vises foran navnet (best treffende alias), f.eks. `bredde`. */
  readonly ex: string;
  /** Treffposisjoner i `ex`. */
  readonly exHighlights: Highlights;
  /** Argumentets plassholder (`typesett`) for argumentkommandoer, ellers null. */
  readonly argumentLabel: string | null;
  /** Nå-tilstand («full», «av», «Tidsskrift»), eller null. */
  readonly state: string | null;
  /** Første binding, én etikett per akkord (`['Space', 'w']`, `['⌘K']`), eller null. Vises til høyre. */
  readonly shortcut: readonly string[] | null;
  readonly enabled: boolean;
  /** Forklaring når `enabled` er false (vises dempet under navnet). */
  readonly reason: string | null;
  /** Sann hvis Enter åpner argumentlisten i stedet for å kjøre. */
  readonly needsArgument: boolean;
  /** Ny inndata (uten kolon) når Enter åpner argumentlisten, f.eks. `tema `. */
  readonly completion: string | null;
  /** Treffposisjoner i `name` til utheving. */
  readonly highlights: Highlights;
}

export interface PaletteArgumentOption {
  readonly kind: 'argument';
  readonly commandId: CommandId;
  /** Kommandoens navn (vises som kontekst, f.eks. «Typesett»). */
  readonly commandName: string;
  /** Kommandoens `:`-ord (`tema`). */
  readonly ex: string;
  readonly argument: string;
  /** Argumentets etikett (`Typesett`). */
  readonly argumentLabel: string;
  readonly value: ArgumentValue;
  /** Gjeldende verdi markeres (f.eks. aktivt typesett). */
  readonly current: boolean;
  readonly enabled: boolean;
  readonly reason: string | null;
  readonly highlights: Highlights;
}

export type PaletteOption = PaletteCommandOption | PaletteArgumentOption;
