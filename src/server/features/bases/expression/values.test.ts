import { describe, expect, it } from 'vitest';
import { addDuration, compareForOperator, compareForSort, dateValue, isTruthy, list, parseDateString, toText, valuesEqual } from './values';
import type { LinkValue } from './values';

const kunde: LinkValue = { kind: 'link', filePath: 'domene/Kunde.md', docPath: 'domene/Kunde', display: 'Kunde' };

describe('values', () => {
  it('parseDateString: ren dato i UTC (BE14), ISO med og uten sone, ugyldig', () => {
    expect(parseDateString('2026-11-05')).toEqual(dateValue(Date.UTC(2026, 10, 5), false));
    expect(parseDateString('2026-11-05T10:00')).toEqual(dateValue(Date.UTC(2026, 10, 5, 10), true));
    expect(parseDateString('2026-11-05T10:00+01:00')).toEqual(dateValue(Date.UTC(2026, 10, 5, 9), true));
    expect(parseDateString('2026-02-30')).toBeNull();
    expect(parseDateString('i morgen')).toBeNull();
  });

  it('isTruthy', () => {
    expect([null, false, 0, '', NaN, list([])].map(isTruthy)).toEqual([false, false, false, false, false, false]);
    expect([true, 1, 'x', list([null]), dateValue(0, false), kunde].map(isTruthy)).toEqual([true, true, true, true, true, true]);
  });

  it('valuesEqual: typer, lister, lenker mot tekst', () => {
    expect(valuesEqual('a', 'a')).toBe(true);
    expect(valuesEqual('a', 'A')).toBe(false);
    expect(valuesEqual(1, '1')).toBe(false);
    expect(valuesEqual(null, null)).toBe(true);
    expect(valuesEqual(null, '')).toBe(false);
    expect(valuesEqual(list([1, 'a']), list([1, 'a']))).toBe(true);
    expect(valuesEqual(kunde, '[[Kunde]]')).toBe(true);
    expect(valuesEqual(kunde, 'domene/Kunde')).toBe(true);
    expect(valuesEqual(kunde, { ...kunde, display: 'K' })).toBe(true);
    expect(valuesEqual(kunde, 'Ordre')).toBe(false);
  });

  it('compareForOperator: usammenlignbare typer gir null', () => {
    expect(compareForOperator(1, 2)).toBeLessThan(0);
    expect(compareForOperator('b', 'a')).toBeGreaterThan(0);
    expect(compareForOperator(dateValue(Date.UTC(2026, 0, 1), false), '2026-01-02')).toBeLessThan(0);
    expect(compareForOperator(1, '2')).toBeNull();
    expect(compareForOperator(null, 1)).toBeNull();
  });

  it('compareForSort: tall numerisk, tekst med nb-kollasjon (Æ < Ø < Å etter Z, case-ufølsom)', () => {
    expect([10, 2, 1].sort(compareForSort)).toEqual([1, 2, 10]);
    expect(['Åpningstider', 'avtale', 'Øyeblikksbilde', 'Ærendelogg', 'Zebra', 'Betaling'].sort(compareForSort)).toEqual([
      'avtale',
      'Betaling',
      'Zebra',
      'Ærendelogg',
      'Øyeblikksbilde',
      'Åpningstider',
    ]);
    expect(['item 10', 'item 9'].sort(compareForSort)).toEqual(['item 9', 'item 10']);
  });

  it('toText', () => {
    expect(toText(dateValue(Date.UTC(2026, 10, 5), false))).toBe('2026-11-05');
    expect(toText(list(['a', 2, true]))).toBe('a, 2, true');
    expect(toText(0.1 + 0.2)).toBe('0.3');
    expect(toText(kunde)).toBe('Kunde');
  });

  it('addDuration: enheter, flere ledd, ugyldig', () => {
    const d = dateValue(Date.UTC(2026, 0, 31), false);
    expect(addDuration(d, '1d', 1)).toEqual(dateValue(Date.UTC(2026, 1, 1), false));
    expect(addDuration(d, '2 weeks', -1)).toEqual(dateValue(Date.UTC(2026, 0, 17), false));
    expect(addDuration(d, '1y 1d', 1)).toEqual(dateValue(Date.UTC(2027, 1, 1), false));
    expect(addDuration(d, '3h', 1)).toEqual(dateValue(Date.UTC(2026, 0, 31, 3), true));
    expect(addDuration(d, 'tull', 1)).toBeNull();
    expect(addDuration(d, '1d tull', 1)).toBeNull();
  });
});
