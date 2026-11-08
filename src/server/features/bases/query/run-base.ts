/**
 * (BaseDefinition, RecordSource) → BaseResult (ADR-003). Klienten får ferdig filtrert, sortert og
 * gruppert resultat med typede celler; den tolker aldri uttrykk.
 */
import type {
  BaseColumn,
  BaseGroup,
  BaseKanbanView,
  BaseResult,
  BaseRow,
  BaseTableView,
  BaseUnsupportedView,
  BaseView,
  BaseWarning,
  VaultValue,
} from '../../../../shared/api-types';
import { KNOWN_FILE_FIELDS, readField } from '../expression/functions';
import { compareText } from '../expression/values';
import type { FileSubject, Value } from '../expression/values';
import type { BaseDefinition, SortSpec, ViewDefinition } from '../definition/base-definition';
import { compileFilter, compileFormulas, createExpressionCompiler } from './compile';
import type { ExpressionCompiler, FormulaFn, Predicate } from './compile';
import { toDisplayValue, groupLabel } from './format-value';
import { groupRows, orderGroups, sortRows } from './group-and-sort';
import type { SortKey } from './group-and-sort';
import { columnLabel, parsePropertyRef } from './property-ref';
import type { PropertyRef } from './property-ref';
import type { RecordSource } from './record-source';
import { RowContext } from './row-context';
import { createWarningSink } from './warnings';
import type { WarningSink } from './warnings';

export interface RunBaseOptions {
  /** PO-12: bare dette viewet (`![[X.base#View]]`). `null` = alle. */
  readonly view: string | null;
  /** `this` i uttrykk (vertsnotatet for ```base-blokker). */
  readonly thisFile: FileSubject | null;
  readonly nowMs: number;
}

export interface RunBaseResult {
  readonly result: BaseResult;
  /** Bruker `now()`/`today()` – resultatet kan ikke caches på tvers av tid. */
  readonly usesClock: boolean;
}

const SUPPORTED_VIEW_TYPES = new Set(['table', 'kanban']);
const DEFAULT_ORDER = ['file.name'];
/** B5/PO-11: uten `sort` sorteres radene/kortene på `file.name`. */
const DEFAULT_SORT: readonly SortSpec[] = [{ property: 'file.name', direction: 'ASC' }];

export function runBase(definition: BaseDefinition, source: RecordSource, options: RunBaseOptions): RunBaseResult {
  const baseSink = createWarningSink(definition.warnings);
  const selected = selectViews(definition.views, options.view);
  if (!selected.ok) return { result: { views: [], warnings: [...baseSink.list(), selected.warning] }, usesClock: false };

  const compiler = createExpressionCompiler(new Set(definition.formulas.keys()));
  const formulas = compileFormulas(definition.formulas, compiler, baseSink);
  const globalFilter = compileFilter(definition.filters, 'filters', compiler, baseSink);

  const env = { formulas, thisFile: options.thisFile, nowMs: options.nowMs, resolveLink: source.resolveLink.bind(source) };
  const needsRows = selected.views.some((v) => SUPPORTED_VIEW_TYPES.has(v.type));
  const rows = needsRows ? source.records().map((record) => new RowContext(record, env)).filter((row) => globalFilter(row)) : [];

  const views = selected.views.map((view) => runView(view, rows, { definition, compiler, formulas }));
  return { result: { views, warnings: baseSink.list() }, usesClock: compiler.usesClock };
}

type ViewSelection = { readonly ok: true; readonly views: readonly ViewDefinition[] } | { readonly ok: false; readonly warning: BaseWarning };

/** PO-12/PO-34: navngitt view (eksakt, så uten hensyn til store/små bokstaver); ukjent → advarsel med liste. */
function selectViews(views: readonly ViewDefinition[], wanted: string | null): ViewSelection {
  if (wanted === null) return { ok: true, views };
  const exact = views.filter((v) => v.name === wanted);
  const loose = exact.length > 0 ? exact : views.filter((v) => v.name.toLowerCase() === wanted.toLowerCase());
  if (loose.length > 0) return { ok: true, views: loose.slice(0, 1) };
  const available = views.map((v) => v.name);
  return {
    ok: false,
    warning: {
      code: 'unknown-view',
      message: `Viewet «${wanted}» finnes ikke. Tilgjengelige views: ${available.map((n) => `«${n}»`).join(', ')}.`,
      source: wanted,
      availableViews: available,
    },
  };
}

interface ViewDeps {
  readonly definition: BaseDefinition;
  readonly compiler: ExpressionCompiler;
  readonly formulas: ReadonlyMap<string, FormulaFn>;
}

