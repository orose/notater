import type { PropertyEntry, VaultId } from '../../../shared/api-types';
import { PropertyValue } from './PropertyValue';

/**
 * PO-22: `aliases` og `tags` har egne felt; `cssclasses`, `publish`, `position` skjules alltid.
 * `title`, `description`, `summary` vises ikke i rutenettet (tittel/ingress har egne plasser).
 */
export const ALWAYS_HIDDEN: readonly string[] = [
  'tags',
  'tag',
  'aliases',
  'alias',
  'cssclasses',
  'cssclass',
  'publish',
  'position',
  'title',
  'description',
  'summary',
];

interface PropertyListProps {
  readonly vaultId: VaultId;
  readonly properties: readonly PropertyEntry[];
  readonly aliases: readonly string[];
  /** Ekstra skjulte properties fra vault-konfig (`hiddenProperties`). */
  readonly hidden?: readonly string[];
  readonly onTagClick: (tag: string) => void;
}

export function PropertyList({ vaultId, properties, aliases, hidden = [], onTagClick }: PropertyListProps) {
  const hide = new Set([...ALWAYS_HIDDEN, ...hidden].map((k) => k.toLowerCase()));
  const visible = properties.filter((p) => !hide.has(p.key.toLowerCase()));
  if (visible.length === 0 && aliases.length === 0) return null;

  return (
    <dl className="props">
      {visible.map((p) => (
        <div key={p.key}>
          <dt className="label">{p.key}</dt>
          <dd className={p.value.type === 'null' ? 'empty' : undefined}>
            <PropertyValue vaultId={vaultId} name={p.key} value={p.value} onTagClick={onTagClick} />
          </dd>
        </div>
      ))}
      {aliases.length > 0 ? (
        <div>
          <dt className="label">Aliaser</dt>
          <dd>{aliases.join(', ')}</dd>
        </div>
      ) : null}
    </dl>
  );
}
