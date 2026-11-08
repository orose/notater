import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PREFERENCES,
  THEME_STORAGE_KEY,
  applyTheme,
  readStoredPreferences,
  resolveMode,
  writeStoredPreferences,
} from './theme-state';

function memoryStorage(initial: Record<string, string> = {}): Storage {
  const data = new Map(Object.entries(initial));
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (k: string) => data.get(k) ?? null,
    key: (i: number) => [...data.keys()][i] ?? null,
    removeItem: (k: string) => void data.delete(k),
    setItem: (k: string, v: string) => void data.set(k, v),
  };
}

function throwingStorage(): Storage {
  const fail = () => {
    throw new Error('SecurityError');
  };
  return { length: 0, clear: fail, getItem: fail, key: fail, removeItem: fail, setItem: fail };
}

describe('readStoredPreferences', () => {
  it('gir standardverdier ved første besøk', () => {
    expect(readStoredPreferences(memoryStorage())).toEqual(DEFAULT_PREFERENCES);
    expect(DEFAULT_PREFERENCES).toEqual({ mode: 'system', type: 'tidsskrift', palette: 'papir', ornaments: true });
  });

  it('leser lagret valg og fyller inn manglende felter', () => {
    const storage = memoryStorage({ [THEME_STORAGE_KEY]: JSON.stringify({ mode: 'dark', palette: 'fosfor' }) });
    expect(readStoredPreferences(storage)).toEqual({ mode: 'dark', type: 'tidsskrift', palette: 'fosfor', ornaments: true });
  });

  it('ignorerer ugyldige verdier og ødelagt JSON', () => {
    expect(readStoredPreferences(memoryStorage({ [THEME_STORAGE_KEY]: '{ikke json' }))).toEqual(DEFAULT_PREFERENCES);
    const storage = memoryStorage({ [THEME_STORAGE_KEY]: JSON.stringify({ mode: 'neon', type: 'comic', ornaments: 'ja' }) });
    expect(readStoredPreferences(storage)).toEqual(DEFAULT_PREFERENCES);
  });

  it('tåler at localStorage kaster (privat modus)', () => {
    expect(readStoredPreferences(throwingStorage())).toEqual(DEFAULT_PREFERENCES);
    expect(() => writeStoredPreferences(throwingStorage(), DEFAULT_PREFERENCES)).not.toThrow();
  });

  it('skriver valget som JSON under nøkkelen fra designsystemet', () => {
    const storage = memoryStorage();
    writeStoredPreferences(storage, { mode: 'light', type: 'terminal', palette: 'signal', ornaments: false });
    expect(JSON.parse(storage.getItem('vault-leser.tema') ?? '')).toEqual({
      mode: 'light',
      type: 'terminal',
      palette: 'signal',
      ornaments: false,
    });
  });
});

describe('resolveMode', () => {
  it('løser system mot OS-innstillingen', () => {
    expect(resolveMode('system', true)).toBe('dark');
    expect(resolveMode('system', false)).toBe('light');
    expect(resolveMode('light', true)).toBe('light');
    expect(resolveMode('dark', false)).toBe('dark');
  });
});

describe('applyTheme', () => {
  it('setter data-attributtene på <html>', () => {
    const root = document.createElement('html');
    applyTheme(root, { mode: 'system', type: 'terminal', palette: 'fosfor', ornaments: false }, true);
    expect(root.dataset).toMatchObject({
      type: 'terminal',
      palette: 'fosfor',
      mode: 'dark',
      modePref: 'system',
      ornaments: 'off',
    });
  });
});
