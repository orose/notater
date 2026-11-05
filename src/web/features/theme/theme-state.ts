// Ren tema-logikk (ingen React). Samme regler som public/tema-init.js, som kjører før første maling.

export type ThemeModePreference = 'system' | 'light' | 'dark';
export type ResolvedMode = 'light' | 'dark';
export type ThemeType = 'tidsskrift' | 'terminal';
export type ThemePalette = 'papir' | 'cyanotypi' | 'fosfor' | 'signal';

export interface ThemePreferences {
  readonly mode: ThemeModePreference;
  readonly type: ThemeType;
  readonly palette: ThemePalette;
  /** PO-19: initial og seksjonsnummer (Tidsskrift). */
  readonly ornaments: boolean;
}

export const THEME_STORAGE_KEY = 'vault-leser.tema';
export const DARK_QUERY = '(prefers-color-scheme: dark)';

export const DEFAULT_PREFERENCES: ThemePreferences = {
  mode: 'system',
  type: 'tidsskrift',
  palette: 'papir',
  ornaments: true,
};

export const MODES: readonly ThemeModePreference[] = ['light', 'dark', 'system'];
export const TYPES: readonly ThemeType[] = ['tidsskrift', 'terminal'];
export const PALETTES: readonly ThemePalette[] = ['papir', 'cyanotypi', 'fosfor', 'signal'];

interface Swatch {
  readonly bg: string;
  readonly text: string;
  readonly accent: string;
  readonly accent2: string;
}

export interface PaletteInfo {
  readonly name: string;
  readonly description: string;
  readonly recommendedFor: ThemeType;
  readonly light: Swatch;
  readonly dark: Swatch;
}

/** Fra prototypen (docs/design/prototype.html). Brukes kun til fargeprøver i temavelgeren. */
export const PALETTE_INFO: Readonly<Record<ThemePalette, PaletteInfo>> = {
  papir: {
    name: 'Papir',
    description: 'Varmt papir, oksblod',
    recommendedFor: 'tidsskrift',
    light: { bg: '#f4eee2', text: '#211c15', accent: '#9a2b1a', accent2: '#1f4d6b' },
    dark: { bg: '#1a1712', text: '#ece4d4', accent: '#f08b6b', accent2: '#8fc1e3' },
  },
  cyanotypi: {
    name: 'Cyanotypi',
    description: 'Kjølig, preussisk blå',
    recommendedFor: 'tidsskrift',
    light: { bg: '#eef1f1', text: '#121d27', accent: '#174a8c', accent2: '#8a4f00' },
    dark: { bg: '#0d1520', text: '#dbe4ec', accent: '#86b9f5', accent2: '#e8b75a' },
  },
  fosfor: {
    name: 'Fosfor',
    description: 'Fosforgrønn, rav',
    recommendedFor: 'terminal',
    light: { bg: '#f2f3ee', text: '#11150e', accent: '#2c6a0f', accent2: '#8a5300' },
    dark: { bg: '#0b0d0a', text: '#d8dfcf', accent: '#a3e66d', accent2: '#ffb454' },
  },
  signal: {
    name: 'Signal',
    description: 'Nøytral, signaloransje',
    recommendedFor: 'terminal',
    light: { bg: '#f6f6f3', text: '#111111', accent: '#b23209', accent2: '#00677d' },
    dark: { bg: '#111213', text: '#e9e9e6', accent: '#ff7a45', accent2: '#5cd0e6' },
  },
};

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

export function normalizePreferences(raw: unknown): ThemePreferences {
  const obj = raw !== null && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    mode: pick(obj.mode, MODES, DEFAULT_PREFERENCES.mode),
    type: pick(obj.type, TYPES, DEFAULT_PREFERENCES.type),
    palette: pick(obj.palette, PALETTES, DEFAULT_PREFERENCES.palette),
    ornaments: typeof obj.ornaments === 'boolean' ? obj.ornaments : DEFAULT_PREFERENCES.ornaments,
  };
}

export function readStoredPreferences(storage: Storage | undefined): ThemePreferences {
  try {
    const raw = storage?.getItem(THEME_STORAGE_KEY);
    return normalizePreferences(raw ? JSON.parse(raw) : null);
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function writeStoredPreferences(storage: Storage | undefined, prefs: ThemePreferences): void {
  try {
    storage?.setItem(THEME_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Privat modus / blokkert lagring: valget gjelder bare denne økten.
  }
}

export function resolveMode(mode: ThemeModePreference, systemDark: boolean): ResolvedMode {
  if (mode === 'system') return systemDark ? 'dark' : 'light';
  return mode;
}

export function applyTheme(root: HTMLElement, prefs: ThemePreferences, systemDark: boolean): void {
  root.dataset.type = prefs.type;
  root.dataset.palette = prefs.palette;
  root.dataset.mode = resolveMode(prefs.mode, systemDark);
  root.dataset.modePref = prefs.mode;
  root.dataset.ornaments = prefs.ornaments ? 'on' : 'off';
}

/** Leser foretrukket tema fra URL-en (`?type=terminal&palette=fosfor&mode=dark`), som i prototypen. */
export function preferencesFromSearch(search: string, base: ThemePreferences): ThemePreferences {
  const params = new URLSearchParams(search);
  return normalizePreferences({
    ...base,
    ...(params.get('mode') ? { mode: params.get('mode') } : {}),
    ...(params.get('type') ? { type: params.get('type') } : {}),
    ...(params.get('palette') ? { palette: params.get('palette') } : {}),
    ...(params.get('ornaments') ? { ornaments: params.get('ornaments') !== 'off' } : {}),
  });
}

export function safeLocalStorage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}
