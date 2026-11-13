import { describe, expect, it } from 'vitest';
import { createTheme, isPalette, modeFromOsc11, PALETTES } from './terminal-theme';

describe('temaet (farger.json, designsystem-terminal §6)', () => {
  it('truecolor: rollene fra paletten, også kode og kulører', () => {
    const t = createTheme('fosfor', 'dark', 'truecolor');
    const s = t.style({ fg: 'aksent', bg: 'linje_bg', bold: true });
    expect(s.fg.kind).toBe('rgb');
    expect(s.bg.kind).toBe('rgb');
    expect(s.bold).toBe(true);
    expect(t.style({ fg: 'kode.keyword', bg: 'kode_bg' }).fg.kind).toBe('rgb');
    expect(t.style()).toBe(t.style({}));
  });

  it('16 farger: indekser fra kartet, palettens aksent, kursiv kommentar og revers på statuslinjen', () => {
    const t = createTheme('papir', 'dark', 'ansi16');
    expect(t.style({ fg: 'aksent' }).fg).toEqual({ kind: 'ansi', index: 9 });
    expect(t.style({ fg: 'dempet' }).fg).toEqual({ kind: 'ansi', index: 7 });
    expect(t.style().bg).toEqual({ kind: 'default' });
    expect(t.style({ fg: 'kode.comment' }).italic).toBe(true);
    const line = t.style({ fg: 'dempet', bg: 'linje_bg' });
    expect(line.inverse).toBe(true);
    expect(line.fg).toEqual({ kind: 'default' });
    expect(createTheme('fosfor', 'light', 'ansi16').style({ fg: 'aksent' }).fg).toEqual({ kind: 'ansi', index: 2 });
  });

  it('NO_COLOR: ingen farger, men revers og vekt beholdes', () => {
    const t = createTheme('fosfor', 'dark', 'none');
    expect(t.style({ fg: 'aksent', bold: true })).toEqual({ fg: { kind: 'default' }, bg: { kind: 'default' }, bold: true });
    expect(t.style({ bg: 'invertert_bg' }).inverse).toBe(true);
  });

  it('palettnavn og lys/mørk fra OSC 11', () => {
    expect(PALETTES).toEqual(['papir', 'cyanotypi', 'fosfor', 'signal']);
    expect(isPalette('fosfor')).toBe(true);
    expect(isPalette('neon')).toBe(false);
    expect(modeFromOsc11('\x1b]11;rgb:ffff/ffff/ffff\x1b\\')).toBe('light');
    expect(modeFromOsc11('\x1b]11;rgb:1a1a/1717/1212\x07')).toBe('dark');
    expect(modeFromOsc11('tull')).toBeNull();
  });
});
