import { describe, expect, it } from 'vitest';
import type { DecodedKey } from '../keys';
import { createTerminalKeys, TERMINAL_CONTEXT, type TerminalActions } from '../commands';
import { EMPTY_LINE, commandLineKey, insertText, lineOptions, resolveLine, type CommandLineState } from './command-line';

const k = (key: string, mods: Partial<DecodedKey> = {}): DecodedKey => ({ key, ctrlKey: false, altKey: false, metaKey: false, shiftKey: false, ...mods });
const timers = { setTimeout: (cb: () => void, ms: number) => setTimeout(cb, ms), clearTimeout: (h: unknown) => clearTimeout(h as NodeJS.Timeout) };
const actions = new Proxy({}, {
  get: (_t, name) => {
    if (name === 'levels') return () => [{ level: 2, agendaLevel: null, slides: 5 }, { level: 3, agendaLevel: 2, slides: 9 }];
    if (name === 'palettes') return () => ['papir', 'fosfor'].map((p) => ({ value: p, label: p }));
    if (name === 'colors') return () => 'terminal';
    if (name === 'transitions') return () => true;
    if (name === 'slideLevel') return () => 3;
    if (name === 'mode') return () => 'dark';
    return () => undefined;
  },
}) as TerminalActions;
const commands = createTerminalKeys(actions, timers).registry.commands.filter((c) => c.id !== 'palette.commands');
const line = (text: string): CommandLineState => ({ text, cursor: [...text].length, selected: 0 });
const resolve = (text: string) => resolveLine(commands, TERMINAL_CONTEXT, line(text));

describe(':-linjen (designsystem-terminal §5.3, AK-3-08)', () => {
  it('redigering: skriv, ←→, Backspace, Ctrl u/w; Backspace på tom linje lukker', () => {
    let s = insertText(EMPTY_LINE, 'agenda av');
    const step = (key: DecodedKey) => {
      const o = commandLineKey(s, key, 3);
      if (o.kind !== 'stay') throw new Error(o.kind);
      s = o.state;
    };
    step(k('Backspace'));
    expect(s.text).toBe('agenda a');
    step(k('w', { ctrlKey: true }));
    expect(s.text).toBe('agenda ');
    step(k('ArrowLeft'));
    step(k('x'));
    expect(s.text).toBe('agendax ');
    step(k('u', { ctrlKey: true }));
    expect(commandLineKey(s, k('Backspace'), 0)).toEqual({ kind: 'close' });
    expect(commandLineKey(s, k('Escape'), 0)).toEqual({ kind: 'close' });
    expect(commandLineKey(s, k('Enter'), 0)).toEqual({ kind: 'enter' });
  });

  it('kjører kommandoer med argument: :presenter h2, :agenda av, :palett papir, :farger palett, :q', () => {
    expect(resolve('presenter h2')).toMatchObject({ kind: 'run', args: { nivå: 'h2' } });
    expect(resolve('agenda av')).toMatchObject({ kind: 'run', args: { verdi: 'av' } });
    expect(resolve('palett papir')).toMatchObject({ kind: 'run', args: { palette: 'papir' } });
    expect(resolve('farger palett')).toMatchObject({ kind: 'run', args: { farger: 'palett' } });
    const q = resolve('q');
    expect(q.kind === 'run' && q.command.id).toBe('present.stop');
    expect(resolve('palett')).toEqual({ kind: 'complete', text: 'palett ' });
  });

  it('feil med vim-koder: E475 ugyldig nivå, E486 nivå som ikke finnes, E475 ukjent palett, E492 ukjent kommando', () => {
    expect(resolve('presenter h9')).toMatchObject({ kind: 'error', error: { code: 'E475' } });
    expect(resolve('presenter hx')).toMatchObject({ kind: 'error', error: { code: 'E475' } });
    expect(resolve('presenter h5')).toMatchObject({ kind: 'error', error: { code: 'E486' } });
    expect(resolve('palett regnbue')).toMatchObject({ kind: 'error', error: { code: 'E475', title: 'Ugyldig argument «regnbue».' } });
    expect(resolve('tull')).toMatchObject({ kind: 'error', error: { code: 'E492', title: 'Ingen kommando heter «tull».' } });
  });

  it('fullføringen viser kommandoene; lese-kommandoene fra web vises ikke', () => {
    const ids = lineOptions(commands, TERMINAL_CONTEXT, '').map((o) => o.commandId);
    expect(ids).toContain('present.start');
    expect(ids).not.toContain('view.toggleZen');
  });
});
