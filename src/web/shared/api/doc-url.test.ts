import { describe, expect, it } from 'vitest';
import { assetUrl, docPathFromPathname, docUrl, folderOf, isImagePath } from './doc-url';

describe('docUrl', () => {
  it('enkoder per segment og beholder skråstreker (api.md)', () => {
    expect(docUrl('test', 'domene/Kunde')).toBe('/v/test/domene/Kunde');
    expect(docUrl('test', 'edge/R&D – spørsmål og svar')).toBe(
      '/v/test/edge/R%26D%20%E2%80%93%20sp%C3%B8rsm%C3%A5l%20og%20svar',
    );
    expect(docUrl('test', 'edge/Notat (kopi)')).toBe('/v/test/edge/Notat%20(kopi)');
    expect(docUrl('test', 'a/100% #1?')).toBe('/v/test/a/100%25%20%231%3F');
  });

  it('legger til anker', () => {
    expect(docUrl('test', 'x', 'partisjoner')).toBe('/v/test/x#partisjoner');
    expect(docUrl('test', 'x', '^offset-def')).toBe('/v/test/x#%5Eoffset-def');
  });
});

describe('docPathFromPathname', () => {
  it('er inversen av docUrl', () => {
    for (const p of ['domene/Kunde', 'edge/R&D – spørsmål og svar', 'edge/versjon 2.0.1 notater', 'a/100% #1?', 'Oppgaver.base']) {
      expect(docPathFromPathname(docUrl('test', p), 'test')).toBe(p);
    }
  });

  it('gir tom streng for vaultets forside', () => {
    expect(docPathFromPathname('/v/test', 'test')).toBe('');
    expect(docPathFromPathname('/v/test/', 'test')).toBe('');
  });

  it('tåler ugyldig prosentkoding', () => {
    expect(docPathFromPathname('/v/test/a%E0b', 'test')).toBe('a%E0b');
  });
});

describe('hjelpere', () => {
  it('assetUrl bruker query-parameter', () => {
    expect(assetUrl('test', 'attachments/diagram med mellomrom.png')).toBe(
      '/api/vaults/test/assets?path=attachments%2Fdiagram%20med%20mellomrom.png',
    );
  });

  it('folderOf og isImagePath', () => {
    expect(folderOf('domene/delt/Adresse')).toBe('domene/delt');
    expect(folderOf('Velkommen')).toBe('');
    expect(isImagePath('a/b.PNG')).toBe(true);
    expect(isImagePath('Oppgaver.base')).toBe(false);
  });
});
