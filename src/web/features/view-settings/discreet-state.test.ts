import { describe, expect, it } from 'vitest';
import {
  DISCREET_MAX,
  DISCREET_STORAGE_KEY,
  discreetKey,
  moveDiscreetIn,
  normalizeDiscreet,
  readDiscreet,
  toggleDiscreetIn,
  writeDiscreet,
} from './discreet-state';

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k) => map.get(k) ?? null,
    key: (i) => [...map.keys()][i] ?? null,
    removeItem: (k) => void map.delete(k),
    setItem: (k, v) => void map.set(k, String(v)),
  };
}

const a = discreetKey('test', 'lesekomfort/Kvartalsrapport');
const b = discreetKey('test', 'lenker/Embed-test');

describe('diskré per notat (F2, ADR-008)', () => {
  it('nøkkelen er vault-id + linjeskift + sti', () => {
    expect(a).toBe('test\nlesekomfort/Kvartalsrapport');
  });

  it('normaliserer: bare v1 med gyldige nøkler, uten duplikater', () => {
    expect(normalizeDiscreet({ v: 1, notes: [a, a, 'uten-skille', 3, b] })).toEqual([a, b]);
    expect(normalizeDiscreet({ v: 2, notes: [a] })).toEqual([]);
    expect(normalizeDiscreet(null)).toEqual([]);
  });

  it('veksler per notat; andre notater er upåvirket', () => {
    const on = toggleDiscreetIn([b], a);
    expect(on).toEqual([b, a]);
    expect(toggleDiscreetIn(on, a)).toEqual([b]);
  });

  it(`holder høyst ${DISCREET_MAX} oppføringer (eldste kastes)`, () => {
    const many = Array.from({ length: DISCREET_MAX }, (_, i) => discreetKey('v', `n${i}`));
    const next = toggleDiscreetIn(many, a);
    expect(next).toHaveLength(DISCREET_MAX);
    expect(next[0]).toBe(discreetKey('v', 'n1'));
    expect(next.at(-1)).toBe(a);
  });

  it('følger notatet ved omdøping (PO-49)', () => {
    const to = discreetKey('test', 'lesekomfort/Rapport Q3');
    expect(moveDiscreetIn([a, b], a, to)).toEqual([b, to]);
    expect(moveDiscreetIn([b], a, to)).toEqual([b]);
    expect(moveDiscreetIn([a, to], a, to)).toEqual([to]);
  });

  it('lagres i localStorage og tåler ødelagt verdi', () => {
    const storage = memoryStorage();
    writeDiscreet(storage, [a]);
    expect(JSON.parse(storage.getItem(DISCREET_STORAGE_KEY) ?? '')).toEqual({ v: 1, notes: [a] });
    expect(readDiscreet(storage)).toEqual([a]);
    storage.setItem(DISCREET_STORAGE_KEY, '{x');
    expect(readDiscreet(storage)).toEqual([]);
  });
});
