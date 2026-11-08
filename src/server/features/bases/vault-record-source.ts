/**
 * Adapter: vault-indeksen (snapshot + lenkeoppløsning) → `RecordSource` for Bases (ADR-003, DIP).
 * Bygges én gang per snapshot; property-konvertering og lenkeoppløsning gjøres lat og caches per fil.
 */
import type { FilePath, VaultValue } from '../../../shared/api-types';
import type { LinkValue, Value } from './expression/values';
import { dateValue, list, parseDateString } from './expression/values';
import type { BaseRecord, RecordSource } from './query/record-source';
import type { LinkResolver } from '../links';
import { parseWikiLinkInner } from '../markdown-syntax';
import type { FrontmatterData } from '../markdown-syntax';
import { toVaultValue } from '../properties';
import type { IndexedNote, VaultFile, VaultSnapshot } from '../vault-index';

const WHOLE_LINK = /^\[\[([^[\]\n]+)\]\]$/;
const TAG_KEYS = new Set(['tags', 'tag']);
const EMPTY_TAGS: readonly string[] = [];

export function createVaultRecordSource(snapshot: VaultSnapshot, links: LinkResolver): RecordSource {
  const linkCache = new Map<string, LinkValue>();

  const resolveLink = (text: string, fromFilePath: FilePath, syntax: 'wiki' | 'markdown' = 'wiki'): LinkValue => {
    const cacheKey = `${syntax}\u0000${fromFilePath}\u0000${text}`;
    const cached = linkCache.get(cacheKey);
    if (cached) return cached;
    const inner = WHOLE_LINK.exec(text.trim())?.[1] ?? text.trim();
    const parts = syntax === 'wiki' ? parseWikiLinkInner(inner) : { target: inner, alias: null };
    const resolved = parts.target === '' ? null : links.resolve(parts.target, fromFilePath, syntax);
    const value: LinkValue = {
      kind: 'link',
      filePath: resolved?.file.filePath ?? null,
      docPath: resolved?.file.docPath ?? null,
      display: parts.alias ?? parts.target,
    };
    linkCache.set(cacheKey, value);
    return value;
  };

  const records = [...snapshot.files.values()]
    .sort((a, b) => (a.filePath < b.filePath ? -1 : a.filePath > b.filePath ? 1 : 0))
    .map((file) => new VaultRecord(file, snapshot.notes.get(file.filePath), resolveLink));
  const byPath = new Map(records.map((r) => [r.filePath, r]));

  return {
    records: () => records,
    record: (filePath) => byPath.get(filePath) ?? null,
    resolveLink: (text, from) => resolveLink(text, from.filePath),
  };
}

type Resolve = (text: string, fromFilePath: FilePath, syntax?: 'wiki' | 'markdown') => LinkValue;

const EMPTY_FRONTMATTER: FrontmatterData = {};

/** Klasse (ikke closures) for å holde allokeringene nede: én post per fil i vaultet. */
class VaultRecord implements BaseRecord {
  readonly filePath: string;
  readonly docPath: string;
  readonly name: string;
  readonly fullName: string;
  readonly ext: string;
  readonly folder: string;
  readonly size: number;
  readonly mtimeMs: number;
  readonly ctimeMs: number;
  private readonly frontmatter: FrontmatterData;
  private values: Map<string, Value> | null = null;
  private displays: Map<string, VaultValue> | null = null;
  private outgoing: LinkValue[] | null = null;

  constructor(
    file: VaultFile,
    private readonly note: IndexedNote | undefined,
    private readonly resolveLink: Resolve,
  ) {
    this.filePath = file.filePath;
    this.docPath = file.docPath;
    this.name = file.title;
    this.fullName = file.filePath.slice(file.filePath.lastIndexOf('/') + 1);
    this.ext = file.ext;
    this.folder = file.folder === '' ? '/' : file.folder;
    this.size = file.size;
    this.mtimeMs = file.mtimeMs;
    this.ctimeMs = file.ctimeMs;
    this.frontmatter = note?.meta.frontmatter ?? EMPTY_FRONTMATTER;
  }

  tags(): readonly string[] {
    return this.note?.meta.tags ?? EMPTY_TAGS;
  }

  links(): readonly LinkValue[] {
    this.outgoing ??= (this.note?.meta.links ?? [])
      .filter((l) => l.target !== '')
      .map((l) => this.resolveLink(l.target, this.filePath, l.kind === 'markdown' || l.kind === 'markdown-embed' ? 'markdown' : 'wiki'));
    return this.outgoing;
  }

  propertyKeys(): readonly string[] {
    return Object.keys(this.frontmatter);
  }

  property(key: string): Value {
    const actual = this.keyFor(key);
    if (actual === null) return null;
    this.values ??= new Map();
    let value = this.values.get(actual);
    if (value === undefined) {
      const raw = this.frontmatter[actual];
      value = TAG_KEYS.has(actual.toLowerCase()) ? toTagList(raw) : toValue(raw, (t) => this.resolveLink(t, this.filePath));
      this.values.set(actual, value);
    }
    return value;
  }

  displayProperty(key: string): VaultValue {
    const actual = this.keyFor(key);
    if (actual === null) return { type: 'null' };
    this.displays ??= new Map();
    let display = this.displays.get(actual);
    if (display === undefined) {
      display = toVaultValue(actual, this.frontmatter[actual], (target) => this.resolveLink(`[[${target}]]`, this.filePath).docPath);
      this.displays.set(actual, display);
    }
    return display;
  }

  /** Eksakt nøkkel, ellers uten hensyn til store/små bokstaver (som Obsidian). */
  private keyFor(key: string): string | null {
    if (Object.prototype.hasOwnProperty.call(this.frontmatter, key)) return key;
    if (this.frontmatter === EMPTY_FRONTMATTER) return null;
    const lower = key.toLowerCase();
    for (const k in this.frontmatter) if (k.toLowerCase() === lower) return k;
    return null;
  }
}

/** Rå frontmatter-verdi → uttrykksverdi: `"[[x]]"` → lenke, `YYYY-MM-DD`/ISO → dato, objekter → objekt. */
function toValue(raw: unknown, link: (text: string) => LinkValue): Value {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'boolean') return raw;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : String(raw);
  if (typeof raw === 'string') {
    if (WHOLE_LINK.test(raw.trim())) return link(raw);
    return parseDateString(raw) ?? raw;
  }
  if (Array.isArray(raw)) return list(raw.map((item) => toValue(item, link)));
  if (raw instanceof Date) return dateValue(raw.getTime(), true);
  if (typeof raw === 'object') {
    const record = raw as Record<string, unknown>;
    return { kind: 'object', get: (k) => toValue(record[k], link), keys: () => Object.keys(record) };
  }
  return String(raw);
}

/** `tags`-property: liste eller skalar (komma/mellomrom-separert), uten `#`. */
function toTagList(raw: unknown): Value {
  const items = Array.isArray(raw) ? raw : raw === null || raw === undefined ? [] : [raw];
  return list(
    items
      .flatMap((v) => (typeof v === 'string' ? v.split(/[,\s]+/) : typeof v === 'number' ? [String(v)] : []))
      .map((t) => t.trim().replace(/^#/, ''))
      .filter((t) => t !== ''),
  );
}
