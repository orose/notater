import { describe, expect, it } from 'vitest';
import { chordCandidates, type KeyInput } from './key-input';

const key = (k: string, mods: Partial<KeyInput> = {}): KeyInput => ({ key: k, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...mods });

describe('chordCandidates (norsk Mac-layout, ADR-007 §3)', () => {
  it(': / ? kommer med Shift, men Shift er ikke del av akkorden', () => {
    expect(chordCandidates(key(':', { shiftKey: true }))).toEqual([':']);
    expect(chordCandidates(key('/', { shiftKey: true }))).toEqual(['/']);
    expect(chordCandidates(key('?', { shiftKey: true }))).toEqual(['?']);
  });

  it('bokstaver følger Shift, ikke Caps Lock', () => {
    expect(chordCandidates(key('G', { shiftKey: true }))).toEqual(['G']);
    expect(chordCandidates(key('G'))).toEqual(['g']); // Caps Lock på, uten Shift
    expect(chordCandidates(key('g'))).toEqual(['g']);
  });

  it('Mod = ⌘ eller Ctrl; Ctrl matcher også bokstavelig Ctrl', () => {
    expect(chordCandidates(key('k', { metaKey: true }))).toEqual(['Mod+k']);
    expect(chordCandidates(key('K', { metaKey: true }))).toEqual(['Mod+k']);
    expect(chordCandidates(key('d', { ctrlKey: true }))).toEqual(['Ctrl+d', 'Mod+d']);
    expect(chordCandidates(key('.', { metaKey: true }))).toEqual(['Mod+.']);
  });

  it('⌥-tegn får Alt og kan dermed aldri treffe en binding (P5)', () => {
    expect(chordCandidates(key('[', { altKey: true }))).toEqual(['Alt+[']);
  });

  it('Space, navngitte taster og ignorerte trykk', () => {
    expect(chordCandidates(key(' '))).toEqual(['Space']);
    expect(chordCandidates(key('Tab', { shiftKey: true }))).toEqual(['Shift+Tab']);
    expect(chordCandidates(key('Dead'))).toEqual([]);
    expect(chordCandidates(key('Shift', { shiftKey: true }))).toEqual([]);
    expect(chordCandidates(key('a', { isComposing: true }))).toEqual([]);
  });
});
