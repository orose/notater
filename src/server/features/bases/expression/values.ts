/**
 * Kjøretidsverdier i uttrykksspråket (ADR-003 «Semantikk for verdier»): sannhetsverdi, likhet,
 * sammenligning, sortering og tekstform. Rene funksjoner.
 */

export interface DateValue {
  readonly kind: 'date';
  /** Millisekunder siden epoke (UTC). */
  readonly ms: number;
  /** `false` = ren dato (frontmatter `YYYY-MM-DD`). */
  readonly hasTime: boolean;
}

export interface ListValue {
  readonly kind: 'list';
  readonly items: readonly Value[];
}

export interface LinkValue {
  readonly kind: 'link';
  /** Oppløst mål (vault-relativ sti med endelse), `null` = brutt lenke. */
  readonly filePath: string | null;
  /** Oppløst mål som `DocPath`, `null` = brutt lenke. */
  readonly docPath: string | null;
  readonly display: string;
}

/** Det uttrykk kan se av en fil (`file.*`). Implementeres av query-laget mot indeksen. */
export interface FileSubject {
  readonly filePath: string;
  readonly docPath: string;
  /** Filnavn uten endelse (PO: `file.name`). */
  readonly name: string;
  /** Filnavn med endelse. */
  readonly fullName: string;
  readonly ext: string;
  /** Mappesti; `"/"` for rot (O4). */
  readonly folder: string;
  readonly size: number;
  readonly mtimeMs: number;
  readonly ctimeMs: number;
  /** Uten `#`, original skrivemåte (frontmatter + inline). */
  tags(): readonly string[];
  /** Utgående lenker, oppløst. */
  links(): readonly LinkValue[];
  /** Note-property (frontmatter) som verdi; `null` hvis den mangler. */
  property(key: string): Value;
  propertyKeys(): readonly string[];
}

export interface FileValue {
  readonly kind: 'file';
  readonly file: FileSubject;
}

/** Navnerom-objekter (`note`, `formula`, `this`) og nestede frontmatter-objekter. */
export interface ObjectValue {
  readonly kind: 'object';
  get(key: string): Value;
  keys(): readonly string[];
}

export type Value = null | string | number | boolean | DateValue | ListValue | LinkValue | FileValue | ObjectValue;

export const list = (items: readonly Value[]): ListValue => ({ kind: 'list', items });
export const dateValue = (ms: number, hasTime: boolean): DateValue => ({ kind: 'date', ms, hasTime });

export function isDate(v: Value): v is DateValue {
  return typeof v === 'object' && v !== null && v.kind === 'date';
}
export function isList(v: Value): v is ListValue {
  return typeof v === 'object' && v !== null && v.kind === 'list';
}
export function isLink(v: Value): v is LinkValue {
  return typeof v === 'object' && v !== null && v.kind === 'link';
}
export function isFile(v: Value): v is FileValue {
  return typeof v === 'object' && v !== null && v.kind === 'file';
}

/** Typenavn brukt i funksjonsregisteret og meldinger. */
export type ValueKind = 'null' | 'string' | 'number' | 'boolean' | 'date' | 'list' | 'link' | 'file' | 'object';

export function kindOf(v: Value): ValueKind {
  if (v === null) return 'null';
  if (typeof v === 'string') return 'string';
  if (typeof v === 'number') return 'number';
  if (typeof v === 'boolean') return 'boolean';
  return v.kind;
}

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATE_TIME = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?$/;

/** `YYYY-MM-DD` (UTC midnatt, BE14) eller ISO med tid; ellers `null`. */
export function parseDateString(text: string): DateValue | null {
  const trimmed = text.trim();
  if (DATE_ONLY.test(trimmed)) {
    const iso = `${trimmed}T00:00:00.000Z`;
    const ms = Date.parse(iso);
    return Number.isNaN(ms) || new Date(ms).toISOString() !== iso ? null : dateValue(ms, false);
  }
  if (DATE_TIME.test(trimmed)) {
    const normalized = trimmed.replace(' ', 'T');
    const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/.test(normalized);
    const ms = Date.parse(hasZone ? normalized : `${normalized}Z`);
    return Number.isNaN(ms) ? null : dateValue(ms, true);
  }
  return null;
}

