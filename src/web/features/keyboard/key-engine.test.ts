import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  SEQUENCE_TIMEOUT_MS,
  WHICH_KEY_DELAY_MS,
  createKeyEngine,
  type EngineBinding,
  type EngineKeymap,
  type KeyEngineState,
} from './key-engine';

function b(commandId: string, keys: string, extra: Partial<EngineBinding> = {}): EngineBinding {
  return { commandId, chords: keys.split(' '), repeat: false, inTextFields: false, ...extra };
}

const KEYMAP: EngineKeymap = {
  normal: [
    b('scroll.down', 'j', { repeat: true }),
    b('scroll.top', 'g g'),
    b('scroll.bottom', 'G'),
    b('fold.toggle', 'z a'),
    b('fold.all', 'z M'),
    b('width', 'Space w'),
    b('zen', 'Space z'),
    b('mode', 'Space m'),
    b('mode', 'Mod+.', { inTextFields: true }),
    b('search', 'Mod+k', { inTextFields: true }),
    b('escape', 'Escape'),
  ],
};

const plain = { repeat: false, typing: false };

describe('createKeyEngine', () => {
  let ran: string[];
  let states: KeyEngineState[];

  beforeEach(() => {
    vi.useFakeTimers();
    ran = [];
    states = [];
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function engine(keymap: EngineKeymap = KEYMAP) {
    return createKeyEngine({
      keymap,
      timers: { setTimeout: (cb, ms) => setTimeout(cb, ms), clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>) },
      onCommand: (id) => ran.push(id),
      onStateChange: (s) => states.push(s),
    });
  }

  it('starter i normal-modus uten påbegynt sekvens (P3)', () => {
    expect(engine().getState()).toEqual({ mode: 'normal', pending: null });
  });

  it('enkelttast kjører kommandoen med én gang', () => {
    const e = engine();
    expect(e.handle(['j'], plain)).toEqual({ kind: 'handled', commandId: 'scroll.down' });
    expect(e.handle(['G'], plain)).toEqual({ kind: 'handled', commandId: 'scroll.bottom' });
    expect(ran).toEqual(['scroll.down', 'scroll.bottom']);
  });

  it('ukjent tast uten påbegynt sekvens er unhandled (nettleseren får den)', () => {
    const e = engine();
    expect(e.handle(['q'], plain)).toEqual({ kind: 'unhandled' });
    expect(e.handle([], plain)).toEqual({ kind: 'unhandled' });
    expect(ran).toEqual([]);
  });

  it('sekvens: g venter, g g kjører', () => {
    const e = engine();
    expect(e.handle(['g'], plain)).toEqual({ kind: 'pending' });
    expect(e.getState().pending?.chords).toEqual(['g']);
    expect(e.handle(['g'], plain)).toEqual({ kind: 'handled', commandId: 'scroll.top' });
    expect(e.getState().pending).toBeNull();
    expect(ran).toEqual(['scroll.top']);
  });

  it('ukjent fortsettelse avbryter sekvensen og kjører ingenting (z x, g q)', () => {
    const e = engine();
    e.handle(['z'], plain);
    expect(e.handle(['x'], plain)).toEqual({ kind: 'cancelled' });
    e.handle(['g'], plain);
    expect(e.handle(['j'], plain)).toEqual({ kind: 'cancelled' });
    expect(e.getState().pending).toBeNull();
    expect(ran).toEqual([]);
  });

  it('Esc avbryter en påbegynt sekvens uten å kjøre Esc-kommandoen', () => {
    const e = engine();
    e.handle(['g'], plain);
    expect(e.handle(['Escape'], plain)).toEqual({ kind: 'cancelled' });
    expect(e.handle(['g'], plain)).toEqual({ kind: 'pending' });
    expect(ran).toEqual([]);
  });

  it('Esc uten påbegynt sekvens kjører Esc-kommandoen', () => {
    const e = engine();
    expect(e.handle(['Escape'], plain)).toEqual({ kind: 'handled', commandId: 'escape' });
  });

  it('tidsavbrudd: sekvensen forlates etter SEQUENCE_TIMEOUT_MS', () => {
    const e = engine();
    e.handle(['g'], plain);
    vi.advanceTimersByTime(SEQUENCE_TIMEOUT_MS - 1);
    expect(e.getState().pending).not.toBeNull();
    vi.advanceTimersByTime(1);
    expect(e.getState().pending).toBeNull();
    expect(e.handle(['g'], plain)).toEqual({ kind: 'pending' });
    expect(ran).toEqual([]);
  });

  it('leader: Space venter; which-key etter WHICH_KEY_DELAY_MS med fortsettelsene', () => {
    const e = engine();
    expect(e.handle(['Space'], plain)).toEqual({ kind: 'pending' });
    expect(e.getState().pending?.showHints).toBe(false);
    expect(e.getState().pending?.continuations).toEqual([
      { chord: 'w', commandId: 'width' },
      { chord: 'z', commandId: 'zen' },
      { chord: 'm', commandId: 'mode' },
    ]);
    vi.advanceTimersByTime(WHICH_KEY_DELAY_MS);
    expect(e.getState().pending?.showHints).toBe(true);
    expect(states.at(-1)?.pending?.showHints).toBe(true);
  });

  it('mens which-key vises, løper ikke tidsavbruddet', () => {
    const e = engine();
    e.handle(['Space'], plain);
    vi.advanceTimersByTime(SEQUENCE_TIMEOUT_MS * 5);
    expect(e.getState().pending?.showHints).toBe(true);
    expect(e.handle(['w'], plain)).toEqual({ kind: 'handled', commandId: 'width' });
    expect(e.getState().pending).toBeNull();
  });

  it('rask Space w kjører uten å vise which-key', () => {
    const e = engine();
    e.handle(['Space'], plain);
    vi.advanceTimersByTime(100);
    e.handle(['w'], plain);
    vi.advanceTimersByTime(WHICH_KEY_DELAY_MS * 2);
    expect(states.some((s) => s.pending?.showHints)).toBe(false);
    expect(ran).toEqual(['width']);
  });

  it('which-key vises bare for leader, ikke for g/z', () => {
    const e = engine();
    e.handle(['z'], plain);
    vi.advanceTimersByTime(WHICH_KEY_DELAY_MS + 10);
    expect(e.getState().pending?.showHints).toBe(false);
  });

  it('auto-repetisjon: bare bindinger med repeat (j) gjentas; andre undertrykkes uten å endre tilstand', () => {
    const e = engine();
    expect(e.handle(['j'], { repeat: true, typing: false })).toEqual({ kind: 'handled', commandId: 'scroll.down' });
    expect(e.handle(['G'], { repeat: true, typing: false })).toEqual({ kind: 'suppressed' });
    e.handle(['Space'], plain);
    // Holdt Space gir repeat-hendelser: leader skal ikke avbrytes av dem.
    expect(e.handle(['Space'], { repeat: true, typing: false })).toEqual({ kind: 'suppressed' });
    expect(e.getState().pending?.chords).toEqual(['Space']);
    expect(ran).toEqual(['scroll.down']);
  });

  it('i tekstfelt matches bare bindinger med inTextFields (P7)', () => {
    const e = engine();
    const typing = { repeat: false, typing: true };
    expect(e.handle(['j'], typing)).toEqual({ kind: 'unhandled' });
    expect(e.handle(['g'], typing)).toEqual({ kind: 'unhandled' });
    expect(e.handle(['Space'], typing)).toEqual({ kind: 'unhandled' });
    expect(e.getState().pending).toBeNull();
    expect(e.handle(['Ctrl+k', 'Mod+k'], typing)).toEqual({ kind: 'handled', commandId: 'search' });
    expect(ran).toEqual(['search']);
  });

  it('flere kandidater: første som treffer vinner (Ctrl+k → Mod+k)', () => {
    const e = engine();
    expect(e.handle(['Ctrl+.', 'Mod+.'], plain)).toEqual({ kind: 'handled', commandId: 'mode' });
  });

  it('cancel() avbryter påbegynt sekvens og skjuler which-key', () => {
    const e = engine();
    e.handle(['Space'], plain);
    vi.advanceTimersByTime(WHICH_KEY_DELAY_MS);
    e.cancel();
    expect(e.getState().pending).toBeNull();
    expect(states.at(-1)?.pending).toBeNull();
    vi.advanceTimersByTime(SEQUENCE_TIMEOUT_MS);
    expect(e.handle(['w'], plain)).toEqual({ kind: 'unhandled' });
  });

  it('setKeymap bytter tastaturkart og avbryter påbegynt sekvens', () => {
    const e = engine();
    e.handle(['g'], plain);
    e.setKeymap({ normal: [b('other', 'g')] });
    expect(e.getState().pending).toBeNull();
    expect(e.handle(['g'], plain)).toEqual({ kind: 'handled', commandId: 'other' });
  });

  it('setMode endrer modus og avbryter påbegynt sekvens', () => {
    const e = engine();
    e.handle(['g'], plain);
    e.setMode('normal');
    expect(e.getState()).toEqual({ mode: 'normal', pending: null });
  });

  it('dispose stopper tidtakerne', () => {
    const e = engine();
    e.handle(['Space'], plain);
    const before = states.length;
    e.dispose();
    vi.advanceTimersByTime(SEQUENCE_TIMEOUT_MS * 2);
    expect(states.length).toBe(before);
  });

  it('en kommando som kaster, etterlater ingen påbegynt sekvens', () => {
    const e = createKeyEngine({
      keymap: KEYMAP,
      timers: { setTimeout: (cb, ms) => setTimeout(cb, ms), clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>) },
      onCommand: () => {
        throw new Error('bom');
      },
    });
    e.handle(['g'], plain);
    expect(() => e.handle(['g'], plain)).toThrow('bom');
    expect(e.getState().pending).toBeNull();
  });
});
