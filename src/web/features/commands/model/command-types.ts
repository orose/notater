// Datamodellen for kommandoregisteret (P2, ADR-007 §1). Ren TS – importeres også av
// `npm run docs:shortcuts` (Node), så ingen React, DOM-tilgang eller import av andre features.

import type { KeyMode } from '../../keyboard';
import type { CommandContext } from './command-context';

/** Grupper i fast rekkefølge (F6). Etikettene vises i `?`-oversikten, paletten og README. */
export const COMMAND_GROUPS = ['navigasjon', 'lesing', 'visning', 'sok'] as const;
export type CommandGroup = (typeof COMMAND_GROUPS)[number];

export const GROUP_LABELS: Readonly<Record<CommandGroup, string>> = {
  navigasjon: 'Navigasjon',
  lesing: 'Lesing',
  visning: 'Visning',
  sok: 'Søk og kommandoer',
};

export interface BindingSpec {
  /** Tastenotasjon, se `keyboard/key-notation.ts` (`'j'`, `'g g'`, `'Leader w'`, `'Mod+k'`). */
  readonly keys: string;
  /** Holdt tast gjentar kommandoen (rulling). Standard: nei. */
  readonly repeat?: boolean;
  /** Virker også med fokus i tekstfelt (kun Mod/Ctrl, P7). Standard: nei. */
  readonly inTextFields?: boolean;
}

export interface ArgumentSpec {
  /** Nøkkel i `args` til `run`. */
  readonly name: string;
  /** Visningsnavn i paletten, f.eks. «Typesett». */
  readonly label: string;
}

/** En lovlig verdi for et argument (verdiene kommer fra handleren ved kjøretid). */
export interface ArgumentValue {
  readonly value: string;
  readonly label: string;
  /** Ekstra søkeord (`fosfor`, `phosphor`). */
  readonly aliases?: readonly string[];
}

/** Statisk del av en kommando: alt som trengs for palett, `?`-oversikt, README og tastaturkart. */
export interface CommandSpecBody {
  /** Norsk navn i paletten og oversikten: «Bytt lesebredde». */
  readonly name: string;
  /** `:`-ord i paletten uten kolon (`bredde`, `zen`, `fold alle`). Fuzzy-søket bruker også `name`. */
  readonly aliases: readonly string[];
  readonly group: CommandGroup;
  /** Én setning: hva skjer. Vises som undertekst i paletten og i README. */
  readonly description: string;
  /** Høyst ett argument i v1.1 (`:tema terminal`). Paletten viser verdiene som underliste. */
  readonly args?: readonly ArgumentSpec[];
  /** Bindinger per modus (P3). Tom = kun palett/mus. */
  readonly bindings: Readonly<Partial<Record<KeyMode, readonly BindingSpec[]>>>;
  /** Kort etikett i which-key (`bredde`). Standard: første alias. */
  readonly hint?: string;
  /** `false` = vises ikke i paletten (f.eks. `system.escape`). Standard: vises. */
  readonly inPalette?: boolean;
}

/** `isEnabled` svarer alltid med begrunnelse når kommandoen ikke kan brukes (F5). */
export type Availability = { readonly enabled: true } | { readonly enabled: false; readonly reason: string };

export const ENABLED: Availability = { enabled: true };

/** Dynamisk del, implementeres i React-laget mot `CommandContext.ports`. */
export interface CommandHandler {
  /** Standard: alltid tilgjengelig. Kalles ved hvert palettsøk og før hver tastekjøring. */
  readonly isEnabled?: (ctx: CommandContext) => Availability;
  /** Lovlige verdier for argumentet `name` (tema, palett …). */
  readonly argumentValues?: (ctx: CommandContext, name: string) => readonly ArgumentValue[];
  /**
   * Utfører kommandoen. `args` er tom når den kjøres fra tastaturet; da bruker kommandoen et
   * fornuftig standardvalg (f.eks. veksle) eller åpner paletten på argumentlisten.
   */
  readonly run: (ctx: CommandContext, args: Readonly<Record<string, string>>) => void | Promise<void>;
}