/** Sannhetsverdi: `null`, `false`, `0`, `NaN`, `""` og tom liste er usanne. */
export function isTruthy(v: Value): boolean {
  if (v === null) return false;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0 && !Number.isNaN(v);
  if (typeof v === 'string') return v !== '';
  if (v.kind === 'list') return v.items.length > 0;
  return true;
}

const stripLinkSyntax = (text: string): string => {
  const m = /^\[\[([^\]|#]*)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]$/.exec(text.trim());
  return (m ? m[1]! : text).trim();
};

function linkMatchesText(link: LinkValue, text: string): boolean {
  const wanted = stripLinkSyntax(text).normalize('NFC').toLowerCase();
  const candidates = [link.display, link.docPath, link.filePath, link.docPath?.slice(link.docPath.lastIndexOf('/') + 1)];
  return candidates.some((c) => c !== null && c !== undefined && c.normalize('NFC').toLowerCase() === wanted);
}

const targetOf = (v: LinkValue | FileValue): string | null => (v.kind === 'file' ? v.file.filePath : v.filePath);

/**
 * Likhet (O6): ulike typer er ulike; strenger er case-sensitive (PO-10); datoer kan sammenlignes
 * med datostrenger; lenker med lenker, filer og tekst (`"[[Kunde]]"`, `"Kunde"`).
 */
export function valuesEqual(a: Value, b: Value): boolean {
  if (a === null || b === null) return a === b;
  if (typeof a !== 'object' || typeof b !== 'object') {
    if (typeof a === typeof b) return a === b || (typeof a === 'number' && Number.isNaN(a) && Number.isNaN(b as number));
    const date = typeof a === 'object' ? a : typeof b === 'object' ? b : null;
    const text = typeof a === 'string' ? a : typeof b === 'string' ? b : null;
    if (date && text !== null) return objectEqualsText(date, text);
    return false;
  }
  if (a.kind === 'date' && b.kind === 'date') return a.ms === b.ms;
  if (a.kind === 'list' && b.kind === 'list') return a.items.length === b.items.length && a.items.every((x, i) => valuesEqual(x, b.items[i]!));
  if ((a.kind === 'link' || a.kind === 'file') && (b.kind === 'link' || b.kind === 'file')) {
    const ta = targetOf(a);
    const tb = targetOf(b);
    return ta !== null && tb !== null ? ta === tb : a.kind === 'link' && b.kind === 'link' && a.display === b.display;
  }
  return a === b;
}

function objectEqualsText(v: Exclude<Value, null | string | number | boolean>, text: string): boolean {
  if (v.kind === 'date') {
    const parsed = parseDateString(text);
    return parsed !== null && parsed.ms === v.ms;
  }
  if (v.kind === 'link') return linkMatchesText(v, text);
  if (v.kind === 'file') return v.file.name === stripLinkSyntax(text) || v.file.docPath === stripLinkSyntax(text);
  return false;
}

/** For `<`, `>`, `<=`, `>=`: tall, strenger, datoer (også mot datostreng), boolske. `null` = usammenlignbare (→ usann). */
export function compareForOperator(a: Value, b: Value): number | null {
  if (typeof a === 'number' && typeof b === 'number') return Number.isNaN(a) || Number.isNaN(b) ? null : a - b;
  if (typeof a === 'string' && typeof b === 'string') return a < b ? -1 : a > b ? 1 : 0;
  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b);
  const da = asDate(a);
  const db = asDate(b);
  if (da && db && (isDate(a) || isDate(b))) return da.ms - db.ms;
  return null;
}

function asDate(v: Value): DateValue | null {
  if (isDate(v)) return v;
  if (typeof v === 'string') return parseDateString(v);
  return null;
}

const collator = new Intl.Collator('nb', { numeric: true, sensitivity: 'base' });

/** Strengsammenligning for sortering (O7). */
export function compareText(a: string, b: string): number {
  return collator.compare(a, b);
}

/** Tom verdi for sortering/gruppering: `null`, `""` og tom liste. */
export function isEmptyValue(v: Value): boolean {
  return v === null || v === '' || (isList(v) && v.items.length === 0);
}

const SORT_RANK: Readonly<Record<ValueKind, number>> = {
  boolean: 0,
  number: 1,
  date: 2,
  string: 3,
  link: 3,
  file: 3,
  list: 3,
  object: 3,
  null: 9,
};

/**
 * Stigende sorteringsrekkefølge (ADR-003/O7): tall numerisk, datoer kronologisk, tekst med
 * nb-kollasjon. Tomme verdier håndteres av kalleren (alltid sist uansett retning).
 */
export function compareForSort(a: Value, b: Value): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (isDate(a) && isDate(b)) return a.ms - b.ms;
  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b);
  const ra = SORT_RANK[kindOf(a)];
  const rb = SORT_RANK[kindOf(b)];
  if (ra !== rb) return ra - rb;
  return compareText(toText(a), toText(b));
}

