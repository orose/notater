// Komposisjonsroten for `npm run present` (ADR-011 §2). SKJELETT: argumenter, konfigurasjon, terminalhygiene,
// tastedekoding og diff-tegning er ekte; indeks, rendering, lysbilder og tastaturmotor kobles på i slice 3-a
// (se ADR-011 §1 og §7 for rekkefølgen). Alt mot prosessen injiseres, så kjøringen kan testes uten terminal.

import type { AppConfig, ConfigSources } from '../../server/features/config';
import { ConfigError, resolveConfig } from '../../server/features/config';
import { PRESENT_USAGE, PresentArgsError, parsePresentArgs, type PresentArgs } from '../features/cli-args';
import { DEFAULT_COLOR, createFrame, renderFrame, textWidth, writeText, type CellStyle, type Frame } from '../features/cells';
import { createKeyDecoder, type DecoderTimers } from '../features/keys';
import { NotATerminalError, openTerminalSession, type ProcessHooks, type TerminalSize, type TtyInput, type TtyOutput } from '../features/screen';

/** Minste terminalstørrelse (v3 «Tilpasning», AK-3-11). */
export const MIN_SIZE: TerminalSize = { cols: 80, rows: 24 };

export interface PresentEnvironment {
  readonly argv: readonly string[];
  readonly config: Omit<ConfigSources, 'argv'>;
  readonly input: TtyInput;
  readonly output: TtyOutput;
  readonly hooks: ProcessHooks;
  readonly timers: DecoderTimers;
  readonly stderr: (text: string) => void;
}

const TEXT: CellStyle = { fg: DEFAULT_COLOR, bg: DEFAULT_COLOR };
const MUTED: CellStyle = { ...TEXT, dim: true };
const STRONG: CellStyle = { ...TEXT, bold: true };

function centered(frame: Frame, y: number, text: string, style: CellStyle): void {
  writeText(frame, Math.max(0, Math.floor((frame.cols - textWidth(text)) / 2)), y, text, style);
}

/** Plassholderskjermen i skjelettet. Erstattes av lysbildetegningen (slice 3-a/3-b). */
export function stubFrame(size: TerminalSize, args: PresentArgs, vault: { readonly name: string; readonly root: string }): Frame {
  const frame = createFrame(size.cols, size.rows);
  if (size.cols < MIN_SIZE.cols || size.rows < MIN_SIZE.rows) {
    const mid = Math.floor(size.rows / 2);
    centered(frame, mid - 1, `Terminalen er for liten (${size.cols}×${size.rows}).`, STRONG);
    centered(frame, mid + 1, `Gjør vinduet minst ${MIN_SIZE.cols}×${MIN_SIZE.rows}, eller trykk q.`, MUTED);
    return frame;
  }
  const lines: Array<[string, CellStyle]> = [
    ['vault-leser · presentasjon i terminalen', STRONG],
    ['', TEXT],
    ['Skjelett (ADR-011). Lysbildene kommer i slice 3-a.', TEXT],
    ['', TEXT],
    [`Vault: ${vault.name} (${vault.root})`, MUTED],
    [`Notat: ${args.note ?? '(søkbar liste)'}`, MUTED],
    ['', TEXT],
    ['q  Esc  Ctrl c  avslutter', MUTED],
  ];
  const top = Math.floor((size.rows - lines.length) / 2);
  lines.forEach(([text, style], i) => centered(frame, top + i, text, style));
  writeText(frame, 1, size.rows - 1, `${size.cols}×${size.rows}`, MUTED);
  return frame;
}

function selectedVault(config: AppConfig) {
  return config.vaults.find((v) => v.id === config.defaultVaultId) ?? config.vaults[0] ?? null;
}

/** Kjører presentasjonen og løses med exit-koden. */
export function runPresent(env: PresentEnvironment): Promise<number> {
  let args: PresentArgs;
  let config: AppConfig;
  try {
    args = parsePresentArgs(env.argv);
    if (args.help) {
      env.stderr(`${PRESENT_USAGE}\n`);
      return Promise.resolve(0);
    }
    config = resolveConfig({ ...env.config, argv: args.configArgv });
  } catch (error) {
    if (error instanceof PresentArgsError) {
      env.stderr(`${error.message}\n`);
      return Promise.resolve(2);
    }
    if (error instanceof ConfigError) {
      env.stderr(`Konfigurasjonsfeil: ${error.message}\n`);
      return Promise.resolve(1);
    }
    throw error;
  }
  const vault = selectedVault(config);
  if (!vault) {
    env.stderr('Konfigurasjonen har ingen vault.\n');
    return Promise.resolve(1);
  }

  return new Promise<number>((resolve) => {
    let finished = false;
    const finish = (code: number, error?: unknown) => {
      if (finished) return;
      finished = true;
      if (error !== undefined) env.stderr(`Uventet feil: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`);
      resolve(code);
    };
    let session;
    try {
      session = openTerminalSession({ input: env.input, output: env.output, hooks: env.hooks, onAbort: finish });
    } catch (error) {
      if (!(error instanceof NotATerminalError)) throw error;
      env.stderr(`${error.message}\n`);
      resolve(1);
      return;
    }
    const s = session;
    let shown: Frame | null = null;
    const draw = () => {
      const next = stubFrame(s.size(), args, vault);
      s.write(renderFrame(shown, next, { depth: 'ansi16', hyperlinks: false }));
      shown = next;
    };
    const quit = () => {
      s.close();
      finish(0);
    };
    const decoder = createKeyDecoder({
      timers: env.timers,
      onInput: (input) => {
        if (input.kind !== 'key') return;
        const k = input.key;
        if (k.key === 'q' || k.key === 'Escape' || (k.ctrlKey && k.key === 'c')) quit();
      },
    });
    s.onData((chunk) => decoder.feed(chunk));
    s.onResize(() => {
      shown = null; // ny størrelse: tegn alt på nytt
      draw();
    });
    draw();
  });
}
