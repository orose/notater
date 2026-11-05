/**
 * Obligatoriske XSS-tester (ADR-002, AK20, QA-SEC-*). Hele `edge/Sikkerhet – ondsinnet HTML.md`
 * kjøres gjennom pipelinen i tillegg til målrettede vektorer.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Element, Root } from 'hast';
import { beforeAll, describe, expect, it } from 'vitest';
import type { CodeHighlighter } from '../code-highlight';
import { splitFrontmatter } from '../markdown-syntax';
import { renderMarkdown } from './render-markdown';
import { byTag, fakeContext, findAll, testHighlighter, textOf } from './test-support';

let highlighter: CodeHighlighter;
beforeAll(async () => {
  highlighter = await testHighlighter();
}, 30_000);

const render = (src: string): Root => renderMarkdown(src, fakeContext(highlighter)).content;
const FORBIDDEN_TAGS = ['script', 'iframe', 'object', 'embed', 'style', 'form', 'meta', 'base', 'link', 'svg', 'math', 'button', 'textarea', 'select'];
const DANGEROUS_URL = /^\s*(javascript|data|vbscript|file):/i;

function assertSafe(tree: Root): void {
  const all = findAll(tree, () => true);
  for (const el of all) {
    expect(FORBIDDEN_TAGS, `tagg <${el.tagName}>`).not.toContain(el.tagName);
    for (const [key, value] of Object.entries(el.properties)) {
      expect(key.toLowerCase().startsWith('on'), `attributt ${key} på <${el.tagName}>`).toBe(false);
      if (key === 'style') {
        // Kun Shiki-output (inne i vr-code) har style, og kun CSS-variabler.
        expect(String(value)).toMatch(/^(?:(?:color|background-color|font-style|font-weight|text-decoration):[^;]*var\(--shiki[^;]*\)?;?|font-style:italic;?|font-weight:bold;?|text-decoration:underline;?)+$/);
      }
      if (['href', 'src', 'action', 'formAction', 'xlinkHref', 'poster', 'srcSet'].includes(key)) {
        expect(String(value), `${key} på <${el.tagName}>`).not.toMatch(DANGEROUS_URL);
      }
    }
    if (el.tagName === 'img') expect(String(el.properties.src ?? '')).not.toMatch(/^https?:/);
  }
}

describe('XSS – målrettede vektorer', () => {
  const vectors: [string, string][] = [
    ['script', "<script>alert('x')</script>"],
    ['script stor bokstav', '<SCRIPT SRC="https://example.com/x.js"></SCRIPT>'],
    ['onerror', '<img src="x" onerror="alert(1)">'],
    ['onerror uten anførsel', "<img src=x onerror=alert('x')>"],
    ['onmouseover', '<div onmouseover="alert(1)">x</div>'],
    ['svg onload', '<svg onload="alert(1)"><circle r="10"/></svg>'],
    ['details ontoggle', '<details open ontoggle="alert(1)"><summary>s</summary>x</details>'],
    ['javascript href', '<a href="javascript:alert(1)">x</a>'],
    ['blandet case', '<a href="JaVaScRiPt:alert(1)">x</a>'],
    ['entitet', '<a href="&#106;avascript:alert(1)">x</a>'],
    ['tab i protokoll', '<a href="java\tscript:alert(1)">x</a>'],
    ['markdown javascript', "[x](javascript:alert('md'))"],
    ['markdown data', '[x](data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==)'],
    ['markdown bilde javascript', '![x](javascript:alert(1))'],
    ['iframe', '<iframe src="https://example.com"></iframe>'],
    ['object/embed', '<object data="x.swf"></object><embed src="x.swf">'],
    ['style-tagg', '<style>body{display:none}</style>'],
    ['inline style', '<div style="position:fixed;inset:0">x</div>'],
    ['form', '<form action="https://example.com"><input type="password"><button>OK</button></form>'],
    ['meta refresh', '<meta http-equiv="refresh" content="0;url=https://example.com">'],
    ['base', '<base href="https://example.com/">'],
    ['wikilink med html', '[[<img src=x onerror=alert(1)>]]'],
    ['wikilink alias med html', '[[Ordre|<script>alert(1)</script>]]'],
    ['tagg med html', '#<script>'],
    ['callout-tittel med html', '> [!note] <img src=x onerror=alert(1)>\n> x'],
    ['kodeblokk-tittel', '```js title="<img src=x onerror=alert(1)>"\nx\n```'],
    ['kodespråk', '```"><img src=x onerror=alert(1)>\nx\n```'],
    ['mermaid', '```mermaid\nA["<img src=x onerror=alert(1)>"]\n```'],
    ['forfalsket plassholder', '<span data-vr-ref="0-0"></span><div data-vr-ref="x"></div>'],
    ['forfalsket blokk-id', '<p data-vr-block-id="&quot; onclick=&quot;alert(1)">x</p>'],
    ['forfalsket vr-element', '<vr-embed data-status="ok">x</vr-embed><vr-callout>x</vr-callout>'],
  ];

  it.each(vectors)('%s', (_name, src) => {
    assertSafe(render(src));
  });

  it('ufarlig HTML beholdes (QA-SEC-04)', () => {
    const tree = render('<kbd>K</kbd> H<sub>2</sub>O x<sup>2</sup> <mark>M</mark>\n\n<details><summary>S</summary>\n\nInnhold **fet**\n\n</details>');
    for (const tag of ['kbd', 'sub', 'sup', 'mark', 'details', 'summary', 'strong']) {
      expect(findAll(tree, byTag(tag)).length, tag).toBeGreaterThan(0);
    }
  });

  it('script-innhold vises ikke som tekst, style-innhold heller ikke', () => {
    const text = textOf(render("<script>alert('x')</script>\n\n<style>body{display:none}</style>"));
    expect(text).not.toContain('alert');
    expect(text).not.toContain('display');
  });

  it('forfalskede vr-elementer og plassholdere fjernes', () => {
    const tree = render('<vr-embed data-status="ok">x</vr-embed>\n\n<span data-vr-ref="abc-0">y</span>');
    expect(findAll(tree, (el) => el.tagName.startsWith('vr-'))).toEqual([]);
    expect(findAll(tree, (el) => el.properties.dataVrRef !== undefined)).toEqual([]);
  });

  it('html-kodeblokk med <script> er tekst (QA-KOD-10)', () => {
    const tree = render('```html\n<script>alert(1)</script>\n```');
    const code = findAll(tree, byTag('vr-code'))[0] as Element;
    expect(code.properties.dataCode).toBe('<script>alert(1)</script>');
    assertSafe(tree);
  });
});

describe('XSS – hele sikkerhetsnotatet i testvaultet', () => {
  it('rendres uten farlige elementer, attributter eller URL-er', () => {
    const source = readFileSync(join(process.cwd(), 'test-vault/edge/Sikkerhet – ondsinnet HTML.md'), 'utf8');
    const tree = render(splitFrontmatter(source).body);
    assertSafe(tree);
    expect(textOf(tree)).toContain('Markert');
    expect(findAll(tree, byTag('kbd'))).toHaveLength(2);
  });
});
