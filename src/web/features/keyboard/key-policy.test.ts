import { describe, expect, it } from 'vitest';
import { validateBindings, type BindingToCheck } from './key-policy';

const b = (keys: string, commandId = 'x.test', extra: Partial<BindingToCheck> = {}): BindingToCheck => ({ commandId, mode: 'normal', keys, ...extra });
const rules = (bindings: BindingToCheck[]) => validateBindings(bindings).map((v) => v.rule);

describe('validateBindings', () => {
  it('godtar spesifikasjonens bindinger', () => {
    expect(rules([b('Leader d', 'a'), b('z a', 'b'), b('Ctrl+d', 'c'), b('Ctrl+u', 'd'), b('?', 'e'), b(':', 'f')])).toEqual([]);
  });

  it('P4: reserverte taster kan ikke starte en binding, Esc kun for system.escape', () => {
    expect(rules([b('d')])).toEqual(['P4-reserved']);
    expect(rules([b('I')])).toEqual(['P4-reserved']);
    expect(rules([b('Escape')])).toEqual(['P4-escape']);
    expect(rules([b('Escape', 'system.escape')])).toEqual([]);
  });

  it('P5: ingen Alt og ingen ⌥-/døde tegn', () => {
    expect(rules([b('Alt+k')])).toEqual(['P5-alt']);
    for (const ch of ['[', ']', '{', '}', '\\', '|', '@', '$', '~', '^', '`']) {
      expect(rules([b(ch)]), ch).toEqual(['P5-character']);
    }
  });

  it('entydighet: duplikat, prefiks og Mod/Ctrl-kollisjon', () => {
    expect(rules([b('g g', 'a'), b('g g', 'b')])).toEqual(['duplicate']);
    expect(rules([b('g', 'a'), b('g g', 'b')])).toEqual(['prefix']);
    expect(rules([b('Mod+k', 'a'), b('Ctrl+k', 'b')])).toEqual(['mod-ctrl-clash']);
  });

  it('P7: inTextFields kun for én Mod/Ctrl-akkord', () => {
    expect(rules([b('Mod+k', 'a', { inTextFields: true })])).toEqual([]);
    expect(rules([b('/', 'a', { inTextFields: true })])).toEqual(['text-field']);
  });
});
