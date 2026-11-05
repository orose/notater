import type { Element } from 'hast';
import type { CodeHighlighter } from '../code-highlight';
import { h, truncateSource } from './hast-builders';

/** Kodeblokk-språk som tilhører plugins vi ikke støtter (QA-NS-01). */
const UNSUPPORTED_PLUGIN_LANGUAGES: Readonly<Record<string, 'dataview' | 'other'>> = {
  dataview: 'dataview',
  dataviewjs: 'dataview',
  tasks: 'other',
};

/** Tittel/filnavn fra kodeblokk-meta: `title="x"`, `title='x'`, `title:x`, `title=x` eller et bart filnavn. */
export function parseCodeTitle(meta: string): string | null {
  const trimmed = meta.trim();
  if (trimmed === '') return null;
  const quoted = /\btitle\s*[:=]\s*(?:"([^"]*)"|'([^']*)')/.exec(trimmed);
  if (quoted) return (quoted[1] ?? quoted[2] ?? '').trim() || null;
  const bare = /\btitle\s*[:=]\s*(\S+)/.exec(trimmed);
  if (bare) return bare[1]!;
  const fileName = /^([\w.\-/]+\.[\w]+)$/.exec(trimmed);
  return fileName ? fileName[1]! : null;
}

export interface CodeBlockDeps {
  readonly highlighter: CodeHighlighter;
  registerInlineBase(source: string): string;
}

/** ` ```lang meta ` → `vr-code` | `vr-mermaid` | `vr-base` | `vr-unsupported`. */
export function buildCodeBlock(lang: string, meta: string, value: string, deps: CodeBlockDeps): Element {
  const language = lang.trim();
  const lower = language.toLowerCase();
  if (lower === 'mermaid') return h('vr-mermaid', { dataSource: value });
  if (lower === 'base') return h('vr-base', { dataBaseId: deps.registerInlineBase(value) });
  const unsupported = UNSUPPORTED_PLUGIN_LANGUAGES[lower];
  if (unsupported) return h('vr-unsupported', { dataKind: unsupported, dataName: lower, dataSource: truncateSource(value) });

  const title = parseCodeTitle(meta);
  return h(
    'vr-code',
    { dataLang: language, ...(title ? { dataTitle: title } : {}), dataCode: value },
    [deps.highlighter.highlight(value, lower)],
  );
}
