// Fra `KeyboardEvent` til kanoniske akkord-id-er (ADR-007 §3 «Norsk Mac-layout»). Ren TS.
//
// Vi bruker `event.key` (tegnet tastaturoppsettet produserer), aldri `event.code` (fysisk posisjon):
// på norsk Mac er `:` = Shift+. , `/` = Shift+7 og `?` = Shift++, og `code` ville gitt
// «Period»/«Digit7»/«Minus». Derfor:
//   1. Shift er IKKE en del av akkorden for tegn – den er allerede «brukt opp» i tegnet.
//   2. Bokstaver får store/små etter `shiftKey`, ikke etter Caps Lock (Caps Lock + g ≠ G).
//   3. Alt/⌥ beholdes som modifikator. Ingen bindinger har Alt (P5), så ⌥8 = «[» treffer aldri.
//   4. Døde taster (`Dead`), IME-komposisjon og rene modifikatortrykk ignoreres.

/** Delmengden av `KeyboardEvent` som motoren trenger (enkel å lage i tester). */
export interface KeyInput {
  readonly key: string;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly altKey: boolean;
  readonly shiftKey: boolean;
  readonly repeat?: boolean;
  readonly isComposing?: boolean;
}

const IGNORED_KEYS = new Set(['Dead', 'Process', 'Unidentified', 'Shift', 'Control', 'Alt', 'AltGraph', 'Meta', 'CapsLock', 'Fn', 'OS']);

const LETTER = /^\p{L}$/u;

/**
 * Kanoniske akkord-id-er (se `chordId`) som dette tastetrykket kan matche, mest spesifikk først.
 * Ctrl gir både `Ctrl+x` og `Mod+x` (PO-36: Mod = ⌘ eller Ctrl). Tom liste = ignorer.
 */
export function chordCandidates(input: KeyInput): readonly string[] {
  if (input.isComposing || IGNORED_KEYS.has(input.key)) return [];
  let key = input.key === ' ' ? 'Space' : input.key;
  const isCharacter = [...key].length === 1;
  const commandChord = input.ctrlKey || input.metaKey;

  if (isCharacter && LETTER.test(key)) {
    // ⌘K og Ctrl d skrives med liten bokstav; ellers avgjør Shift (ikke Caps Lock).
    key = commandChord ? key.toLowerCase() : input.shiftKey ? key.toUpperCase() : key.toLowerCase();
  }

  const alt = input.altKey ? ['Alt'] : [];
  const shift = input.shiftKey && (!isCharacter || (commandChord && LETTER.test(key))) ? ['Shift'] : [];
  const tail = [...alt, ...shift, key].join('+');

  if (input.ctrlKey && input.metaKey) return [`Ctrl+Mod+${tail}`];
  if (input.ctrlKey) return [`Ctrl+${tail}`, `Mod+${tail}`];
  if (input.metaKey) return [`Mod+${tail}`];
  return [tail];
}
