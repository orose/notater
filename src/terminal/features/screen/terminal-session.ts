// Terminalhygiene (ADR-011 §3, AK-3-11): alternativ skjermbuffer, skjult markør, raw mode – og gjenoppretting
// uansett hvordan prosessen slutter (normal avslutning, `q`/Esc/Ctrl c, SIGTERM/SIGHUP, ukjent feil).
//
// Rekkefølgen er bindende: inn = raw mode → alternativ buffer → skjul markør → autowrap av → bracketed paste →
// (kitty-tastatur, hvis støttet); ut = samme i omvendt rekkefølge. Gjenopprettingen skrives SYNKRONT
// (`writeSync`), så den også kommer ut fra `uncaughtException` og `exit`, der asynkrone skriv går tapt.
// Alt mot prosessen injiseres (strømmer, signaler, writeSync), så økten testes uten ekte terminal.

export const SEQ = {
  altScreenOn: '\x1b[?1049h',
  altScreenOff: '\x1b[?1049l',
  cursorHide: '\x1b[?25l',
  cursorShow: '\x1b[?25h',
  autowrapOff: '\x1b[?7l',
  autowrapOn: '\x1b[?7h',
  pasteOn: '\x1b[?2004h',
  pasteOff: '\x1b[?2004l',
  /** Kitty-tastaturprotokollen, flagg 1 (disambiguate): Esc og Ctrl-taster blir entydige (Ghostty). */
  kittyKeysPush: '\x1b[>1u',
  kittyKeysPop: '\x1b[<u',
  /** Spør om kitty-protokollen og send DA1 etterpå: kommer `CSI ? flagg u` før DA1-svaret, støttes den. */
  kittyKeysQuery: '\x1b[?u\x1b[c',
  reset: '\x1b[0m',
  clear: '\x1b[2J',
} as const;

export interface TtyInput {
  readonly isTTY?: boolean;
  setRawMode?(mode: boolean): unknown;
  setEncoding?(encoding: 'utf8'): unknown;
  on(event: 'data', listener: (chunk: string) => void): unknown;
  off(event: 'data', listener: (chunk: string) => void): unknown;
  resume(): unknown;
  pause(): unknown;
}

export interface TtyOutput {
  readonly isTTY?: boolean;
  readonly columns?: number;
  readonly rows?: number;
  write(data: string): unknown;
  on(event: 'resize', listener: () => void): unknown;
  off(event: 'resize', listener: () => void): unknown;
}

export type ExitSignal = 'SIGTERM' | 'SIGHUP' | 'SIGINT';

/** Prosessen slik økten ser den. I produksjon: `process` + `fs.writeSync(1, …)`. */
export interface ProcessHooks {
  onSignal(signal: ExitSignal, listener: () => void): () => void;
  onFatal(listener: (error: unknown) => void): () => void;
  onExit(listener: () => void): () => void;
  writeSync(data: string): void;
}

export interface TerminalSize {
  readonly cols: number;
  readonly rows: number;
}

export interface TerminalSession {
  size(): TerminalSize;
  write(data: string): void;
  onData(listener: (chunk: string) => void): () => void;
  onResize(listener: (size: TerminalSize) => void): () => void;
  /** Slår på kitty-tastaturprotokollen etter at spørringen er besvart (ADR-011 §6). */
  enableKittyKeys(): void;
  /** Gjenoppretter terminalen. Idempotent; kalles også av signal-, feil- og exit-krokene. */
  close(): void;
  readonly closed: boolean;
}

export interface SessionOptions {
  readonly input: TtyInput;
  readonly output: TtyOutput;
  readonly hooks: ProcessHooks;
  /** Kalles etter gjenoppretting ved signal eller ukjent feil (exit-kode). */
  readonly onAbort: (code: number, error?: unknown) => void;
}

export class NotATerminalError extends Error {
  override readonly name = 'NotATerminalError';
}

export function openTerminalSession(options: SessionOptions): TerminalSession {
  const { input, output, hooks } = options;
  if (!input.isTTY || !output.isTTY || !input.setRawMode) {
    throw new NotATerminalError('Presentasjonen må kjøres i en terminal (stdin og stdout må være en TTY).');
  }
  let closed = false;
  let kitty = false;
  const unsubscribe: Array<() => void> = [];

  const restoreSequence = () => `${kitty ? SEQ.kittyKeysPop : ''}${SEQ.pasteOff}${SEQ.autowrapOn}${SEQ.reset}${SEQ.cursorShow}${SEQ.altScreenOff}`;

  const close = () => {
    if (closed) return;
    closed = true;
    try {
      hooks.writeSync(restoreSequence());
    } finally {
      input.setRawMode?.(false);
      input.pause();
      for (const off of unsubscribe.splice(0)) off();
    }
  };

  input.setRawMode(true);
  input.setEncoding?.('utf8');
  hooks.writeSync(`${SEQ.altScreenOn}${SEQ.cursorHide}${SEQ.autowrapOff}${SEQ.pasteOn}${SEQ.clear}`);
  input.resume();

  for (const signal of ['SIGTERM', 'SIGHUP', 'SIGINT'] as const) {
    unsubscribe.push(
      hooks.onSignal(signal, () => {
        close();
        options.onAbort(signal === 'SIGINT' ? 130 : signal === 'SIGTERM' ? 143 : 129);
      }),
    );
  }
  unsubscribe.push(
    hooks.onFatal((error) => {
      close();
      options.onAbort(1, error);
    }),
  );
  // Siste skanse: `process.exit()` fra hvor som helst.
  unsubscribe.push(hooks.onExit(close));

  return {
    size: () => ({ cols: output.columns ?? 80, rows: output.rows ?? 24 }),
    write: (data) => {
      if (!closed) output.write(data);
    },
    onData: (listener) => {
      input.on('data', listener);
      return () => input.off('data', listener);
    },
    onResize: (listener) => {
      const handler = () => listener({ cols: output.columns ?? 80, rows: output.rows ?? 24 });
      output.on('resize', handler);
      return () => output.off('resize', handler);
    },
    enableKittyKeys: () => {
      if (closed || kitty) return;
      kitty = true;
      output.write(SEQ.kittyKeysPush);
    },
    close,
    get closed() {
      return closed;
    },
  };
}
