// AK-1.1-08: regler for tastebindinger (P4 reserverte taster, P5 norsk tastatur) og en tolerant
// normalisering av kommandoregisteret, slik at sjekken kan kjøres mot registeret når arkitekten har
// laget det (src/web/features/…), uten at QA må gjette den endelige formen på typene.
//
// Ren logikk, ingen Playwright – testes selv i e2e/v1.1-ak08-register.spec.ts.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { REPO } from './real-server';

/** P4: kan ikke bindes i normal-modus (første tast i en binding). Store/små bokstaver skilles. */
export const RESERVERTE_TASTER: readonly string[] = ['i', 'a', 'o', 'e', 'I', 'A', 'O', 's', 'c', 'd', 'x', 'p', 'y', 'u', 'r'];

/**
 * P5: tegn som krever ⌥ (Option) på norsk Mac-layout. Spesifikasjonen lister `[ ] { } \ | @ $`
 * («bl.a.»); QA legger til `~` (⌥¨, død tast) og `€ £` (⌥-tegn). Døde taster (`^ ` ´ ¨`) gir
 * sammensatte tegn og er heller ikke trygge. Se spørsmål Q-11 i testplanen.
 */
export const ALT_TEGN: readonly string[] = ['[', ']', '{', '}', '\\', '|', '@', '$', '~', '€', '£'];
export const DODE_TASTER: readonly string[] = ['^', '`', '´', '¨'];

/** Esc er bare lov for «lukk/avbryt» (P4). Kommandoer med Esc må ha en id/navn som matcher denne. */
export const ESC_TILLATT = /lukk|avbryt|close|cancel|escape|esc|zen/i;

const MODIFIKATORER: Record<string, string> = {
  ctrl: 'Ctrl',
  control: 'Ctrl',
  '⌃': 'Ctrl',
  meta: 'Meta',
  cmd: 'Meta',
  command: 'Meta',
  '⌘': 'Meta',
  mod: 'Mod',
  controlormeta: 'Mod',
  shift: 'Shift',
  '⇧': 'Shift',
  alt: 'Alt',
  option: 'Alt',
  opt: 'Alt',
  '⌥': 'Alt',
};

const TASTENAVN: Record<string, string> = {
  space: 'Space',
  mellomrom: 'Space',
  '␣': 'Space',
  ' ': 'Space',
  esc: 'Escape',
  escape: 'Escape',
  enter: 'Enter',
  return: 'Enter',
  '↵': 'Enter',
  period: '.',
  slash: '/',
};

/** Tastenavn på to bokstaver som ikke skal tolkes som sekvens. */
const TOBOKSTAVSNAVN: readonly string[] = ['Up', 'up', 'Fn', 'fn'];

/** Ett trinn i en sekvens: modifikatorer + tast, f.eks. `{ mods: ['Ctrl'], key: 'd' }`. */
export interface Trinn {
  readonly mods: readonly string[];
  readonly key: string;
}

export interface Binding {
  readonly commandId: string;
  readonly commandName: string;
  readonly mode: string;
  /** Slik bindingen sto i registeret (for feilmeldinger). */
  readonly raw: string;
  readonly steps: readonly Trinn[];
}

function normaliserTast(token: string): string {
  return TASTENAVN[token.toLowerCase()] ?? TASTENAVN[token] ?? token;
}

/** `Ctrl+d`, `⌘K`, `Mod+k`, `Shift+?` → ett trinn. */
export function parseTrinn(token: string): Trinn {
  const mods: string[] = [];
  let rest = token;
  // Symbolmodifikatorer foran tasten: ⌘K, ⌃d, ⇧G, ⌥8
  while (rest.length > 1 && ['⌘', '⌃', '⇧', '⌥'].includes(rest[0] as string)) {
    mods.push(MODIFIKATORER[rest[0] as string] as string);
    rest = rest.slice(1);
  }
  const deler = rest.length > 1 && rest.includes('+') ? rest.split('+') : [rest];
  // `Ctrl++` / `Shift++` → siste del er tom; tasten er «+».
  if (deler.length > 1 && deler[deler.length - 1] === '') {
    deler.pop();
    deler[deler.length - 1] = '+';
  }
  const key = deler.pop() ?? '';
  for (const del of deler) {
    const mod = MODIFIKATORER[del.toLowerCase()] ?? MODIFIKATORER[del];
    if (!mod) throw new Error(`Ukjent modifikator «${del}» i «${token}»`);
    mods.push(mod);
  }
  return { mods, key: normaliserTast(key) };
}

/**
 * Tolker en binding i de vanligste notasjonene:
 * `'Space w'`, `'g g'`, `'gg'`, `'zM'`, `'Ctrl+d'`, `'Mod+k'`, `'⌘K'`, `['g', 'g']`, `[{ key: 'g' }, …]`.
 */
