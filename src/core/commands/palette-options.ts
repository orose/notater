// Valgene i paletten i kommandomodus (F5, ADR-007 §4). Ren TS: testbar uten DOM.

import { formatKeySequence, parseKeySequence, type LabelPlatform } from '../keyboard';
import type { CommandContext } from './command-context';
import { PALETTE_GROUP_ORDER, type ArgumentError, type ArgumentSpec } from './command-types';
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

function prefixMatch(query: string, candidate: string): ReturnType<typeof fuzzyMatch> {
  const q = normalizeForSearch(query.trim());
  const c = normalizeForSearch(candidate);
  if (!c.startsWith(q)) return null;
  return { score: q.length === c.length ? 1000 : 500 + q.length, ranges: q.length > 0 ? [[0, q.length]] : [] };
}

/** Handlerens forklaring når argumentet ikke treffer noen verdi (S4), ellers null (generell E475). */
export function paletteArgumentError(commands: readonly Command[], ctx: CommandContext, query: string): ArgumentError | null {
  const target = argumentTarget(commands, query);
  if (!target || target.rest === '' || argumentOptions(target, ctx).length > 0) return null;
  return target.command.argumentError(ctx, target.argument.name, target.rest);
}

/** Underlistens overskrift når inndata er en argumentkommando (`tema …`), ellers null. */
export function paletteArgumentHeading(commands: readonly Command[], query: string): { readonly ex: string; readonly label: string } | null {
  const target = argumentTarget(commands, query);
  return target ? { ex: target.command.aliases[0] ?? target.command.name, label: target.argument.label } : null;
}

function argumentOptions(target: ArgumentTarget, ctx: CommandContext): PaletteArgumentOption[] {
  const { command, argument, rest } = target;
  const availability = command.isEnabled(ctx);
  const values = command.argumentValues(ctx, argument.name);
  const scored = values.flatMap((value, index) => {
    const candidates = [value.label, value.value, ...(value.aliases ?? [])];
    const matches = candidates.map((c) => (argument.match === 'prefix' ? prefixMatch(rest, c) : fuzzyMatch(rest, c)));
    const score = Math.max(...matches.map((m) => m?.score ?? -1));
    if (score < 0) return [];
    const option: PaletteArgumentOption = {
      kind: 'argument',
      commandId: command.id,
      commandName: command.name,
      ex: command.aliases[0] ?? command.name,
      argument: argument.name,
      argumentLabel: argument.label,
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
 * Kommandoene som passer `query` (inndata uten `:`), best først. Tom spørring gir alle, gruppert i
 * `PALETTE_GROUP_ORDER` (katalogrekkefølge innen gruppe).
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

  const empty = query.trim() === '';
  const scored = commands.flatMap((command, index) => {
    if (command.inPalette === false) return [];
    const nameMatch = fuzzyMatch(query, command.name);
    // Eksakt alias slår alt (`:fold` → «Fold/utfold seksjonen», ikke «Fold alle»).
    let ex = command.aliases[0] ?? command.name;
    let exHighlights: PaletteCommandOption['exHighlights'] = [];
    let aliasScore = -1;
    for (const alias of command.aliases) {
      const m = fuzzyMatch(query, alias);
      if (!m) continue;
      const score = m.score + (m.score === 1000 ? 1 : 0);
      if (score > aliasScore) {
        aliasScore = score;
        ex = alias;
        exHighlights = m.ranges;
      }
    }
    const score = Math.max(nameMatch?.score ?? -1, aliasScore);
    if (score < 0) return [];
    const availability = command.isEnabled(ctx);
    const argument = command.args?.[0];
    const option: PaletteCommandOption = {
      kind: 'command',
      commandId: command.id,
      name: command.name,
      description: command.description,
      group: command.group,
      ex,
      exHighlights: empty ? [] : exHighlights,
      argumentLabel: argument ? argument.label.toLowerCase() : null,
      state: command.state(ctx),
      shortcut: shortcutChords(command, platform),
      enabled: availability.enabled,
      reason: availability.enabled ? null : availability.reason,
      needsArgument: argument !== undefined && argument.optional !== true,
      completion: argument !== undefined && argument.optional !== true ? `${command.aliases[0] ?? command.name} ` : null,
      highlights: nameMatch?.ranges ?? [],
    };
    const order = empty ? PALETTE_GROUP_ORDER.indexOf(command.group) * 1000 + index : index;
    return [{ option, score, order }];
  });
  return scored.sort((a, b) => b.score - a.score || a.order - b.order).map((s) => s.option);
}
