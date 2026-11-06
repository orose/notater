import { join } from 'node:path';
import type { Element } from 'hast';
import { beforeAll, describe, expect, it } from 'vitest';
import type { BaseDocument, NoteDocument } from '../../../shared/api-types';
import { createBaseEvaluator } from '../bases';
import { byTag, findAll, testHighlighter, textOf } from '../../test-support/render-fixtures';
import { createInlineMetaExtractor } from '../vault-index';
import { createVaultRuntime } from '../vault-registry';
import type { VaultState } from '../vault-registry';
import { getDocument } from './document-service';

let state: VaultState;
const bases = createBaseEvaluator();

beforeAll(async () => {
  const vault = createVaultRuntime(
    { id: 'test', name: 'Testvault', root: join(process.cwd(), 'test-vault'), ignore: [], hiddenProperties: [] },
    { highlighter: testHighlighter, createInitialExtractor: createInlineMetaExtractor, incrementalExtractor: createInlineMetaExtractor(), watch: null },
  );
  state = await vault.renderReady();
}, 60_000);

const note = (path: string): NoteDocument => {
  const doc = getDocument(state, path, bases);
  if (doc?.kind !== 'note') throw new Error(`ikke notat: ${path}`);
  return doc;
};
const backlinkSources = (path: string) => note(path).backlinks.map((b) => b.source).sort();

describe('getDocument – oppslag', () => {
  it('ukjent sti og traversal gir null (QA-URL-08)', () => {
    for (const path of ['Finnes ikke', '../etc/passwd', '..%2f..%2fetc', '/etc/hosts', '.obsidian/app.json', '.trash/Slettet notat']) {
      expect(getDocument(state, path, bases), path).toBeNull();
    }
  });

  it('NFD-fil er tilgjengelig via NFC-sti (QA-IDX-09)', () => {
    expect(note('edge/Årsrapport (NFD)').title).toBe('Årsrapport (NFD)');
  });
});

describe('getDocument – notat', () => {
  it('Velkommen: metadata og innhold', () => {
    const doc = note('Velkommen');
    expect(doc).toMatchObject({ kind: 'note', vaultId: 'test', path: 'Velkommen', filePath: 'Velkommen.md', title: 'Velkommen' });
    expect(doc.mtime).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(doc.content.type).toBe('root');
  });

  it('tagger iht. fasit (QA-TAG-01/05/07/11)', () => {
    expect(note('oppgaver/Rydd Kafka-konsumentgrupper').tags).toEqual(['team', 'task/backend']);
    expect(note('oppgaver/Bytt til records i DTO-er').tags).toEqual(['Task']);
    expect(note('teknisk/Bash-tips').tags).toEqual(['bash', 'verktøy', 'taskforce']);
    expect(note('domene/Hendelseskatalog').tags).toEqual(['kafka-topics', 'katalog']);
    expect(note('README-QA').tags).toEqual([]);
  });

  it('ugyldig frontmatter: ingen properties/tagger, advarsel (QA-IDX-07)', () => {
    const doc = note('edge/Ugyldig frontmatter');
    expect(doc.properties).toEqual([]);
    expect(doc.tags).toEqual([]);
    expect(doc.frontmatterError).toMatch(/kunne ikke leses/);
    expect(note('Velkommen').frontmatterError).toBeNull();
    expect(doc.warnings).toEqual([{ code: 'invalid-frontmatter', message: expect.stringContaining('kunne ikke leses') }]);
  });

  it('properties typet, inkl. brutte lenker (QA-FM-01, QA-LNK-04)', () => {
    const props = Object.fromEntries(note('edge/Frontmatter-typer').properties.map((p) => [p.key, p.value]));
    expect(props.tall).toEqual({ type: 'number', value: 42 });
    expect(props.dato).toEqual({ type: 'date', value: '2026-11-05T00:00:00.000Z', hasTime: false });
    expect(props.lenke).toEqual({ type: 'link', target: 'teknisk/Kafka/Kafka-grunnleggende', display: 'Kafka-grunnleggende' });
    expect(props.lenkeliste).toEqual({
      type: 'list',
      value: [
        { type: 'link', target: 'domene/Ordre', display: 'Ordre' },
        { type: 'link', target: null, display: 'Finnes ikke' },
      ],
    });
  });

  it('cssclasses skjules alltid, konfigurerte nøkler skjules (PO-22); ordtelling (PO-23)', () => {
    expect(note('edge/Frontmatter-typer').properties.map((p) => p.key)).not.toContain('cssclasses');
    const doc = getDocument(state, 'edge/Frontmatter-typer', bases, { hiddenProperties: ['URL'] }) as NoteDocument;
    expect(doc.properties.map((p) => p.key)).not.toContain('url');
    expect(note('edge/Tomt notat').wordCount).toBe(0);
    expect(note('Velkommen').wordCount).toBeGreaterThan(10);
  });

  it('README-QA har 0 utgående lenker', () => {
    expect(findAll(note('README-QA').content, (el) => el.tagName === 'a' && el.properties.dataVrLink !== 'external')).toEqual([]);
  });

  it('kommentarer finnes ikke i innholdet (QA-MD-02)', () => {
    expect(JSON.stringify(note('teknisk/Markdown-elementer').content)).not.toContain('HEMMELIG');
  });
});

