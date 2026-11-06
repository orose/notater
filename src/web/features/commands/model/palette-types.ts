// Felles palett (F5, ADR-007 §4): typer for kommandomodus. Skjelett – matching implementeres i 1.1-a.

import type { CommandId } from './catalog';
import type { ArgumentValue } from './command-types';

/** Hva paletten viser, avledet av inndata: uten prefiks notatsøk, med `:` kommandoer. */
export type PaletteMode = { readonly kind: 'search'; readonly query: string } | { readonly kind: 'commands'; readonly query: string };

/** `':tema ter'` → kommandomodus med `tema ter`; alt annet → søk. Ledende mellomrom ignoreres ikke. */
export function paletteModeOf(input: string): PaletteMode {
  return input.startsWith(':') ? { kind: 'commands', query: input.slice(1) } : { kind: 'search', query: input };
}

export interface PaletteCommandOption {
  readonly kind: 'command';
  readonly commandId: CommandId;
  readonly name: string;
  /** Første binding formatert for plattformen (vises til høyre), eller null. */
  readonly shortcut: string | null;
  readonly enabled: boolean;
  /** Forklaring når `enabled` er false (vises dempet under navnet). */
  readonly reason: string | null;
  /** Sann hvis Enter åpner argumentlisten i stedet for å kjøre. */
  readonly needsArgument: boolean;
  /** Treffposisjoner i `name` til utheving. */
  readonly highlights: ReadonlyArray<readonly [number, number]>;
}

export interface PaletteArgumentOption {
  readonly kind: 'argument';
  readonly commandId: CommandId;
  readonly argument: string;
  readonly value: ArgumentValue;
  /** Gjeldende verdi markeres (f.eks. aktivt typesett). */
  readonly current: boolean;
}

export type PaletteOption = PaletteCommandOption | PaletteArgumentOption;