const pad = (n: number, width = 2): string => String(n).padStart(width, '0');

/** Tekstform (konkatenering, `toString()`, gruppenøkler, `contains` på tekst). */
export function toText(v: Value): string {
  if (v === null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(Number(v.toPrecision(12)));
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  switch (v.kind) {
    case 'date': {
      const d = new Date(v.ms);
      const day = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
      return v.hasTime ? d.toISOString() : day;
    }
    case 'list':
      return v.items.map(toText).join(', ');
    case 'link':
      return v.display;
    case 'file':
      return v.file.name;
    case 'object':
      return `{${v.keys().join(', ')}}`;
  }
}

const DURATION_UNITS: ReadonlyArray<[RegExp, 'y' | 'M' | 'w' | 'd' | 'h' | 'm' | 's']> = [
  [/^(?:y|yr|yrs|year|years|år)$/, 'y'],
  [/^(?:M|mo|month|months|måned|måneder)$/, 'M'],
  [/^(?:w|week|weeks|uke|uker)$/, 'w'],
  [/^(?:d|day|days|dag|dager)$/, 'd'],
  [/^(?:h|hr|hrs|hour|hours|time|timer)$/, 'h'],
  [/^(?:m|min|mins|minute|minutes|minutt|minutter)$/, 'm'],
  [/^(?:s|sec|secs|second|seconds|sekund|sekunder)$/, 's'],
];
const UNIT_MS = { w: 7 * 86_400_000, d: 86_400_000, h: 3_600_000, m: 60_000, s: 1000 } as const;

/**
 * Legger en varighet som tekst (`"1d"`, `"2 weeks"`, `"-3h"`, `"1y 2M"`) til en dato.
 * `null` hvis teksten ikke er en varighet.
 */
export function addDuration(date: DateValue, text: string, sign: 1 | -1): DateValue | null {
  const parts = [...text.trim().matchAll(/([+-]?\d+(?:\.\d+)?)\s*([A-Za-zåæø]+)/g)];
  if (parts.length === 0 || parts.map((p) => p[0]).join('').replace(/\s/g, '') !== text.replace(/\s/g, '')) return null;
  const d = new Date(date.ms);
  let hasTime = date.hasTime;
  for (const [, amountText, unitText] of parts) {
    const unit = DURATION_UNITS.find(([re]) => re.test(unitText!))?.[1];
    if (!unit) return null;
    const amount = Number(amountText) * sign;
    if (unit === 'y') d.setUTCFullYear(d.getUTCFullYear() + amount);
    else if (unit === 'M') d.setUTCMonth(d.getUTCMonth() + amount);
    else {
      d.setTime(d.getTime() + amount * UNIT_MS[unit]);
      if (unit !== 'w' && unit !== 'd') hasTime = true;
    }
  }
  return dateValue(d.getTime(), hasTime);
}
