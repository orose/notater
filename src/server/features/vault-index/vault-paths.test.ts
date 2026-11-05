import { describe, expect, it } from 'vitest';
import { classifyFile, describeVaultPath, isIgnoredPath, normalizeVaultPath } from './vault-paths';

describe('normalizeVaultPath', () => {
  it('gjør om til NFC og POSIX-separatorer', () => {
    expect(normalizeVaultPath('edge\\Årsrapport (NFD).md')).toBe('edge/Årsrapport (NFD).md');
  });
});

describe('isIgnoredPath', () => {
  it('ignorerer alt som starter med punktum, på alle nivåer', () => {
    expect(isIgnoredPath('.obsidian/app.json', [])).toBe(true);
    expect(isIgnoredPath('.trash/Slettet notat.md', [])).toBe(true);
    expect(isIgnoredPath('a/.git/x', [])).toBe(true);
    expect(isIgnoredPath('a/.skjult.md', [])).toBe(true);
    expect(isIgnoredPath('domene/Kunde.md', [])).toBe(false);
  });

  it('ignorerer node_modules og konfigurerte prefikser', () => {
    expect(isIgnoredPath('x/node_modules/y.md', [])).toBe(true);
    expect(isIgnoredPath('Maler/Mal.md', ['Maler/'])).toBe(true);
    expect(isIgnoredPath('Maler/Mal.md', ['Maler'])).toBe(true);
    expect(isIgnoredPath('Malerier/x.md', ['Maler'])).toBe(false);
  });
});

describe('classifyFile', () => {
  it('klassifiserer filtyper', () => {
    expect(classifyFile('a/Kunde.md')).toEqual({ kind: 'note', unsupportedKind: null });
    expect(classifyFile('Oppgaver.base')).toEqual({ kind: 'base', unsupportedKind: null });
    expect(classifyFile('Tegning.canvas')).toEqual({ kind: 'unsupported', unsupportedKind: 'canvas' });
    expect(classifyFile('edge/Skisse.excalidraw.md')).toEqual({ kind: 'unsupported', unsupportedKind: 'excalidraw' });
    expect(classifyFile('bilder/a.PNG')).toEqual({ kind: 'asset', unsupportedKind: null });
  });
});

describe('describeVaultPath', () => {
  it('notat: docPath og tittel uten .md', () => {
    expect(describeVaultPath('domene/Kunde.md')).toMatchObject({
      filePath: 'domene/Kunde.md',
      docPath: 'domene/Kunde',
      title: 'Kunde',
      name: 'Kunde',
      ext: 'md',
      folder: 'domene',
      kind: 'note',
    });
  });

  it('punktum i filnavn tolkes ikke som endelse (QA-URL-02)', () => {
    expect(describeVaultPath('edge/versjon 2.0.1 notater.md')).toMatchObject({
      docPath: 'edge/versjon 2.0.1 notater',
      title: 'versjon 2.0.1 notater',
    });
  });

  it('base og vedlegg beholder endelsen i docPath og navn', () => {
    expect(describeVaultPath('Oppgaver.base')).toMatchObject({
      docPath: 'Oppgaver.base',
      name: 'Oppgaver.base',
      title: 'Oppgaver',
      folder: '',
      ext: 'base',
    });
    expect(describeVaultPath('attachments/logo.svg')).toMatchObject({ docPath: 'attachments/logo.svg', ext: 'svg' });
  });

  it('excalidraw-notat: tittel Skisse.excalidraw', () => {
    expect(describeVaultPath('edge/Skisse.excalidraw.md')).toMatchObject({
      docPath: 'edge/Skisse.excalidraw',
      title: 'Skisse.excalidraw',
    });
  });
});
