import { describe, expect, it } from 'vitest';
import { fuzzyMatch, normalizeForSearch } from './fuzzy';

describe('fuzzyMatch', () => {
  it('tom spørring treffer alt med poeng 0', () => {
    expect(fuzzyMatch('', 'Zen-modus')).toEqual({ score: 0, ranges: [] });
  });

  it('eksakt > prefiks > ordstart > delstreng > delsekvens', () => {
    const exact = fuzzyMatch('zen', 'zen')?.score ?? 0;
    const prefix = fuzzyMatch('zen', 'zen-modus')?.score ?? 0;
    const wordStart = fuzzyMatch('modus', 'zen-modus')?.score ?? 0;
    const inside = fuzzyMatch('odus', 'zen-modus')?.score ?? 0;
    const subsequence = fuzzyMatch('zm', 'zen-modus')?.score ?? 0;
    expect(exact).toBeGreaterThan(prefix);
    expect(prefix).toBeGreaterThan(wordStart);
    expect(wordStart).toBeGreaterThan(inside);
    expect(inside).toBeGreaterThan(subsequence);
    expect(subsequence).toBeGreaterThan(0);
  });

  it('delsekvens: «zn» treffer «Zen-modus», men ikke «Til bunnen»', () => {
    expect(fuzzyMatch('zn', 'Zen-modus')).not.toBeNull();
    expect(fuzzyMatch('zn', 'Til bunnen')).toBeNull();
  });

  it('ser bort fra store/små bokstaver og aksenter (diskret = diskré)', () => {
    expect(fuzzyMatch('DISKRE', 'diskré')?.score).toBe(1000);
    expect(normalizeForSearch('Diskré')).toBe('diskre');
    expect(normalizeForSearch('Mørk')).toBe('mørk');
  });

  it('mellomrom i spørringen kan hoppes over i delsekvens («fold alle» i «Fold alle»)', () => {
    expect(fuzzyMatch('foldalle', 'Fold alle')).not.toBeNull();
    expect(fuzzyMatch('fold alle', 'Fold alle')?.ranges).toEqual([[0, 9]]);
  });

  it('gir treffområder i originalteksten til utheving', () => {
    expect(fuzzyMatch('bredde', 'Bytt lesebredde')?.ranges).toEqual([[9, 15]]);
    expect(fuzzyMatch('zm', 'Zen-modus')?.ranges).toEqual([
      [0, 1],
      [4, 5],
    ]);
  });
});
