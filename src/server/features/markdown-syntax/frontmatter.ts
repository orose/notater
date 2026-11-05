import { parse } from 'yaml';

export interface FrontmatterSplit {
  /** YAML-teksten, `null` hvis fila ikke har (gyldig avgrenset) frontmatter. */
  readonly yaml: string | null;
  readonly body: string;
}

const FRONTMATTER = /^---[ \t]*\r?\n(?:([\s\S]*?)\r?\n)?---[ \t]*(?:\r?\n|$)/;

/** Frontmatter må starte på første linje og avsluttes med `---`. Ellers er alt brødtekst. */
export function splitFrontmatter(source: string): FrontmatterSplit {
  const text = source.startsWith('﻿') ? source.slice(1) : source;
  const match = FRONTMATTER.exec(text);
  if (!match) return { yaml: null, body: text };
  return { yaml: match[1] ?? '', body: text.slice(match[0].length) };
}

export type FrontmatterData = Readonly<Record<string, unknown>>;

export interface FrontmatterResult {
  /** `null` ved ugyldig YAML. Tom frontmatter gir `{}`. */
  readonly data: FrontmatterData | null;
  /** Norsk feilmelding ved ugyldig YAML. */
  readonly error: string | null;
}

const INVALID = 'Egenskapene kunne ikke leses (ugyldig YAML i frontmatter).';

/** Tolerant: kaster aldri. YAML 1.2 core-skjema, så datoer forblir strenger. */
export function parseFrontmatter(yaml: string): FrontmatterResult {
  if (yaml.trim() === '') return { data: {}, error: null };
  try {
    const value: unknown = parse(yaml, { schema: 'core', uniqueKeys: false, prettyErrors: false });
    if (value === null || value === undefined) return { data: {}, error: null };
    if (typeof value !== 'object' || Array.isArray(value)) return { data: null, error: INVALID };
    return { data: value as FrontmatterData, error: null };
  } catch {
    return { data: null, error: INVALID };
  }
}
