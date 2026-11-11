import { describe, expect, it, vi } from 'vitest';
import { createKeyDecoder, type TerminalInput } from './index';

function setup() {
  const inputs: TerminalInput[] = [];
  vi.useFakeTimers();
  const decoder = createKeyDecoder({
    onInput: (i) => inputs.push(i),
    timers: { setTimeout: (cb, ms) => setTimeout(cb, ms), clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>) },
  });
  const keys = () => inputs.flatMap((i) => (i.kind === 'key' ? [`${i.key.ctrlKey ? 'C-' : ''}${i.key.altKey ? 'A-' : ''}${i.key.shiftKey ? 'S-' : ''}${i.key.key}`] : []));
  return { decoder, inputs, keys };
}

describe('tastedekoder (ADR-011 §6)', () => {
  it('gir tegn, store bokstaver med shift og norske tegn som de er', () => {
    const { decoder, keys } = setup();
    decoder.feed('jG: ?ø');
    expect(keys()).toEqual(['j', 'S-G', ':', 'Space', '?', 'ø']);
  });

  it('tolker Ctrl c, Enter og Backspace fra C0-kontrolltegn', () => {
    const { decoder, keys } = setup();
    decoder.feed('\x03\r\x7f');
    expect(keys()).toEqual(['C-c', 'Enter', 'Backspace']);
  });

  it('tolker piler, PageUp/PageDown og modifikatorer i CSI og SS3', () => {
    const { decoder, keys } = setup();
    decoder.feed('\x1b[A\x1bOB\x1b[5~\x1b[6~\x1b[1;5C');
    expect(keys()).toEqual(['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'C-ArrowRight']);
  });

  it('tolker CSI u (kitty-protokollen i Ghostty), også Esc og Ctrl c', () => {
    const { decoder, keys } = setup();
    decoder.feed('\x1b[27u\x1b[99;5u\x1b[103;2u');
    expect(keys()).toEqual(['Escape', 'C-c', 'S-G']);
  });

  it('venter på resten av en delt sekvens, og tolker ensom ESC som Escape etter tidsavbruddet', () => {
    const { decoder, keys } = setup();
    decoder.feed('\x1b[');
    decoder.feed('D');
    expect(keys()).toEqual(['ArrowLeft']);
    decoder.feed('\x1b');
    expect(keys()).toEqual(['ArrowLeft']);
    vi.advanceTimersByTime(40);
    expect(keys()).toEqual(['ArrowLeft', 'Escape']);
    vi.useRealTimers();
  });

  it('skiller ut lim inn og svar fra terminalen', () => {
    const { decoder, inputs, keys } = setup();
    decoder.feed('\x1b[200~uke 45\x1b[201~\x1b[?1u\x1b]11;rgb:1a1a/1717/1212\x07q');
    expect(inputs.filter((i) => i.kind !== 'key')).toEqual([
      { kind: 'paste', text: 'uke 45' },
      { kind: 'reply', sequence: '\x1b[?1u' },
      { kind: 'reply', sequence: '\x1b]11;rgb:1a1a/1717/1212\x07' },
    ]);
    expect(keys()).toEqual(['q']);
  });
});
