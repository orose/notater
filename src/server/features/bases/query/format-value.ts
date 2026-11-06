/** Kjøretidsverdi → `VaultValue` (api.md) og gruppeetiketter. Rene funksjoner. */
import type { VaultValue } from '../../../../shared/api-types';
import { isEmptyValue, toText } from '../expression/values';
import type { DateValue, Value } from '../expression/values';

export interface FormatOptions {
  /** Strenger i lister vises som tagger (`file.tags`). */
  readonly asTags?: boolean;
}

export function toDisplayValue(value: Value, options: FormatOptions = {}): VaultValue {
  if (value === null) return { type: 'null' };
  if (typeof value === 'string') return options.asTags ? { type: 'tag', value } : { type: 'string', value };
  if (typeof value === 'number') return Number.isFinite(value) ? { type: 'number', value } : { type: 'null' };
  if (typeof value === 'boolean') return { type: 'boolean', value };
  switch (value.kind) {
    case 'date':
      return { type: 'date', value: new Date(value.ms).toISOString(), hasTime: value.hasTime };
    case 'list':
      return { type: 'list', value: value.items.map((item) => toDisplayValue(item, options)) };
    case 'link':
      return { type: 'link', target: value.docPath, display: value.display };
    case 'file':
      return { type: 'link', target: value.file.docPath, display: value.file.name };
    case 'object':
      return { type: 'string', value: JSON.stringify(Object.fromEntries(value.keys().map((k) => [k, toText(value.get(k))]))) };
  }
}

/** Etikett for «(ingen)»-gruppen (PO). */
export const NO_VALUE_LABEL = '(ingen)';

const pad = (n: number): string => String(n).padStart(2, '0');

/** Datoer som `dd.MM.yyyy` (B10), ren dato i UTC; med tid i Europe/Oslo. */
function dateLabel(date: DateValue): string {
  if (!date.hasTime) {
    const d = new Date(date.ms);
    return `${pad(d.getUTCDate())}.${pad(d.getUTCMonth() + 1)}.${d.getUTCFullYear()}`;
  }
  const parts = new Intl.DateTimeFormat('nb-NO', {
    timeZone: 'Europe/Oslo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(new Date(date.ms));
  const get = (type: string): string => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('day')}.${get('month')}.${get('year')} ${get('hour')}:${get('minute')}`;
}

export function groupLabel(value: Value): string {
  if (isEmptyValue(value)) return NO_VALUE_LABEL;
  if (typeof value === 'object' && value !== null && value.kind === 'date') return dateLabel(value);
  if (typeof value === 'object' && value !== null && value.kind === 'list') return value.items.map(groupLabel).join(', ');
  return toText(value);
}
