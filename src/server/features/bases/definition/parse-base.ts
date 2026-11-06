/**
 * `.base`-YAML → `BaseDefinition` (ADR-003). Tolerant: kaster aldri. Ugyldig YAML gir et feilkort;
 * ukjente nøkler og feil form gir advarsler og ignoreres.
 */
import { YAMLParseError, parse } from 'yaml';
import type { BaseWarning } from '../../../../shared/api-types';
import type { BaseDefinition, FilterNode, ParsedBase, SortDirection, SortSpec, ViewDefinition } from './base-definition';

const TOP_LEVEL_KEYS = new Set(['filters', 'formulas', 'properties', 'views', 'summaries', 'display']);
/** View-nøkler vi forstår eller bevisst ignorerer (Obsidian-nøkler uten betydning for tabell/kanban). */
const VIEW_KEYS = new Set([
  'type',
  'name',
  'filters',
  'order',
  'sort',
  'groupBy',
  'groupOrder',
  'columnSize',
  'indentProperties',
  'limit',
  'summaries',
  'rowHeight',
  'image',
  'imageFit',
  'imageAspectRatio',
  'cardSize',
]);
const DEFAULT_VIEW_NAMES: Readonly<Record<string, string>> = { table: 'Tabell', kanban: 'Kanban', cards: 'Kort', list: 'Liste' };

type Warn = (warning: BaseWarning) => void;

export function parseBaseDefinition(source: string): ParsedBase {
  let raw: unknown;
  try {
    raw = parse(source, { schema: 'core', uniqueKeys: false, prettyErrors: true });
  } catch (error) {
    return { ok: false, error: yamlError(error) };
  }
  if (raw === null || raw === undefined) raw = {};
  if (!isRecord(raw)) {
    return { ok: false, error: { code: 'invalid-yaml', message: 'Kunne ikke lese base-definisjonen: toppnivået må være et objekt med nøkler.' } };
  }

  const warnings: BaseWarning[] = [];
  const warn: Warn = (w) => warnings.push(w);
  for (const key of Object.keys(raw)) if (!TOP_LEVEL_KEYS.has(key)) warn(unknownKey(key));

  const filters = parseFilter(raw.filters, warn, 'filters');
  const formulas = parseFormulas(raw.formulas, warn);
  const displayNames = parseDisplayNames(raw.properties);
  const rawViews = raw.views === undefined || raw.views === null ? [] : raw.views;
  if (!Array.isArray(rawViews)) warn(invalidValue('views', 'en liste'));
  const views = (Array.isArray(rawViews) ? rawViews : []).map((v, i) => parseView(v, i));
  const definition: BaseDefinition = {
    filters,
    formulas,
    displayNames,
    views: views.length > 0 ? views : [parseView({ type: 'table' }, 0)],
    warnings,
  };
  return { ok: true, definition };
}

function yamlError(error: unknown): BaseWarning {
  const line = error instanceof YAMLParseError ? error.linePos?.[0]?.line : undefined;
  const detail = error instanceof Error ? (error.message.split('\n')[0] ?? '') : String(error);
  return {
    code: 'invalid-yaml',
    message: `Kunne ikke lese base-definisjonen${line ? ` (linje ${line})` : ''}: ugyldig YAML.`,
    source: detail,
  };
}

function parseFilter(value: unknown, warn: Warn, where: string): FilterNode | null {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return { kind: 'expr', source: String(value) };
  }
  if (isRecord(value)) {
    const keys = Object.keys(value);
    const op = keys.length === 1 ? keys[0] : undefined;
    if (op === 'and' || op === 'or' || op === 'not') {
      const rawChildren = value[op];
      const list = Array.isArray(rawChildren) ? rawChildren : rawChildren === null || rawChildren === undefined ? [] : [rawChildren];
      const children = list.map((c) => parseFilter(c, warn, where)).filter((c): c is FilterNode => c !== null);
      return { kind: op, children };
    }
  }
  warn({
    code: 'invalid-filter',
    message: `Filteret i «${where}» har en form som ikke forstås (bruk et uttrykk eller and/or/not) og ignoreres.`,
    source: JSON.stringify(value),
  });
  return null;
}

function parseFormulas(value: unknown, warn: Warn): Map<string, string> {
  const formulas = new Map<string, string>();
  if (value === undefined || value === null) return formulas;
  if (!isRecord(value)) {
    warn(invalidValue('formulas', 'et objekt med formelnavn og uttrykk'));
    return formulas;
  }
  for (const [name, expr] of Object.entries(value)) {
    if (typeof expr === 'string' || typeof expr === 'number' || typeof expr === 'boolean') formulas.set(name, String(expr));
    else warn(invalidValue(`formulas.${name}`, 'et uttrykk'));
  }
  return formulas;
}

