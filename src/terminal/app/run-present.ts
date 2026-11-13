// Komposisjonsroten for `npm run present` (ADR-011 §2, §7). Argumenter → konfig → økt (alternativ buffer,
// oppstartsskjerm) → indeks og Shiki parallelt → notatoppslag eller notatliste → kortstokk → første lysbilde.
// Taster går gjennom dekoderen til notatlisten eller til katalogens tastaturmotor (flaten «terminal»); live
// endringer gir ny kortstokk med samme lysbilde. Alt mot prosessen injiseres, så kjøringen testes uten terminal.

import type { NoteDocument } from '../../shared/api-types';
import type { HeadingLevel } from '../../core/presentation';
import type { AppConfig, ConfigSources, VaultConfig } from '../../server/features/config';
import { ConfigError, resolveConfig } from '../../server/features/config';
import { detectCapabilities, type TerminalCapabilities } from '../features/capabilities';
import { renderFrame, type Frame } from '../features/cells';
import { PRESENT_USAGE, PresentArgsError, parsePresentArgs, type PresentArgs } from '../features/cli-args';
import { createTerminalKeys, type TerminalKeys } from '../features/commands';
import { createKeyDecoder, type DecodedKey, type DecoderTimers } from '../features/keys';
import { createPicker, pickerKey, pickerPaste, pickerRows, pickerView, type PickerState } from '../features/note-picker';
import { isTooSmall, startupView, tooSmallView, type StartupProgress } from '../features/overlays';
import { NotATerminalError, SEQ, openTerminalSession, type ProcessHooks, type TerminalSession, type TerminalSize, type TtyInput, type TtyOutput } from '../features/screen';
import { goTo, levelsOf, rebuild, startPresent, step, toggleBlackout, type PresentState } from '../features/session';
import { plainSlideView } from '../features/slides';
import { openTerminalVault, type TerminalVault, type TerminalVaultOptions } from '../features/vault';

export { MIN_SIZE } from '../features/overlays';

export interface PresentEnvironment {
  readonly argv: readonly string[];
  readonly config: Omit<ConfigSources, 'argv'>;
  readonly input: TtyInput;
  readonly output: TtyOutput;
  readonly hooks: ProcessHooks;
  readonly timers: DecoderTimers;
  readonly stderr: (text: string) => void;
  /** Standard: `openTerminalVault` (worker-pool, chokidar). Tester bytter den ut. */
  readonly openVault?: (vault: VaultConfig, options: TerminalVaultOptions) => TerminalVault;
  /** Ekstra valg til vaultet (M2-bunten gir ferdig worker-kode). */
  readonly vaultOptions?: Omit<TerminalVaultOptions, 'onProgress'>;
}

/** Den eneste testkroken (ADR-011 §8, AR-3-30): kaster en feil etter første lysbilderamme. */
export const TEST_CRASH_ENV = 'VAULT_READER_TEST_CRASH';

type Screen =
  | { readonly kind: 'startup'; readonly progress: StartupProgress }
  | { readonly kind: 'picker'; readonly picker: PickerState }
  | { readonly kind: 'present'; readonly docPath: string; readonly state: PresentState }
  | { readonly kind: 'missing'; readonly docPath: string; readonly state: PresentState };

/** Svar på `CSI ?u`: `CSI ? flagg u` (kitty-tastaturet støttes). */
function isKittyReply(sequence: string): boolean {
  return sequence.startsWith('\u001b[?') && sequence.endsWith('u') && /^\d+$/.test(sequence.slice(3, -1));
}

function selectedVault(config: AppConfig) {
  return config.vaults.find((v) => v.id === config.defaultVaultId) ?? config.vaults[0] ?? null;
}

