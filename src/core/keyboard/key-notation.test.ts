import { describe, expect, it } from 'vitest';
import { KeyNotationError, chordId, formatKeySequence, parseKeySequence, sequenceId } from './key-notation';

describe('parseKeySequence', () => {
  it('parser sekvenser, leader og modifikatorer', () => {
    expect(sequenceId(parseKeySequence('g g'))).toBe('g g');
    expect(sequenceId(parseKeySequence('Leader w'))).toBe('Space w');
    expect(sequenceId(parseKeySequence('Mod+k'))).toBe('Mod+k');
    expect(sequenceId(parseKeySequence('Shift+Ctrl+Tab'))).toBe('Ctrl+Shift+Tab');
    expect(chordId(parseKeySequence('+')[0]!)).toBe('+');
    expect(chordId(parseKeySequence('Mod++')[0]!)).toBe('Mod++');
  });

  it('avviser Shift på tegn og ukjente taster', () => {
    expect(() => parseKeySequence('Shift+g')).toThrow(KeyNotationError);
    expect(() => parseKeySequence('Hyper+k')).toThrow(KeyNotationError);
    expect(() => parseKeySequence('Spacebar')).toThrow(KeyNotationError);
    expect(() => parseKeySequence('  ')).toThrow(KeyNotationError);
  });
});

describe('formatKeySequence', () => {
  const f = (keys: string, p: Parameters<typeof formatKeySequence>[1]) => formatKeySequence(parseKeySequence(keys), p);

  it('skriver som spesifikasjonens tastaturkart', () => {
    expect(f('g g', 'apple')).toBe('gg');
    expect(f('z M', 'apple')).toBe('zM');
    expect(f('Leader w', 'apple')).toBe('Space w');
    expect(f('Ctrl+d', 'apple')).toBe('Ctrl d');
    expect(f('Escape', 'other')).toBe('Esc');
  });

  it('PO-36: ⌘K på Apple, Ctrl K ellers, begge i dokumentasjon', () => {
    expect(f('Mod+k', 'apple')).toBe('⌘K');
    expect(f('Mod+k', 'other')).toBe('Ctrl K');
    expect(f('Mod+k', 'docs')).toBe('⌘K / Ctrl K');
    expect(f('j', 'docs')).toBe('j');
  });
});
