import type { Element } from 'hast';
import { createCssVariablesTheme, createHighlighter } from 'shiki';
import type { ThemeRegistration } from 'shiki';

/** Syntax highlighting av én kodeblokk. Synkron etter at highlighteren er opprettet. */
export interface CodeHighlighter {
  /** Returnerer Shikis `pre.shiki > code > span.line > span[style]`. Ukjent språk → ren tekst. */
  highlight(code: string, lang: string): Element;
  isSupported(lang: string): boolean;
  /**
   * Kompilerer alle grammatikker på forhånd (Shiki gjør det lat ved første bruk, ~5–50 ms per språk).
   * Ett språk per event-loop-runde, så forespørsler ikke blokkeres. Holder notatbytte < 200 ms (AK17).
   */
  warmUp(): Promise<void>;
}

/** Fast språksett (ADR-002). Alias (ts, sh, yml …) følger med fra Shiki. */
export const SUPPORTED_LANGUAGES = [
  'java',
  'kotlin',
  'json',
  'jsonc',
  'bash',
  'shellscript',
  'powershell',
  'yaml',
  'sql',
  'typescript',
  'tsx',
  'javascript',
  'jsx',
  'html',
  'css',
  'scss',
  'xml',
  'python',
  'go',
  'rust',
  'c',
  'cpp',
  'csharp',
  'dockerfile',
  'diff',
  'markdown',
  'toml',
  'ini',
  'properties',
  'groovy',
  'graphql',
  'http',
  'nginx',
  'scala',
  'ruby',
  'php',
  'swift',
  'proto',
  'hcl',
  'terraform',
  'make',
] as const;

const THEME_NAME = 'vault-reader';

/** «Polyglott» eksempel som treffer vanlige grammatikkregler (strenger, tall, kommentarer, kall, tagger). */
const WARM_UP_SAMPLE = [
  '// kommentar',
  '/* blokk */ # kommentar',
  'import x from "y"; package a.b;',
  'public class A extends B { private int n = 42; String s = "t"; }',
  'def f(a, b=1): return a + b',
  'function g(x: number): string { return `v${x}`; }',
  'SELECT a, COUNT(*) FROM t WHERE b = \'c\' GROUP BY a;',
  'key: value',
  '  - item: [1, 2.5, true, null]',
  '{ "k": "v", "n": 1 }',
  '<div class="a" id=\'b\'>t &amp; u</div>',
  'echo "$HOME" | grep -v x && ls -la',
  '@Annotation fun main(args: Array<String>) { println("hi") }',
  '+ lagt til',
  '- fjernet',
].join('\n');

/**
 * CSS-variabel-tema (ADR-002, A9), utvidet med `number`, `type`, `property` og `operator` slik UX
 * definerer i docs/design/tokens.css. Diff-scopene mappes til `string` (+), `keyword` (−) og
 * `constant` (endret). Reglene legges sist så de vinner over grunntemaet.
 */
export function createVaultReaderTheme(): ThemeRegistration {
  const base = createCssVariablesTheme({ name: THEME_NAME, variablePrefix: '--shiki-', fontStyle: true });
  const token = (name: string) => ({ foreground: `var(--shiki-token-${name})` });
  return {
    ...base,
    tokenColors: [
      ...(base.tokenColors ?? []),
      { scope: ['constant.numeric', 'constant.numeric.integer', 'constant.numeric.float'], settings: token('number') },
      {
        scope: ['entity.name.type', 'entity.name.class', 'support.type', 'support.class', 'storage.type.java', 'entity.other.inherited-class'],
        settings: token('type'),
      },
      {
        scope: ['variable.other.property', 'support.type.property-name', 'meta.object-literal.key', 'entity.name.tag.yaml', 'support.type.property-name.json'],
        settings: token('property'),
      },
      { scope: ['keyword.operator'], settings: token('operator') },
      // Grunntemaet bruker --shiki-token-inserted/-deleted/-changed, som tokens.css ikke definerer.
      // Vi mapper diff-scopene til eksisterende variabler, så klienten ikke trenger reservevariabler.
      { scope: ['markup.inserted', 'meta.diff.header.to-file', 'punctuation.definition.inserted'], settings: token('string') },
      { scope: ['markup.deleted', 'meta.diff.header.from-file', 'punctuation.definition.deleted'], settings: token('keyword') },
      { scope: ['markup.changed', 'punctuation.definition.changed'], settings: token('constant') },
    ],
  };
}

export async function createCodeHighlighter(): Promise<CodeHighlighter> {
  const highlighter = await createHighlighter({ themes: [createVaultReaderTheme()], langs: [...SUPPORTED_LANGUAGES] });
  const loaded = new Set(highlighter.getLoadedLanguages().map((l) => l.toLowerCase()));
  const isSupported = (lang: string): boolean => lang !== '' && loaded.has(lang.toLowerCase());

  return {
    isSupported,
    async warmUp() {
      for (const lang of SUPPORTED_LANGUAGES) {
        await new Promise<void>((resolve) => setImmediate(resolve));
        highlighter.codeToHast(WARM_UP_SAMPLE, { lang, theme: THEME_NAME });
      }
    },
    highlight(code, lang) {
      const language = isSupported(lang) ? lang.toLowerCase() : 'text';
      const root = highlighter.codeToHast(code, { lang: language, theme: THEME_NAME });
      const pre = root.children.find((c): c is Element => c.type === 'element' && c.tagName === 'pre');
      if (!pre) throw new Error('Shiki ga ikke pre-element');
      normalizeClassNames(pre);
      return pre;
    },
  };
}

/** Shiki setter `class` som streng; standard HAST bruker `className: string[]`. */
function normalizeClassNames(node: Element): void {
  const raw = node.properties.class;
  if (typeof raw === 'string') {
    delete node.properties.class;
    node.properties.className = raw.split(/\s+/).filter(Boolean);
  }
  for (const child of node.children) if (child.type === 'element') normalizeClassNames(child);
}
