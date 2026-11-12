import { describe, expect, it } from 'vitest';
import { formatDate, formatDateTime, statusKind } from './format';

describe('formatDate', () => {
  it('formaterer rene datoer norsk uten tidssoneforskyvning', () => {
    expect(formatDate('2026-11-03', false)).toBe('3. nov. 2026');
    expect(formatDate('2026-11-03T00:00:00.000Z', false, 'America/Los_Angeles')).toBe('3. nov. 2026');
  });

  it('tar med klokkeslett med punktum (norsk skrivemåte)', () => {
    expect(formatDate('2026-11-03T13:02:00.000Z', true, 'Europe/Oslo')).toBe('3. nov. 2026, 14.02');
    expect(formatDateTime('2026-11-03T13:02:00.000Z', 'Europe/Oslo')).toBe('3. nov. 2026, 14.02');
  });

  it('returnerer rå tekst ved ugyldig dato', () => {
    expect(formatDate('ikke en dato', false)).toBe('ikke en dato');
  });
});

describe('statusKind', () => {
  it('skiller ferdig, pågår og åpen (form + farge i CSS)', () => {
    expect(statusKind('done')).toBe('done');
    expect(statusKind('Ferdig')).toBe('done');
    expect(statusKind('aktiv')).toBe('done');
    expect(statusKind('doing')).toBe('doing');
    expect(statusKind('pågår')).toBe('doing');
    expect(statusKind('todo')).toBe('todo');
    expect(statusKind('utkast')).toBe('todo');
  });
});
