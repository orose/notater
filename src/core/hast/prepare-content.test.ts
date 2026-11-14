import type { Element } from 'hast';
import { describe, expect, it } from 'vitest';
import { h, root } from '../test-support/hast';
import { prepareContent, readingMinutes } from './prepare-content';

function el(node: unknown): Element {
  return node as Element;
}

describe('prepareContent – ingress', () => {
  it('merker første avsnitt som «lede» når notatet starter med et avsnitt', () => {
    const out = prepareContent(root(h('p', {}, 'Først'), h('p', {}, 'Andre')));
    expect(el(out.children[0]).properties.className).toEqual(['lede']);
    expect(el(out.children[1]).properties.className).toBeUndefined();
  });

  it('hopper over når notatet starter med noe annet', () => {
    const out = prepareContent(root(h('h2', { id: 'a' }, 'A'), h('p', {}, 'Tekst')));
    expect(el(out.children[1]).properties.className).toBeUndefined();
  });

  it('ignorerer tomme tekstnoder (linjeskift) foran første element', () => {
    const out = prepareContent(root('\n', h('p', {}, 'Først')));
    expect(el(out.children[1]).properties.className).toEqual(['lede']);
  });

  it('muterer ikke input (cachet i TanStack Query)', () => {
    const input = root(h('p', {}, 'Først'));
    prepareContent(input);
    expect(el(input.children[0]).properties.className).toBeUndefined();
  });
});

describe('prepareContent – sidenoter (PO-20)', () => {
  const content = root(
    h(
      'p',
      {},
      'Tekst',
      h('sup', {}, h('a', { href: '#user-content-fn-1', id: 'user-content-fnref-1', dataFootnoteRef: true }, '1')),
      ' videre.',
    ),
    h(
      'section',
      { dataFootnotes: true, className: ['footnotes'] },
      h('h2', { id: 'footnote-label', className: ['sr-only'] }, 'Footnotes'),
      h(
        'ol',
        {},
        h(
          'li',
          { id: 'user-content-fn-1' },
          h('p', {}, 'Notetekst ', h('a', { href: '#user-content-fnref-1', dataFootnoteBackref: '' }, '↩')),
        ),
      ),
    ),
  );

  it('setter inn en vr-sidenote med notens innhold rett etter referansen', () => {
    const out = prepareContent(content);
    const p = el(out.children[0]);
    const sidenote = el(p.children[2]);
    expect(sidenote.tagName).toBe('vr-sidenote');
    expect(sidenote.properties.dataNumber).toBe('1');
    // tilbakelenken «↩» fjernes fra sidenoten
    expect(JSON.stringify(sidenote)).toContain('Notetekst');
    expect(JSON.stringify(sidenote)).not.toContain('↩');
  });

  it('erstatter GFM-fotnoteseksjonen med vr-footnotes (fallback på smal skjerm)', () => {
    const out = prepareContent(content);
    const section = el(out.children[1]);
    expect(section.tagName).toBe('vr-footnotes');
    expect(JSON.stringify(section)).not.toContain('Footnotes');
    expect(JSON.stringify(section)).toContain('Notetekst');
  });
});

describe('readingMinutes', () => {
  it('ord / 220, rundet opp, minst 1', () => {
    const words = Array.from({ length: 221 }, () => 'ord').join(' ');
    expect(readingMinutes(root(h('p', {}, words)))).toBe(2);
    expect(readingMinutes(root())).toBe(1);
  });

  it('teller ikke rå kildetekst i data-attributter', () => {
    const code = h('vr-code', { dataCode: Array.from({ length: 500 }, () => 'x').join(' ') }, h('pre', {}, 'a b'));
    expect(readingMinutes(root(code))).toBe(1);
  });
});

describe('prepareContent – oppgavelister (BUG-005)', () => {
  it('gir avkrysningsboksen tilgjengelig navn fra punktets tekst (uten nestede lister)', () => {
    const out = prepareContent(
      root(
        h(
          'ul',
          { className: ['contains-task-list'] },
          h(
            'li',
            { className: ['task-list-item'] },
            h('input', { type: 'checkbox', checked: false, disabled: true }),
            ' ',
            h('strong', {}, 'Nestet'),
            ':',
            h('ul', {}, h('li', { className: ['task-list-item'] }, h('input', { type: 'checkbox', checked: true, disabled: true }), ' Under')),
          ),
        ),
      ),
    );
    const outer = el(el(el(out.children[0]).children[0]).children[0]);
    expect(outer.properties.ariaLabel).toBe('Nestet:');
    const nested = el(el(el(el(el(out.children[0]).children[0]).children[4]).children[0]).children[0]);
    expect(nested.properties.ariaLabel).toBe('Under');
  });
});
