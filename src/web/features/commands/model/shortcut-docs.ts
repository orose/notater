// `?`-oversikten og README-avsnittet genereres fra samme funksjon (F6, AK-1.1-07). Ren TS.

import { formatKeySequence, parseKeySequence, type LabelPlatform } from '../../keyboard';
import { COMMAND_CATALOG, KEY_HINTS } from './catalog';
import { catalogBindings } from './registry';
import { COMMAND_GROUPS, GROUP_LABELS, type CommandGroup, type CommandSpecBody } from './command-types';

export interface ShortcutRow {
  /** Kommando- eller hint-id (stabil, brukes som React-nøkkel og i tester). */
  readonly id: string;
  /** `command` = kommando i registeret; `hint` = tast en komponent håndterer selv (KEY_HINTS). */
  readonly kind: 'command' | 'hint';
  /** Ferdig formaterte tastevarianter, f.eks. `['⌘K', '/']`. */
  readonly keys: readonly string[];
  /** Samme varianter, én etikett per akkord (`[['Space', 'w']]`), til én `<kbd>` per tast. */
  readonly chords: ReadonlyArray<readonly string[]>;
  readonly label: string;
  /** Én setning om hva som skjer (kommandoens beskrivelse); tom for tastehint. */
  readonly description: string;
}

export interface ShortcutGroup {
  readonly group: CommandGroup;
  readonly label: string;
  readonly rows: readonly ShortcutRow[];
  /** `:`-ord for kommandoene i gruppen som ikke har taster («Bare som kommando: :tema …»). */
  readonly commandOnly: readonly string[];
}

function variant(keys: string, platform: LabelPlatform): { keys: string; chords: string[] } {
  const sequence = parseKeySequence(keys);
  return { keys: formatKeySequence(sequence, platform), chords: sequence.map((chord) => formatKeySequence([chord], platform)) };
}

/** Alle normal-modus-bindinger + tastehint, gruppert i fast rekkefølge. Kommandoer uten taster utelates. */
export function shortcutGroups(platform: LabelPlatform): ShortcutGroup[] {
  const bindings = catalogBindings().filter((b) => b.mode === 'normal');
  return COMMAND_GROUPS.map((group) => {
    const rows: ShortcutRow[] = [];
    const commandOnly: string[] = [];
    for (const [id, raw] of Object.entries(COMMAND_CATALOG)) {
      const spec: CommandSpecBody = raw;
      if (spec.group !== group) continue;
      const variants = bindings.filter((b) => b.commandId === id).map((b) => variant(b.keys, platform));
      if (variants.length > 0) {
        rows.push({
          id,
          kind: 'command',
          keys: variants.map((v) => v.keys),
          chords: variants.map((v) => v.chords),
          label: spec.name,
          description: spec.description,
        });
      } else {
        commandOnly.push(spec.aliases[0] ?? spec.name);
      }
    }
    for (const hint of KEY_HINTS) {
      if (hint.group !== group) continue;
      const variants = hint.keys.map((k) => variant(k, platform));
      rows.push({ id: hint.id, kind: 'hint', keys: variants.map((v) => v.keys), chords: variants.map((v) => v.chords), label: hint.description, description: '' });
    }
    return { group, label: GROUP_LABELS[group], rows, commandOnly };
  }).filter((g) => g.rows.length > 0);
}

/**
 * Markdown til README mellom `<!-- hurtigtaster:start -->` og `<!-- hurtigtaster:end -->`: én tabell med
 * én rad per kommando (gruppen står på første rad i hver gruppe), og tastehintene som liste under.
 */
export function renderShortcutsMarkdown(groups: readonly ShortcutGroup[]): string {
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
      if (row.kind === 'hint') {
        hints.push(`- ${row.keys.map(code).join(', ')}: ${row.label}`);
        continue;
      }
      table.push(`| ${first ? g.label : ''} | ${row.keys.map(code).join(', ')} | ${cell(row.label)} |`);
      first = false;
    }
  }
  const parts = [table.join('\n')];
  if (hints.length > 0) parts.push(['Taster i paletten, base-fanene og hopp-lenken (håndteres av komponentene selv):', '', ...hints].join('\n'));
  return parts.join('\n\n');
}

export const README_MARKERS = { start: '<!-- hurtigtaster:start -->', end: '<!-- hurtigtaster:end -->' } as const;
