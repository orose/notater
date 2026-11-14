// Komposisjonsroten for `npm run present` (ADR-011 §2, §7). Argumenter → konfig → økt (alternativ buffer,
// oppstartsskjerm) → indeks og Shiki parallelt → notatoppslag eller notatliste → kortstokk → første lysbilde.
// Taster går gjennom dekoderen til notatlisten eller til katalogens tastaturmotor (flaten «terminal»); live
// endringer gir ny kortstokk med samme lysbilde. Alt mot prosessen injiseres, så kjøringen testes uten terminal.

import type { NoteDocument } from '../../shared/api-types';
import type { HeadingLevel } from '../../core/presentation';
import type { AppConfig, ConfigSources, VaultConfig } from '../../server/features/config';
import { ConfigError, resolveConfig } from '../../server/features/config';
import { detectCapabilities, type TerminalCapabilities } from '../features/capabilities';
import { renderFrame, textWidth, writeText, type Frame } from '../features/cells';
import { PRESENT_USAGE, PresentArgsError, parsePresentArgs, type PresentArgs } from '../features/cli-args';
import { EMPTY_LINE, commandLineKey, insertText, lineOptions, paintCommandError, paintCommandLine, resolveLine, type CommandLineState } from '../features/command-line';
import type { ArgumentError } from '../../core/commands';
import { TERMINAL_CONTEXT, createTerminalKeys, type ColorChoice, type TerminalKeys } from '../features/commands';
import { createKeyDecoder, type DecodedKey, type DecoderTimers } from '../features/keys';
import { createPicker, pickerKey, pickerPaste, pickerRows, pickerView, type PickerState } from '../features/note-picker';
import { helpView, isTooSmall, overviewView, startupView, tooSmallView, type StartupProgress } from '../features/overlays';
import { NotATerminalError, SEQ, openTerminalSession, type ProcessHooks, type TerminalSession, type TerminalSize, type TtyInput, type TtyOutput } from '../features/screen';
import { currentSlide, goTo, levelsOf, rebuild, startPresent, step, toggleBlackout, type DeckFitter, type PresentState } from '../features/session';
import { createTerminalFitter, scrollInfo, slideView } from '../features/slides';
import { DEFAULT_PALETTE, PALETTES, createTheme, isPalette, modeFromOsc11, type PaletteName, type TerminalTheme, type ThemeMode } from '../features/theme';
import { resolveSlide, type DraftFit } from '../../core/presentation';
import { createFrame } from '../features/cells';
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
  | { readonly kind: 'missing'; readonly docPath: string };

/** Spør etter terminalens bakgrunnsfarge (svaret leses av dekoderen som `reply`). */
const OSC11_QUERY = '\u001b]11;?\u001b\\';

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
  if (args.palette !== null && !isPalette(args.palette)) {
    env.stderr(`E475: Ukjent palett «${args.palette}». Gyldige paletter: ${PALETTES.join(', ')}.\n`);
    return Promise.resolve(2);
  }
  const palette: PaletteName = args.palette ?? DEFAULT_PALETTE;
  // PO-132: terminalens eget fargetema er standard; våre paletter er opt-in (`--palett`, `--farger palett`).
  const colors: ColorChoice = args.colors === 'terminal' ? 'terminal' : args.palette !== null || args.colors === 'palett' ? 'palett' : 'terminal';

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
    const app = createApp({ env, args, vaultConfig, capabilities, palette, colors, session, finish });
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
  readonly palette: PaletteName;
  readonly colors: ColorChoice;
  readonly session: TerminalSession;
  readonly finish: (code: number, error?: unknown, message?: string) => void;
}

type Overlay =
  | { readonly kind: 'overview'; readonly cursor: number }
  | { readonly kind: 'help' }
  | { readonly kind: 'command'; readonly line: CommandLineState }
  | { readonly kind: 'error'; readonly error: ArgumentError };

/** Hvor lenge en bekreftelse står nederst (designsystem-terminal §5.3 og §5.6). */
const NOTICE_MS = 2000;
const LONG_NOTICE_MS = 4000;

