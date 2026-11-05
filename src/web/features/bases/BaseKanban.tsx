import { Link } from 'react-router';
import type { BaseKanbanView, BaseRow, VaultId } from '../../../shared/api-types';
import { baseName, docUrl } from '../../shared/api';
import { BaseCell } from './BaseCell';

function cardTitle(row: BaseRow): string {
  const name = row.cells['file.name'];
  return name && name.type === 'string' ? name.value : baseName(row.path);
}

/** Kanban (designsystem §7.10). Read-only: ingen dra-og-slipp (B1). */
export function BaseKanban({ vaultId, view }: { readonly vaultId: VaultId; readonly view: BaseKanbanView }) {
  const fields = view.columns.filter((c) => c.id !== 'file.name');
  return (
    <div className="kanban" tabIndex={0} role="region" aria-label={`Kanban: ${view.name}`}>
      {view.groups.map((group, gi) => (
        <section key={gi} className={group.key === null ? 'lane none' : 'lane'} aria-label={`${group.label}: ${group.rows.length}`}>
          <header className="lane-head">
            <span className="label">{group.label}</span>
            <span className="n">{group.rows.length}</span>
          </header>
          {group.rows.map((row) => (
            <Link key={row.path} className="card" to={docUrl(vaultId, row.path)}>
              <span className="t">{cardTitle(row)}</span>
              {fields.map((f) => {
                const value = row.cells[f.id];
                if (!value || value.type === 'null') return null;
                const isTags = value.type === 'list' && value.value.every((v) => v.type === 'tag');
                return isTags ? (
                  <span key={f.id} className="card-tags">
                    <BaseCell vaultId={vaultId} columnId={f.id} rowPath={row.path} value={value} />
                  </span>
                ) : (
                  <span key={f.id} className="card-field">
                    <span className="k">{f.label}</span>{' '}
                    {value.type === 'link' ? (
                      value.display // ingen nestede lenker inne i kortet
                    ) : (
                      <BaseCell vaultId={vaultId} columnId={f.id} rowPath={row.path} value={value} />
                    )}
                  </span>
                );
              })}
            </Link>
          ))}
        </section>
      ))}
    </div>
  );
}
