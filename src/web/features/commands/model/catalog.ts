// Kommandokatalogen for v1.1 (spesifikasjonens tastaturkart). ÉN kilde for id-er, navn, aliaser,
// grupper og tastebindinger (P2). Handlere (isEnabled/run) kobles på i React-laget med
// `createCommandRegistry(handlers)`, som krever en handler for hver id her (typesjekket).
//
// Rekkefølgen her er rekkefølgen i `?`-oversikten, README og paletten (innen gruppe).
// Alle kommandoer vises i paletten (AK-1.1-06: «alle registrerte kommandoer kan kjøres derfra»),
// også `system.escape` og `palette.commands`; `inPalette` finnes for senere bruk.

import type { CommandSpecBody } from './command-types';

export const COMMAND_CATALOG = {
  // ---------------------------------------------------------------- Navigasjon
  'scroll.down': {
    name: 'Rull ned',
    aliases: ['ned'],
    group: 'navigasjon',
    description: 'Ruller ca. tre linjer ned.',
    bindings: { normal: [{ keys: 'j', repeat: true }] },
  },
  'scroll.up': {
    name: 'Rull opp',
    aliases: ['opp'],
    group: 'navigasjon',
    description: 'Ruller ca. tre linjer opp.',
    bindings: { normal: [{ keys: 'k', repeat: true }] },
  },
  'scroll.halfPageDown': {
    name: 'Halv side ned',
    aliases: ['halv ned'],
    group: 'navigasjon',
    description: 'Ruller en halv skjermhøyde ned.',
    bindings: { normal: [{ keys: 'Ctrl+d', repeat: true }] },
  },
  'scroll.halfPageUp': {
    name: 'Halv side opp',
    aliases: ['halv opp'],
    group: 'navigasjon',
    description: 'Ruller en halv skjermhøyde opp.',
    bindings: { normal: [{ keys: 'Ctrl+u', repeat: true }] },
  },
  'scroll.top': {
    name: 'Til toppen',
    aliases: ['topp'],
    group: 'navigasjon',
    description: 'Hopper til toppen av siden.',
    bindings: { normal: [{ keys: 'g g' }] },
  },
  'scroll.bottom': {
    name: 'Til bunnen',
    aliases: ['bunn'],
    group: 'navigasjon',
    description: 'Hopper til bunnen av siden.',
    bindings: { normal: [{ keys: 'G' }] },
  },
  'history.back': {
    name: 'Tilbake',
    aliases: ['tilbake'],
    group: 'navigasjon',
    description: 'Går tilbake i nettleserhistorikken.',
    bindings: { normal: [{ keys: 'H' }] },
  },
  'history.forward': {
    name: 'Frem',
    aliases: ['frem'],
    group: 'navigasjon',
    description: 'Går frem i nettleserhistorikken.',
    bindings: { normal: [{ keys: 'L' }] },
  },
  // ---------------------------------------------------------------- Lesing
  'outline.toggleSection': {
    name: 'Fold/utfold seksjonen',
    aliases: ['fold'],
    group: 'lesing',
    description: 'Folder seksjonen ved leseposisjonen (eller den fokuserte overskriften) sammen eller ut.',
    bindings: { normal: [{ keys: 'z a' }] },
  },
  'outline.foldAll': {
    name: 'Fold alle',
    aliases: ['fold alle'],
    group: 'lesing',
    description: 'Folder alle seksjoner sammen.',
    bindings: { normal: [{ keys: 'z M' }] },
  },
  'outline.unfoldAll': {
    name: 'Utfold alle',
    aliases: ['utfold alle', 'utfold'],
    group: 'lesing',
    description: 'Folder alle seksjoner ut.',
    bindings: { normal: [{ keys: 'z R' }] },
  },

  // ---------------------------------------------------------------- Visning
  'view.toggleWidth': {
    name: 'Bytt lesebredde',
    aliases: ['bredde'],
    group: 'visning',
    description: 'Veksler mellom leseoptimalisert og full bredde. Huskes.',
    bindings: { normal: [{ keys: 'Leader w' }] },
    hint: 'bredde',
  },
  'view.toggleDiscreet': {
    name: 'Diskré embedding – dette notatet',
    aliases: ['diskret', 'diskré'],
    group: 'visning',
    description: 'Lar innebygde notater gli inn i teksten (kun dette notatet). Huskes.',
    bindings: { normal: [{ keys: 'Leader d' }] },
    hint: 'diskré',
  },
  'view.toggleZen': {
    name: 'Zen-modus',
    aliases: ['zen'],
    group: 'visning',
    description: 'Skjuler panelene og øvrig krom. Esc avslutter.',
    bindings: { normal: [{ keys: 'Leader z' }] },
    hint: 'zen',
  },
  'theme.toggleMode': {
    name: 'Bytt lys/mørk',
    aliases: ['modus'],
    group: 'visning',
    description: 'Veksler mellom lys og mørk modus.',
    bindings: { normal: [{ keys: 'Leader m' }, { keys: 'Mod+.', inTextFields: true }] },
    hint: 'lys/mørk',
  },
  'theme.light': {
    name: 'Lys modus',
    aliases: ['lys'],
    group: 'visning',
    description: 'Bytter til lys modus.',
    bindings: {},
  },
  'theme.dark': {
    name: 'Mørk modus',
    aliases: ['mørk', 'mork'],
    group: 'visning',
    description: 'Bytter til mørk modus.',
    bindings: {},
  },
  'theme.setType': {
    name: 'Typesett',
    aliases: ['tema', 'typesett'],
    group: 'visning',
    description: 'Velger typesett (Tidsskrift, Terminal, Klartekst).',
    args: [{ name: 'type', label: 'Typesett' }],
    bindings: {},
  },
  'theme.setPalette': {
    name: 'Palett',
    aliases: ['palett'],
    group: 'visning',
    description: 'Velger fargepalett.',
    args: [{ name: 'palette', label: 'Palett' }],
    bindings: {},
  },
  'appearance.open': {
    name: 'Åpne Utseende',
    aliases: ['utseende'],
    group: 'visning',
    description: 'Åpner dialogen for tema, bredde og visning.',
    bindings: { normal: [{ keys: 'Leader t' }] },
    hint: 'utseende',
  },

  // ---------------------------------------------------------------- Søk og kommandoer
  'palette.search': {
    name: 'Søk i notater',
    aliases: ['søk', 'sok'],
    group: 'sok',
    description: 'Åpner paletten for søk i titler, aliaser, innhold og tagger.',
    bindings: { normal: [{ keys: 'Mod+k', inTextFields: true }, { keys: '/' }] },
  },
  'palette.commands': {
    name: 'Kommandoer',
    aliases: ['kommandoer'],
    group: 'sok',
    description: 'Åpner paletten i kommandomodus (:).',
    bindings: { normal: [{ keys: ':' }] },
  },
  'help.shortcuts': {
    name: 'Hurtigtastoversikt',
    aliases: ['hjelp', 'taster'],
    group: 'sok',
    description: 'Viser alle hurtigtaster, gruppert.',
    bindings: { normal: [{ keys: '?' }] },
  },
  'system.escape': {
    name: 'Lukk / avbryt',
    aliases: ['lukk'],
    group: 'sok',
    description: 'Lukker palett, dialog og oversikt, avbryter en påbegynt tastesekvens og går ut av zen.',
    bindings: { normal: [{ keys: 'Escape' }] },
  },
} as const satisfies Readonly<Record<string, CommandSpecBody>>;

