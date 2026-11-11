// `:presenter h<n>` huskes per notat i nettleseren (S4, ADR-010 §7). Samme mønster som diskré embedding (ADR-008):
// `{ "v": 1, "levels": [["<vaultId>\n<docPath>", 3], …] }`, kun overstyrte notater, nyeste sist, maks 500.
// P1: tar aldri notatinnhold eller frontmatter som inndata. All tilgang i try/catch.

import type { HeadingLevel } from './model';

export const PRESENTATION_STORAGE_KEY = 'vault-leser.presentasjon';
export const PRESENTATION_LEVELS_MAX = 500;

export type StoredLevels = readonly (readonly [string, HeadingLevel])[];

export function presentationKey(vaultId: string, docPath: string): string {
  return `${vaultId}\n${docPath}`;
}

function isLevel(value: unknown): value is HeadingLevel {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 6;
}

export function normalizeLevels(raw: unknown): StoredLevels {
  if (!raw || typeof raw !== 'object' || (raw as { v?: unknown }).v !== 1) return [];
  const levels = (raw as { levels?: unknown }).levels;
  if (!Array.isArray(levels)) return [];
  const out = new Map<string, HeadingLevel>();
  for (const entry of levels) {
    if (!Array.isArray(entry) || entry.length !== 2) continue;
    const [key, level] = entry as [unknown, unknown];
    if (typeof key !== 'string' || !key.includes('\n') || !isLevel(level)) continue;
    out.delete(key); // siste forekomst vinner og står sist
    out.set(key, level);
  }
  return [...out].slice(-PRESENTATION_LEVELS_MAX);
}

export function readLevels(storage: Storage | undefined): StoredLevels {
  try {
    return normalizeLevels(JSON.parse(storage?.getItem(PRESENTATION_STORAGE_KEY) ?? 'null'));
  } catch {
    return [];
  }
}

export function writeLevels(storage: Storage | undefined, levels: StoredLevels): void {
  try {
    storage?.setItem(PRESENTATION_STORAGE_KEY, JSON.stringify({ v: 1, levels }));
  } catch {
    // full kvote eller blokkert: valget gjelder bare økten
  }
}

export function levelIn(levels: StoredLevels, key: string): HeadingLevel | null {
  return levels.find(([k]) => k === key)?.[1] ?? null;
}

/** `level = null` (`:presenter auto`) fjerner overstyringen. Satt nivå legges sist; eldste kastes over grensen. */
export function setLevelIn(levels: StoredLevels, key: string, level: HeadingLevel | null): StoredLevels {
  const rest = levels.filter(([k]) => k !== key);
  return level === null ? rest : [...rest, [key, level] as const].slice(-PRESENTATION_LEVELS_MAX);
}

/** Omdøping (PO-49): valget følger notatet. */
export function moveLevelIn(levels: StoredLevels, from: string, to: string): StoredLevels {
  const level = levelIn(levels, from);
  if (level === null) return levels;
  return setLevelIn(
    levels.filter(([k]) => k !== from),
    to,
    level,
  );
}
