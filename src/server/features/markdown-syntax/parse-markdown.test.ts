import type { Root, RootContent } from 'mdast';
import { visit } from 'unist-util-visit';
import { describe, expect, it } from 'vitest';
import type { ObsidianTag, UnsupportedNode, WikiLink } from './obsidian-nodes';
import { parseObsidianMarkdown } from './parse-markdown';
import { toPlainText } from './plain-text';

function nodesOfType<T>(tree: Root, type: string): T[] {
  const found: T[] = [];
  visit(tree, (node) => {
    if (node.type === type) found.push(node as T);
  });
  return found;
}

const wikiLinks = (src: string) => nodesOfType<WikiLink>(parseObsidianMarkdown(src), 'wikiLink');
const tags = (src: string) => nodesOfType<ObsidianTag>(parseObsidianMarkdown(src), 'obsidianTag').map((t) => t.value);

describe('parseObsidianMarkdown – wikilinks og embeds', () => {
  it('lager wikiLink-noder med mål, anker og alias', () => {
    const [link] = wikiLinks('Se [[Kafka#Partisjoner|her]].');
    expect(link).toMatchObject({ embed: false, target: 'Kafka', anchor: 'Partisjoner', alias: 'her' });
  });

  it('gjenkjenner embeds', () => {
    const [link] = wikiLinks('![[Consumer groups]]');
    expect(link).toMatchObject({ embed: true, target: 'Consumer groups', value: '![[Consumer groups]]' });
  });

  it('flere lenker i samme tekst', () => {
    expect(wikiLinks('[[A]] og [[B]] og ![[C]]').map((l) => l.target)).toEqual(['A', 'B', 'C']);
  });

  it('ignorerer inline-kode, kodeblokker, escapede, tomme og uavsluttede', () => {
    const src = [
      'I kode: `[[Ordre]]`',
      'Escapet: \\[[Ordre]]',
      'Tom: [[]]',
      'Uavsluttet: [[Ordre',
      '',
      '```markdown',
      'Se [[Betaling]]',
      '```',
    ].join('\n');
    expect(wikiLinks(src)).toEqual([]);
  });

  it('escapet lenke vises som bokstavelig tekst uten vaktpost', () => {
    const tree = parseObsidianMarkdown('Escapet: \\[[Ordre]]');
    expect(toPlainText(tree)).toBe('Escapet: [[Ordre]]');
  });

  it('wikilink med escapet pipe i tabellcelle', () => {
    const src = '| a | b |\n|---|---|\n| [[Kunde\\|lenke med alias i tabell]] | x |';
    const tree = parseObsidianMarkdown(src);
    const [link] = nodesOfType<WikiLink>(tree, 'wikiLink');
    expect(link).toMatchObject({ target: 'Kunde', alias: 'lenke med alias i tabell' });
    expect(nodesOfType(tree, 'tableCell')).toHaveLength(4);
  });
});

describe('parseObsidianMarkdown – tagger', () => {
  it('fasit QA-TAG-08: riktige inline-tagger', () => {
    const src =
      'Dette avsnittet har #arkitektur og en nestet #java/spring og #særnorsk og #kafka-streams. ' +
      '`#ikke-tagg-i-kode` er ikke en tagg. Tall alene: #2026. Utrop#ikke-tagg. \\#ikkeentagg';
    expect(tags(src)).toEqual(['arkitektur', 'java/spring', 'særnorsk', 'kafka-streams']);
  });

  it('ikke i URL-fragment, ikke i kodeblokk', () => {
    expect(tags('https://example.com/#task\n\n```\n#task\n```')).toEqual([]);
  });

  it('tagg først i linje', () => {
    expect(tags('#task')).toEqual(['task']);
  });
});

