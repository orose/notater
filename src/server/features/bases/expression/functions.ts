/**
 * Funksjonsregister (ADR-003, OCP): globale funksjoner, metoder per verditype og felter.
 * Nye funksjoner = nye oppføringer her; evaluatoren endres ikke.
 */
import type { EvalContext } from './context';
import {
  compareForSort,
  dateValue,
  isDate,
  isEmptyValue,
  isFile,
  isLink,
  isList,
  isTruthy,
  kindOf,
  list,
  parseDateString,
  toText,
  valuesEqual,
} from './values';
import type { DateValue, FileSubject, ObjectValue, Value, ValueKind } from './values';

export type GlobalFunction = (args: readonly Value[], ctx: EvalContext) => Value;
export type Method = (receiver: Value, args: readonly Value[], ctx: EvalContext) => Value;
type Field = (receiver: Value, ctx: EvalContext) => Value;

const str = (v: Value | undefined): string => toText(v ?? null);
const num = (v: Value | undefined): number | null => {
  if (typeof v === 'number') return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isNaN(n) ? null : n;
  }
  return null;
};
const flat = (args: readonly Value[]): Value[] => args.flatMap((a) => (isList(a) ? a.items : [a]));

function toDate(v: Value | undefined): DateValue | null {
  if (v === undefined || v === null) return null;
  if (isDate(v)) return v;
  if (typeof v === 'string') return parseDateString(v);
  if (typeof v === 'number') return dateValue(v, true);
  return null;
}

function todayMs(nowMs: number): number {
  const d = new Date(nowMs);
  return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
}

export const GLOBAL_FUNCTIONS: ReadonlyMap<string, GlobalFunction> = new Map<string, GlobalFunction>([
  // `if` evalueres lat i evaluatoren; denne brukes bare om noen kaller den indirekte.
  ['if', (args) => (isTruthy(args[0] ?? null) ? (args[1] ?? null) : (args[2] ?? null))],
  ['now', (_args, ctx) => dateValue(ctx.nowMs(), true)],
  ['today', (_args, ctx) => dateValue(todayMs(ctx.nowMs()), false)],
  ['date', (args) => toDate(args[0])],
  ['number', (args) => {
    const v = args[0] ?? null;
    if (typeof v === 'boolean') return Number(v);
    if (isDate(v)) return v.ms;
    return num(v);
  }],
  ['list', (args) => {
    const v = args[0] ?? null;
    return isList(v) ? v : v === null ? list([]) : list([v]);
  }],
  ['link', (args, ctx) => {
    const target = args[0] ?? null;
    if (isFile(target)) return ctx.resolveLink(target.file.filePath, ctx.file);
    const link = ctx.resolveLink(str(target), ctx.file);
    return args[1] !== undefined && args[1] !== null ? { ...link, display: str(args[1]) } : link;
  }],
  ['max', (args) => extreme(flat(args), 1)],
  ['min', (args) => extreme(flat(args), -1)],
]);

function extreme(values: readonly Value[], sign: 1 | -1): Value {
  let best: Value = null;
  for (const v of values) {
    if (isEmptyValue(v)) continue;
    if (best === null || sign * compareForSort(v, best) > 0) best = v;
  }
  return best;
}

const pad = (n: number, w = 2): string => String(n).padStart(w, '0');

/** Datoformat med `YYYY YY MM M DD D HH H mm ss`. Ren dato i UTC, dato med tid i lokal tid. */
export function formatDate(date: DateValue, pattern: string): string {
  const d = new Date(date.ms);
  const utc = !date.hasTime;
  const parts: Record<string, string> = {
    YYYY: String(utc ? d.getUTCFullYear() : d.getFullYear()),
    YY: String(utc ? d.getUTCFullYear() : d.getFullYear()).slice(-2),
    MM: pad((utc ? d.getUTCMonth() : d.getMonth()) + 1),
    M: String((utc ? d.getUTCMonth() : d.getMonth()) + 1),
    DD: pad(utc ? d.getUTCDate() : d.getDate()),
    D: String(utc ? d.getUTCDate() : d.getDate()),
    HH: pad(utc ? d.getUTCHours() : d.getHours()),
    H: String(utc ? d.getUTCHours() : d.getHours()),
    mm: pad(utc ? d.getUTCMinutes() : d.getMinutes()),
    ss: pad(utc ? d.getUTCSeconds() : d.getSeconds()),
  };
  return pattern.replace(/YYYY|YY|MM|M|DD|D|HH|H|mm|ss/g, (token) => parts[token]!);
}

