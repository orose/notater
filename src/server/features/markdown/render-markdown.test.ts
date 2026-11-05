import type { Element } from 'hast';
import { beforeAll, describe, expect, it } from 'vitest';
import type { CodeHighlighter } from '../code-highlight';
import { renderMarkdown } from './render-markdown';
import { byTag, fakeContext, findAll, testHighlighter, textOf } from './test-support';

let highlighter: CodeHighlighter;
beforeAll(async () => {
  highlighter = await testHighlighter();
}, 30_000);

const render = (src: string, options = {}) => {
  const ctx = fakeContext(highlighter);
  return { ctx, ...renderMarkdown(src, ctx, options) };
};
const first = (src: string, tag: string): Element => findAll(render(src).content, byTag(tag))[0]!;

describe('wikilinks', () => {
  it('intern lenke med href, mål og anker', () => {
    const a = first('Se [[Kafka-grunnleggende#Partisjoner|her]]', 'a');
    expect(a.properties).toMatchObject({
      dataVrLink: 'internal',
      dataVrTarget: 'Kafka-grunnleggende',
      dataVrAnchor: 'partisjoner',
      href: '/v/test/Kafka-grunnleggende#partisjoner',
    });
    expect(textOf(a)).toBe('her');
  });

  it('visningstekst uten alias: mål › anker', () => {
    expect(textOf(first('[[Kafka#Partisjoner]]', 'a'))).toBe('Kafka › Partisjoner');
    expect(textOf(first('[[#Brutte lenker]]', 'a'))).toBe('Brutte lenker');
    expect(textOf(first('[[Ordre]]', 'a'))).toBe('Ordre');
  });

  it('brutt lenke: ingen href, rå tekst for tooltip', () => {
    const a = first('[[Finnes ikke|brutt]]', 'a');
    expect(a.properties).toMatchObject({ dataVrLink: 'unresolved', dataVrRaw: 'Finnes ikke|brutt' });
    expect(a.properties.href).toBeUndefined();
    expect(textOf(a)).toBe('brutt');
  });

  it('aliasforslag «Mente du X?» (PO-7)', () => {
    const a = first('[[Bestilling]]', 'a');
    expect(a.properties).toMatchObject({ dataVrLink: 'unresolved', dataVrSuggestion: 'domene/Ordre', dataVrSuggestionTitle: 'Ordre' });
  });

  it('tvetydig lenke og manglende anker merkes', () => {
    expect(first('[[Kunde]]', 'a').properties).toMatchObject({ dataVrAmbiguous: 'true', dataVrAlternatives: '["arkiv/2023/Kunde"]' });
    expect(first('[[Kafka#Mangler]]', 'a').properties).toMatchObject({ dataVrAnchorMissing: 'true' });
  });

  it('embeds delegeres til konteksten', () => {
    const { ctx, content } = render('![[Kafka#^offset-def]]\n\n![[bilde.png|Alt|200]]');
    expect(ctx.embeds.map((e) => [e.path, e.anchor, e.alias, e.syntax])).toEqual([
      ['Kafka', '^offset-def', null, 'wiki'],
      ['bilde.png', null, 'Alt|200', 'wiki'],
    ]);
    // Embed alene i et avsnitt pakkes ikke i <p>.
    expect(findAll(content, byTag('p'))).toHaveLength(0);
    expect(findAll(content, byTag('vr-embed'))).toHaveLength(2);
  });
});

describe('markdown-lenker og bilder', () => {
  it('relativ .md-lenke blir intern, URL-dekodet', () => {
    const { ctx, content } = render('[Spring](Spring/Spring%20Boot.md#Topp)');
    expect(ctx.links[0]).toEqual({ path: 'Spring/Spring Boot.md', anchor: 'Topp', syntax: 'markdown' });
    expect(findAll(content, byTag('a'))[0]!.properties).toMatchObject({ dataVrLink: 'internal', dataVrTarget: 'Spring/Spring Boot' });
  });

  it('ekstern lenke får rel', () => {
    expect(first('[Kafka](https://kafka.apache.org)', 'a').properties).toMatchObject({
      dataVrLink: 'external',
      href: 'https://kafka.apache.org',
      rel: ['noopener', 'noreferrer'],
    });
  });

  it('ren URL og e-post blir eksterne lenker (QA-MD-09)', () => {
    const links = findAll(render('https://spring.io og <post@example.com>').content, byTag('a'));
    expect(links.map((a) => a.properties.dataVrLink)).toEqual(['external', 'external']);
  });

  it('brutt markdown-lenke', () => {
    expect(first('[Brutt](finnes-ikke.md)', 'a').properties.dataVrLink).toBe('unresolved');
  });

  it('lokalt bilde går via embed-resolveren', () => {
    const { ctx } = render('![Arkitektur](../attachments/arkitektur%20x.png)');
    expect(ctx.embeds[0]).toMatchObject({ path: '../attachments/arkitektur x.png', alias: 'Arkitektur', syntax: 'markdown' });
  });

  it('eksternt bilde lastes ikke – blir lenke (PO-13, B10)', () => {
    const { content } = render('![Pixel](https://example.com/p.png)');
    expect(findAll(content, byTag('img'))).toHaveLength(0);
    const a = findAll(content, byTag('a'))[0]!;
    expect(a.properties).toMatchObject({ dataVrLink: 'external', dataVrExternalImage: 'true', href: 'https://example.com/p.png' });
    expect(textOf(a)).toBe('Pixel');
  });
});

