// Valgene i paletten i kommandomodus (F5, ADR-007 §4). Ren TS: testbar uten DOM.

import { formatKeySequence, parseKeySequence, type LabelPlatform } from '../../keyboard';
import type { CommandContext } from './command-context';
import type { ArgumentSpec } from './command-types';
import { fuzzyMatch, normalizeForSearch } from './fuzzy';
import type { PaletteArgumentOption, PaletteCommandOption, PaletteOption } from './palette-types';
import type { Command } from './registry';

/** Første normal-modus-binding, én etikett per akkord. */
export function shortcutChords(command: Command, platform: Exclude<LabelPlatform, 'docs'>): readonly string[] | null {
  const first = command.bindings.normal?.[0];
  if (!first) return null;
  return parseKeySequence(first.keys).map((chord) => formatKeySequence([chord], platform));
}

function words(command: Command): string[] {
  return [command.name, ...command.aliases];
}

interface ArgumentTarget {
  readonly command: Command;
  readonly argument: ArgumentSpec;
  readonly rest: string;
}

/** `tema ter` → kommandoen med aliaset/navnet `tema` og resten `ter`. Lengste ord vinner. */
function argumentTarget(commands: readonly Command[], query: string): ArgumentTarget | null {
  const q = normalizeForSearch(query.trimStart());
  let best: ArgumentTarget | null = null;
  let bestLength = -1;
  for (const command of commands) {
    const argument = command.args?.[0];
    if (!argument || command.inPalette === false) continue;
    for (const word of words(command)) {
      const w = normalizeForSearch(word);
      if (q.startsWith(`${w} `) && w.length > bestLength) {
        best = { command, argument, rest: query.trimStart().slice(word.length + 1).trim() };
        bestLength = w.length;
      }
    }
  }
  return best;
}

function argumentOptions(target: ArgumentTarget, ctx: CommandContext): PaletteArgumentOption[] {
  const { command, argument, rest } = target;
  const availability = command.isEnabled(ctx);
  const values = command.argumentValues(ctx, argument.name);
  const scored = values.flatMap((value, index) => {
    const candidates = [value.label, value.value, ...(value.aliases ?? [])];
    const matches = candidates.map((c) => fuzzyMatch(rest, c));
    const score = Math.max(...matches.map((m) => m?.score ?? -1));
    if (score < 0) return [];
    const option: PaletteArgumentOption = {
      kind: 'argument',
      commandId: command.id,
      commandName: command.name,
      argument: argument.name,
      value,
      current: value.current ?? false,
      enabled: availability.enabled,
      reason: availability.enabled ? null : availability.reason,
      highlights: matches[0]?.ranges ?? [],
    };
    return [{ option, score, index }];
  });
  return scored.sort((a, b) => b.score - a.score || a.index - b.index).map((s) => s.option);
}

/**
 * Kommandoene som passer `query` (inndata uten `:`), best først; tom spørring gir katalogrekkefølge.
 * `tema …` (et ord for en argumentkommando + mellomrom) gir argumentets verdier som underliste.
 */
export function commandPaletteOptions(
  commands: readonly Command[],
  ctx: CommandContext,
  query: string,
  platform: Exclude<LabelPlatform, 'docs'>,
): PaletteOption[] {
  const target = argumentTarget(commands, query);
  if (target) return argumentOptions(target, ctx);

  const scored = commands.flatMap((command, index) => {
    if (command.inPalette === false) return [];
    const nameMatch = fuzzyMatch(query, command.name);
    // Eksakt alias slår alt (`:fold` → «Fold/utfold seksjonen», ikke «Fold alle»).
    const aliasScores = command.aliases.map((alias) => {
      const m = fuzzyMatch(query, alias);
      return m ? m.score + (m.score === 1000 ? 1 : 0) : -1;
    });
    const score = Math.max(nameMatch?.score ?? -1, ...aliasScores);
    if (score < 0) return [];
    const availability = command.isEnabled(ctx);
    const argument = command.args?.[0];
    const option: PaletteCommandOption = {
      kind: 'command',
      commandId: command.id,
      name: command.name,
      description: command.description,
      group: command.group,
      shortcut: shortcutChords(command, platform),
      enabled: availability.enabled,
      reason: availability.enabled ? null : availability.reason,
      needsArgument: argument !== undefined,
      completion: argument !== undefined ? `${command.aliases[0] ?? command.name} ` : null,
      highlights: nameMatch?.ranges ?? [],
    };
    return [{ option, score, index }];
  });
  return scored.sort((a, b) => b.score - a.score || a.index - b.index).map((s) => s.option);
}
