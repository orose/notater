/** Sortering og gruppering (ADR-003, PO-11, B2/B3/B5/B7). Generiske, rene funksjoner. */
import { compareForSort, compareText, isEmptyValue, toText } from '../expression/values';
import type { Value } from '../expression/values';
import type { SortDirection } from '../definition/base-definition';

export interface SortKey<T> {
  readonly value: (row: T) => Value;
  readonly direction: SortDirection;
}

/** Tomme verdier sist uansett retning (B3). */
export function compareWithNullsLast(a: Value, b: Value, direction: SortDirection): number {
  const emptyA = isEmptyValue(a);
  const emptyB = isEmptyValue(b);
  if (emptyA || emptyB) return emptyA === emptyB ? 0 : emptyA ? 1 : -1;
  const c = compareForSort(a, b);
  return direction === 'DESC' ? -c : c;
}

/** Stabil sortering på flere nøkler; nøkkelverdier beregnes én gang per rad. */
export function sortRows<T>(rows: readonly T[], keys: readonly SortKey<T>[], tieBreak: (a: T, b: T) => number): T[] {
  const decorated = rows.map((row) => ({ row, values: keys.map((k) => k.value(row)) }));
  decorated.sort((a, b) => {
    for (let i = 0; i < keys.length; i++) {
      const c = compareWithNullsLast(a.values[i]!, b.values[i]!, keys[i]!.direction);
      if (c !== 0) return c;
    }
    return tieBreak(a.row, b.row);
  });
  return decorated.map((d) => d.row);
}

export interface GroupBucket<T> {
  /** Grupperingsverdi; `null` for «(ingen)». */
  readonly value: Value;
  /** Tekstnøkkel (case-sensitiv, B6); `null` for «(ingen)». */
  readonly text: string | null;
  readonly rows: T[];
}

/** Grupperer i rekkefølgen radene kommer (allerede sortert). Lister grupperes på tekstformen (ADR-003 v1). */
export function groupRows<T>(rows: readonly T[], value: (row: T) => Value): GroupBucket<T>[] {
  const buckets = new Map<string | null, GroupBucket<T>>();
  for (const row of rows) {
    const v = value(row);
    const text = isEmptyValue(v) ? null : toText(v);
    let bucket = buckets.get(text);
    if (!bucket) {
      bucket = { value: text === null ? null : v, text, rows: [] };
      buckets.set(text, bucket);
    }
    bucket.rows.push(row);
  }
  return [...buckets.values()];
}

export interface GroupOrderOptions {
  readonly direction: SortDirection;
  /**
   * Kanban: oppførte verdier først i denne rekkefølgen – også uten kort (PO-11/B7) – deretter
   * øvrige alfabetisk (nb). `null` = vanlig tabellgruppering.
   */
  readonly groupOrder: readonly string[] | null;
}

/** Ordner grupper; «(ingen)» alltid sist (PO). */
export function orderGroups<T>(buckets: readonly GroupBucket<T>[], options: GroupOrderOptions): GroupBucket<T>[] {
  const none = buckets.find((b) => b.text === null);
  const valued = buckets.filter((b) => b.text !== null);
  const byValue = (a: GroupBucket<T>, b: GroupBucket<T>): number => {
    const c = compareWithNullsLast(a.value, b.value, options.direction);
    return c !== 0 ? c : compareText(a.text!, b.text!) || (a.text! < b.text! ? -1 : a.text! > b.text! ? 1 : 0);
  };
  const ordered: GroupBucket<T>[] = [];
  if (options.groupOrder) {
    const listed = new Set<string>();
    for (const entry of options.groupOrder) {
      if (listed.has(entry)) continue;
      listed.add(entry);
      ordered.push(valued.find((b) => b.text === entry) ?? { value: entry, text: entry, rows: [] });
    }
    ordered.push(...valued.filter((b) => !listed.has(b.text!)).sort(byValue));
  } else {
    ordered.push(...[...valued].sort(byValue));
  }
  if (none) ordered.push(none);
  return ordered;
}
