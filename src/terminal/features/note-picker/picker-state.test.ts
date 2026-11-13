import { describe, expect, it } from 'vitest';
import type { DecodedKey } from '../keys';
import type { NoteCandidate } from '../vault';
import { createPicker, pickerKey, pickerPaste, type PickerOutcome, type PickerState } from './picker-state';

const k = (key: string, ctrl = false): DecodedKey => ({ key, ctrlKey: ctrl, altKey: false, metaKey: false, shiftKey: false });
const notes: NoteCandidate[] = [
  { docPath: 'a/Kvartalsrapport', filePath: 'a/Kvartalsrapport.md', title: 'Kvartalsrapport', aliases: [], mtimeMs: 1 },
  { docPath: 'a/Årsrapport', filePath: 'a/Årsrapport.md', title: 'Årsrapport', aliases: [], mtimeMs: 3 },
  { docPath: 'b/Kafka', filePath: 'b/Kafka.md', title: 'Kafka', aliases: [], mtimeMs: 2 },
];
const stayed = (o: PickerOutcome): PickerState => {
  if (o.kind !== 'stay') throw new Error(o.kind);
  return o.state;
};

describe('notatlisten (designsystem-terminal §5.5)', () => {
  it('nyeste først uten søk; skriving filtrerer; Backspace, Ctrl u og Ctrl w retter', () => {
    let s = createPicker(notes);
    expect(s.results.map((r) => r.note.title)).toEqual(['Årsrapport', 'Kafka', 'Kvartalsrapport']);
    for (const ch of 'kaf') s = stayed(pickerKey(s, k(ch)));
    expect(s.query).toBe('kaf');
    expect(s.results[0]?.note.title).toBe('Kafka');
    s = stayed(pickerKey(s, k('Backspace')));
    expect(s.query).toBe('ka');
    s = stayed(pickerKey(s, k('u', true)));
    expect(s.query).toBe('');
    s = pickerPaste(s, 'rapport\n');
    expect(s.query).toBe('rapport ');
    expect(stayed(pickerKey(s, k('w', true))).query).toBe('');
  });

  it('↑ ↓ og Ctrl n/p flytter innenfor listen; Enter åpner; Esc og Ctrl c avslutter', () => {
    let s = createPicker(notes);
    s = stayed(pickerKey(s, k('ArrowDown')));
    s = stayed(pickerKey(s, k('n', true)));
    s = stayed(pickerKey(s, k('ArrowDown')));
    expect(s.cursor).toBe(2);
    s = stayed(pickerKey(s, k('p', true)));
    expect(pickerKey(s, k('Enter'))).toEqual({ kind: 'open', docPath: 'b/Kafka' });
    expect(pickerKey(s, k('Escape'))).toEqual({ kind: 'quit' });
    expect(pickerKey(s, k('c', true))).toEqual({ kind: 'quit' });
  });

  it('forhåndsutfylt søk (tvetydig argument)', () => {
    const s = createPicker(notes, 'rapport');
    expect(s.results.map((r) => r.note.title).sort()).toEqual(['Kvartalsrapport', 'Årsrapport']);
    expect(pickerKey(createPicker(notes, 'xyz'), k('Enter')).kind).toBe('stay');
  });
});