function levelText(levels: readonly number[]): string {
  if (levels.length === 0) return 'Notatet har ingen overskrifter.';
  const names = levels.map((l) => `h${l}`);
  return `Notatet har overskrifter på nivå ${names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} og ${names.at(-1)}`}.`;
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
  const vaultConfig = selectedVault(config);
  if (!vaultConfig) {
    env.stderr('Konfigurasjonen har ingen vault.\n');
    return Promise.resolve(1);
  }
  const capabilities = detectCapabilities(env.config.env, args.colors);

  return new Promise<number>((resolve) => {
    let finished = false;
    let vault: TerminalVault | null = null;
    const finish = (code: number, error?: unknown, message?: string) => {
      if (finished) return;
      finished = true;
      if (error !== undefined) env.stderr(`Uventet feil: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`);
      if (message) env.stderr(`${message}\n`);
      void vault?.close().catch(() => undefined);
      resolve(code);
    };
    let session: TerminalSession;
    try {
      session = openTerminalSession({ input: env.input, output: env.output, hooks: env.hooks, onAbort: finish });
    } catch (error) {
      if (!(error instanceof NotATerminalError)) throw error;
      env.stderr(`${error.message}\n`);
      resolve(1);
      return;
    }
    const app = createApp({ env, args, vaultConfig, capabilities, session, finish });
    try {
      vault = (env.openVault ?? openTerminalVault)(vaultConfig, { ...env.vaultOptions, onProgress: app.progress });
    } catch (error) {
      session.close();
      finish(1, error);
      return;
    }
    app.start(vault).catch((error: unknown) => {
      session.close();
      finish(1, undefined, `Kunne ikke starte presentasjonen: ${error instanceof Error ? error.message : String(error)}`);
    });
  });
}

interface AppDeps {
  readonly env: PresentEnvironment;
  readonly args: PresentArgs;
  readonly vaultConfig: VaultConfig;
  readonly capabilities: TerminalCapabilities;
  readonly session: TerminalSession;
  readonly finish: (code: number, error?: unknown, message?: string) => void;
}

function createApp({ env, args, vaultConfig, capabilities, session, finish }: AppDeps) {
  let screen: Screen = { kind: 'startup', progress: { done: 0, total: null } };
  let shown: Frame | null = null;
  let scheduled = false;
  let firstSlideDrawn = false;
  let vault: TerminalVault | null = null;
  const options = { level: (typeof args.level === 'number' ? args.level : null) as HeadingLevel | null, transitions: args.transitions };

  const view = (size: TerminalSize): Frame => {
    if (isTooSmall(size)) return tooSmallView(size);
    switch (screen.kind) {
      case 'startup':
        return startupView(size, screen.progress);
      case 'picker':
        return pickerView(screen.picker, size.cols, size.rows, { vaultName: vaultConfig.name });
      case 'present':
      case 'missing':
        return plainSlideView(screen.state.deck, screen.state.index, size.cols, size.rows, { blackout: screen.state.blackout });
    }
  };

  const draw = () => {
    scheduled = false;
    if (session.closed) return;
    const next = view(session.size());
    session.write(renderFrame(shown, next, { depth: capabilities.depth, hyperlinks: capabilities.hyperlinks }));
    shown = next;
    if (!firstSlideDrawn && screen.kind === 'present' && !isTooSmall(session.size())) {
      firstSlideDrawn = true;
      if (env.config.env[TEST_CRASH_ENV] === 'etter-første-ramme') {
        env.timers.setTimeout(() => {
          throw new Error(`Testkrok ${TEST_CRASH_ENV}: kastet etter første ramme`);
        }, 0);
      }
    }
  };
  /** Flere endringer i samme tikk gir én ramme (ADR-011 §3). */
  const redraw = () => {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(draw);
  };

  const quit = (code = 0, message?: string) => {
    keys.dispose();
    session.close();
    finish(code, undefined, message);
  };

  const updatePresent = (fn: (state: PresentState) => PresentState) => {
    if (screen.kind !== 'present') return;
    const state = fn(screen.state);
    if (state !== screen.state) {
      screen = { ...screen, state };
      redraw();
    }
  };

  const keys: TerminalKeys = createTerminalKeys(
    {
      next: () => updatePresent((s) => step(s, 1)),
      previous: () => updatePresent((s) => step(s, -1)),
      first: () => updatePresent((s) => goTo(s, 0)),
      last: () => updatePresent((s) => goTo(s, s.deck.slides.length - 1)),
      toggleBlackout: () => updatePresent(toggleBlackout),
      escape: () => {
        if (screen.kind === 'present' && screen.state.blackout) updatePresent(toggleBlackout);
        else quit();
      },
      stop: () => quit(),
    },
    env.timers,
  );

  const isQuitKey = (key: DecodedKey) => key.key === 'q' || key.key === 'Escape' || (key.ctrlKey && key.key === 'c');

  const onKey = (key: DecodedKey) => {
    // «For liten» (designsystem-terminal §5.7): bare avslutning virker; posisjonen beholdes.
    if (isTooSmall(session.size())) {
      if (isQuitKey(key)) quit();
      return;
    }
    if (screen.kind === 'picker') {
      const outcome = pickerKey(screen.picker, key, pickerRows(session.size().rows));
      if (outcome.kind === 'quit') quit();
      else if (outcome.kind === 'open') void present(outcome.docPath);
      else {
        screen = { kind: 'picker', picker: outcome.state };
        redraw();
      }
      return;
    }
    if (screen.kind === 'present') {
      keys.handle(key);
      return;
    }
    // Oppstart og «notatet finnes ikke lenger»: bare avslutning.
    if (isQuitKey(key)) quit();
  };

  const decoder = createKeyDecoder({
    timers: env.timers,
    onInput: (input) => {
      if (input.kind === 'key') onKey(input.key);
      else if (input.kind === 'paste' && screen.kind === 'picker') {
        screen = { kind: 'picker', picker: pickerPaste(screen.picker, input.text) };
        redraw();
      } else if (input.kind === 'reply' && isKittyReply(input.sequence)) session.enableKittyKeys();
    },
  });
  session.onData((chunk) => decoder.feed(chunk));
  session.onResize(() => {
    shown = null; // ny størrelse: tegn alt på nytt
    redraw();
  });
  // Kitty-tastaturet (ADR-011 §6): svarer terminalen på `CSI ?u` før DA1, slås det på.
  session.write(SEQ.kittyKeysQuery);
  draw();

  const present = async (docPath: string): Promise<void> => {
    const doc = await vault!.document(docPath);
    if (!doc) {
      quit(1, `Fant ikke notatet «${docPath}».`);
      return;
    }
    if (options.level !== null) {
      const valid = levelsOf(doc).map((l) => l.level);
      if (!valid.includes(options.level)) {
        quit(2, `E486: Ingen overskrifter på nivå h${options.level} i notatet. ${levelText(valid)}`);
        return;
      }
    }
    screen = { kind: 'present', docPath, state: startPresent(doc, options) };
    redraw();
  };

  /** Live (AK-3-10, ADR-011 §7): samme vei på nytt; omdøping følges, sletting gir melding. */
  const onChange = async (changes: readonly { type: string; path: string; from?: string }[]): Promise<void> => {
    if (screen.kind !== 'present' && screen.kind !== 'missing') return;
    let docPath = screen.docPath;
    const renamed = changes.find((c) => c.type === 'renamed' && c.from === docPath);
    if (renamed) docPath = renamed.path;
    const doc: NoteDocument | null = await vault!.document(docPath);
    if (screen.kind !== 'present' && screen.kind !== 'missing') return;
    if (!doc) {
      screen = { kind: 'missing', docPath, state: screen.state };
      redraw();
      return;
    }
    screen = { kind: 'present', docPath, state: rebuild(screen.state, { doc }) };
    redraw();
  };

  return {
    progress: (done: number, total: number) => {
      if (screen.kind !== 'startup') return;
      screen = { kind: 'startup', progress: { done, total } };
      redraw();
    },
    async start(opened: TerminalVault): Promise<void> {
      vault = opened;
      const state = await opened.ready();
      if (session.closed) return;
      opened.runtime.subscribe((event) => {
        void onChange(event.changes).catch(() => undefined);
      });
      if (args.note === null) {
        screen = { kind: 'picker', picker: createPicker(opened.notes(state)) };
        redraw();
        return;
      }
      const hit = opened.lookup(state, args.note);
      if (hit.kind === 'none') {
        quit(1, `Fant ikke notatet «${args.note}» i vaultet «${vaultConfig.name}».`);
        return;
      }
      if (hit.kind === 'list') {
        screen = { kind: 'picker', picker: createPicker(opened.notes(state), hit.query) };
        redraw();
        return;
      }
      await present(hit.docPath);
    },
  };
}