describe('parseObsidianMarkdown – markering og kommentarer', () => {
  it('==markering== blir highlight, escapet blir tekst', () => {
    const tree = parseObsidianMarkdown('Dette er ==viktig== men \\==ikke dette\\==');
    expect(nodesOfType(tree, 'highlight')).toHaveLength(1);
    expect(toPlainText(tree)).toBe('Dette er viktig men ==ikke dette==');
  });

  it('kommentarer finnes ikke i treet', () => {
    const tree = parseObsidianMarkdown('Synlig %%skjult%% tekst\n\n%%\nHEMMELIG-KOMMENTAR\n%%\n\nEtter');
    expect(toPlainText(tree)).not.toContain('HEMMELIG');
    expect(toPlainText(tree)).not.toContain('skjult');
  });
});

describe('parseObsidianMarkdown – blokk-id-er', () => {
  it('avsnitt med ^id får blokk-id og markøren fjernes', () => {
    const tree = parseObsidianMarkdown('En offset er posisjonen. ^offset-def');
    const para = tree.children[0]!;
    expect(para.data?.vrBlockId).toBe('offset-def');
    expect(toPlainText(tree)).toBe('En offset er posisjonen.');
  });

  it('listepunkt får blokk-id', () => {
    const tree = parseObsidianMarkdown('- Auto-commit er enkelt. ^liste-blokk\n- Neste');
    const items = nodesOfType<RootContent>(tree, 'listItem');
    expect(items[0]!.data?.vrBlockId).toBe('liste-blokk');
    expect(toPlainText(tree)).not.toContain('^liste-blokk');
  });

  it('frittstående ^id gjelder blokken før', () => {
    const tree = parseObsidianMarkdown('| a |\n|---|\n| 1 |\n\n^tabell-id');
    expect(tree.children).toHaveLength(1);
    expect(tree.children[0]!.type).toBe('table');
    expect(tree.children[0]!.data?.vrBlockId).toBe('tabell-id');
  });
});

describe('parseObsidianMarkdown – LaTeX', () => {
  it('$$-blokk blir unsupported(latex) med kilde', () => {
    const tree = parseObsidianMarkdown('$$\n\\mathbb{E}[X] = \\int x \\, dx\n$$');
    const [node] = nodesOfType<UnsupportedNode>(tree, 'unsupported');
    expect(node).toMatchObject({ kind: 'latex', inline: false });
    expect(node!.value).toContain('\\,');
  });

  it('inline $…$ blir unsupported inline, men $5 og $10 er tekst', () => {
    const tree = parseObsidianMarkdown('Inline: $x^2 + y^2 = z^2$. Det koster $5 og $10 i USA.');
    const nodes = nodesOfType<UnsupportedNode>(tree, 'unsupported');
    expect(nodes).toHaveLength(1);
    expect(nodes[0]).toMatchObject({ kind: 'latex', inline: true, value: '$x^2 + y^2 = z^2$' });
    expect(toPlainText(tree)).toContain('Det koster $5 og $10 i USA.');
  });
});

describe('parseObsidianMarkdown – linjeskift, oppgaver, fotnoter', () => {
  it('enkelt linjeskift blir break (PO-14)', () => {
    const tree = parseObsidianMarkdown('linje 1\nlinje 2');
    expect(nodesOfType(tree, 'break')).toHaveLength(1);
  });

  it('egendefinert oppgavestatus [/] og [-]', () => {
    const tree = parseObsidianMarkdown('- [/] Delvis\n- [-] Kansellert\n- [x] Gjort\n- [ ] Ikke');
    const items = nodesOfType<{ checked?: boolean | null; data?: { vrTaskStatus?: string } }>(tree, 'listItem');
    expect(items.map((i) => i.checked)).toEqual([true, true, true, false]);
    expect(items.map((i) => i.data?.vrTaskStatus)).toEqual(['/', '-', undefined, undefined]);
    expect(toPlainText(tree)).not.toContain('[/]');
  });

  it('inline-fotnote ^[…] blir fotnote', () => {
    const tree = parseObsidianMarkdown('Tekst.^[Dette er en inline-fotnote.]');
    expect(nodesOfType(tree, 'footnoteReference')).toHaveLength(1);
    expect(nodesOfType(tree, 'footnoteDefinition')).toHaveLength(1);
  });
});
