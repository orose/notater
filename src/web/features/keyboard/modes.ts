// Modi (P3, ADR-007 §2). v1.1 har kun `normal`. `insert` (og evt. `visual`) legges til her senere;
// tastaturkart, motor og registertyper er allerede nøklet på modus, så det blir et tillegg.

export const KEY_MODES = ['normal'] as const;
export type KeyMode = (typeof KEY_MODES)[number];

export const DEFAULT_MODE: KeyMode = 'normal';