const normalizeTag = (t: string): string => t.trim().replace(/^#/, '').normalize('NFC').toLowerCase();

/** Normaliserte tagger per fil (hasTag kalles for hver rad i hvert filter/formel). */
const normalizedTags = new WeakMap<FileSubject, readonly string[]>();

/** `hasTag("task")` matcher `task` og `task/x`, ikke `tasks` (PO, case-insensitivt PO-10). */
export function fileHasTag(file: FileSubject, wanted: readonly string[]): boolean {
  let tags = normalizedTags.get(file);
  if (!tags) {
    tags = file.tags().map(normalizeTag);
    normalizedTags.set(file, tags);
  }
  if (tags.length === 0) return false;
  return wanted.some((raw) => {
    const w = normalizeTag(raw);
    return w !== '' && tags.some((t) => t === w || t.startsWith(`${w}/`));
  });
}

/** `inFolder("x")` er sann for `x` og undermapper (O5), ikke for `x-arkiv`. */
export function fileInFolder(file: FileSubject, folder: string): boolean {
  const wanted = folder.normalize('NFC').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  if (wanted === '') return true;
  const own = file.folder === '/' ? '' : file.folder;
  return own === wanted || own.startsWith(`${wanted}/`);
}

const fileOf = (v: Value): FileSubject | null => (isFile(v) ? v.file : null);

const FILE_METHODS: Readonly<Record<string, Method>> = {
  inFolder: (r, args) => fileInFolder(fileOf(r)!, str(args[0])),
  hasTag: (r, args) => fileHasTag(fileOf(r)!, flat(args).map(str)),
  hasLink: (r, args, ctx) => {
    const file = fileOf(r)!;
    const target = args[0] ?? null;
    const wanted = isFile(target)
      ? target.file.filePath
      : isLink(target)
        ? target.filePath
        : ctx.resolveLink(str(target), file).filePath;
    return wanted !== null && file.links().some((l) => l.filePath === wanted);
  },
  hasProperty: (r, args) => {
    const key = str(args[0]).toLowerCase();
    return fileOf(r)!.propertyKeys().some((k) => k.toLowerCase() === key);
  },
  asLink: (r, args, ctx) => {
    const file = fileOf(r)!;
    const link = ctx.resolveLink(file.filePath, file);
    return args[0] !== undefined && args[0] !== null ? { ...link, display: str(args[0]) } : link;
  },
};

const FILE_FIELDS: Readonly<Record<string, Field>> = {
  name: (r) => fileOf(r)!.name,
  basename: (r) => fileOf(r)!.name,
  fullname: (r) => fileOf(r)!.fullName,
  path: (r) => fileOf(r)!.filePath,
  folder: (r) => fileOf(r)!.folder,
  ext: (r) => fileOf(r)!.ext,
  size: (r) => fileOf(r)!.size,
  ctime: (r) => dateValue(fileOf(r)!.ctimeMs, true),
  mtime: (r) => dateValue(fileOf(r)!.mtimeMs, true),
  tags: (r) => list(fileOf(r)!.tags()),
  links: (r) => list(fileOf(r)!.links()),
  properties: (r): ObjectValue => {
    const file = fileOf(r)!;
    return { kind: 'object', get: (k) => file.property(k), keys: () => file.propertyKeys() };
  },
  file: (r) => r,
};

const containsValue = (haystack: Value, needle: Value): boolean => {
  if (isList(haystack)) return haystack.items.some((item) => valuesEqual(item, needle));
  if (typeof haystack === 'string') return haystack.includes(str(needle));
  return false;
};

const ANY_METHODS: Readonly<Record<string, Method>> = {
  isEmpty: (r) => isEmptyValue(r) || (typeof r === 'object' && r !== null && r.kind === 'object' && r.keys().length === 0),
  isTruthy: (r) => isTruthy(r),
  toString: (r: Value) => toText(r),
  isType: (r, args) => kindOf(r) === str(args[0]).toLowerCase(),
};

const STRING_METHODS: Readonly<Record<string, Method>> = {
  contains: (r, args) => containsValue(r, args[0] ?? null),
  containsAll: (r, args) => flat(args).every((a) => containsValue(r, a)),
  containsAny: (r, args) => flat(args).some((a) => containsValue(r, a)),
  startsWith: (r, args) => str(r).startsWith(str(args[0])),
  endsWith: (r, args) => str(r).endsWith(str(args[0])),
  lower: (r) => str(r).toLowerCase(),
  upper: (r) => str(r).toUpperCase(),
  title: (r) => str(r).replace(/(^|\s)(\p{L})/gu, (_m, space: string, ch: string) => space + ch.toUpperCase()),
  trim: (r) => str(r).trim(),
  replace: (r, args) => str(r).split(str(args[0])).join(str(args[1])),
  split: (r, args) => list(str(r).split(args[0] === undefined ? ',' : str(args[0]))),
  slice: (r, args) => str(r).slice(num(args[0]) ?? 0, num(args[1]) ?? undefined),
  reverse: (r) => [...str(r)].reverse().join(''),
};

const NUMBER_METHODS: Readonly<Record<string, Method>> = {
  round: (r, args) => {
    const digits = num(args[0]) ?? 0;
    const f = 10 ** digits;
    return Math.round((r as number) * f) / f;
  },
  floor: (r) => Math.floor(r as number),
  ceil: (r) => Math.ceil(r as number),
  abs: (r) => Math.abs(r as number),
  toFixed: (r, args) => (r as number).toFixed(Math.min(Math.max(num(args[0]) ?? 0, 0), 20)),
};

const DATE_METHODS: Readonly<Record<string, Method>> = {
  format: (r, args) => formatDate(r as DateValue, args[0] === undefined ? 'YYYY-MM-DD' : str(args[0])),
  date: (r) => {
    const d = r as DateValue;
    if (!d.hasTime) return d;
    const local = new Date(d.ms);
    return dateValue(Date.UTC(local.getFullYear(), local.getMonth(), local.getDate()), false);
  },
  time: (r) => formatDate({ ...(r as DateValue), hasTime: true }, 'HH:mm:ss'),
};

const dateField =
  (pick: (d: Date, utc: boolean) => number): Field =>
  (r) => {
    const v = r as DateValue;
    return pick(new Date(v.ms), !v.hasTime);
  };

const DATE_FIELDS: Readonly<Record<string, Field>> = {
  year: dateField((d, utc) => (utc ? d.getUTCFullYear() : d.getFullYear())),
  month: dateField((d, utc) => (utc ? d.getUTCMonth() : d.getMonth()) + 1),
  day: dateField((d, utc) => (utc ? d.getUTCDate() : d.getDate())),
  hour: dateField((d, utc) => (utc ? d.getUTCHours() : d.getHours())),
  minute: dateField((d, utc) => (utc ? d.getUTCMinutes() : d.getMinutes())),
  second: dateField((d, utc) => (utc ? d.getUTCSeconds() : d.getSeconds())),
};

const LIST_METHODS: Readonly<Record<string, Method>> = {
  contains: (r, args) => containsValue(r, args[0] ?? null),
  containsAll: (r, args) => flat(args).every((a) => containsValue(r, a)),
  containsAny: (r, args) => flat(args).some((a) => containsValue(r, a)),
  join: (r, args) => (isList(r) ? r.items.map(toText).join(args[0] === undefined ? ', ' : str(args[0])) : null),
  reverse: (r) => (isList(r) ? list([...r.items].reverse()) : null),
  sort: (r) => (isList(r) ? list([...r.items].sort(compareForSort)) : null),
  unique: (r) => (isList(r) ? list(r.items.filter((v, i) => r.items.findIndex((w) => valuesEqual(v, w)) === i)) : null),
  flat: (r) => (isList(r) ? list(r.items.flatMap((v) => (isList(v) ? v.items : [v]))) : null),
  slice: (r, args) => (isList(r) ? list(r.items.slice(num(args[0]) ?? 0, num(args[1]) ?? undefined)) : null),
};

const OBJECT_METHODS: Readonly<Record<string, Method>> = {
  keys: (r) => (typeof r === 'object' && r !== null && r.kind === 'object' ? list([...r.keys()]) : null),
  values: (r) => (typeof r === 'object' && r !== null && r.kind === 'object' ? list(r.keys().map((k) => r.get(k))) : null),
};

const lengthField: Field = (r) => (typeof r === 'string' ? [...r].length : isList(r) ? r.items.length : null);

const METHODS: Readonly<Partial<Record<ValueKind, Readonly<Record<string, Method>>>>> = {
  string: STRING_METHODS,
  number: NUMBER_METHODS,
  date: DATE_METHODS,
  list: LIST_METHODS,
  file: FILE_METHODS,
  object: OBJECT_METHODS,
};

const FIELDS: Readonly<Partial<Record<ValueKind, Readonly<Record<string, Field>>>>> = {
  string: { length: lengthField },
  list: { length: lengthField },
  date: DATE_FIELDS,
  file: FILE_FIELDS,
};

const own = <T>(table: Readonly<Record<string, T>> | undefined, name: string): T | undefined =>
  table && Object.prototype.hasOwnProperty.call(table, name) ? table[name] : undefined;

/** Metode for en mottaker, eller `null` hvis typen ikke har den. */
export function findMethod(receiver: Value, name: string): Method | null {
  return own(METHODS[kindOf(receiver)], name) ?? own(ANY_METHODS, name) ?? null;
}

/** Feltoppslag `a.b`. Objekter (navnerom, nestede frontmatter-objekter) slår opp nøkkelen. `undefined` = ukjent felt. */
export function readField(receiver: Value, name: string, ctx: EvalContext): Value | undefined {
  if (typeof receiver === 'object' && receiver !== null && receiver.kind === 'object') return receiver.get(name);
  const field = own(FIELDS[kindOf(receiver)], name);
  return field ? field(receiver, ctx) : undefined;
}

/** Alle metodenavn på tvers av typer – brukes til statisk sjekk av ukjente funksjoner. */
export const KNOWN_METHOD_NAMES: ReadonlySet<string> = new Set(
  [ANY_METHODS, ...Object.values(METHODS)].flatMap((table) => Object.keys(table ?? {})),
);

/** Feltene på `file`. */
export const KNOWN_FILE_FIELDS: ReadonlySet<string> = new Set(Object.keys(FILE_FIELDS));

