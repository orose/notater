import { describe, expect, it } from 'vitest';
import { createFrame, frameToLines, graphemes, renderFrame, rgbTo256, textWidth, writeText, type CellStyle } from './index';

const RED: CellStyle = { fg: { kind: 'rgb', rgb: 0xff0000 }, bg: { kind: 'default' } };

describe('Unicode-bredde (ADR-011 §4)', () => {
  it('teller æøå, kombinerende tegn, emoji og CJK riktig', () => {
    expect(textWidth('Blåbærsyltetøy')).toBe(14);
    expect(textWidth('A\u0308')).toBe(1);
    expect(graphemes('A\u0308')).toHaveLength(1);
    expect(textWidth('🚀')).toBe(2);
    expect(textWidth('👩‍💻')).toBe(2);
    expect(textWidth('🇳🇴')).toBe(2);
    expect(textWidth('漢字')).toBe(4);
    expect(textWidth('한국어')).toBe(6);
  });

  it('regner rammetegn, blokktegn og tekstpresentert ⚠ som én celle, ⚠\ufe0f (VS16) som to', () => {
    expect(textWidth('┌─┬─┐│█▀▄')).toBe(9);
    expect(textWidth('⚠')).toBe(1);
    expect(textWidth('⚠\ufe0f')).toBe(2);
  });
});

describe('ramme', () => {
  it('skriver brede tegn som to celler og klipper uten halve tegn', () => {
    const frame = createFrame(5, 1);
    expect(writeText(frame, 0, 0, 'ab漢字', RED)).toBe(5);
    expect(frameToLines(frame)).toEqual(['ab漢']);
  });
});

describe('diff til ANSI', () => {
  it('tegner hele rammen første gang og bare endringene etterpå', () => {
    const a = createFrame(10, 2);
    writeText(a, 0, 0, 'hei', RED);
    const first = renderFrame(null, a, { depth: 'truecolor', hyperlinks: false });
    expect(first).toContain('\x1b[1;1H');
    expect(first).toContain('38;2;255;0;0');

    const b = createFrame(10, 2);
    writeText(b, 0, 0, 'hei', RED);
    writeText(b, 4, 1, 'ø', RED);
    const diff = renderFrame(a, b, { depth: 'truecolor', hyperlinks: false });
    expect(diff.startsWith('\x1b[2;5H')).toBe(true);
    expect(diff).not.toContain('hei');
    expect(renderFrame(b, b, { depth: 'truecolor', hyperlinks: false })).toBe('');
  });

  it('bruker OSC 8 bare når terminalen støtter lenker', () => {
    const f = createFrame(6, 1);
    writeText(f, 0, 0, 'lenke', { ...RED, link: 'https://example.org' });
    expect(renderFrame(null, f, { depth: 'ansi16', hyperlinks: true })).toContain('\x1b]8;;https://example.org\x1b\\');
    expect(renderFrame(null, f, { depth: 'ansi16', hyperlinks: false })).not.toContain('\x1b]8;;');
  });

  it('runder truecolor til nærmeste xterm-256-farge', () => {
    expect(rgbTo256(0x000000)).toBe(16);
    expect(rgbTo256(0xffffff)).toBe(231);
    expect(rgbTo256(0x808080)).toBe(244);
  });
});