function createApp({ env, args, vaultConfig, capabilities, palette: initialPalette, colors: initialColors, session, finish }: AppDeps) {
  let screen: Screen = { kind: 'startup', progress: { done: 0, total: null } };
  let shown: Frame | null = null;
  let scheduled = false;
  let firstSlideDrawn = false;
  let vault: TerminalVault | null = null;
  let overlay: Overlay | null = null;
  let notice: string | null = null;
  let noticeTimer: unknown = null;
  /** Rulleposisjon per lysbilde-id i økten (ADR-011 §4). */
  const scrolls = new Map<string, number>();
  // «system»: lys eller mørk fra terminalens bakgrunn (OSC 11), ellers mørk (AR-3-11).
  let mode: ThemeMode = 'dark';
  let palette: PaletteName = initialPalette;
  let colors: ColorChoice = initialColors;
  /** Fargedybden miljøet tåler for paletten (uten `--farger`). */
  const paletteDepth = detectCapabilities(env.config.env, null).depth;
  const depth = () => (colors === 'terminal' ? (capabilities.depth === 'none' ? 'none' : 'ansi16') : paletteDepth);
  let theme: TerminalTheme = createTheme(palette, mode, depth());
  const retheme = () => {
    theme = createTheme(palette, mode, depth());
    shown = null;
    redraw();
  };
  /** PO-117: vaultmappens navn, eller `obsidianVault` fra konfigen. */
  const obsidianVault = vaultConfig.obsidianVault ?? vaultConfig.root.split(/[\\/]/).filter(Boolean).pop() ?? vaultConfig.name;
  const options = { level: (typeof args.level === 'number' ? args.level : null) as HeadingLevel | null, transitions: args.transitions };

  // Tilpasning (A2) per størrelse; cachen deles, nøkkelen har med størrelsen (ADR-011 §4).
  const fitCache = new Map<string, DraftFit>();
  let fitterSize = '';
  let fitter: DeckFitter = createTerminalFitter(80, 24, fitCache);
  const currentFitter = (): DeckFitter => {
    const { cols, rows } = session.size();
    if (`${cols}x${rows}` !== fitterSize) {
      fitterSize = `${cols}x${rows}`;
      fitter = createTerminalFitter(Math.max(cols, 80), Math.max(rows, 24), fitCache);
    }
    return fitter;
  };

  const showNotice = (text: string, ms = NOTICE_MS) => {
    notice = text;
    if (noticeTimer !== null) env.timers.clearTimeout(noticeTimer);
    noticeTimer = env.timers.setTimeout(() => {
      notice = null;
      noticeTimer = null;
      redraw();
    }, ms);
    redraw();
  };

  const slideCtx = (state: PresentState) => ({ deck: state.deck, doc: state.doc, theme, obsidianVault });

  const commands = () => keys.registry.commands.filter((c) => c.inPalette !== false && c.id !== 'palette.commands');

  const view = (size: TerminalSize): Frame => {
    if (isTooSmall(size)) return tooSmallView(size, theme);
    switch (screen.kind) {
      case 'startup':
        return startupView(size, screen.progress, theme);
      case 'picker':
        return pickerView(screen.picker, size.cols, size.rows, { vaultName: vaultConfig.name, theme });
      case 'missing':
        return missingView(size, theme);
      case 'present': {
        const state = screen.state;
        if (overlay?.kind === 'overview') return overviewView(state.deck, state.index, overlay.cursor, size.cols, size.rows, theme);
        const slide = currentSlide(state);
        let frame = slideView(slideCtx(state), state.index, size.cols, size.rows, { blackout: state.blackout, scroll: slide ? (scrolls.get(slide.id) ?? 0) : 0, notice });
        if (overlay?.kind === 'help') frame = helpView(frame, theme);
        else if (overlay?.kind === 'command') frame = paintCommandLine(frame, theme, overlay.line, lineOptions(commands(), TERMINAL_CONTEXT, overlay.line.text));
        else if (overlay?.kind === 'error') frame = paintCommandError(frame, theme, overlay.error);
        return frame;
      }
    }
  };

  const missingView = (size: TerminalSize, t: TerminalTheme): Frame => {
    const frame = createFrame(size.cols, size.rows, t.style());
    const y = Math.floor(size.rows / 2) - 1;
    const line1 = 'Notatet finnes ikke lenger';
    const line2 = 'Det vises igjen hvis det kommer tilbake.  q avslutter';
    writeText(frame, Math.max(0, Math.floor((size.cols - textWidth(line1)) / 2)), y, line1, t.style({ bold: true }));
    writeText(frame, Math.max(0, Math.floor((size.cols - textWidth(line2)) / 2)), y + 2, line2, t.style({ fg: 'dempet' }));
    return frame;
  };

  const draw = () => {
    scheduled = false;
    if (session.closed) return;
    const next = view(session.size());
    session.write(renderFrame(shown, next, { depth: theme.depth, hyperlinks: capabilities.hyperlinks }));
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
    if (noticeTimer !== null) env.timers.clearTimeout(noticeTimer);
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

  /** Ny kortstokk med samme lysbilde; melding hvis lysbildet ble borte (live, §5.6). */
  const rebuildDeck = (change: Parameters<typeof rebuild>[1]) => {
    if (screen.kind !== 'present') return;
    const before = currentSlide(screen.state);
    const previousDeck = screen.state.deck;
    const state = rebuild(screen.state, change, currentFitter());
    screen = { ...screen, state };
    const after = currentSlide(state);
    const reason = before ? resolveSlide(state.deck.slides, before.id, previousDeck.slides).reason : 'exact';
    if (change.doc && after && reason !== 'exact' && reason !== 'base') {
      showNotice(`Lysbildet finnes ikke lenger. Du står ved «${after.heading ?? state.deck.title}».`, LONG_NOTICE_MS);
    }
    redraw();
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
      scroll: (direction) => {
        if (screen.kind !== 'present') return;
        const slide = currentSlide(screen.state);
        if (!slide) return;
        const { cols, rows } = session.size();
        const { max, step: by } = scrollInfo(slideCtx(screen.state), screen.state.index, cols, rows);
        const now = scrolls.get(slide.id) ?? 0;
        const next = Math.max(0, Math.min(max, now + direction * by));
        if (next !== now) {
          scrolls.set(slide.id, next);
          redraw();
        }
      },
      toggleOverview: () => {
        if (screen.kind !== 'present') return;
        overlay = overlay?.kind === 'overview' ? null : { kind: 'overview', cursor: screen.state.index };
        redraw();
      },
      openCommandLine: () => {
        overlay = { kind: 'command', line: EMPTY_LINE };
        redraw();
      },
      openHelp: () => {
        overlay = { kind: 'help' };
        redraw();
      },
      setLevel: (level) => {
        options.level = level === 'auto' ? null : (level as HeadingLevel);
        rebuildDeck({ options: { ...options } });
      },
      levels: () => (screen.kind === 'present' ? levelsOf(screen.state.doc) : []),
      slideLevel: () => (screen.kind === 'present' ? screen.state.deck.slideLevel : null),
      setTransitions: (on) => {
        options.transitions = on;
        rebuildDeck({ options: { ...options } });
      },
      transitions: () => options.transitions,
      setPalette: (name) => {
        if (!isPalette(name)) return;
        palette = name;
        colors = 'palett';
        retheme();
        showNotice(`Palett ${name}`);
      },
      palettes: () => PALETTES.map((p) => ({ value: p, label: p, current: colors === 'palett' && p === palette })),
      setColors: (choice) => {
        colors = choice;
        retheme();
        showNotice(choice === 'terminal' ? 'Terminalens egne farger' : `Palett ${palette}`);
      },
      colors: () => colors,
      setMode: (next) => {
        mode = next === 'toggle' ? (mode === 'dark' ? 'light' : 'dark') : next;
        retheme();
      },
      mode: () => mode,
      notice: (message) => showNotice(message),
    },
    env.timers,
    (reason) => showNotice(reason),
  );

  const isQuitKey = (key: DecodedKey) => key.key === 'q' || key.key === 'Escape' || (key.ctrlKey && key.key === 'c');

  const runLine = (line: CommandLineState) => {
    const resolution = resolveLine(commands(), TERMINAL_CONTEXT, line);
    if (resolution.kind === 'complete') {
      overlay = { kind: 'command', line: { text: resolution.text, cursor: [...resolution.text].length, selected: 0 } };
    } else if (resolution.kind === 'error') overlay = { kind: 'error', error: resolution.error };
    else {
      overlay = null;
      void resolution.command.run(TERMINAL_CONTEXT, resolution.args);
    }
    redraw();
  };

  const onOverlayKey = (key: DecodedKey): boolean => {
    if (!overlay || screen.kind !== 'present') return false;
    if (key.ctrlKey && key.key === 'c' && overlay.kind !== 'command') {
      quit();
      return true;
    }
    switch (overlay.kind) {
      case 'error':
        // Neste tast fjerner meldingen og brukes ikke til noe annet (§5.3).
        overlay = null;
        break;
      case 'help':
        if (key.key === '?' || key.key === 'Escape' || key.key === 'q') overlay = null;
        break;
      case 'overview': {
        const count = screen.state.deck.slides.length;
        const move = (to: number) => (overlay = { kind: 'overview', cursor: Math.max(0, Math.min(count - 1, to)) });
        const cursor = overlay.cursor;
        if (key.key === 'Escape' || key.key === 'o') overlay = null;
        else if (key.key === 'j' || key.key === 'ArrowDown' || key.key === 'l' || key.key === 'ArrowRight') move(cursor + 1);
        else if (key.key === 'k' || key.key === 'ArrowUp' || key.key === 'h' || key.key === 'ArrowLeft') move(cursor - 1);
        else if (key.key === 'G') move(count - 1);
        else if (key.key === 'g') move(0);
        else if (key.key === 'PageDown') move(cursor + 10);
        else if (key.key === 'PageUp') move(cursor - 10);
        else if (key.key === 'Enter') {
          updatePresent((s) => goTo(s, cursor));
          overlay = null;
        }
        break;
      }
      case 'command': {
        const optionCount = lineOptions(commands(), TERMINAL_CONTEXT, overlay.line.text).length;
        const outcome = commandLineKey(overlay.line, key, optionCount);
        if (outcome.kind === 'close') overlay = null;
        else if (outcome.kind === 'enter') {
          runLine(overlay.line);
          return true;
        } else overlay = { kind: 'command', line: outcome.state };
        break;
      }
    }
    redraw();
    return true;
  };

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
    if (onOverlayKey(key)) return;
    if (screen.kind === 'present') {
      if (notice) {
        notice = null;
        redraw();
      }
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
      } else if (input.kind === 'paste' && overlay?.kind === 'command') {
        overlay = { kind: 'command', line: insertText(overlay.line, input.text) };
        redraw();
      } else if (input.kind === 'reply' && isKittyReply(input.sequence)) session.enableKittyKeys();
      else if (input.kind === 'reply') {
        const detected = modeFromOsc11(input.sequence);
        if (detected && detected !== mode) {
          mode = detected;
          retheme();
        }
      }
    },
  });
  session.onData((chunk) => decoder.feed(chunk));
  session.onResize(() => {
    // Ny størrelse: ny tilpasning (samme lysbilde, `resolveSlide`) og full omtegning (AK-3-07).
    shown = null;
    if (screen.kind === 'present' && !isTooSmall(session.size())) rebuildDeck({});
    redraw();
  });
  // Kitty-tastaturet (ADR-011 §6): svarer terminalen på `CSI ?u` før DA1, slås det på.
  session.write(`${OSC11_QUERY}${SEQ.kittyKeysQuery}`);
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
    screen = { kind: 'present', docPath, state: startPresent(doc, { ...options }, currentFitter()) };
    redraw();
  };

  /** Live (AK-3-10, ADR-011 §7): samme vei på nytt; omdøping følges, sletting gir melding. */
  let lastState: PresentState | null = null;
  const onChange = async (changes: readonly { type: string; path: string; from?: string }[]): Promise<void> => {
    if (screen.kind !== 'present' && screen.kind !== 'missing') return;
    let docPath = screen.docPath;
    const renamed = changes.find((c) => c.type === 'renamed' && c.from === docPath);
    if (renamed) docPath = renamed.path;
    const doc: NoteDocument | null = await vault!.document(docPath);
    if (screen.kind !== 'present' && screen.kind !== 'missing') return;
    if (!doc) {
      if (screen.kind === 'present') lastState = screen.state;
      overlay = null;
      screen = { kind: 'missing', docPath };
      redraw();
      return;
    }
    if (screen.kind === 'missing') {
      const previous = lastState;
      screen = { kind: 'present', docPath, state: previous ? rebuild(previous, { doc }, currentFitter()) : startPresent(doc, { ...options }, currentFitter()) };
      redraw();
      return;
    }
    screen = { ...screen, docPath };
    rebuildDeck({ doc });
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
