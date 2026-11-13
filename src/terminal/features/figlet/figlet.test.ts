import { describe, expect, it } from 'vitest';
import { chooseHeader, drawnHeight, headerHeight, loadFont } from './header';
import { figletText, renderFiglet } from './flf';

describe('FIGlet-fontene (designsystem-terminal §3.1)', () => {
  it('leser vr-blokk (4 rader) og vr-smal (3 rader) med ÆØÅ og –', () => {
    const blokk = loadFont('vr-blokk');
    const smal = loadFont('vr-smal');
    expect(blokk.height).toBe(4);
    expect(smal.height).toBe(3);
    for (const ch of 'AZÆØÅ09–?') expect(blokk.glyphs.has(ch), ch).toBe(true);
    expect(blokk.glyphs.has('😀')).toBe(false);
    const rows = renderFiglet(blokk, 'STATUSMØTE UKE 45')!;
    expect(rows).toHaveLength(4);
    expect(Math.max(...rows.map((r) => [...r].length))).toBeLessThanOrEqual(99);
    expect(rows.join('')).toMatch(/^[█▀▄ ]+$/u);
  });

  it('versaler, ÆØÅ beholdes og andre aksenter fjernes', () => {
    expect(figletText('Café über Ærø')).toBe('CAFE UBER ÆRØ');
  });
});

describe('fallback-kjeden (AR-3-20, §3.2)', () => {
  const at = (cols: number, rows: number, title = false) => ({ width: cols - 2 * Math.max(4, Math.round(cols * 0.067)), height: Math.floor(rows / 3), threeLines: title && rows >= 36 });

  it('Statusmøte uke 45: vr-blokk på to linjer ved 80×24 (2 × 4 = 8 ≤ ⅓, som QAs fasit), én linje ved 120×36 og 200×50', () => {
    const narrow = chooseHeader('Statusmøte uke 45', at(80, 24, true));
    expect(narrow.kind === 'figlet' && [narrow.font, narrow.blocks.length]).toEqual(['vr-blokk', 2]);
    expect(drawnHeight(narrow)).toBe(9);
    const wide = chooseHeader('Statusmøte uke 45', at(120, 36, true));
    expect(wide).toMatchObject({ kind: 'figlet', font: 'vr-blokk' });
    expect(wide.kind === 'figlet' && wide.blocks.length).toBe(1);
    expect(chooseHeader('Statusmøte uke 45', at(200, 50, true))).toMatchObject({ kind: 'figlet', font: 'vr-blokk' });
  });

  it('Relativt nær framtid: vr-blokk på to linjer ved 80×24; Agenda alltid vr-blokk', () => {
    const h = chooseHeader('Relativt nær framtid', at(80, 24));
    expect(h.kind === 'figlet' && [h.font, h.blocks.length]).toEqual(['vr-blokk', 2]);
    expect(headerHeight(h)).toBe(8);
    expect(chooseHeader('Relativt nær framtid', at(120, 36))).toMatchObject({ font: 'vr-blokk' });
    expect(chooseHeader('Agenda', at(80, 24))).toMatchObject({ font: 'vr-blokk' });
  });

  it('fet tekst når ordet er for langt eller et tegn mangler (aldri blandet)', () => {
    expect(chooseHeader('Donaudampfschifffahrtsgesellschaftskapitänswitwenrentenversicherungsanstalt', at(200, 50))).toEqual({ kind: 'text' });
    expect(chooseHeader('Status 🚀', at(200, 50))).toEqual({ kind: 'text' });
  });
});
