import type { Element } from 'hast';
import { createCssVariablesTheme, createHighlighter } from 'shiki';
import type { ThemeRegistration } from 'shiki';

/** Syntax highlighting av én kodeblokk. Synkron etter at highlighteren er opprettet. */
export interface CodeHighlighter {
  /** Returnerer Shikis `pre.shiki > code > span.line > span[style]`. Ukjent språk → ren tekst. */
  highlight(code: string, lang: string): Element;
  isSupported(lang: string): boolean;
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

/**
 * CSS-variabel-tema (ADR-002, A9), utvidet med `number`, `type`, `property` og `operator` slik UX
 * definerer i docs/design/tokens.css. Reglene legges sist så de vinner over grunntemaet.
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
    ],
  };
}

export async function createCodeHighlighter(): Promise<CodeHighlighter> {
  const highlighter = await createHighlighter({ themes: [createVaultReaderTheme()], langs: [...SUPPORTED_LANGUAGES] });
  const loaded = new Set(highlighter.getLoadedLanguages().map((l) => l.toLowerCase()));
  const isSupported = (lang: string): boolean => lang !== '' && loaded.has(lang.toLowerCase());

  return {
    isSupported,
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
