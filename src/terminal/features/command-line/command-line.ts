// Kommandolinjen `:` (ADR-011 §6, designsystem-terminal §5.3): vim-lik linje nederst. Valgene kommer fra samme
// `commandPaletteOptions` og fuzzy som web-paletten; feilene har samme koder og tekster (E475/E486/E492, AR-3-24).

import {
  commandPaletteOptions,
  invalidArgumentError,
  paletteArgumentError,
  paletteArgumentHeading,
  unknownCommandError,
  type ArgumentError,
  type Command,
  type CommandContext,
  type PaletteOption,
} from '../../../core/commands';
import { graphemes } from '../cells';
import type { DecodedKey } from '../keys';

export interface CommandLineState {
  readonly text: string;
  /** Markøren som antall grafemer fra starten. */
  readonly cursor: number;
  readonly selected: number;
}

export const EMPTY_LINE: CommandLineState = { text: '', cursor: 0, selected: 0 };

export type LineKeyOutcome = { readonly kind: 'stay'; readonly state: CommandLineState } | { readonly kind: 'close' } | { readonly kind: 'enter' };

function edit(chars: string[], cursor: number): CommandLineState {
  return { text: chars.join(''), cursor: Math.max(0, Math.min(chars.length, cursor)), selected: 0 };
}

export function insertText(state: CommandLineState, text: string): CommandLineState {
  const chars = graphemes(state.text);
  const add = graphemes(text.replace(/[\r\n\t]+/g, ' '));
  chars.splice(state.cursor, 0, ...add);
  return edit(chars, state.cursor + add.length);
}

/** Ett tastetrykk på linjen. `optionCount` = antall valg i fullføringen (Tab/↑↓ flytter). */
export function commandLineKey(state: CommandLineState, key: DecodedKey, optionCount: number): LineKeyOutcome {
  const chars = graphemes(state.text);
  const stay = (s: CommandLineState): LineKeyOutcome => ({ kind: 'stay', state: s });
  if (key.key === 'Escape' || (key.ctrlKey && key.key === 'c')) return { kind: 'close' };
  if (key.key === 'Enter') return { kind: 'enter' };
  if (key.key === 'Backspace') {
    if (chars.length === 0) return { kind: 'close' };
    if (state.cursor === 0) return stay(state);
    chars.splice(state.cursor - 1, 1);
    return stay(edit(chars, state.cursor - 1));
  }
  if (key.key === 'Delete') {
    chars.splice(state.cursor, 1);
    return stay(edit(chars, state.cursor));
  }
  if (key.ctrlKey && key.key === 'u') return stay(EMPTY_LINE);
  if (key.ctrlKey && key.key === 'w') {
    const before = chars.slice(0, state.cursor).join('').replace(/\S*\s*$/u, '');
    const next = [...graphemes(before), ...chars.slice(state.cursor)];
    return stay(edit(next, graphemes(before).length));
  }
  if (key.key === 'ArrowLeft') return stay({ ...state, cursor: Math.max(0, state.cursor - 1) });
  if (key.key === 'ArrowRight') return stay({ ...state, cursor: Math.min(chars.length, state.cursor + 1) });
  if (key.key === 'Home' || (key.ctrlKey && key.key === 'a')) return stay({ ...state, cursor: 0 });
  if (key.key === 'End' || (key.ctrlKey && key.key === 'e')) return stay({ ...state, cursor: chars.length });
  const count = Math.max(1, optionCount);
  if (key.key === 'Tab' && !key.shiftKey) return stay({ ...state, selected: (state.selected + 1) % count });
  if (key.key === 'ArrowDown' || (key.ctrlKey && key.key === 'n')) return stay({ ...state, selected: (state.selected + 1) % count });
  if ((key.key === 'Tab' && key.shiftKey) || key.key === 'ArrowUp' || (key.ctrlKey && key.key === 'p')) return stay({ ...state, selected: (state.selected - 1 + count) % count });
  if (key.key === 'Space') return stay(insertText(state, ' '));
  if (!key.ctrlKey && !key.altKey && !key.metaKey && [...key.key].length === 1) return stay(insertText(state, key.key));
  return stay(state);
}

export type LineResolution =
  | { readonly kind: 'run'; readonly command: Command; readonly args: Readonly<Record<string, string>> }
  | { readonly kind: 'complete'; readonly text: string }
  | { readonly kind: 'error'; readonly error: ArgumentError };

export function lineOptions(commands: readonly Command[], ctx: CommandContext, text: string): PaletteOption[] {
  return commandPaletteOptions(commands, ctx, text, 'other').filter((o) => o.enabled || o.kind === 'argument');
}

/** Hva Enter gjør med linjen: kjør valgt kommando/verdi, fyll ut argumentet, eller vis feilen. */
export function resolveLine(commands: readonly Command[], ctx: CommandContext, state: CommandLineState): LineResolution {
  const text = state.text.trim();
  const options = lineOptions(commands, ctx, state.text);
  const option = options[Math.min(state.selected, options.length - 1)];
  if (!option) {
    const heading = paletteArgumentHeading(commands, state.text);
    if (heading) {
      const error = paletteArgumentError(commands, ctx, state.text);
      return { kind: 'error', error: error ?? invalidArgumentError(text.slice(heading.ex.length).trim()) };
    }
    return { kind: 'error', error: unknownCommandError(text) };
  }
  const command = commands.find((c) => c.id === option.commandId)!;
  if (option.kind === 'argument') return { kind: 'run', command, args: { [option.argument]: option.value.value } };
  if (option.needsArgument && option.completion) return { kind: 'complete', text: option.completion };
  if (!option.enabled) return { kind: 'error', error: { code: 'E475', title: `${option.name}: ${option.reason ?? 'kan ikke brukes nå'}.`, detail: '' } };
  return { kind: 'run', command, args: {} };
}
