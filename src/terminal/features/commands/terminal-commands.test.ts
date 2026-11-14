import { describe, expect, it } from 'vitest';
import type { DecodedKey } from '../keys';
import { NOT_IN_TERMINAL, createTerminalKeys, terminalHandlers, type TerminalActions } from './terminal-commands';

const k = (key: string, mods: Partial<DecodedKey> = {}): DecodedKey => ({ key, ctrlKey: false, altKey: false, metaKey: false, shiftKey: false, ...mods });
const timers = { setTimeout: (cb: () => void, ms: number) => setTimeout(cb, ms), clearTimeout: (h: unknown) => clearTimeout(h as NodeJS.Timeout) };

function setup() {
  const calls: string[] = [];
  const names = ['next', 'previous', 'first', 'last', 'toggleBlackout', 'escape', 'stop', 'toggleOverview', 'openCommandLine', 'openHelp'];
  const actions = {
    ...Object.fromEntries(names.map((n) => [n, () => calls.push(n)])),
    scroll: (d: number) => calls.push(d > 0 ? 'scrollDown' : 'scrollUp'),
    setLevel: (l: unknown) => calls.push(`level:${String(l)}`),
    levels: () => [{ level: 2, agendaLevel: null, slides: 5 }, { level: 3, agendaLevel: 2, slides: 9 }],
    slideLevel: () => 3,
    setTransitions: (on: boolean) => calls.push(`transitions:${on}`),
    transitions: () => true,
    setPalette: (p: string) => calls.push(`palette:${p}`),
    palettes: () => [{ value: 'fosfor', label: 'fosfor' }],
    setColors: (c: string) => calls.push(`colors:${c}`),
    colors: () => 'terminal',
    setMode: (m: string) => calls.push(`mode:${m}`),
    mode: () => 'dark',
    notice: (m: string) => calls.push(`notice:${m}`),
  } as unknown as TerminalActions;
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

  it('lese-kommandoene har den felles «ikke tilgjengelig»-handleren', () => {
    const handlers = terminalHandlers({} as TerminalActions);
    const ctx = { mode: 'present' } as never;
    expect(handlers['scroll.down'].isEnabled?.(ctx)).toEqual({ enabled: false, reason: NOT_IN_TERMINAL });
  });

  it('o, :, ?, ↑ og ↓ når oversikt, kommandolinje, hjelp og rulling', () => {
    const { calls, keys } = setup();
    for (const key of ['o', ':', '?', 'ArrowDown', 'ArrowUp']) keys.handle(k(key));
    expect(calls).toEqual(['toggleOverview', 'openCommandLine', 'openHelp', 'scrollDown', 'scrollUp']);
  });

  it(':presenter, :agenda, :palett og :farger kjører med argument; ugyldig nivå gir E475/E486', () => {
    const { calls, keys } = setup();
    const cmd = (id: string) => keys.registry.commands.find((c) => c.id === id)!;
    const ctx = { mode: 'present' } as never;
    void cmd('present.start').run(ctx, { nivå: 'h2' });
    void cmd('present.agenda').run(ctx, { verdi: 'av' });
    void cmd('theme.setPalette').run(ctx, { palette: 'papir' });
    void cmd('terminal.colors').run(ctx, { farger: 'palett' });
    expect(calls).toEqual(['level:2', 'notice:Lysbildenivå h2 · ikke lagret', 'transitions:false', 'notice:Overganger av · huskes ikke', 'palette:papir', 'colors:palett']);
    expect(cmd('present.start').argumentError(ctx, 'nivå', 'h9')?.code).toBe('E475');
    expect(cmd('present.start').argumentError(ctx, 'nivå', 'h5')?.code).toBe('E486');
    expect(cmd('present.start').argumentValues(ctx, 'nivå').map((v) => v.value)).toEqual(['auto', 'h2', 'h3']);
  });
});