export function parseBinding(input: unknown): Trinn[] {
  if (Array.isArray(input)) return input.flatMap((del) => parseBinding(del));
  if (input && typeof input === 'object') {
    const o = input as Record<string, unknown>;
    if (typeof o.key === 'string') {
      const mods = Object.entries(MODIFIKATORER)
        .filter(([navn]) => o[`${navn}Key`] === true || o[navn] === true)
        .map(([, mod]) => mod);
      return [{ mods: [...new Set(mods)], key: normaliserTast(o.key) }];
    }
    for (const felt of ['keys', 'sequence', 'steps', 'combo', 'binding']) {
      if (felt in o) return parseBinding(o[felt]);
    }
    throw new Error(`Forstår ikke bindingen ${JSON.stringify(input)}`);
  }
  if (typeof input !== 'string') throw new Error(`Forstår ikke bindingen ${JSON.stringify(input)}`);
  const s = input.trim();
  if (s === '') return [];
  if (s === ' ') return [{ mods: [], key: 'Space' }];
  if (/\s/.test(s)) return s.split(/\s+/).map(parseTrinn);
  // `gg`, `za`, `zM`: to bokstaver uten skilletegn = sekvens. (`Space`, `Escape` osv. er tastenavn.)
  if (/^[a-zA-Z]{2}$/.test(s) && !TOBOKSTAVSNAVN.includes(s)) return [...s].map((c) => ({ mods: [], key: c }));
  return [parseTrinn(s)];
}

export function visTrinn(steps: readonly Trinn[]): string {
  return steps.map((t) => [...t.mods, t.key].join('+')).join(' ');
}

/** P4: første tast uten modifikator (Shift teller ikke som modifikator for store bokstaver) er reservert. */
export function brytReservert(binding: Binding): string | null {
  const first = binding.steps[0];
  if (!first) return `${binding.commandId}: tom binding`;
  const utenShift = first.mods.filter((m) => m !== 'Shift');
  if (utenShift.length > 0) return null; // Ctrl d, ⌘K osv. er ikke vim-taster
  const key = first.mods.includes('Shift') && /^[a-z]$/.test(first.key) ? first.key.toUpperCase() : first.key;
  if (RESERVERTE_TASTER.includes(key)) {
    return `${binding.commandId} («${binding.commandName}») bruker reservert tast «${key}» (${binding.raw}) i modus ${binding.mode} (P4)`;
  }
  if (key === 'Escape' && !ESC_TILLATT.test(`${binding.commandId} ${binding.commandName}`)) {
    return `${binding.commandId} («${binding.commandName}») bruker Esc, som bare er lov til lukk/avbryt (P4)`;
  }
  return null;
}

/** P5: ingen ⌥-avhengige tegn eller ⌥-modifikator i noe trinn. */
export function brytNorskTastatur(binding: Binding): string | null {
  for (const t of binding.steps) {
    if (t.mods.includes('Alt')) return `${binding.commandId} bruker ⌥/Alt (${binding.raw}) (P5)`;
    if (ALT_TEGN.includes(t.key)) return `${binding.commandId} bruker «${t.key}», som krever ⌥ på norsk Mac (${binding.raw}) (P5)`;
    if (DODE_TASTER.includes(t.key)) return `${binding.commandId} bruker død tast «${t.key}» (${binding.raw}) (P5)`;
  }
  return null;
}

/** Duplikater: samme sekvens i samme modus på to kommandoer, eller en sekvens som er prefiks av en annen. */
export function konflikter(bindings: readonly Binding[]): string[] {
  const feil: string[] = [];
  const nøkkel = (b: Binding) => `${b.mode}:${visTrinn(b.steps)}`;
  // Esc er kontekstavhengig (lukk palett, lukk dialog, gå ut av zen) og kan deles.
  const aktuelle = bindings.filter((b) => !(b.steps.length === 1 && b.steps[0]?.key === 'Escape'));
  for (const a of aktuelle) {
    for (const b of aktuelle) {
      if (a === b || a.mode !== b.mode || a.commandId === b.commandId) continue;
      if (nøkkel(a) === nøkkel(b) && a.commandId < b.commandId) feil.push(`${a.commandId} og ${b.commandId} har begge ${visTrinn(a.steps)}`);
      const pa = visTrinn(a.steps);
      const pb = visTrinn(b.steps);
      if (pb.startsWith(`${pa} `)) feil.push(`${a.commandId} (${pa}) er prefiks av ${b.commandId} (${pb}) – ${pb} kan aldri nås`);
    }
  }
  return feil;
}

// ---------------------------------------------------------------------------------------------
// Normalisering av registeret
// ---------------------------------------------------------------------------------------------

/** En kommando slik QA ser den, uansett hvordan registeret er formet. */
export interface NormalisertKommando {
  readonly id: string;
  readonly name: string;
  readonly group: string | null;
  readonly bindings: readonly Binding[];
}

const BINDINGSFELT = ['keys', 'bindings', 'keybindings', 'keyBindings', 'shortcuts', 'hotkeys', 'taster'];
const NAVNEFELT = ['name', 'title', 'label', 'navn'];
const GRUPPEFELT = ['group', 'category', 'gruppe'];

