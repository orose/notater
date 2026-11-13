import { describe, expect, it } from 'vitest';
import type { DecodedKey } from '../keys';
import { COMING_LATER, NOT_IN_TERMINAL, createTerminalKeys, terminalHandlers, type TerminalActions } from './terminal-commands';

const k = (key: string, mods: Partial<DecodedKey> = {}): DecodedKey => ({ key, ctrlKey: false, altKey: false, metaKey: false, shiftKey: false, ...mods });
const timers = { setTimeout: (cb: () => void, ms: number) => setTimeout(cb, ms), clearTimeout: (h: unknown) => clearTimeout(h as NodeJS.Timeout) };

function setup() {
  const calls: string[] = [];
  const actions: TerminalActions = Object.fromEntries(['next', 'previous', 'first', 'last', 'toggleBlackout', 'escape', 'stop'].map((n) => [n, () => calls.push(n)])) as unknown as TerminalActions;
  const notices: string[] = [];
  const keys = createTerminalKeys(actions, timers, (r) => notices.push(r));
  return { calls, notices, keys };
}

describe('taster i terminalen (ADR-011 §6, AK-3-08)', () => {
  it('v2-present-tastene: neste, forrige, gg, G, b og .', () => {
    const { calls, keys } = setup();
    for (const key of ['j', 'ArrowRight', 'n', ' ', 'PageDown']) keys.handle(k(key));
    for (const key of ['k', 'ArrowLeft', 'p', 'PageUp']) keys.handle(k(key));
    keys.handle(k('g'));
    keys.handle(k('g'));
    keys.handle(k('G', { shiftKey: true }));
    keys.handle(k('b'));
    keys.handle(k('.'));
    expect(calls).toEqual([...Array(5).fill('next'), ...Array(4).fill('previous'), 'first', 'last', 'toggleBlackout', 'toggleBlackout']);
  });

  it('q, Ctrl c og Esc', () => {
    const { calls, keys } = setup();
    keys.handle(k('q'));
    keys.handle(k('c', { ctrlKey: true }));
    keys.handle(k('Escape'));
    expect(calls).toEqual(['stop', 'stop', 'escape']);
  });

  it('g Esc avbryter sekvensen uten å avslutte', () => {
    const { calls, keys } = setup();
    keys.handle(k('g'));
    expect(keys.handle(k('Escape')).kind).toBe('cancelled');
    expect(calls).toEqual([]);
  });

  it('lese-kommandoer har den felles «ikke tilgjengelig»-handleren; kommende kommandoer sier fra', () => {
    const handlers = terminalHandlers({} as TerminalActions);
    const ctx = { mode: 'present' } as never;
    expect(handlers['scroll.down'].isEnabled?.(ctx)).toEqual({ enabled: false, reason: NOT_IN_TERMINAL });
    const { notices, keys } = setup();
    keys.handle(k('o'));
    expect(notices).toEqual([COMING_LATER]);
  });
});
