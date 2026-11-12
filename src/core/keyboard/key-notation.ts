// Tastenotasjon for kommandoregisteret (ADR-007 §2). Ren TS: ingen DOM, ingen React.
//
// En binding skrives som en streng med akkorder skilt av mellomrom:
//   'j'  'G'  '?'  'g g'  'z a'  'Leader w'  'Mod+k'  'Ctrl+d'  'Escape'  'Shift+Tab'
//
// - Én tegn-tast skrives som tegnet den produserer (`event.key`): 'G' (ikke 'Shift+g'), '?' og ':'
//   (ikke 'Shift+…'). Shift er altså aldri en modifikator for tegn – bare for navngitte taster.
// - `Mod` = ⌘ på Apple, Ctrl ellers; begge virker overalt (PO-36). `Ctrl` = bokstavelig Control.
// - `Leader` utvides til LEADER_KEY ('Space').
// - `Alt` kan parses (for å kunne avvises av policyen), men skal aldri brukes (P5).

export type Modifier = 'Ctrl' | 'Mod' | 'Alt' | 'Shift';

/** Navngitte taster (verdier av `event.key`, med ' ' omdøpt til 'Space'). */
export const NAMED_KEYS = [
  'Space',
  'Escape',
  'Enter',
  'Tab',
  'Backspace',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Home',
  'End',
  'PageUp',
  'PageDown',
] as const;
export type NamedKey = (typeof NAMED_KEYS)[number];

export const LEADER_KEY: NamedKey = 'Space';

const MODIFIER_ORDER: readonly Modifier[] = ['Ctrl', 'Mod', 'Alt', 'Shift'];

export interface KeyChord {
  /** Ett tegn (`'g'`, `'G'`, `'?'`) eller en `NamedKey`. */
  readonly key: string;
  /** Sortert i MODIFIER_ORDER, uten duplikater. */
  readonly modifiers: readonly Modifier[];
}

export type KeySequence = readonly KeyChord[];

export class KeyNotationError extends Error {
  override readonly name = 'KeyNotationError';
}

export function isNamedKey(key: string): key is NamedKey {
  return (NAMED_KEYS as readonly string[]).includes(key);
}

function isModifier(token: string): token is Modifier {
  return (MODIFIER_ORDER as readonly string[]).includes(token);
}

/** `'Mod+k'` → `{ key: 'k', modifiers: ['Mod'] }`. `'+'` alene er tasten pluss. */
export function parseChord(text: string): KeyChord {
  if (text === '+') return { key: '+', modifiers: [] };
  const parts = text.endsWith('++') ? [...text.slice(0, -2).split('+'), '+'] : text.split('+');
  const key = parts.pop() ?? '';
  const modifiers = new Set<Modifier>();
  for (const part of parts) {
    if (!isModifier(part)) throw new KeyNotationError(`Ukjent modifikator «${part}» i «${text}»`);
    modifiers.add(part);
  }
  const resolved = key === 'Leader' ? LEADER_KEY : key;
  if ([...resolved].length !== 1 && !isNamedKey(resolved)) {
    throw new KeyNotationError(`Ukjent tast «${key}» i «${text}»`);
  }
  if (modifiers.has('Shift') && !isNamedKey(resolved)) {
    throw new KeyNotationError(`Shift skrives ikke for tegn – skriv tegnet selv («G», «?») i «${text}»`);
  }
  return { key: resolved, modifiers: MODIFIER_ORDER.filter((m) => modifiers.has(m)) };
}

/** `'Leader w'` → `[Space, w]`. Tom streng er en feil. */
export function parseKeySequence(text: string): KeySequence {
  const tokens = text.trim().split(/\s+/).filter((t) => t !== '');
  if (tokens.length === 0) throw new KeyNotationError('Tom tastesekvens');
  return tokens.map(parseChord);
}

/** Kanonisk id for en akkord, brukt som oppslagsnøkkel: `'Mod+k'`, `'G'`, `'Space'`. */
export function chordId(chord: KeyChord): string {
  return [...chord.modifiers, chord.key].join('+');
}

export function sequenceId(sequence: KeySequence): string {
  return sequence.map(chordId).join(' ');
}

export type LabelPlatform = 'apple' | 'other' | 'docs';

const KEY_LABELS: Partial<Record<string, string>> = {
  Escape: 'Esc',
  Enter: '↵',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  Backspace: '⌫',
};

function chordLabel(chord: KeyChord, platform: Exclude<LabelPlatform, 'docs'>): string {
  // `⌘K` med stor bokstav (konvensjon for ⌘-snarveier), men `Ctrl d` som i vim og spesifikasjonen.
  const key = KEY_LABELS[chord.key] ?? (chord.modifiers.includes('Mod') ? chord.key.toUpperCase() : chord.key);
  const mods = chord.modifiers.map((m) => {
    if (m === 'Mod') return platform === 'apple' ? '⌘' : 'Ctrl';
    if (m === 'Alt') return platform === 'apple' ? '⌥' : 'Alt';
    if (m === 'Shift') return platform === 'apple' ? '⇧' : 'Shift';
    return 'Ctrl';
  });
  if (mods.length === 0) return key;
  // PO-36: «⌘K» på Apple, «Ctrl K» ellers.
  return platform === 'apple' && chord.modifiers.every((m) => m !== 'Ctrl') ? `${mods.join('')}${key}` : `${mods.join(' ')} ${key}`;
}

function isPlainCharacter(chord: KeyChord): boolean {
  return chord.modifiers.length === 0 && !isNamedKey(chord.key);
}

/**
 * Visningstekst: `gg`, `za`, `Space w`, `⌘K` / `Ctrl K`, `Ctrl d`. Påfølgende rene tegn skrives
 * sammen (som i spesifikasjonens tastaturkart). `docs` gir begge varianter der Mod inngår
 * (`⌘K / Ctrl K`), til README og `?`-oversikten på ukjent plattform.
 */
export function formatKeySequence(sequence: KeySequence, platform: LabelPlatform): string {
  if (platform === 'docs') {
    const apple = formatKeySequence(sequence, 'apple');
    const other = formatKeySequence(sequence, 'other');
    return apple === other ? apple : `${apple} / ${other}`;
  }
  let out = '';
  sequence.forEach((chord, i) => {
    const prev = sequence[i - 1];
    const glue = i === 0 ? '' : prev && isPlainCharacter(prev) && isPlainCharacter(chord) ? '' : ' ';
    out += glue + chordLabel(chord, platform);
  });
  return out;
}
