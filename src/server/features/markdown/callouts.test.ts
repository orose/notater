import type { Element } from 'hast';
import { beforeAll, describe, expect, it } from 'vitest';
import type { CodeHighlighter } from '../code-highlight';
import { renderMarkdown } from './render-markdown';
import { byTag, fakeContext, findAll, testHighlighter, textOf } from './test-support';

let highlighter: CodeHighlighter;
beforeAll(async () => {
  highlighter = await testHighlighter();
}, 30_000);

const callouts = (src: string): Element[] => findAll(renderMarkdown(src, fakeContext(highlighter)).content, byTag('vr-callout'));
const title = (c: Element) => textOf(c.children.find((x): x is Element => x.type === 'element' && x.tagName === 'vr-callout-title')!);
const body = (c: Element) => c.children.find((x): x is Element => x.type === 'element' && x.tagName === 'vr-callout-body')!;

describe('callouts', () => {
  it('type og egen tittel', () => {
    const [c] = callouts('> [!tip] Idempotente konsumenter\n> Innhold *her*.');
    expect(c!.properties).toMatchObject({ dataCalloutType: 'tip', dataFold: 'none' });
    expect(title(c!)).toBe('Idempotente konsumenter');
    expect(textOf(body(c!))).toContain('Innhold her.');
  });

  it('norsk standardtittel når tittel mangler (PO-14)', () => {
    expect(title(callouts('> [!note]\n> x')[0]!)).toBe('Merk');
    expect(title(callouts('> [!warning]\n> x')[0]!)).toBe('Advarsel');
  });

  it('aliaser normaliseres, typen er case-insensitiv, ukjent beholdes', () => {
    expect(callouts('> [!summary] S\n> x')[0]!.properties.dataCalloutType).toBe('abstract');
    expect(callouts('> [!faq] F\n> x')[0]!.properties.dataCalloutType).toBe('question');
    expect(callouts('> [!error] E\n> x')[0]!.properties.dataCalloutType).toBe('danger');
    expect(callouts('> [!WARNING] W\n> x')[0]!.properties.dataCalloutType).toBe('warning');
    const [custom] = callouts('> [!egendefinert] Ukjent type\n> x');
    expect(custom!.properties.dataCalloutType).toBe('egendefinert');
    expect(title(custom!)).toBe('Ukjent type');
  });

  it('foldbare: - lukket, + åpen', () => {
    expect(callouts('> [!tip]- Lukket\n> x')[0]!.properties.dataFold).toBe('closed');
    expect(callouts('> [!tip]+ Åpen\n> x')[0]!.properties.dataFold).toBe('open');
  });

  it('bare tittel gir tom body (QA-CAL-04)', () => {
    const [c] = callouts('> [!info] Bare tittel');
    expect(title(c!)).toBe('Bare tittel');
    expect(body(c!).children.filter((n) => n.type === 'element')).toEqual([]);
  });

  it('mangler mellomrom etter ] (QA-CAL-11)', () => {
    const [c] = callouts('> [!note]Mangler mellomrom etter ]\n> x');
    expect(title(c!)).toBe('Mangler mellomrom etter ]');
  });

  it('nestede callouts, innerste lukket; tekst etter nesting ligger i ytre (QA-CAL-06)', () => {
    const src = '> [!question] Ytre\n> Tekst i ytre.\n> > [!example] Indre\n> > Tekst i indre.\n> > > [!danger]- Innerste\n> > > Dypt.\n>\n> Mer tekst i ytre.';
    const all = callouts(src);
    expect(all.map((c) => c.properties.dataCalloutType)).toEqual(['question', 'example', 'danger']);
    expect(all[2]!.properties.dataFold).toBe('closed');
    const outerBodyParagraphs = body(all[0]!).children.filter((n): n is Element => n.type === 'element' && n.tagName === 'p');
    expect(outerBodyParagraphs.map(textOf)).toContain('Mer tekst i ytre.');
  });

  it('kode, liste og lenke inni callout', () => {
    const [c] = callouts('> [!example] Kode\n> ```java\n> int x;\n> ```\n> - [ ] oppgave\n> Se [[Consumer groups]].');
    expect(findAll(c!, byTag('vr-code'))[0]!.properties.dataCode).toBe('int x;');
    expect(findAll(c!, byTag('input'))).toHaveLength(1);
    expect(findAll(c!, byTag('a'))[0]!.properties.dataVrLink).toBe('internal');
  });

  it('vanlig blokksitat er ikke callout', () => {
    expect(callouts('> Bare et sitat')).toEqual([]);
  });
});
