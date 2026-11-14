import type { Element } from 'hast';
import { bundledLanguagesInfo, createCssVariablesTheme, createHighlighter } from 'shiki';
import type { ThemeRegistration } from 'shiki';

/** Syntax highlighting av én kodeblokk. Synkron etter at highlighteren er opprettet. */
export interface CodeHighlighter {
  /** Returnerer Shikis `pre.shiki > code > span.line > span[style]`. Ukjent språk → ren tekst. */
  highlight(code: string, lang: string): Element;
  isSupported(lang: string): boolean;
  /**
   * Kompilerer alle grammatikker på forhånd (Shiki gjør det lat ved første bruk, ~5–50 ms per språk).
   * Ett språk per bit; `between` kalles før hver bit (standard: neste event-loop-runde, i serveren:
   * vent til ingen forespørsler pågår), så forespørsler ikke blokkeres (AK17, BUG-008).
   */
  warmUp(between?: () => Promise<void>, preferred?: readonly string[]): Promise<void>;
  /**
   * Laster grammatikkene for språkene (id eller alias) som er med i `SUPPORTED_LANGUAGES` og ikke er lastet (SV2,
   * ADR-011 M1). Ukjente språk ignoreres; de gir ren tekst i `highlight` som før.
   */
  ensureLanguages(langs: readonly string[]): Promise<void>;
}

export interface CodeHighlighterOptions {
  /** Språkene som lastes ved start. Standard: hele `SUPPORTED_LANGUAGES` (web-serveren). */
  readonly preload?: readonly string[];
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

const nextTick = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

/** «Polyglott» eksempel som treffer vanlige grammatikkregler (strenger, tall, kommentarer, kall, tagger). */
const WARM_UP_LINES: readonly string[] = [
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
];

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

const SUPPORTED = new Set<string>(SUPPORTED_LANGUAGES);

/** Språk-id eller alias → id i det faste språksettet, ellers `null`. */
function supportedLanguageId(lang: string): string | null {
  const key = lang.trim().toLowerCase();
  if (key === '') return null;
  if (SUPPORTED.has(key)) return key;
  const info = bundledLanguagesInfo.find((l) => l.id === key || l.aliases?.includes(key));
  return info && SUPPORTED.has(info.id) ? info.id : null;
}

export async function createCodeHighlighter(options: CodeHighlighterOptions = {}): Promise<CodeHighlighter> {
  const initial = options.preload ? [...new Set(options.preload.map(supportedLanguageId).filter((l): l is string => l !== null))] : [...SUPPORTED_LANGUAGES];
  const highlighter = await createHighlighter({ themes: [createVaultReaderTheme()], langs: initial });
  const loaded = new Set<string>();
  const refreshLoaded = () => {
    for (const l of highlighter.getLoadedLanguages()) loaded.add(l.toLowerCase());
  };
  refreshLoaded();
  const isSupported = (lang: string): boolean => lang !== '' && loaded.has(lang.toLowerCase());

  return {
    isSupported,
    async ensureLanguages(langs) {
      const missing = [...new Set(langs.map(supportedLanguageId).filter((l): l is string => l !== null && !loaded.has(l)))];
      if (missing.length === 0) return;
      await highlighter.loadLanguage(...(missing as Parameters<typeof highlighter.loadLanguage>));
      refreshLoaded();
    },
    async warmUp(between = nextTick, preferred = []) {
      // Språkene vaultet faktisk bruker varmes opp først og uten å vente på ledig tid (de trengs straks;
      // ellers kompileres grammatikken midt i en forespørsel, ~100–300 ms). Resten venter på `between`.
      const first = [...new Set(preferred.filter(isSupported).map((l) => l.toLowerCase()))];
      const rest = SUPPORTED_LANGUAGES.filter((l) => !first.includes(l) && isSupported(l));
      // Én linje per bit: hele prøven på én gang kompilerte opptil ~300 ms per språk i én blokk
      // (cpp, javascript); linje for linje er største bit ~60–130 ms, og totalen er den samme.
      for (const [lang, wait] of [...first.map((l) => [l, nextTick] as const), ...rest.map((l) => [l, between] as const)]) {
        for (const line of WARM_UP_LINES) {
          await wait();
          highlighter.codeToHast(line, { lang, theme: THEME_NAME });
        }
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
