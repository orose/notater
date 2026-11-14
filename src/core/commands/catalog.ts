// Kommandokatalogen for v1.1 (spesifikasjonens tastaturkart). ÉN kilde for id-er, navn, aliaser,
// grupper og tastebindinger (P2) for begge flatene (web og terminal, ADR-011 §6). Handlere (isEnabled/run) kobles
// på per flate med `createCommandRegistry(flate, handlers)`, som krever en handler for hver id flaten har (typesjekket).
//
// Rekkefølgen her er rekkefølgen i `?`-oversikten, README og paletten (innen gruppe).
// Alle kommandoer vises i paletten (AK-1.1-06: «alle registrerte kommandoer kan kjøres derfra»),
// også `system.escape` og `palette.commands`; `inPalette` finnes for senere bruk.

import type { KeyMode } from '../keyboard';
import type { CommandSpecBody } from './command-types';

export const COMMAND_CATALOG = {
  // ---------------------------------------------------------------- Navigasjon
  'scroll.down': {
    name: 'Rull ned',
    aliases: ['ned'],
    group: 'navigasjon',
    modes: ['normal'],
    description: 'Ruller ca. tre linjer ned.',
    pair: 'scroll.up',
    pairName: 'Rull ned / opp',
    short: 'ca. tre linjer',
    bindings: { normal: [{ keys: 'j', repeat: true }] },
  },
  'scroll.up': {
    name: 'Rull opp',
    aliases: ['opp'],
    group: 'navigasjon',
    modes: ['normal'],
    description: 'Ruller ca. tre linjer opp.',
    bindings: { normal: [{ keys: 'k', repeat: true }] },
  },
  'scroll.halfPageDown': {
    name: 'Halv side ned',
    aliases: ['halv ned'],
    group: 'navigasjon',
    modes: ['normal'],
    description: 'Ruller en halv skjermhøyde ned.',
    pair: 'scroll.halfPageUp',
    pairName: 'Halv side ned / opp',
    bindings: { normal: [{ keys: 'Ctrl+d', repeat: true }] },
  },
  'scroll.halfPageUp': {
    name: 'Halv side opp',
    aliases: ['halv opp'],
    group: 'navigasjon',
    modes: ['normal'],
    description: 'Ruller en halv skjermhøyde opp.',
    bindings: { normal: [{ keys: 'Ctrl+u', repeat: true }] },
  },
  'scroll.top': {
    name: 'Til toppen',
    aliases: ['topp'],
    group: 'navigasjon',
    modes: ['normal'],
    description: 'Hopper til toppen av siden.',
    pair: 'scroll.bottom',
    pairName: 'Til toppen / bunnen',
    bindings: { normal: [{ keys: 'g g' }] },
  },
  'scroll.bottom': {
    name: 'Til bunnen',
    aliases: ['bunn'],
    group: 'navigasjon',
    modes: ['normal'],
    description: 'Hopper til bunnen av siden.',
    bindings: { normal: [{ keys: 'G' }] },
  },
  'history.back': {
    name: 'Tilbake',
    aliases: ['tilbake'],
    group: 'navigasjon',
    modes: ['normal'],
    description: 'Går tilbake i nettleserhistorikken.',
    pair: 'history.forward',
    pairName: 'Tilbake / frem i historikken',
    bindings: { normal: [{ keys: 'H' }] },
  },
  'history.forward': {
    name: 'Frem',
    aliases: ['frem'],
    group: 'navigasjon',
    modes: ['normal'],
    description: 'Går frem i nettleserhistorikken.',
    bindings: { normal: [{ keys: 'L' }] },
  },
  // ---------------------------------------------------------------- Lesing
  'outline.toggleSection': {
    name: 'Fold/utfold seksjonen',
    aliases: ['fold'],
    group: 'lesing',
    modes: ['normal'],
    description: 'Folder seksjonen ved leseposisjonen (eller den fokuserte overskriften) sammen eller ut.',
    short: 'ved leseposisjonen, eller fokusert overskrift',
    bindings: { normal: [{ keys: 'z a' }] },
  },
  'outline.foldAll': {
    name: 'Fold alle',
    aliases: ['fold alle'],
    group: 'lesing',
    modes: ['normal'],
    description: 'Folder alle seksjoner sammen.',
    pair: 'outline.unfoldAll',
    pairName: 'Fold alle / utfold alle',
    bindings: { normal: [{ keys: 'z M' }] },
  },
  'outline.unfoldAll': {
    name: 'Utfold alle',
    aliases: ['utfold alle', 'utfold'],
    group: 'lesing',
    modes: ['normal'],
    description: 'Folder alle seksjoner ut.',
    bindings: { normal: [{ keys: 'z R' }] },
  },

  // ---------------------------------------------------------------- Visning
  'view.toggleWidth': {
    name: 'Bytt lesebredde',
    aliases: ['bredde'],
    group: 'visning',
    modes: ['normal'],
    description: 'Veksler mellom leseoptimalisert og full bredde. Huskes.',
    short: 'leseoptimalisert ↔ full',
    bindings: { normal: [{ keys: 'Leader w' }] },
    hint: 'bredde',
  },
  'view.toggleDiscreet': {
    name: 'Diskré embedding – dette notatet',
    aliases: ['diskret', 'diskré'],
    group: 'visning',
    modes: ['normal'],
    description: 'Lar innebygde notater gli inn i teksten (kun dette notatet). Huskes.',
    short: 'bare dette notatet',
    bindings: { normal: [{ keys: 'Leader d' }] },
    hint: 'diskré',
  },
  'view.toggleZen': {
    name: 'Zen-modus',
    aliases: ['zen'],
    group: 'visning',
    modes: ['normal'],
    description: 'Skjuler panelene og øvrig krom. Esc avslutter.',
    short: 'skjul paneler og krom',
    bindings: { normal: [{ keys: 'Leader z' }] },
    hint: 'zen',
  },
  'theme.toggleMode': {
    name: 'Bytt lys/mørk',
    aliases: ['modus'],
    group: 'visning',
    description: 'Veksler mellom lys og mørk modus.',
    // Q-11: ⌘. / Ctrl . virker også under presentasjon.
    bindings: { normal: [{ keys: 'Leader m' }, { keys: 'Mod+.', inTextFields: true }], present: [{ keys: 'Mod+.', inTextFields: true }] },
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
    surfaces: ['web'],
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
  'terminal.colors': {
    name: 'Terminalfarger',
    aliases: ['farger'],
    group: 'visning',
    surfaces: ['terminal'],
    description: 'Bytter mellom paletten og terminalens egne 16 farger.',
    args: [{ name: 'farger', label: 'Farger' }],
    bindings: {},
  },
  'appearance.open': {
    name: 'Åpne Utseende',
    aliases: ['utseende'],
    group: 'visning',
    surfaces: ['web'],
    description: 'Åpner dialogen for tema, bredde og visning.',
    bindings: { normal: [{ keys: 'Leader t' }] },
    hint: 'utseende',
  },

  // ---------------------------------------------------------------- Søk og kommandoer
  'palette.search': {
    name: 'Søk i notater',
    aliases: ['søk', 'sok'],
    group: 'sok',
    modes: ['normal'],
    description: 'Åpner paletten for søk i titler, aliaser, innhold og tagger.',
    bindings: { normal: [{ keys: 'Mod+k', inTextFields: true }, { keys: '/' }] },
  },
  'palette.commands': {
    name: 'Kommandoer',
    aliases: ['kommandoer'],
    group: 'sok',
    description: 'Åpner paletten i kommandomodus (:).',
    short: 'kommandolinjen',
    bindings: { normal: [{ keys: ':' }], present: [{ keys: ':' }] },
  },
  'help.shortcuts': {
    name: 'Hurtigtastoversikt',
    aliases: ['hjelp', 'taster'],
    group: 'sok',
    description: 'Viser alle hurtigtaster, gruppert.',
    bindings: { normal: [{ keys: '?' }], present: [{ keys: '?' }] },
  },
  'system.escape': {
    name: 'Lukk / avbryt',
    aliases: ['lukk'],
    group: 'sok',
    description: 'Lukker palett, dialog og oversikt, avbryter en påbegynt tastesekvens og går ut av zen. Under presentasjon: slår av svart skjerm, ellers avslutter presentasjonen.',
    short: 'avbryter også en påbegynt sekvens, og går ut av zen',
    bindings: { normal: [{ keys: 'Escape' }], present: [{ keys: 'Escape' }] },
  },

  // ---------------------------------------------------------------- Presentasjon (v2, ADR-010 §3)
  'present.start': {
    name: 'Presenter',
    aliases: ['presenter'],
    group: 'presentasjon',
    description: 'Viser notatet som lysbilder fra seksjonen ved leseposisjonen. Valgfritt lysbildenivå (h2–h6, auto) huskes for notatet.',
    short: 'fra leseposisjonen',
    args: [{ name: 'nivå', label: 'Lysbildenivå', optional: true, match: 'prefix' }],
    bindings: { normal: [{ keys: 'Leader p' }] },
    hint: 'presenter',
  },
  'present.next': {
    name: 'Neste lysbilde',
    aliases: ['neste'],
    group: 'presentasjon',
    modes: ['present'],
    description: 'Går til neste lysbilde. Under svart skjerm: viser lysbildet igjen.',
    pair: 'present.previous',
    pairName: 'Neste / forrige lysbilde',
    short: 'også klikker og Space',
    bindings: { present: [{ keys: 'j', repeat: true }, { keys: 'ArrowRight', repeat: true }, { keys: 'n' }, { keys: 'Space' }, { keys: 'PageDown' }] },
  },
  'present.previous': {
    name: 'Forrige lysbilde',
    aliases: ['forrige'],
    group: 'presentasjon',
    modes: ['present'],
    description: 'Går til forrige lysbilde. Under svart skjerm: viser lysbildet igjen.',
    bindings: { present: [{ keys: 'k', repeat: true }, { keys: 'ArrowLeft', repeat: true }, { keys: 'p' }, { keys: 'PageUp' }] },
  },
  'present.first': {
    name: 'Første lysbilde',
    aliases: ['første', 'forste'],
    group: 'presentasjon',
    modes: ['present'],
    description: 'Går til tittellysbildet.',
    pair: 'present.last',
    pairName: 'Første / siste lysbilde',
    bindings: { present: [{ keys: 'g g' }] },
  },
  'present.last': {
    name: 'Siste lysbilde',
    aliases: ['siste'],
    group: 'presentasjon',
    modes: ['present'],
    description: 'Går til siste lysbilde.',
    bindings: { present: [{ keys: 'G' }] },
  },
  'present.scrollDown': {
    name: 'Rull blokken ned',
    aliases: ['rull ned'],
    group: 'presentasjon',
    modes: ['present'],
    description: 'Ruller en for stor kodeblokk eller tabell på lysbildet (PO-94).',
    pair: 'present.scrollUp',
    pairName: 'Rull stor blokk ned / opp',
    short: 'kode eller tabell som ikke får plass',
    bindings: { present: [{ keys: 'ArrowDown', repeat: true }] },
  },
  'present.scrollUp': {
    name: 'Rull blokken opp',
    aliases: ['rull opp'],
    group: 'presentasjon',
    modes: ['present'],
    description: 'Ruller en for stor kodeblokk eller tabell på lysbildet opp.',
    bindings: { present: [{ keys: 'ArrowUp', repeat: true }] },
  },
  'present.overview': {
    name: 'Lysbildeoversikt',
    aliases: ['oversikt'],
    group: 'presentasjon',
    modes: ['present'],
    description: 'Viser alle lysbildene i et rutenett. Piltaster eller hjkl og Enter hopper.',
    bindings: { present: [{ keys: 'o' }] },
  },
  'present.blackout': {
    name: 'Svart skjerm',
    aliases: ['svart'],
    group: 'presentasjon',
    modes: ['present'],
    description: 'Gjør lerretet helt svart, og tilbake.',
    short: 'av/på',
    bindings: { present: [{ keys: 'b' }, { keys: '.' }] },
  },
  'present.fullscreen': {
    name: 'Fullskjerm',
    aliases: ['fullskjerm'],
    group: 'presentasjon',
    modes: ['present'],
    surfaces: ['web'],
    description: 'Slår nettleserens fullskjerm av og på uten å avslutte presentasjonen.',
    short: 'av/på',
    bindings: { present: [{ keys: 'f' }] },
  },
  'present.agenda': {
    name: 'Overganger',
    aliases: ['agenda'],
    group: 'presentasjon',
    modes: ['present'],
    description: 'Slår overgangslysbildene (agendaen med «du er her») av eller på for denne presentasjonen. Huskes ikke.',
    args: [{ name: 'verdi', label: 'Overganger', optional: true }],
    bindings: {},
  },
  'present.stop': {
    name: 'Avslutt presentasjon',
    aliases: ['avslutt', 'q'],
    group: 'presentasjon',
    modes: ['present'],
    description: 'Avslutter presentasjonen og viser seksjonen for gjeldende lysbilde i notatet.',
    bindings: {},
    // Ctrl c bindes bare i terminalen (i nettleseren er det kopier), ADR-011 §6.
    surfaceBindings: { terminal: { present: [{ keys: 'q' }, { keys: 'Ctrl+c' }] } },
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
  /** Modiene tipset gjelder i. Standard: bare normal-modus. */
  readonly modes?: readonly KeyMode[];
}

export const KEY_HINTS: readonly KeyHint[] = [
  { id: 'palette.select', keys: ['ArrowUp', 'ArrowDown'], description: 'Velg treff eller kommando i paletten.', group: 'sok', modes: ['normal', 'present'] },
  { id: 'palette.open', keys: ['Enter'], description: 'Åpne treffet / kjør kommandoen.', group: 'sok', modes: ['normal', 'present'] },
  { id: 'palette.openNewTab', keys: ['Mod+Enter'], description: 'Åpne treffet i ny fane.', group: 'sok' },
  { id: 'bases.tabs', keys: ['ArrowLeft', 'ArrowRight', 'Home', 'End'], description: 'Bytt fane (view) i en base når fanene har fokus.', group: 'navigasjon' },
  { id: 'skip-link', keys: ['Tab'], description: 'Første trykk gir «Hopp til innhold».', group: 'navigasjon' },
  // Oversikten (`o`) eier sine egne taster (ADR-010 §3, AR-2-19).
  { id: 'overview.move', keys: ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'h', 'j', 'k', 'l'], description: 'Flytt markøren i lysbildeoversikten.', group: 'presentasjon', modes: ['normal', 'present'] },
  { id: 'overview.open', keys: ['Enter'], description: 'Gå til lysbildet i oversikten.', group: 'presentasjon', modes: ['normal', 'present'] },
];