describe('getDocument – lenker i Lenketest (README-QA §4)', () => {
  const links = (): Element[] => findAll(note('lenker/Lenketest').content, byTag('a'));
  const byText = (text: string) => links().find((a) => textOf(a) === text)!;

  it('løser og bryter lenker iht. fasit', () => {
    expect(byText('Ordre').properties.dataVrTarget).toBe('domene/Ordre');
    expect(byText('ordrene våre').properties.dataVrTarget).toBe('domene/Ordre');
    expect(byText('kafka-grunnleggende').properties.dataVrTarget).toBe('teknisk/Kafka/Kafka-grunnleggende');
    expect(byText('Avtale').properties.dataVrTarget).toBe('domene/avtale');
    expect(byText('Faktura.md').properties.dataVrTarget).toBe('domene/Faktura');
    expect(byText('Årsrapport (NFD)').properties.dataVrTarget).toBe('edge/Årsrapport (NFD)');
    expect(byText('Bestilling').properties).toMatchObject({ dataVrLink: 'unresolved', dataVrSuggest: 'domene/Ordre' });
    expect(byText('Slettet notat').properties.dataVrLink).toBe('unresolved');
    expect(byText('README').properties.dataVrLink).toBe('unresolved');
    expect(byText('Tegning.canvas').properties.dataVrTarget).toBe('Tegning.canvas');
    expect(byText('logoen').properties.dataVrTarget).toBe('attachments/logo.svg');
  });

  it('tvetydig Kunde → domene/Kunde, merket (PO-8)', () => {
    expect(byText('Kunde').properties).toMatchObject({ dataVrTarget: 'domene/Kunde', dataVrAmbiguous: '2' });
  });

  it('ankre: overskrift, blokk, manglende anker (punkt 3, 6, 31)', () => {
    expect(byText('Kafka-grunnleggende › Partisjoner').properties.dataVrAnchor).toBe('partisjoner');
    expect(byText('Kafka-grunnleggende › ^offset-def').properties.dataVrAnchor).toBe('^offset-def');
    expect(byText('Kafka-grunnleggende › Overskrift som ikke finnes').properties).toMatchObject({
      dataVrLink: 'internal',
      dataVrAnchorMissing: 'true',
      dataVrAnchor: 'Overskrift som ikke finnes',
      href: '/v/test/teknisk/Kafka/Kafka-grunnleggende',
    });
  });

  it('markdown-lenker relativt og URL-dekodet (44–48)', () => {
    expect(byText('Kunde (relativ)').properties.dataVrTarget).toBe('domene/Kunde');
    expect(byText('Spring-konfig (URL-kodet)').properties.dataVrTarget).toBe('teknisk/Spring/Spring Boot – konfigurasjon');
    expect(byText('Ordre med vinkelparentes').properties.dataVrTarget).toBe('domene/Ordre');
    expect(byText('Ekstern lenke').properties.dataVrLink).toBe('external');
    expect(byText('Brutt markdown-lenke').properties.dataVrLink).toBe('unresolved');
  });

  it('blokk-id-markør vises ikke (QA-LNK-01)', () => {
    const block = findAll(note('lenker/Lenketest').content, (el) => el.properties.id === '^lokal-blokk')[0]!;
    expect(textOf(block)).toBe('Dette avsnittet har en blokk-ID.');
  });
});

describe('getDocument – tilbakelenker (README-QA §4 tabell)', () => {
  it('distinkte kilder per mål', () => {
    expect(backlinkSources('domene/Kunde')).toHaveLength(9);
    expect(backlinkSources('arkiv/2023/Kunde')).toEqual(['lenker/Lenketest']);
    expect(backlinkSources('teknisk/Kafka/Kafka-grunnleggende')).toHaveLength(8);
    expect(backlinkSources('domene/Ordre')).toHaveLength(11);
    expect(backlinkSources('domene/avtale')).toEqual(['domene/Faktura', 'domene/_MOC', 'lenker/Lenketest']);
    expect(backlinkSources('lenker/Syklus A')).toEqual(['lenker/Embed-test', 'lenker/Syklus B']);
    expect(backlinkSources('README-QA')).toEqual([]);
  });

  it('property-lenker merkes (PO-9)', () => {
    const fm = note('teknisk/Kafka/Kafka-grunnleggende').backlinks.find((b) => b.source === 'edge/Frontmatter-typer');
    expect(fm).toMatchObject({ fromProperty: true });
  });

  it('base har tilbakelenker (6)', () => {
    const doc = getDocument(state, 'Oppgaver.base', bases) as BaseDocument;
    expect(doc.backlinks).toHaveLength(6);
  });
});

