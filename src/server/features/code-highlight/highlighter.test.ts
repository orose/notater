import type { Element, ElementContent } from 'hast';
import { beforeAll, describe, expect, it } from 'vitest';
import { createCodeHighlighter } from './highlighter';
import type { CodeHighlighter } from './highlighter';

let highlighter: CodeHighlighter;

beforeAll(async () => {
  highlighter = await createCodeHighlighter();
}, 30_000);

function styles(node: ElementContent, out: string[] = []): string[] {
  if (node.type === 'element') {
    const style = node.properties.style;
    if (typeof style === 'string') out.push(style);
    node.children.forEach((c) => styles(c, out));
  }
  return out;
}

function text(node: ElementContent): string {
  if (node.type === 'text') return node.value;
  if (node.type === 'element') return node.children.map(text).join('');
  return '';
}

describe('createCodeHighlighter', () => {
  it('gir pre.shiki med CSS-variabel-farger (ingen hardkodede farger)', () => {
    const pre = highlighter.highlight('public class A { int x = 42; }', 'java');
    expect(pre.tagName).toBe('pre');
    const all = styles(pre);
    expect(all.some((s) => s.includes('var(--shiki-token-keyword)'))).toBe(true);
    expect(all.some((s) => s.includes('var(--shiki-token-number)'))).toBe(true);
    expect(all.every((s) => !/#[0-9a-f]{3,6}\b/i.test(s))).toBe(true);
  });

  it('diff bruker bare variabler som tokens.css definerer (ingen --shiki-token-inserted/-deleted/-changed)', () => {
    const all = styles(highlighter.highlight('--- a/x\n+++ b/x\n@@ -1 +1 @@\n-gammel\n+ny\n! endret', 'diff'));
    expect(all.some((s) => s.includes('var(--shiki-token-string)'))).toBe(true);
    expect(all.some((s) => s.includes('var(--shiki-token-keyword)'))).toBe(true);
    expect(all.filter((s) => /--shiki-token-(inserted|deleted|changed)/.test(s))).toEqual([]);
  });

  it('støtter alias som ts, sh, yml', () => {
    for (const lang of ['ts', 'typescript', 'sh', 'bash', 'shell', 'yml', 'yaml', 'json', 'sql', 'kotlin', 'xml', 'diff', 'html', 'markdown']) {
      expect(highlighter.isSupported(lang), lang).toBe(true);
    }
  });

  it('ukjent språk gir ren tekst uten feil', () => {
    expect(highlighter.isSupported('cobol-2077')).toBe(false);
    const pre = highlighter.highlight('MOVE 1 TO X.', 'cobol-2077');
    expect(text(pre)).toBe('MOVE 1 TO X.');
  });

  it('html med <script> blir tekst, ikke elementer', () => {
    const pre: Element = highlighter.highlight('<script>alert(1)</script>', 'html');
    expect(text(pre)).toBe('<script>alert(1)</script>');
    const tags: string[] = [];
    const walk = (n: ElementContent): void => {
      if (n.type === 'element') {
        tags.push(n.tagName);
        n.children.forEach(walk);
      }
    };
    walk(pre);
    expect(tags.every((t) => ['pre', 'code', 'span'].includes(t))).toBe(true);
  });

  it('warmUp kompilerer alle språk uten feil', async () => {
    await expect(highlighter.warmUp()).resolves.toBeUndefined();
  }, 30_000);

  it('bevarer tab og innrykk', () => {
    expect(text(highlighter.highlight('\tfoo\n    bar', ''))).toBe('\tfoo\n    bar');
  });
});

describe('createCodeHighlighter({ preload }) + ensureLanguages (SV2, ADR-011 M1)', () => {
  it('laster bare språkene som er bedt om; andre gir ren tekst til de er lastet (også via alias)', async () => {
    const few = await createCodeHighlighter({ preload: ['java'] });
    expect(few.isSupported('java')).toBe(true);
    expect(few.isSupported('python')).toBe(false);
    expect(styles(few.highlight('def f(): return 1', 'python')).some((s) => s.includes('--shiki-token-keyword'))).toBe(false);
    await few.ensureLanguages(['py', 'ts', 'finnes-ikke', '']);
    expect(few.isSupported('python')).toBe(true);
    expect(few.isSupported('py')).toBe(true);
    expect(few.isSupported('typescript')).toBe(true);
    expect(few.isSupported('finnes-ikke')).toBe(false);
    expect(styles(few.highlight('def f(): return 1', 'python')).some((s) => s.includes('--shiki-token-keyword'))).toBe(true);
    expect(text(few.highlight('def f(): return 1', 'python'))).toBe('def f(): return 1');
  }, 30_000);

  it('språk utenfor det faste språksettet (ADR-002) lastes ikke', async () => {
    const few = await createCodeHighlighter({ preload: [] });
    await few.ensureLanguages(['haskell']);
    expect(few.isSupported('haskell')).toBe(false);
  }, 30_000);

  it('uten valg: hele språksettet som før', () => {
    expect(highlighter.isSupported('python')).toBe(true);
    expect(highlighter.isSupported('terraform')).toBe(true);
  });
});