export type CommandId = keyof typeof COMMAND_CATALOG;

export const COMMAND_IDS = Object.keys(COMMAND_CATALOG) as CommandId[];

/**
 * Taster som håndteres av komponentene selv etter ARIA-mønstre (combobox, tabs) – ikke kommandoer,
 * men dokumentert fra registeret slik at `?`-oversikten og README er komplette (P2).
 */
export interface KeyHint {
  readonly id: string;
  readonly keys: readonly string[];
  readonly description: string;
  readonly group: CommandSpecBody['group'];
}

export const KEY_HINTS: readonly KeyHint[] = [
  { id: 'palette.select', keys: ['ArrowUp', 'ArrowDown'], description: 'Velg treff eller kommando i paletten.', group: 'sok' },
  { id: 'palette.open', keys: ['Enter'], description: 'Åpne treffet / kjør kommandoen.', group: 'sok' },
  { id: 'palette.openNewTab', keys: ['Mod+Enter'], description: 'Åpne treffet i ny fane.', group: 'sok' },
  { id: 'bases.tabs', keys: ['ArrowLeft', 'ArrowRight', 'Home', 'End'], description: 'Bytt fane (view) i en base når fanene har fokus.', group: 'navigasjon' },
  { id: 'skip-link', keys: ['Tab'], description: 'Første trykk gir «Hopp til innhold».', group: 'navigasjon' },
];