describe('getBacklinks (PO-28)', () => {
  it('mål som ikke finnes: «Lenket fra»', async () => {
    const { getBacklinks } = await import('./document-service');
    const result = getBacklinks(state, 'Finnes ikke|brutt med alias');
    expect(result).toMatchObject({ exists: false, path: 'Finnes ikke|brutt med alias' });
    expect(result.backlinks.map((b) => b.source)).toContain('lenker/Lenketest');
    expect(getBacklinks(state, 'domene/avtale')).toMatchObject({ exists: true });
    expect(getBacklinks(state, 'domene/avtale').backlinks).toHaveLength(3);
  });
});

describe('getDocument – embeds i Embed-test (README-QA §5)', () => {
  const embeds = () => findAll(note('lenker/Embed-test').content, byTag('vr-embed'));

  it('statuser', () => {
    const statuses = embeds().map((e) => `${e.properties.dataTarget ?? e.properties.dataRaw}:${e.properties.dataStatus}`);
    expect(statuses).toContain('lenker/Syklus A:ok');
    expect(statuses).toContain('lenker/Syklus A:cycle');
    expect(statuses).toContain('![[Finnes ikke]]:missing');
    expect(statuses).toContain('![[Kafka-grunnleggende#Seksjon som ikke finnes]]:missing');
    expect(statuses).toContain('lenker/Kjede 3:ok');
  });

  it('kjede 3 viser kun Innhold (QA-EMB-07)', () => {
    const kjede3 = embeds().find((e) => e.properties.dataTarget === 'lenker/Kjede 3')!;
    expect(textOf(kjede3)).toContain('bunnen av kjeden');
    expect(textOf(kjede3)).not.toContain('Ikke med');
  });

  it('base-embeds evalueres; #View gir bare det viewet (PO-12), canvas er ikke støttet', () => {
    const doc = note('lenker/Embed-test');
    const baseEls = findAll(doc.content, byTag('vr-base'));
    expect(baseEls.map((b) => b.properties.dataView ?? null)).toEqual([null, 'Kanban', 'Ukjent']);
    const results = baseEls.map((b) => doc.bases[String(b.properties.dataBaseId)]!);
    expect(results.map((r) => r.views.map((v) => v.name))).toEqual([['Huskeliste', 'Kanban', 'Arkiv'], ['Kanban'], []]);
    // PO-34/PO-42: ukjent view → advarsel med liste over tilgjengelige views, ingen fallback.
    expect(results[2]!.warnings).toEqual([expect.objectContaining({ code: 'unknown-view', message: expect.stringContaining('«Huskeliste», «Kanban», «Arkiv»') })]);
    expect(findAll(doc.content, byTag('vr-unsupported'))[0]!.properties.dataKind).toBe('canvas');
  });
});

describe('getDocument – andre filtyper', () => {
  it('base gir BaseDocument', () => {
    const doc = getDocument(state, 'Oppgaver.base', bases) as BaseDocument;
    expect(doc).toMatchObject({ kind: 'base', title: 'Oppgaver', result: { warnings: [] } });
    expect(doc.result.views.map((v) => v.name)).toEqual(['Huskeliste', 'Kanban', 'Arkiv']);
  });

  it('canvas og excalidraw gir vr-unsupported', () => {
    expect(findAll(note('Tegning.canvas').content, byTag('vr-unsupported'))[0]!.properties.dataKind).toBe('canvas');
    expect(findAll(note('edge/Skisse.excalidraw').content, byTag('vr-unsupported'))[0]!.properties.dataKind).toBe('excalidraw');
  });

  it('bilde gir img via vedleggsruten, med dimensjoner fra filheaderen (PO-71)', () => {
    expect(findAll(note('attachments/logo.svg').content, byTag('img'))[0]!.properties).toMatchObject({
      src: '/api/vaults/test/assets?path=attachments%2Flogo.svg',
      width: 120,
      height: 120,
    });
    expect(findAll(note('attachments/bred.png').content, byTag('img'))[0]!.properties).toMatchObject({ width: 2400, height: 40 });
  });

  it('lokale bilder i notater får width/height (PO-71, QA-IMG-01–07)', () => {
    const sizes = findAll(note('lenker/Bilder').content, byTag('img')).map((img) => [img.properties.alt, img.properties.width, img.properties.height]);
    expect(sizes).toEqual([
      ['arkitektur.png', 320, 180],
      ['arkitektur.png', 160, 90],
      ['Arkitekturskisse', 200, 113],
      ['logo.svg', 120, 120],
      ['diagram med mellomrom.png', 64, 64],
      ['bred.png', 2400, 40],
      ['Arkitektur, relativ sti', 320, 180],
      ['Logo fra vault-roten', 120, 120],
      ['Sjakkbrett', 64, 64],
      ['Sjakkbrett URL-kodet', 64, 64],
      ['domenemodell.svg', 240, 80],
    ]);
  });

  it('render-cache gjenbrukes innen samme revisjon', () => {
    expect(note('Velkommen').content).toBe(note('Velkommen').content);
  });
});
