// `?`-oversikten og README-avsnittet genereres fra samme funksjon (F6, AK-1.1-07). Ren TS.
// Kommandoer med `pair` slås sammen til én rad («`j` / `k` Rull ned / opp», PO-69).

import { formatKeySequence, parseKeySequence, type KeyMode, type LabelPlatform } from '../keyboard';
import { COMMAND_CATALOG, KEY_HINTS, type CommandId } from './catalog';
import { catalogBindings } from './registry';
import { GROUP_LABELS, MODE_GROUP_ORDER, type CommandGroup, type CommandSpecBody, type Surface } from './command-types';

/** Én tastevariant: ferdig tekst (`⌘K`) og én etikett per akkord (`['Space', 'w']`). */
export interface ShortcutBinding {
  readonly keys: string;
  readonly chords: readonly string[];
}

/** Én kommando i en rad (en par-rad har to). */
export interface ShortcutCommand {
  readonly id: CommandId;
  readonly name: string;
  readonly bindings: readonly ShortcutBinding[];
}

export interface ShortcutRow {
  /** Første kommandos id, eller hint-id (stabil, brukes som React-nøkkel og i tester). */
  readonly id: string;
  /** `command` = kommando(er) i registeret; `hint` = tast en komponent håndterer selv (KEY_HINTS). */
  readonly kind: 'command' | 'hint';
  /** Kommandoene i raden (1 eller 2); tom for hint. */
  readonly commands: readonly ShortcutCommand[];
  /** Alle tastevarianter i raden, i rekkefølge (til README og hint). */
  readonly bindings: readonly ShortcutBinding[];
  /** Radnavnet: `pairName` for par, ellers kommandoens navn (hint: beskrivelsen). */
  readonly label: string;
  /** Kort undertekst (`short`), eller tom. */
  readonly description: string;
}

export interface ShortcutGroup {
  readonly group: CommandGroup;
  readonly label: string;
  readonly rows: readonly ShortcutRow[];
  /** `:`-ord for kommandoene i gruppen som ikke har taster («Bare som kommando: :tema …»). */
  readonly commandOnly: readonly string[];
}

function variant(keys: string, platform: LabelPlatform): ShortcutBinding {
  const sequence = parseKeySequence(keys);
  return { keys: formatKeySequence(sequence, platform), chords: sequence.map((chord) => formatKeySequence([chord], platform)) };
}

/**
 * Alle bindinger i modusen (par slått sammen) + tastehint, gruppert i fast rekkefølge. Standard: normal-modus.
 * `present` gir presentasjonsmodusens kort (`?` under presentasjon, README «I presentasjon», ADR-010 §3).
 * `surface` velger flatens kommandoer og taster (ADR-011 §6); standard er web (README og web-`?` er uendret).
 */
export function shortcutGroups(platform: LabelPlatform, mode: KeyMode = 'normal', surface: Surface = 'web'): ShortcutGroup[] {
  const bindings = catalogBindings(surface).filter((b) => b.mode === mode);
  const commandOf = (id: CommandId): ShortcutCommand => ({
    id,
    name: COMMAND_CATALOG[id].name,
    bindings: bindings.filter((b) => b.commandId === id).map((b) => variant(b.keys, platform)),
  });
  const paired = new Set<string>(Object.values(COMMAND_CATALOG).flatMap((spec: CommandSpecBody) => (spec.pair ? [spec.pair] : [])));

  return MODE_GROUP_ORDER[mode].map((group) => {
    const rows: ShortcutRow[] = [];
    const commandOnly: string[] = [];
    for (const [rawId, raw] of Object.entries(COMMAND_CATALOG)) {
      const id = rawId as CommandId;
      const spec: CommandSpecBody = raw;
      if (spec.group !== group || (spec.modes && !spec.modes.includes(mode)) || (spec.surfaces && !spec.surfaces.includes(surface))) continue;
      const first = commandOf(id);
      if (first.bindings.length === 0) {
        commandOnly.push(spec.aliases[0] ?? spec.name);
        continue;
      }
      if (paired.has(id)) continue;
      const commands = spec.pair ? [first, commandOf(spec.pair as CommandId)] : [first];
      rows.push({
        id,
        kind: 'command',
        commands,
        bindings: commands.flatMap((c) => c.bindings),
        label: spec.pair ? (spec.pairName ?? `${spec.name} / ${commands[1]?.name ?? ''}`) : spec.name,
        description: spec.short ?? '',
      });
    }
    for (const hint of KEY_HINTS) {
      if (hint.group !== group || !(hint.modes ?? ['normal']).includes(mode)) continue;
      rows.push({
        id: hint.id,
        kind: 'hint',
        commands: [],
        bindings: hint.keys.map((k) => variant(k, platform)),
        label: hint.description,
        description: '',
      });
    }
    return { group, label: GROUP_LABELS[group], rows, commandOnly };
  }).filter((g) => g.rows.length > 0);
}

/**
 * Markdown til README mellom `<!-- hurtigtaster:start -->` og `<!-- hurtigtaster:end -->`: én tabell med
 * de samme radene som `?`-kortet (par slått sammen, gruppen på første rad i hver gruppe), og tastehintene
 * som liste under.
 */
export function renderShortcutsMarkdown(
  groups: readonly ShortcutGroup[],
  hintsIntro = 'Taster i paletten, base-fanene og hopp-lenken (håndteres av komponentene selv):',
): string {
  const code = (k: string) =>
    k
      .split(' / ')
      .map((v) => `\`${v}\``)
      .join(' / ');
  const cell = (text: string) => text.replace(/\|/g, '\\|');
  const table = ['| Gruppe | Taster | Kommando |', '|---|---|---|'];
  const hints: string[] = [];
  for (const g of groups) {
    let first = true;
    for (const row of g.rows) {
      const keys = row.bindings.map((b) => code(b.keys)).join(', ');
      if (row.kind === 'hint') {
        hints.push(`- ${keys}: ${row.label}`);
        continue;
      }
      table.push(`| ${first ? g.label : ''} | ${keys} | ${cell(row.label)} |`);
      first = false;
    }
  }
  const parts = [table.join('\n')];
  if (hints.length > 0) parts.push([hintsIntro, '', ...hints].join('\n'));
  return parts.join('\n\n');
}

export const README_MARKERS = { start: '<!-- hurtigtaster:start -->', end: '<!-- hurtigtaster:end -->' } as const;

/** README-avsnittet «I presentasjon» (present-modus, ADR-010 §3). */
export const README_PRESENT_MARKERS = { start: '<!-- hurtigtaster-presentasjon:start -->', end: '<!-- hurtigtaster-presentasjon:end -->' } as const;
