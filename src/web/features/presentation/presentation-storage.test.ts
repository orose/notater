import { describe, expect, it } from 'vitest';
import {
  PRESENTATION_LEVELS_MAX,
  PRESENTATION_STORAGE_KEY,
  levelIn,
  moveLevelIn,
  normalizeLevels,
  presentationKey,
  readLevels,
  setLevelIn,
  writeLevels,
} from './presentation-storage';

const key = presentationKey('test', 'rapporter/uke-45');

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (k) => data.get(k) ?? null,
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (k) => void data.delete(k),
    setItem: (k, v) => void data.set(k, v),
  };
}

describe('lagret lysbildenivå per notat (S4, ADR-010 §7)', () => {
  it('normaliserer: ukjent versjon, feil form og ugyldige nivåer gir ingenting', () => {
    expect(normalizeLevels(null)).toEqual([]);
    expect(normalizeLevels({ v: 2, levels: [[key, 3]] })).toEqual([]);
    expect(normalizeLevels({ v: 1, levels: [[key, 7], ['uten-linjeskift', 3], [key, 2.5], 'x'] })).toEqual([]);
    expect(normalizeLevels({ v: 1, levels: [[key, 3], [key, 4]] })).toEqual([[key, 4]]);
  });

  it('setter, fjerner (auto) og begrenser antallet', () => {
    let levels = setLevelIn([], key, 3);
    expect(levelIn(levels, key)).toBe(3);
    levels = setLevelIn(levels, key, null);
    expect(levelIn(levels, key)).toBeNull();
    for (let i = 0; i < PRESENTATION_LEVELS_MAX + 5; i++) levels = setLevelIn(levels, presentationKey('v', `n${i}`), 2);
    expect(levels).toHaveLength(PRESENTATION_LEVELS_MAX);
    expect(levelIn(levels, presentationKey('v', 'n0'))).toBeNull();
  });

  it('følger notatet ved omdøping (PO-49)', () => {
    const to = presentationKey('test', 'rapporter/uke-46');
    expect(moveLevelIn([[key, 4]], key, to)).toEqual([[to, 4]]);
    expect(moveLevelIn([[key, 4]], 'annet\nnotat', to)).toEqual([[key, 4]]);
  });

  it('leser og skriver localStorage, og tåler blokkert lagring', () => {
    const storage = memoryStorage();
    writeLevels(storage, [[key, 3]]);
    expect(JSON.parse(storage.getItem(PRESENTATION_STORAGE_KEY) ?? '')).toEqual({ v: 1, levels: [[key, 3]] });
    expect(readLevels(storage)).toEqual([[key, 3]]);
    const broken = { ...storage, getItem: () => '{ikke json', setItem: () => { throw new Error('kvote'); } } as Storage;
    expect(readLevels(broken)).toEqual([]);
    expect(() => writeLevels(broken, [])).not.toThrow();
    expect(readLevels(undefined)).toEqual([]);
  });
});