function runView(view: ViewDefinition, baseRows: readonly RowContext[], deps: ViewDeps): BaseView {
  if (!SUPPORTED_VIEW_TYPES.has(view.type)) {
    return {
      type: 'unsupported',
      name: view.name,
      originalType: view.type,
      warnings: [...view.warnings, { code: 'unknown-view-type', message: `View-typen «${view.type}» støttes ikke.`, source: view.type }],
    } satisfies BaseUnsupportedView;
  }

  const sink = createWarningSink(view.warnings);
  const where = `viewet «${view.name}»`;
  const filter: Predicate = compileFilter(view.filters, where, deps.compiler, sink);
  const reader = (raw: string, role: string): PropertyReader => propertyReader(parsePropertyRef(raw), deps.formulas, sink, `${role} i ${where}`);

  const sortSpecs = view.sort.length > 0 ? view.sort : DEFAULT_SORT;
  const sortKeys: SortKey<RowContext>[] = sortSpecs.map((spec) => ({ value: reader(spec.property, 'sort').read, direction: spec.direction }));
  const byName = (a: RowContext, b: RowContext): number =>
    compareText(a.file.name, b.file.name) || (a.file.filePath < b.file.filePath ? -1 : a.file.filePath > b.file.filePath ? 1 : 0);
  let rows = sortRows(baseRows.filter((row) => filter(row)), sortKeys, byName);
  if (view.limit !== null) rows = rows.slice(0, view.limit);

  const columns = buildColumns(view, deps.definition.displayNames);
  const cellReaders = columns.map((c) => ({ id: c.id, read: reader(c.id, 'order').display }));
  const toRow = (row: RowContext): BaseRow => ({
    path: row.file.docPath,
    cells: Object.fromEntries(cellReaders.map((c) => [c.id, c.read(row)])),
  });

  const isKanban = view.type === 'kanban';
  let groups: BaseGroup[];
  if (view.groupBy) {
    const groupReader = reader(view.groupBy.property, 'groupBy');
    const buckets = orderGroups(groupRows(rows, groupReader.read), {
      direction: view.groupBy.direction,
      groupOrder: isKanban ? view.groupOrder : null,
    });
    groups = buckets.map((bucket) => ({
      key: bucket.text === null ? null : toDisplayValue(bucket.value),
      label: groupLabel(bucket.value),
      rows: bucket.rows.map(toRow),
    }));
  } else {
    if (isKanban) sink.add({ code: 'missing-group-by', message: `Kanban-viewet «${view.name}» mangler groupBy; alle kort vises i én kolonne.` });
    groups = [{ key: null, label: isKanban ? groupLabel(null) : '', rows: rows.map(toRow) }];
  }

  const common = { name: view.name, columns, groups, totalRows: rows.length, warnings: sink.list() };
  if (isKanban) {
    return { type: 'kanban', ...common, groupBy: view.groupBy ? parsePropertyRef(view.groupBy.property).id : '' } satisfies BaseKanbanView;
  }
  return { type: 'table', ...common, grouped: view.groupBy !== null, indentProperties: view.indentProperties } satisfies BaseTableView;
}

function buildColumns(view: ViewDefinition, displayNames: Readonly<Record<string, string>>): BaseColumn[] {
  const widths = new Map(Object.entries(view.columnSize).map(([key, width]) => [parsePropertyRef(key).id, width]));
  const seen = new Set<string>();
  const columns: BaseColumn[] = [];
  for (const raw of view.order.length > 0 ? view.order : DEFAULT_ORDER) {
    const ref = parsePropertyRef(raw);
    if (ref.name === '' || seen.has(ref.id)) continue;
    seen.add(ref.id);
    const width = widths.get(ref.id);
    columns.push({ id: ref.id, label: columnLabel(ref, displayNames), ...(width !== undefined ? { width } : {}) });
  }
  return columns;
}

interface PropertyReader {
  /** Verdi for filtrering/sortering/gruppering. */
  readonly read: (row: RowContext) => Value;
  /** Verdi for visning i en celle. */
  readonly display: (row: RowContext) => VaultValue;
}

const TAG_PROPERTIES = new Set(['tags', 'tag']);

function propertyReader(ref: PropertyRef, formulas: ReadonlyMap<string, FormulaFn>, sink: WarningSink, where: string): PropertyReader {
  if (ref.namespace === 'note') {
    return { read: (row) => row.file.property(ref.name), display: (row) => row.file.displayProperty(ref.name) };
  }
  if (ref.namespace === 'formula') {
    if (!formulas.has(ref.name)) {
      sink.add({ code: 'unknown-formula', message: `Formelen «${ref.name}» finnes ikke (${where}).`, source: ref.id });
    }
    const read = (row: RowContext): Value => row.formula(ref.name);
    return { read, display: (row) => toDisplayValue(read(row)) };
  }
  if (!KNOWN_FILE_FIELDS.has(ref.name)) {
    sink.add({ code: 'unknown-property', message: `Ukjent felt «${ref.id}» (${where}).`, source: ref.id });
  }
  const read = (row: RowContext): Value => readField({ kind: 'file', file: row.file }, ref.name, row) ?? null;
  const asTags = TAG_PROPERTIES.has(ref.name);
  return { read, display: (row) => toDisplayValue(read(row), { asTags }) };
}
