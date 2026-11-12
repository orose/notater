// Datamodellen for kommandoregisteret (P2, ADR-007 §1). Ren TS – importeres også av
// `npm run docs:shortcuts` (Node), så ingen React, DOM-tilgang eller import av andre features.

import type { KeyMode } from '../keyboard';
import type { CommandContext } from './command-context';

/** Grupper i fast rekkefølge (F6). Etikettene vises i `?`-oversikten, paletten og README. */
export const COMMAND_GROUPS = ['navigasjon', 'lesing', 'visning', 'sok', 'presentasjon'] as const;
export type CommandGroup = (typeof COMMAND_GROUPS)[number];

/** Gruppeorden i paletten med tom `:`-linje: mest brukt først (designsystem §11.7). */
export const PALETTE_GROUP_ORDER: readonly CommandGroup[] = ['visning', 'lesing', 'presentasjon', 'sok', 'navigasjon'];

/** Gruppeorden i `?`-kortet per modus: under presentasjon står presentasjonstastene først. */
export const MODE_GROUP_ORDER: Readonly<Record<KeyMode, readonly CommandGroup[]>> = {
  normal: COMMAND_GROUPS,
  present: ['presentasjon', 'visning', 'sok', 'navigasjon', 'lesing'],
};

/** Flatene som bruker katalogen (ADR-011 §6): nettleseren og terminalpresentasjonen. */
export const SURFACES = ['web', 'terminal'] as const;
export type Surface = (typeof SURFACES)[number];

export const GROUP_LABELS: Readonly<Record<CommandGroup, string>> = {
  navigasjon: 'Navigasjon',
  lesing: 'Lesing',
  visning: 'Visning',
  sok: 'Søk og kommandoer',
  presentasjon: 'Presentasjon',
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
  /** Kommandoen kan kjøres uten argument (Enter på kommandoraden kjører, ⇥ fyller inn). Standard: nei. */
  readonly optional?: boolean;
  /** `prefix`: verdiene matches fra starten (`4` treffer ikke `h4`). Standard: fuzzy. */
  readonly match?: 'fuzzy' | 'prefix';
}

/** Forklarende feil for et argument som ikke finnes blant verdiene (vim-stil kode, f.eks. E475/E486). */
export interface ArgumentError {
  readonly code: string;
  /** Fet første setning. */
  readonly title: string;
  /** Forklaring etter tittelen. */
  readonly detail: string;
}

/** En lovlig verdi for et argument (verdiene kommer fra handleren ved kjøretid). */
export interface ArgumentValue {
  readonly value: string;
  readonly label: string;
  /** Ekstra søkeord (`fosfor`, `phosphor`). */
  readonly aliases?: readonly string[];
  /** Kort forklaring i underlisten (f.eks. «Seriff, marginalia, figurer»). */
  readonly description?: string;
  /** Gjeldende verdi (markeres i underlisten). */
  readonly current?: boolean;
  /** Visuell prøve i underlisten: typografisk prøve (`Aa` i typesettets font) eller fargestripe. */
  readonly visual?: { readonly specimen?: string; readonly swatch?: readonly string[] };
  /** Ekstra merknad etter beskrivelsen (f.eks. «anbefalt for Terminal»). */
  readonly note?: string;
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
  /**
   * `?`-kortet og README slår denne kommandoen sammen med `pair` til én rad («`j` / `k` Rull ned / opp»,
   * PO-69). Settes på den første i paret; partneren står rett etter i samme gruppe.
   */
  readonly pair?: string;
  /** Radnavnet for paret («Rull ned / opp»). */
  readonly pairName?: string;
  /** Kort undertekst i `?`-kortet («ca. tre linjer»). */
  readonly short?: string;
  /** Kort etikett i which-key (`bredde`). Standard: første alias. */
  readonly hint?: string;
  /**
   * Modiene kommandoen kan brukes i (ADR-010 §3). Standard: alle. Utenfor gir den begrunnelsen «Ikke under
   * presentasjon» / «Bare under presentasjon», og `?`-kortet viser den bare i sine modi.
   */
  readonly modes?: readonly KeyMode[];
  /** Flatene kommandoen finnes på (ADR-011 §6). Standard: alle. */
  readonly surfaces?: readonly Surface[];
  /** Ekstra taster for én flate, i tillegg til `bindings` (terminalen: `q`/`Ctrl+c` på `present.stop`). */
  readonly surfaceBindings?: Readonly<Partial<Record<Surface, Readonly<Partial<Record<KeyMode, readonly BindingSpec[]>>>>>>;
  /** `false` = vises ikke i paletten. Standard: vises (i v1.1 vises alle, AK-1.1-06). */
  readonly inPalette?: boolean;
}

export const NOT_WHILE_PRESENTING = 'Ikke under presentasjon';
export const ONLY_WHILE_PRESENTING = 'Bare under presentasjon';

/** `isEnabled` svarer alltid med begrunnelse når kommandoen ikke kan brukes (F5). */
export type Availability = { readonly enabled: true } | { readonly enabled: false; readonly reason: string };

export const ENABLED: Availability = { enabled: true };

/** Dynamisk del, implementeres i React-laget mot `CommandContext.ports`. */
export interface CommandHandler {
  /** Standard: alltid tilgjengelig. Kalles ved hvert palettsøk og før hver tastekjøring. */
  readonly isEnabled?: (ctx: CommandContext) => Availability;
  /** Nå-tilstand vist i paletten og which-key («full», «av», «lys»). Standard: ingen. */
  readonly state?: (ctx: CommandContext) => string | null;
  /** Lovlige verdier for argumentet `name` (tema, palett …). */
  readonly argumentValues?: (ctx: CommandContext, name: string) => readonly ArgumentValue[];
  /**
   * Forklaring når inndata ikke treffer noen verdi (S4: `:presenter h9` → E475, `:presenter h5` → E486). `null` gir
   * palettens generelle E475-tekst.
   */
  readonly argumentError?: (ctx: CommandContext, name: string, input: string) => ArgumentError | null;
  /**
   * Utfører kommandoen. `args` er tom når den kjøres fra tastaturet; da bruker kommandoen et
   * fornuftig standardvalg (f.eks. veksle) eller åpner paletten på argumentlisten.
   */
  readonly run: (ctx: CommandContext, args: Readonly<Record<string, string>>) => void | Promise<void>;
}
