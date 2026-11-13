// Terminalens evner fra miljøet (ADR-011 §3 «Terminalens evner», AR-3-11). Ren funksjon; første treff vinner.

import type { ColorDepth } from '../cells';
import type { ColorsArg } from '../cli-args';

export interface TerminalCapabilities {
  readonly depth: ColorDepth;
  /** OSC 8-hyperlenker. */
  readonly hyperlinks: boolean;
}

export type TerminalEnv = Readonly<Record<string, string | undefined>>;

const TRUECOLOR_TERMS = new Set(['xterm-ghostty', 'xterm-kitty']);
const KNOWN_PROGRAMS = new Set(['ghostty', 'iterm.app', 'wezterm']);

function knownTerminal(env: TerminalEnv): boolean {
  return TRUECOLOR_TERMS.has(env.TERM ?? '') || KNOWN_PROGRAMS.has((env.TERM_PROGRAM ?? '').toLowerCase());
}

function colorDepth(env: TerminalEnv, colors: ColorsArg | null): ColorDepth {
  if (colors === 'terminal') return 'ansi16';
  if (env.NO_COLOR !== undefined && env.NO_COLOR !== '') return 'none';
  if (/^(truecolor|24bit)$/i.test(env.COLORTERM ?? '') || knownTerminal(env)) return 'truecolor';
  if ((env.TERM ?? '').includes('256color')) return 'ansi256';
  return 'ansi16';
}

export function detectCapabilities(env: TerminalEnv, colors: ColorsArg | null): TerminalCapabilities {
  const vte = Number(env.VTE_VERSION ?? '0');
  return {
    depth: colorDepth(env, colors),
    hyperlinks: knownTerminal(env) || vte >= 5000 || env.WT_SESSION !== undefined,
  };
}