function førsteStreng(o: Record<string, unknown>, felt: readonly string[]): string | null {
  for (const f of felt) if (typeof o[f] === 'string') return o[f] as string;
  return null;
}

function bindingerFra(id: string, name: string, value: unknown): Binding[] {
  if (value === undefined || value === null) return [];
  const lag = (mode: string, raw: unknown): Binding => ({ commandId: id, commandName: name, mode, raw: typeof raw === 'string' ? raw : JSON.stringify(raw), steps: parseBinding(raw) });
  // Per modus: { normal: ['j'], insert: [...] }
  if (!Array.isArray(value) && typeof value === 'object') {
    const o = value as Record<string, unknown>;
    if ('mode' in o && typeof o.mode === 'string') return [lag(o.mode, o.keys ?? o.sequence ?? o.key)];
    return Object.entries(o).flatMap(([mode, liste]) => (Array.isArray(liste) ? liste : [liste]).map((raw) => lag(mode, raw)));
  }
  if (typeof value === 'string') return [lag('normal', value)];
  if (Array.isArray(value)) {
    return value.flatMap((raw) => {
      if (raw && typeof raw === 'object' && !Array.isArray(raw) && 'mode' in raw) {
        const o = raw as Record<string, unknown>;
        return [lag(String(o.mode), o.keys ?? o.sequence ?? o.key ?? o.binding)];
      }
      return [lag('normal', raw)];
    });
  }
  throw new Error(`Forstår ikke bindingene til ${id}: ${JSON.stringify(value)}`);
}

function serUtSomKommando(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && typeof (v as Record<string, unknown>).id === 'string' && førsteStreng(v as Record<string, unknown>, NAVNEFELT) !== null;
}

/** Tar et array, Map, Record<id, kommando> eller objekt med `.all()/.list()/.commands`. */
export function normaliserRegister(register: unknown): NormalisertKommando[] {
  let liste: unknown[] = [];
  if (Array.isArray(register)) liste = register;
  else if (register instanceof Map) liste = [...register.values()];
  else if (register && typeof register === 'object') {
    const o = register as Record<string, unknown>;
    for (const metode of ['all', 'list', 'getAll', 'values']) {
      if (typeof o[metode] === 'function') {
        liste = [...((o[metode] as () => Iterable<unknown>).call(register))];
        break;
      }
    }
    if (liste.length === 0 && Array.isArray(o.commands)) liste = o.commands;
    if (liste.length === 0) liste = Object.values(o);
  }
  const kommandoer = liste.filter(serUtSomKommando);
  if (kommandoer.length === 0) throw new Error('Fant ingen kommandoer (objekter med id + navn) i registeret');
  return kommandoer.map((k) => {
    const id = k.id as string;
    const name = førsteStreng(k, NAVNEFELT) as string;
    const felt = BINDINGSFELT.find((f) => f in k);
    return { id, name, group: førsteStreng(k, GRUPPEFELT), bindings: felt ? bindingerFra(id, name, k[felt]) : [] };
  });
}

/**
 * Kandidater for registermodulen. Arkitekten lager registeret i src/web/features/ – når fila finnes,
 * legg den eksakte stien først her (og fjern `test.fixme` i v1.1-ak08-register.spec.ts).
 */
export const REGISTER_KANDIDATER: readonly string[] = [
  'src/web/features/commands/index.ts',
  'src/web/features/commands/registry.ts',
  'src/web/features/command-registry/index.ts',
  'src/web/features/keyboard/index.ts',
  'src/web/features/keyboard/registry.ts',
  'src/web/features/kommandoer/index.ts',
];

/**
 * Laster registeret dynamisk (stien er en variabel, så `tsc` for e2e drar ikke inn web-koden).
 * Returnerer den første eksporten som ser ut som et register, eller `null` hvis ingen kandidat finnes.
 */
export async function lastRegister(): Promise<{ readonly fil: string; readonly eksport: string; readonly kommandoer: NormalisertKommando[] } | null> {
  for (const rel of REGISTER_KANDIDATER) {
    const fil = join(REPO, rel);
    if (!existsSync(fil)) continue;
    const modul = (await import(pathToFileURL(fil).href)) as Record<string, unknown>;
    for (const [eksport, verdi] of Object.entries(modul)) {
      const kandidat = typeof verdi === 'function' && verdi.length === 0 && /register|commands|kommando/i.test(eksport) ? safeCall(verdi) : verdi;
      try {
        return { fil: rel, eksport, kommandoer: normaliserRegister(kandidat) };
      } catch {
        // ikke denne eksporten
      }
    }
    throw new Error(`${rel} finnes, men ingen eksport ser ut som et kommandoregister. Tilpass normaliserRegister().`);
  }
  return null;
}

function safeCall(fn: (...args: unknown[]) => unknown): unknown {
  try {
    return fn();
  } catch {
    return null;
  }
}
