import { describe, expect, it } from 'vitest';
import { WIDTH_STORAGE_KEY, ZEN_HINT_TIMES, applyWidth, applyZen, normalizeWidth, readWidth, takeZenHint, writeWidth } from './view-state';

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

const throwing = {
  getItem: () => {
    throw new Error('blokkert');
  },
  setItem: () => {
    throw new Error('full');
  },
} as unknown as Storage;

describe('lesebredde (F1)', () => {
  it('normaliserer: bare { v: 1, width: "full" } gir full', () => {
    expect(normalizeWidth({ v: 1, width: 'full' })).toBe('full');
    expect(normalizeWidth({ v: 1, width: 'readable' })).toBe('readable');
    expect(normalizeWidth({ v: 2, width: 'full' })).toBe('readable');
    expect(normalizeWidth('full')).toBe('readable');
    expect(normalizeWidth(null)).toBe('readable');
  });

  it('husker valget i localStorage', () => {
    const storage = memoryStorage();
    expect(readWidth(storage)).toBe('readable');
    writeWidth(storage, 'full');
    expect(JSON.parse(storage.getItem(WIDTH_STORAGE_KEY) ?? '')).toEqual({ v: 1, width: 'full' });
    expect(readWidth(storage)).toBe('full');
  });

  it('tåler ødelagt verdi og blokkert lagring', () => {
    const storage = memoryStorage();
    storage.setItem(WIDTH_STORAGE_KEY, '{ikke json');
    expect(readWidth(storage)).toBe('readable');
    expect(readWidth(throwing)).toBe('readable');
    expect(() => writeWidth(throwing, 'full')).not.toThrow();
    expect(readWidth(undefined)).toBe('readable');
  });

  it('setter data-width bare for full bredde, og data-zen bare i zen', () => {
    const root = document.createElement('html');
    applyWidth(root, 'full');
    expect(root.dataset.width).toBe('full');
    applyWidth(root, 'readable');
    expect(root.hasAttribute('data-width')).toBe(false);
    applyZen(root, true);
    expect(root.dataset.zen).toBe('on');
    applyZen(root, false);
    expect(root.hasAttribute('data-zen')).toBe(false);
  });
});

describe('førstegangshint for zen', () => {
  it(`vises de ${ZEN_HINT_TIMES} første gangene`, () => {
    const storage = memoryStorage();
    const shown = Array.from({ length: 5 }, () => takeZenHint(storage));
    expect(shown).toEqual([true, true, true, false, false]);
    expect(takeZenHint(throwing)).toBe(false);
  });
});
