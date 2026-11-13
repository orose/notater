// Notatlisten ved oppstart (ADR-011 §7, designsystem-terminal §5.5): søkefelt, fuzzy-rangering, markør. Ren tilstand.

import type { DecodedKey } from '../keys';
import { rankNotes, type NoteCandidate, type RankedNote } from '../vault';

export interface PickerState {
  readonly notes: readonly NoteCandidate[];
  readonly query: string;
  readonly results: readonly RankedNote[];
  readonly cursor: number;
}

export type PickerOutcome = { readonly kind: 'stay'; readonly state: PickerState } | { readonly kind: 'open'; readonly docPath: string } | { readonly kind: 'quit' };

export function createPicker(notes: readonly NoteCandidate[], query = ''): PickerState {
  return { notes, query, results: rankNotes(notes, query), cursor: 0 };
}

function withQuery(state: PickerState, query: string): PickerState {
  return { ...state, query, results: rankNotes(state.notes, query), cursor: 0 };
}

function move(state: PickerState, by: number): PickerState {
  const max = state.results.length - 1;
  return { ...state, cursor: Math.max(0, Math.min(max, state.cursor + by)) };
}

const stay = (state: PickerState): PickerOutcome => ({ kind: 'stay', state });

/** Ett tastetrykk. `pageSize` = antall synlige rader (PageUp/PageDown). */
export function pickerKey(state: PickerState, key: DecodedKey, pageSize = 10): PickerOutcome {
  if (key.key === 'Escape' || (key.ctrlKey && key.key === 'c')) return { kind: 'quit' };
  if (key.key === 'Enter') {
    const hit = state.results[state.cursor];
    return hit ? { kind: 'open', docPath: hit.note.docPath } : stay(state);
  }
  if (key.key === 'ArrowDown' || (key.ctrlKey && key.key === 'n')) return stay(move(state, 1));
  if (key.key === 'ArrowUp' || (key.ctrlKey && key.key === 'p')) return stay(move(state, -1));
  if (key.key === 'PageDown') return stay(move(state, pageSize));
  if (key.key === 'PageUp') return stay(move(state, -pageSize));
  if (key.key === 'Backspace') return stay(withQuery(state, [...state.query].slice(0, -1).join('')));
  if (key.ctrlKey && key.key === 'u') return stay(withQuery(state, ''));
  if (key.ctrlKey && key.key === 'w') return stay(withQuery(state, state.query.replace(/\S*\s*$/u, '')));
  if (!key.ctrlKey && !key.altKey && !key.metaKey && [...key.key].length === 1) return stay(withQuery(state, state.query + key.key));
  if (key.key === 'Space') return stay(withQuery(state, `${state.query} `));
  return stay(state);
}

/** Lim inn i søkefeltet (bracketed paste): én linje. */
export function pickerPaste(state: PickerState, text: string): PickerState {
  return withQuery(state, state.query + text.replace(/[\r\n\t]+/g, ' '));
}