function parseDisplayNames(value: unknown): Record<string, string> {
  const names: Record<string, string> = {};
  if (!isRecord(value)) return names;
  for (const [id, config] of Object.entries(value)) {
    if (isRecord(config) && typeof config.displayName === 'string' && config.displayName.trim() !== '') names[id] = config.displayName;
  }
  return names;
}

function parseView(value: unknown, index: number): ViewDefinition {
  const warnings: BaseWarning[] = [];
  const warn: Warn = (w) => warnings.push(w);
  const raw = isRecord(value) ? value : {};
  if (!isRecord(value)) warn(invalidValue(`views[${index}]`, 'et objekt'));
  for (const key of Object.keys(raw)) if (!VIEW_KEYS.has(key)) warn(unknownKey(key));

  const type = typeof raw.type === 'string' && raw.type.trim() !== '' ? raw.type.trim() : 'table';
  const name = typeof raw.name === 'string' && raw.name.trim() !== '' ? raw.name : (DEFAULT_VIEW_NAMES[type] ?? type);
  const limit = typeof raw.limit === 'number' && Number.isInteger(raw.limit) && raw.limit > 0 ? raw.limit : null;
  if (raw.limit !== undefined && raw.limit !== null && limit === null) warn(invalidValue('limit', 'et positivt heltall'));

  return {
    type,
    name: String(name),
    filters: parseFilter(raw.filters, warn, `${name}.filters`),
    order: stringList(raw.order, 'order', warn),
    sort: sortList(raw.sort, warn),
    groupBy: groupBy(raw.groupBy, warn),
    groupOrder: stringList(raw.groupOrder, 'groupOrder', warn),
    columnSize: columnSize(raw.columnSize, warn),
    indentProperties: typeof raw.indentProperties === 'boolean' ? raw.indentProperties : true,
    limit,
    warnings,
  };
}

function stringList(value: unknown, key: string, warn: Warn): string[] {
  if (value === undefined || value === null) return [];
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return [String(value)];
  if (Array.isArray(value)) {
    return value.filter((v) => v !== null && v !== undefined && typeof v !== 'object').map((v) => String(v));
  }
  warn(invalidValue(key, 'en liste'));
  return [];
}

function direction(value: unknown): SortDirection {
  return typeof value === 'string' && value.trim().toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
}

function sortSpec(value: unknown): SortSpec | null {
  if (typeof value === 'string' && value.trim() !== '') return { property: value.trim(), direction: 'ASC' };
  if (isRecord(value) && typeof value.property === 'string' && value.property.trim() !== '') {
    return { property: value.property.trim(), direction: direction(value.direction) };
  }
  return null;
}

function sortList(value: unknown, warn: Warn): SortSpec[] {
  if (value === undefined || value === null) return [];
  const list = Array.isArray(value) ? value : isRecord(value) ? [value] : null;
  const specs = (list ?? []).map(sortSpec);
  if (list === null || specs.some((s) => s === null)) warn(invalidValue('sort', 'en liste med property og direction'));
  return specs.filter((s): s is SortSpec => s !== null);
}

function groupBy(value: unknown, warn: Warn): SortSpec | null {
  if (value === undefined || value === null) return null;
  const spec = sortSpec(value);
  if (!spec) warn(invalidValue('groupBy', 'property og direction'));
  return spec;
}

function columnSize(value: unknown, warn: Warn): Record<string, number> {
  const sizes: Record<string, number> = {};
  if (value === undefined || value === null) return sizes;
  if (!isRecord(value)) {
    warn(invalidValue('columnSize', 'et objekt med kolonnebredder'));
    return sizes;
  }
  let invalid = false;
  for (const [id, width] of Object.entries(value)) {
    if (typeof width === 'number' && Number.isFinite(width) && width > 0) sizes[id] = width;
    else invalid = true;
  }
  if (invalid) warn(invalidValue('columnSize', 'positive tall (px)'));
  return sizes;
}

function unknownKey(key: string): BaseWarning {
  return { code: 'unknown-key', message: `Ukjent nøkkel «${key}» ignoreres.`, source: key };
}

function invalidValue(key: string, expected: string): BaseWarning {
  return { code: 'invalid-value', message: `«${key}» må være ${expected}; verdien ignoreres.`, source: key };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
