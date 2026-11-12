// Modi (P3, ADR-007 §2, ADR-010 §3). `normal` er lesevisningen, `present` presentasjonsmodus (v2). `insert` (og evt.
// `visual`) legges til her senere; tastaturkart, motor og registertyper er nøklet på modus.

export const KEY_MODES = ['normal', 'present'] as const;
export type KeyMode = (typeof KEY_MODES)[number];

export const DEFAULT_MODE: KeyMode = 'normal';
