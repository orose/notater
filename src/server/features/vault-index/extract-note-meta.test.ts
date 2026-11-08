import { describe, expect, it } from 'vitest';
import { extractNoteMeta } from './extract-note-meta';

describe('extractNoteMeta – frontmatter, aliaser og tagger', () => {
  it('leser frontmatter, aliaser og tagger (frontmatter først, så inline)', () => {
    const meta = extractNoteMeta('---\naliases: [Kafka, Apache Kafka]\ntags: [kafka, læring]\n---\n# K\nTekst #inline og #Kafka');
    expect(meta.frontmatter).toEqual({ aliases: ['Kafka', 'Apache Kafka'], tags: ['kafka', 'læring'] });
    expect(meta.aliases).toEqual(['Kafka', 'Apache Kafka']);
    expect(meta.tags).toEqual(['kafka', 'læring', 'inline']);
  });

  it('skalar tags og alias, med og uten #', () => {
    const meta = extractNoteMeta('---\ntags: "#task, team"\naliases: Eneste\n---\n');
    expect(meta.tags).toEqual(['task', 'team']);
    expect(meta.aliases).toEqual(['Eneste']);
  });

  it('nestet tagg i frontmatter (QA-TAG-02)', () => {
    expect(extractNoteMeta('---\ntags:\n  - task/backend\n---\n').tags).toEqual(['task/backend']);
  });

  it('ugyldig YAML: ingen tagger/properties, men feilmelding (QA-IDX-07)', () => {
    const meta = extractNoteMeta('---\ntags: [qa, ugyldig\n  feil: innrykk: her\n---\n# Tittel\n');
    expect(meta.frontmatter).toBeNull();
    expect(meta.frontmatterError).toMatch(/kunne ikke leses/);
    expect(meta.tags).toEqual([]);
    expect(meta.headings).toEqual([{ depth: 1, text: 'Tittel', id: 'tittel' }]);
  });

  it('tomt notat gir tom metadata', () => {
    expect(extractNoteMeta('')).toMatchObject({ frontmatter: null, tags: [], links: [], headings: [], text: '' });
  });
});

describe('extractNoteMeta – lenker', () => {
  it('wikilinks, embeds og markdown-lenker med snippet', () => {
    const meta = extractNoteMeta(
      'Se [[Ordre|ordrene]] og ![[Kafka#^offset-def]].\n\n[Kunde](../domene/Kunde.md) og [Spring](Spring%20Boot.md#Topp) og [ekstern](https://x.no) og ![bilde](a%20b.png)',
    );
    expect(meta.links).toEqual([
      { kind: 'wikilink', target: 'Ordre', anchor: null, snippet: 'Se ordrene og Kafka.' },
      { kind: 'embed', target: 'Kafka', anchor: '^offset-def', snippet: 'Se ordrene og Kafka.' },
      { kind: 'markdown', target: '../domene/Kunde.md', anchor: null, snippet: expect.stringContaining('Kunde og Spring') },
      { kind: 'markdown', target: 'Spring Boot.md', anchor: 'Topp', snippet: expect.any(String) },
      { kind: 'markdown-embed', target: 'a b.png', anchor: null, snippet: expect.any(String) },
    ]);
  });

  it('lenker i properties (PO-9)', () => {
    const meta = extractNoteMeta('---\nrelatert:\n  - "[[Kunde]]"\n  - "[[Betaling|b]]"\nlenke: "[[Kafka#Topics]]"\n---\n');
    expect(meta.links).toEqual([
      { kind: 'property', target: 'Kunde', anchor: null, snippet: 'relatert: [[Kunde]]' },
      { kind: 'property', target: 'Betaling', anchor: null, snippet: 'relatert: [[Betaling|b]]' },
      { kind: 'property', target: 'Kafka', anchor: 'Topics', snippet: 'lenke: [[Kafka#Topics]]' },
    ]);
  });

  it('ikke lenker i kode, kommentarer eller escapet', () => {
    const meta = extractNoteMeta('`[[A]]` %%[[B]]%% \\[[C]]\n\n```\n[[D]]\n```');
    expect(meta.links).toEqual([]);
  });

  it('lang snippet kuttes rundt lenken', () => {
    const long = `${'a '.repeat(200)}[[Mål]]${' b'.repeat(200)}`;
    const [link] = extractNoteMeta(long).links;
    expect(link!.snippet.length).toBeLessThanOrEqual(162);
    expect(link!.snippet).toContain('Mål');
  });
});

describe('extractNoteMeta – overskrifter, blokker og tekst', () => {
  it('overskrifter og blokk-id-er', () => {
    const meta = extractNoteMeta('## Offset\nEn offset. ^offset-def\n\n- punkt ^liste-blokk');
    expect(meta.headings).toEqual([{ depth: 2, text: 'Offset', id: 'offset' }]);
    expect(meta.blockIds).toEqual(['offset-def', 'liste-blokk']);
  });

  it('ren tekst uten kommentarer og blokk-id-er', () => {
    const meta = extractNoteMeta('---\na: 1\n---\nSynlig %%HEMMELIG%% tekst ^id');
    expect(meta.text).toBe('Synlig  tekst');
  });
});
