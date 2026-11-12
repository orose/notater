import type { Element } from 'hast';
import { describe, expect, it } from 'vitest';
import type { TocEntry } from '../../shared/api-types';
import { h, root } from '../test-support/hast';
import { prepareContent } from './prepare-content';
import { splitLeadingTitle } from './leading-title';

const toc: TocEntry[] = [
  { depth: 1, text: 'Velkommen til testvaultet', id: 'velkommen-til-testvaultet' },
  { depth: 2, text: 'Rendering', id: 'rendering' },
];

describe('splitLeadingTitle (PO-35)', () => {
  it('bruker første H1 som tittel og fjerner den fra brødtekst og TOC', () => {
    const content = root(
      h('h1', { id: 'velkommen-til-testvaultet' }, 'Velkommen til ', h('em', {}, 'testvaultet')),
      '\n',
      h('p', {}, 'Dette er et vault.'),
      h('h2', { id: 'rendering' }, 'Rendering'),
    );
    const out = splitLeadingTitle({ title: 'Velkommen', content, toc });
    expect(out.title).toBe('Velkommen til testvaultet');
    expect(out.content.children.some((c) => c.type === 'element' && c.tagName === 'h1')).toBe(false);
    expect(out.toc.map((e) => e.id)).toEqual(['rendering']);
  });

  it('ignorerer tomme tekstnoder foran H1', () => {
    const out = splitLeadingTitle({ title: 'X', content: root('\n', h('h1', { id: 'a' }, 'A'), h('p', {}, 'B')), toc: [] });
    expect(out.title).toBe('A');
  });

  it('beholder filnavnet når første blokk ikke er en H1', () => {
    const content = root(h('p', {}, 'Tekst'), h('h1', { id: 'senere' }, 'Senere'));
    const out = splitLeadingTitle({ title: 'Filnavn', content, toc: [{ depth: 1, text: 'Senere', id: 'senere' }] });
    expect(out.title).toBe('Filnavn');
    expect(out.content).toBe(content);
    expect(out.toc).toHaveLength(1);
  });

  it('beholder filnavnet når H1 er tom', () => {
    const out = splitLeadingTitle({ title: 'Filnavn', content: root(h('h1', { id: 'x' }, '  ')), toc: [] });
    expect(out.title).toBe('Filnavn');
  });

  it('muterer ikke input', () => {
    const content = root(h('h1', { id: 'a' }, 'A'), h('p', {}, 'B'));
    splitLeadingTitle({ title: 'X', content, toc: [] });
    expect(content.children).toHaveLength(2);
  });

  it('gir initial (lede) på første avsnitt etter tittelen', () => {
    const out = splitLeadingTitle({ title: 'X', content: root(h('h1', { id: 'a' }, 'A'), '\n', h('p', {}, 'Først')), toc: [] });
    const prepared = prepareContent(out.content);
    const first = prepared.children.find((c): c is Element => c.type === 'element');
    expect(first?.tagName).toBe('p');
    expect(first?.properties.className).toEqual(['lede']);
  });
});

describe('splitLeadingTitle – inline-formatering', () => {
  it('slår sammen inline-noder uten ekstra mellomrom', () => {
    const out = splitLeadingTitle({ title: 'X', content: root(h('h1', { id: 'k' }, h('strong', {}, 'Kaf'), 'ka')), toc: [] });
    expect(out.title).toBe('Kafka');
  });
});
