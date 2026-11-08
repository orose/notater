import { describe, expect, it } from 'vitest';
import { describeVaultPath } from '../vault-index';
import type { VaultFile } from '../vault-index';
import { createLinkResolver } from './link-resolver';

function files(...paths: string[]): VaultFile[] {
  return paths.map((p) => ({ ...describeVaultPath(p), diskPath: p, size: 0, mtimeMs: 0, ctimeMs: 0 }));
}

const VAULT = files(
  'Velkommen.md',
  'domene/Ordre.md',
  'domene/Kunde.md',
  'arkiv/2023/Kunde.md',
  'domene/avtale.md',
  'domene/Faktura.md',
  'domene/delt/Adresse.md',
  'teknisk/Kafka/Kafka-grunnleggende.md',
  'teknisk/Kafka/Consumer groups.md',
  'teknisk/Spring/Spring Boot – konfigurasjon.md',
  'edge/Årsrapport (NFD).md',
  'edge/versjon 2.0.1 notater.md',
  'edge/Skisse.excalidraw.md',
  'lenker/Lenketest.md',
  'lenker/Kunde.md',
  'Oppgaver.base',
  'Tegning.canvas',
  'attachments/arkitektur.png',
  'attachments/logo.svg',
  'domene/domenemodell.svg',
);

const resolver = createLinkResolver(VAULT);
const FROM = 'Velkommen.md';
const target = (link: string, from = FROM, kind: 'wiki' | 'markdown' = 'wiki') =>
  resolver.resolve(link, from, kind)?.file.filePath ?? null;

describe('resolve – Obsidian-regler (README-QA §4)', () => {
  it('basename, case-insensitivt', () => {
    expect(target('Ordre')).toBe('domene/Ordre.md');
    expect(target('ORDRE')).toBe('domene/Ordre.md');
    expect(target('kafka-grunnleggende')).toBe('teknisk/Kafka/Kafka-grunnleggende.md');
    expect(target('Avtale')).toBe('domene/avtale.md');
  });

  it('eksakt sti fra rot og sti-suffiks', () => {
    expect(target('domene/Kunde')).toBe('domene/Kunde.md');
    expect(target('arkiv/2023/Kunde')).toBe('arkiv/2023/Kunde.md');
    expect(target('teknisk/Kafka/Consumer groups')).toBe('teknisk/Kafka/Consumer groups.md');
    expect(target('delt/Adresse')).toBe('domene/delt/Adresse.md');
  });

  it('.md-endelse og andre filtyper med endelse', () => {
    expect(target('Faktura.md')).toBe('domene/Faktura.md');
    expect(target('Oppgaver.base')).toBe('Oppgaver.base');
    expect(target('Tegning.canvas')).toBe('Tegning.canvas');
    expect(target('arkitektur.png')).toBe('attachments/arkitektur.png');
    expect(target('attachments/logo.svg')).toBe('attachments/logo.svg');
    expect(target('Oppgaver')).toBeNull();
  });

  it('punktum i notatnavn, excalidraw og NFC/NFD', () => {
    expect(target('versjon 2.0.1 notater')).toBe('edge/versjon 2.0.1 notater.md');
    expect(target('Skisse.excalidraw')).toBe('edge/Skisse.excalidraw.md');
    expect(target('Årsrapport (NFD)')).toBe('edge/Årsrapport (NFD).md');
    expect(target('Årsrapport (NFD)')).toBe('edge/Årsrapport (NFD).md');
  });

  it('tvetydig: samme mappe først, så færrest mapper, så alfabetisk (PO-8)', () => {
    expect(target('Kunde', 'Velkommen.md')).toBe('domene/Kunde.md');
    expect(target('Kunde', 'lenker/Lenketest.md')).toBe('lenker/Kunde.md');
    expect(target('Kunde', 'arkiv/2023/x.md')).toBe('arkiv/2023/Kunde.md');
    const res = resolver.resolve('Kunde', FROM, 'wiki')!;
    expect(res.alternatives.map((f) => f.filePath)).toEqual(['lenker/Kunde.md', 'arkiv/2023/Kunde.md']);
    expect(resolver.resolve('Ordre', FROM, 'wiki')!.alternatives).toEqual([]);
  });

  it('tomt mål = samme notat', () => {
    expect(target('', 'lenker/Lenketest.md')).toBe('lenker/Lenketest.md');
  });

  it('brutte lenker', () => {
    expect(target('Finnes ikke')).toBeNull();
    expect(target('domene/Finnes ikke')).toBeNull();
    expect(target('Slettet notat')).toBeNull();
  });

  it('relativ sti (./, ../) – aldri ut av vaultet', () => {
    expect(target('../domene/Kunde', 'lenker/Lenketest.md')).toBe('domene/Kunde.md');
    expect(target('./Lenketest', 'lenker/Lenketest.md')).toBe('lenker/Lenketest.md');
    expect(target('../../etc/passwd', 'lenker/Lenketest.md')).toBeNull();
    expect(target('../../../Velkommen', 'lenker/Lenketest.md')).toBeNull();
  });

  it('wikilinks URL-dekodes ikke (%2e%2e er bokstavelig)', () => {
    expect(target('%2e%2e/%2e%2e/etc/passwd', 'lenker/Lenketest.md')).toBeNull();
  });

  it('markdown-lenker: relativ til kilden først, så vault-rot (QA-IMG-07/08)', () => {
    expect(target('../domene/Kunde.md', 'lenker/Lenketest.md', 'markdown')).toBe('domene/Kunde.md');
    expect(target('Spring/Spring Boot – konfigurasjon.md', 'teknisk/Markdown.md', 'markdown')).toBe(
      'teknisk/Spring/Spring Boot – konfigurasjon.md',
    );
    expect(target('attachments/logo.svg', 'lenker/Bilder.md', 'markdown')).toBe('attachments/logo.svg');
    expect(target('finnes-ikke.md', 'lenker/Lenketest.md', 'markdown')).toBeNull();
    expect(target('/etc/hosts', 'lenker/Lenketest.md', 'markdown')).toBeNull();
  });
});

describe('aliasforslag for brutte lenker (PO-7)', () => {
  it('finner notat med matchende alias, case-insensitivt', () => {
    const withAliases = createLinkResolver(VAULT, new Map([['domene/Ordre.md', ['Bestilling', 'Order']]]));
    expect(withAliases.resolve('Bestilling', FROM, 'wiki')).toBeNull();
    expect(withAliases.suggestByAlias('bestilling')?.filePath).toBe('domene/Ordre.md');
    expect(withAliases.suggestByAlias('Ukjent')).toBeNull();
  });
});
