// `?`-oversikten og README-avsnittet genereres fra samme funksjon (F6, AK-1.1-07). Ren TS.

import { formatKeySequence, parseKeySequence, type LabelPlatform } from '../../keyboard';
import { COMMAND_CATALOG, KEY_HINTS } from './catalog';
import { catalogBindings } from './registry';
import { COMMAND_GROUPS, GROUP_LABELS, type CommandGroup, type CommandSpecBody } from './command-types';

export interface ShortcutRow {
  /** Kommando- eller hint-id (stabil, brukes som React-nøkkel og i tester). */
  readonly id: string;
  /** Ferdig formaterte tastevarianter, f.eks. `['⌘K', '/']`. */
  readonly keys: readonly string[];
  readonly label: string;
}

export interface ShortcutGroup {
  readonly group: CommandGroup;
  readonly label: string;
  readonly rows: readonly ShortcutRow[];
}

/** Alle normal-modus-bindinger + tastehint, gruppert i fast rekkefølge. Kommandoer uten taster utelates. */
export function shortcutGroups(platform: LabelPlatform): ShortcutGroup[] {
  const bindings = catalogBindings().filter((b) => b.mode === 'normal');
  return COMMAND_GROUPS.map((group) => {
    const rows: ShortcutRow[] = [];
    for (const [id, raw] of Object.entries(COMMAND_CATALOG)) {
      const spec: CommandSpecBody = raw;
      if (spec.group !== group) continue;
      const keys = bindings.filter((b) => b.commandId === id).map((b) => formatKeySequence(parseKeySequence(b.keys), platform));
      if (keys.length > 0) rows.push({ id, keys, label: spec.name });
    }
    for (const hint of KEY_HINTS) {
      if (hint.group !== group) continue;
      rows.push({ id: hint.id, keys: hint.keys.map((k) => formatKeySequence(parseKeySequence(k), platform)), label: hint.description });
    }
    return { group, label: GROUP_LABELS[group], rows };
  }).filter((g) => g.rows.length > 0);
}

/** Markdown til README mellom `<!-- hurtigtaster:start -->` og `<!-- hurtigtaster:end -->`. */
export function renderShortcutsMarkdown(groups: readonly ShortcutGroup[]): string {
  const code = (k: string) => k.split(' / ').map((v) => `\`${v}\``).join(' / ');
  return groups
    .map((g) => [`#### ${g.label}`, '', '| Taster | Hva |', '|---|---|', ...g.rows.map((r) => `| ${r.keys.map(code).join(', ')} | ${r.label} |`)].join('\n'))
    .join('\n\n');
}

export const README_MARKERS = { start: '<!-- hurtigtaster:start -->', end: '<!-- hurtigtaster:end -->' } as const;
