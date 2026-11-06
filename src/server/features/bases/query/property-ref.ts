/** «status» | «note.status» | «file.name» | «formula.team» → kanonisk referanse (ADR-003, api.md). */

export type PropertyNamespace = 'file' | 'note' | 'formula';

export interface PropertyRef {
  readonly namespace: PropertyNamespace;
  readonly name: string;
  /** Kanonisk id, f.eks. `note.status` for både «status» og «note.status». */
  readonly id: string;
}

export function parsePropertyRef(raw: string): PropertyRef {
  const text = raw.trim();
  const dot = text.indexOf('.');
  const prefix = dot > 0 ? text.slice(0, dot) : '';
  if (prefix === 'file' || prefix === 'note' || prefix === 'formula') {
    const name = text.slice(dot + 1);
    return { namespace: prefix, name, id: `${prefix}.${name}` };
  }
  return { namespace: 'note', name: text, id: `note.${text}` };
}

const FILE_LABELS: Readonly<Record<string, string>> = {
  name: 'Navn',
  basename: 'Navn',
  fullname: 'Filnavn',
  path: 'Sti',
  folder: 'Mappe',
  ext: 'Filtype',
  size: 'Størrelse',
  ctime: 'Opprettet',
  mtime: 'Endret',
  tags: 'Tagger',
  links: 'Lenker',
};

/** Visningsnavn: `properties.<id>.displayName` fra basen, ellers norsk standard (bases-fasit.md). */
export function columnLabel(ref: PropertyRef, displayNames: Readonly<Record<string, string>>): string {
  const custom = displayNames[ref.id] ?? (ref.namespace === 'note' ? displayNames[ref.name] : undefined);
  if (custom) return custom;
  if (ref.namespace === 'file') return FILE_LABELS[ref.name] ?? ref.name;
  return ref.name;
}
