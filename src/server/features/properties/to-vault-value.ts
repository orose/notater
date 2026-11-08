import type { DocPath, PropertyEntry, VaultValue } from '../../../shared/api-types';
import { parseWikiLinkInner } from '../markdown-syntax';
import type { FrontmatterData } from '../markdown-syntax';

/** Løser lenkemålet i `"[[x]]"`; `null` = brutt. */
export type PropertyLinkResolver = (target: string) => DocPath | null;

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATE_TIME = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?$/;
const WHOLE_LINK = /^\[\[([^[\]\n]+)\]\]$/;
const TAG_KEYS = new Set(['tags', 'tag']);

/**
 * Frontmatter-verdi → `VaultValue` (api.md «Delte verdityper»). Datoer uten tidssone tolkes som UTC
 * slik at `2026-11-05` alltid blir samme dag uansett serverens tidssone.
 */
export function toVaultValue(key: string, value: unknown, resolveLink: PropertyLinkResolver): VaultValue {
  if (TAG_KEYS.has(key.toLowerCase())) return toTagList(value);
  return convert(value, resolveLink);
}

export function toPropertyEntries(data: FrontmatterData | null, resolveLink: PropertyLinkResolver): PropertyEntry[] {
  if (!data) return [];
  return Object.entries(data).map(([key, value]) => ({ key, value: toVaultValue(key, value, resolveLink) }));
}

function convert(value: unknown, resolveLink: PropertyLinkResolver): VaultValue {
  if (value === null || value === undefined) return { type: 'null' };
  if (typeof value === 'boolean') return { type: 'boolean', value };
  if (typeof value === 'number') return Number.isFinite(value) ? { type: 'number', value } : { type: 'string', value: String(value) };
  if (typeof value === 'string') return convertString(value, resolveLink);
  if (Array.isArray(value)) return { type: 'list', value: value.map((v) => convert(v, resolveLink)) };
  if (value instanceof Date) return { type: 'date', value: value.toISOString(), hasTime: true };
  return { type: 'string', value: JSON.stringify(value) };
}

function convertString(value: string, resolveLink: PropertyLinkResolver): VaultValue {
  const trimmed = value.trim();
  const link = WHOLE_LINK.exec(trimmed);
  if (link) {
    const parts = parseWikiLinkInner(link[1]!);
    return { type: 'link', target: resolveLink(parts.target), display: parts.alias ?? parts.target };
  }
  const date = DATE_ONLY.exec(trimmed);
  if (date) {
    const iso = `${trimmed}T00:00:00.000Z`;
    const parsed = new Date(iso);
    if (!Number.isNaN(parsed.getTime()) && parsed.toISOString() === iso) return { type: 'date', value: iso, hasTime: false };
  }
  if (DATE_TIME.test(trimmed)) {
    const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/.test(trimmed);
    const parsed = new Date(hasZone ? trimmed.replace(' ', 'T') : `${trimmed.replace(' ', 'T')}Z`);
    if (!Number.isNaN(parsed.getTime())) return { type: 'date', value: parsed.toISOString(), hasTime: true };
  }
  return { type: 'string', value };
}

function toTagList(value: unknown): VaultValue {
  const raw = Array.isArray(value) ? value : value === null || value === undefined ? [] : [value];
  const tags = raw
    .flatMap((v) => (typeof v === 'string' ? v.split(/[,\s]+/) : typeof v === 'number' ? [String(v)] : []))
    .map((t) => t.trim().replace(/^#/, ''))
    .filter((t) => t !== '');
  return { type: 'list', value: tags.map((t) => ({ type: 'tag', value: t })) };
}
