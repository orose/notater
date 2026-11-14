import { EventEmitter } from 'node:events';
import { describe, expect, it } from 'vitest';
import { NotATerminalError, SEQ, openTerminalSession, type ExitSignal, type ProcessHooks } from './index';

function fakeTerminal(isTTY = true) {
  const written: string[] = [];
  const rawModes: boolean[] = [];
  const input = Object.assign(new EventEmitter(), {
    isTTY,
    setRawMode: (m: boolean) => rawModes.push(m),
    resume: () => undefined,
    pause: () => undefined,
  });
  const output = Object.assign(new EventEmitter(), { isTTY, columns: 120, rows: 36, write: (s: string) => written.push(s) });
  const signals = new Map<string, () => void>();
  let fatal: ((e: unknown) => void) | null = null;
  let exit: (() => void) | null = null;
  const hooks: ProcessHooks = {
    onSignal: (s: ExitSignal, l) => (signals.set(s, l), () => signals.delete(s)),
    onFatal: (l) => ((fatal = l), () => (fatal = null)),
    onExit: (l) => ((exit = l), () => (exit = null)),
    writeSync: (s) => written.push(s),
  };
  const aborts: number[] = [];
  const open = () => openTerminalSession({ input, output, hooks, onAbort: (code) => aborts.push(code) });
  return { open, written, rawModes, signals, aborts, fatal: () => fatal, exit: () => exit };
}

const RESTORE_TAIL = `${SEQ.cursorShow}${SEQ.altScreenOff}`;

describe('terminaløkt (AK-3-11)', () => {
  it('går inn i alternativ buffer med skjult markør og raw mode, og gjenoppretter ved close', () => {
    const t = fakeTerminal();
    const session = t.open();
    expect(t.written[0]).toContain(SEQ.altScreenOn);
    expect(t.written[0]).toContain(SEQ.cursorHide);
    expect(t.rawModes).toEqual([true]);
    expect(session.size()).toEqual({ cols: 120, rows: 36 });
    session.close();
    session.close();
    expect(t.written.at(-1)?.endsWith(RESTORE_TAIL)).toBe(true);
    expect(t.rawModes).toEqual([true, false]);
    expect(t.written.filter((w) => w.includes(SEQ.altScreenOff))).toHaveLength(1);
  });

  it('gjenoppretter ved SIGTERM og ved ukjent feil, og melder exit-kode', () => {
    const t = fakeTerminal();
    t.open();
    t.signals.get('SIGTERM')?.();
    expect(t.written.at(-1)?.endsWith(RESTORE_TAIL)).toBe(true);
    expect(t.aborts).toEqual([143]);

    const u = fakeTerminal();
    u.open();
    u.fatal()?.(new Error('boom'));
    expect(u.written.at(-1)?.endsWith(RESTORE_TAIL)).toBe(true);
    expect(u.aborts).toEqual([1]);
  });

  it('slår av kitty-tastaturet ved avslutning når det var på', () => {
    const t = fakeTerminal();
    const session = t.open();
    session.enableKittyKeys();
    t.exit()?.();
    expect(t.written.at(-1)?.startsWith(SEQ.kittyKeysPop)).toBe(true);
  });

  it('nekter å starte uten TTY', () => {
    expect(() => fakeTerminal(false).open()).toThrow(NotATerminalError);
  });
});
