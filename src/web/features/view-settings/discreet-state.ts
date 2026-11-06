// Diskré embedding per notat (ADR-008, F2): `{ "v": 1, "notes": ["<vaultId>\n<docPath>", …] }` – kun notater der
// valget er på, nyeste sist, maks 500. `\n` kan ikke forekomme i vault-id eller DocPath, så nøkkelen er entydig.
// P1: tar aldri notatinnhold eller frontmatter som inndata.

export const DISCREET_STORAGE_KEY = 'vault-leser.diskret';
export const DISCREET_MAX = 500;

export function discreetKey(vaultId: string, docPath: string): string {
  return `${vaultId}\n${docPath}`;
}

export function normalizeDiscreet(raw: unknown): readonly string[] {
  if (!raw || typeof raw !== 'object' || (raw as { v?: unknown }).v !== 1) return [];
  const notes = (raw as { notes?: unknown }).notes;
  if (!Array.isArray(notes)) return [];
  const valid = notes.filter((n): n is string => typeof n === 'string' && n.includes('\n'));
  return [...new Set(valid)].slice(-DISCREET_MAX);
}

export function readDiscreet(storage: Storage | undefined): readonly string[] {
  try {
    return normalizeDiscreet(JSON.parse(storage?.getItem(DISCREET_STORAGE_KEY) ?? 'null'));
  } catch {
    return [];
  }
}

export function writeDiscreet(storage: Storage | undefined, notes: readonly string[]): void {
  try {
    storage?.setItem(DISCREET_STORAGE_KEY, JSON.stringify({ v: 1, notes }));
  } catch {
    // full kvote eller blokkert: valget gjelder bare økten
  }
}

/** Slår på/av for ett notat. På legges sist (nyeste); eldste kastes over grensen. */
export function toggleDiscreetIn(notes: readonly string[], key: string): readonly string[] {
  if (notes.includes(key)) return notes.filter((n) => n !== key);
  return [...notes, key].slice(-DISCREET_MAX);
}

/** Omdøping (PO-49): valget følger notatet. */
export function moveDiscreetIn(notes: readonly string[], from: string, to: string): readonly string[] {
  if (!notes.includes(from)) return notes;
  const rest = notes.filter((n) => n !== from);
  return rest.includes(to) ? rest : [...rest, to].slice(-DISCREET_MAX);
}