describe('tagger, markering, blokk-id-er, oppgaver, fotnoter', () => {
  it('tagg blir a[data-vr-link=tag]', () => {
    expect(first('Om #java/spring her', 'a').properties).toMatchObject({ dataVrLink: 'tag', dataVrTag: 'java/spring' });
  });

  it('==markering== blir <mark>', () => {
    expect(textOf(first('==viktig==', 'mark'))).toBe('viktig');
  });

  it('blokk-id blir id="^x" og vises ikke', () => {
    const { content } = render('Avsnitt. ^lokal-blokk\n\n- punkt ^liste');
    expect(findAll(content, byTag('p'))[0]!.properties.id).toBe('^lokal-blokk');
    expect(findAll(content, byTag('li'))[0]!.properties.id).toBe('^liste');
    expect(textOf(content)).not.toContain('^');
  });

  it('oppgaver er deaktiverte avkrysningsbokser; egendefinert status i data-task', () => {
    const { content } = render('- [ ] a\n- [x] b\n- [/] c');
    const inputs = findAll(content, byTag('input'));
    expect(inputs.map((i) => [i.properties.disabled, i.properties.checked])).toEqual([
      [true, false],
      [true, true],
      [true, true],
    ]);
    expect(findAll(content, byTag('li'))[2]!.properties.dataTask).toBe('/');
  });

  it('fotnoter: id og href henger sammen', () => {
    const { content } = render('Tekst.[^1]\n\n[^1]: Fotnote.');
    const ref = findAll(content, (el) => el.tagName === 'a' && el.properties.dataFootnoteRef !== undefined)[0]!;
    const href = String(ref.properties.href).slice(1);
    expect(findAll(content, (el) => el.properties.id === href)).toHaveLength(1);
  });

  it('enkelt linjeskift blir <br> (PO-14)', () => {
    expect(findAll(render('a\nb').content, byTag('br'))).toHaveLength(1);
  });
});

describe('overskrifter og TOC', () => {
  it('id-er fra github-slugger, unike, og TOC med ren tekst', () => {
    const { content, toc } = render('## Oppsummering\n## `kode` og [[Lenke]]\n## Oppsummering');
    expect(findAll(content, byTag('h2')).map((h) => h.properties.id)).toEqual(['oppsummering', 'kode-og-lenke', 'oppsummering-1']);
    expect(toc).toEqual([
      { depth: 2, text: 'Oppsummering', id: 'oppsummering' },
      { depth: 2, text: 'kode og Lenke', id: 'kode-og-lenke' },
      { depth: 2, text: 'Oppsummering', id: 'oppsummering-1' },
    ]);
  });

  it('seksjon: kun valgt overskrift og underseksjoner', () => {
    const { content } = render('## A\na\n### A2\nb\n## B\nc', { section: { type: 'heading', id: 'a' } });
    expect(textOf(content)).toContain('A2');
    expect(textOf(content)).not.toContain('c');
  });

  it('blokk-seksjon og manglende seksjon', () => {
    expect(textOf(render('x ^b1\n\ny', { section: { type: 'block', id: 'b1' } }).content).trim()).toBe('x');
    expect(render('x', { section: { type: 'heading', id: 'nei' } }).content.children).toEqual([]);
  });

  it('innebygd innhold får ikke overskrift-id-er (unngår duplikate id-er)', () => {
    const { content } = render('## A', { embedded: true });
    expect(findAll(content, byTag('h2'))[0]!.properties.id).toBeUndefined();
  });
});

describe('kodeblokker, mermaid, base og ikke-støttet', () => {
  it('vr-code med språk, tittel og rå kode', () => {
    const el = first('```yaml title="application.yaml"\na: 1\n```', 'vr-code');
    expect(el.properties).toMatchObject({ dataLang: 'yaml', dataTitle: 'application.yaml', dataCode: 'a: 1' });
    expect(findAll(el, byTag('pre'))[0]!.properties.className).toContain('shiki');
  });

  it('tittel med title:fil og bart filnavn', () => {
    expect(first('```java title:OrdreProperties.java\nx\n```', 'vr-code').properties.dataTitle).toBe('OrdreProperties.java');
    expect(first('```ts api.ts\nx\n```', 'vr-code').properties.dataTitle).toBe('api.ts');
    expect(first('```\n\tx\n```', 'vr-code').properties).toMatchObject({ dataLang: '', dataCode: '\tx' });
  });

  it('mermaid blir vr-mermaid med kilde, sequenceDiagram-språk er vanlig kode', () => {
    expect(first('```mermaid\nflowchart LR\n  A-->B\n```', 'vr-mermaid').properties.dataSource).toBe('flowchart LR\n  A-->B');
    expect(first('```sequenceDiagram\nA->>B: x\n```', 'vr-code').properties.dataLang).toBe('sequenceDiagram');
  });

  it('```base registreres og blir vr-base', () => {
    const { ctx, content } = render('```base\nviews: []\n```');
    expect(ctx.bases).toEqual(['views: []']);
    expect(findAll(content, byTag('vr-base'))[0]!.properties).toMatchObject({ dataBaseId: 'base-1' });
  });

  it('dataview, tasks og LaTeX blir vr-unsupported', () => {
    const { content } = render('```dataview\nTABLE x\n```\n\n```tasks\nnot done\n```\n\n$$\nx^2\n$$\n\nInline $a+b$ og $5 og $10.');
    const nodes = findAll(content, byTag('vr-unsupported')).map((n) => [n.properties.dataKind, n.properties.dataName, n.properties.dataInline]);
    expect(nodes).toEqual([
      ['dataview', 'dataview', undefined],
      ['other', 'tasks', undefined],
      ['latex', undefined, undefined],
      ['latex', undefined, 'true'],
    ]);
    expect(textOf(content)).toContain('$5 og $10');
  });
});
