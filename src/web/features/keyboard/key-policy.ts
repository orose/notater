// Tastepolicy for v1.1 (P4, P5, P7 og ADR-007 §3). Ren TS. Håndheves av `validateBindings`,
// som kjøres mot hele registeret i en enhetstest (AK-1.1-08).

import { chordId, isNamedKey, parseKeySequence, sequenceId, type KeyChord, type KeySequence } from './key-notation';
import type { KeyMode } from './modes';

/** P4: reservert for fremtidig redigering (vim). Kan ikke starte en binding i normal-modus. */
export const RESERVED_NORMAL_KEYS: readonly string[] = ['i', 'a', 'o', 'e', 'I', 'A', 'O', 's', 'c', 'd', 'x', 'p', 'y', 'u', 'r'];

/** P4: `Esc` = «gå ut av modus». Kun systemkommandoen for lukk/avbryt kan bindes til den. */
export const ESCAPE_COMMAND_ID = 'system.escape';

/**
 * P5: tegn som kan skrives UTEN ⌥ på norsk Mac-layout (og på norsk/US PC). Hviteliste i stedet for
 * svarteliste: alt som ikke står her (bl.a. `[ ] { } \ | @ $ ~ ^ ´ ¨ \``) er forbudt. `^ ´ ¨ \`` er
 * døde taster på norsk Mac og gir `event.key === 'Dead'`.
 */
export const P5_SAFE_CHARACTERS: ReadonlySet<string> = new Set([
  ...'abcdefghijklmnopqrstuvwxyz',
  ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  ...'0123456789',
  ...'.,-:;/?+!"#%&()=*\'_',
]);

export interface BindingToCheck {
  readonly commandId: string;
  readonly mode: KeyMode;
  /** Notasjon, f.eks. `'Leader w'`. */
  readonly keys: string;
  readonly inTextFields?: boolean;
}

export interface PolicyViolation {
  readonly commandId: string;
  readonly keys: string;
  readonly rule: 'notation' | 'P4-reserved' | 'P4-escape' | 'P5-alt' | 'P5-character' | 'duplicate' | 'prefix' | 'mod-ctrl-clash' | 'text-field';
  readonly message: string;
}

function isCommandChord(chord: KeyChord): boolean {
  return chord.modifiers.includes('Mod') || chord.modifiers.includes('Ctrl');
}

function checkChord(chord: KeyChord): Pick<PolicyViolation, 'rule' | 'message'> | null {
  if (chord.modifiers.includes('Alt')) return { rule: 'P5-alt', message: 'Alt/⌥ er ikke tillatt (P5)' };
  if (!isNamedKey(chord.key) && !P5_SAFE_CHARACTERS.has(chord.key)) {
    return { rule: 'P5-character', message: `«${chord.key}» krever ⌥ eller død tast på norsk Mac (P5)` };
  }
  return null;
}

/**
 * Alle brudd på tastepolicyen. Tom liste = lovlig tastaturkart.
 * - P4: første akkord i normal-modus kan ikke være en reservert tast uten modifikator
 *   (`Space d`, `z a` og `Ctrl+d` er lov – de starter ikke med en reservert tast).
 * - P4: `Escape` kun for `system.escape`.
 * - P5: ingen Alt, kun tegn fra hvitelisten.
 * - Entydighet: ingen duplikater, og ingen sekvens er prefiks av en annen i samme modus
 *   (da trengs aldri tidsavbrudd for å skille `g` fra `gg`).
 * - `Mod+x` og `Ctrl+x` kan ikke begge bindes (de er samme trykk utenfor Apple).
 * - `inTextFields` kun for én akkord med Mod/Ctrl (P7).
 */
export function validateBindings(bindings: readonly BindingToCheck[]): PolicyViolation[] {
  const violations: PolicyViolation[] = [];
  const parsed: Array<{ binding: BindingToCheck; sequence: KeySequence; id: string }> = [];

  for (const binding of bindings) {
    const fail = (rule: PolicyViolation['rule'], message: string) =>
      violations.push({ commandId: binding.commandId, keys: binding.keys, rule, message });
    let sequence: KeySequence;
    try {
      sequence = parseKeySequence(binding.keys);
    } catch (error) {
      fail('notation', error instanceof Error ? error.message : String(error));
      continue;
    }
    const first = sequence[0] as KeyChord;
    if (binding.mode === 'normal' && first.modifiers.length === 0 && RESERVED_NORMAL_KEYS.includes(first.key)) {
      fail('P4-reserved', `«${first.key}» er reservert for redigering (P4)`);
    }
    if (sequence.some((c) => c.key === 'Escape') && binding.commandId !== ESCAPE_COMMAND_ID) {
      fail('P4-escape', 'Esc er reservert for «gå ut av modus» / lukk (P4)');
    }
    for (const chord of sequence) {
      const problem = checkChord(chord);
      if (problem) fail(problem.rule, problem.message);
    }
    if (binding.inTextFields && (sequence.length !== 1 || !isCommandChord(first))) {
      fail('text-field', 'Kun én akkord med Mod/Ctrl kan virke i tekstfelt (P7)');
    }
    parsed.push({ binding, sequence, id: sequenceId(sequence) });
  }

  for (const a of parsed) {
    for (const b of parsed) {
      if (a === b || a.binding.mode !== b.binding.mode) continue;
      if (a.id === b.id && parsed.indexOf(a) < parsed.indexOf(b)) {
        violations.push({ commandId: b.binding.commandId, keys: b.binding.keys, rule: 'duplicate', message: `Samme taster som ${a.binding.commandId}` });
      } else if (b.id.startsWith(`${a.id} `)) {
        violations.push({ commandId: b.binding.commandId, keys: b.binding.keys, rule: 'prefix', message: `${a.binding.commandId} (${a.binding.keys}) er et prefiks` });
      }
      const [ca] = a.sequence;
      const [cb] = b.sequence;
      if (
        ca && cb && a.sequence.length === 1 && b.sequence.length === 1 &&
        ca.key === cb.key && ca.modifiers.includes('Mod') && cb.modifiers.includes('Ctrl') &&
        chordId({ key: ca.key, modifiers: ca.modifiers.filter((m) => m !== 'Mod') }) === chordId({ key: cb.key, modifiers: cb.modifiers.filter((m) => m !== 'Ctrl') })
      ) {
        violations.push({ commandId: b.binding.commandId, keys: b.binding.keys, rule: 'mod-ctrl-clash', message: `Kolliderer med ${a.binding.keys} utenfor Apple` });
      }
    }
  }
  return violations;
}
