import { Fragment } from 'react';
import type { BaseTableView, VaultId } from '../../../shared/api-types';
import { BaseCell } from './BaseCell';

export function BaseTable({ vaultId, view }: { readonly vaultId: VaultId; readonly view: BaseTableView }) {
  if (view.totalRows === 0) {
    return (
      <div className="mini-state">
        <strong>Ingen notater matcher denne visningen</strong>
        Filtrene i «{view.name}» gir 0 treff.
      </div>
    );
  }
  return (
    <div className="table-wrap" tabIndex={0} role="region" aria-label={`Tabell: ${view.name}`}>
      <table>
        <thead>
          <tr>
            {view.columns.map((c) => (
              <th key={c.id} scope="col" style={c.width ? { width: `${c.width}px` } : undefined}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {view.groups.map((group, gi) => (
            <Fragment key={gi}>
              {view.grouped ? (
                <tr className={group.key === null ? 'group-row none' : 'group-row'}>
                  <th colSpan={view.columns.length} scope="colgroup">
                    {group.label}
                    <span className="n">{group.rows.length}</span>
                  </th>
                </tr>
              ) : null}
              {group.rows.map((row) => (
                <tr key={row.path}>
                  {view.columns.map((c) => (
                    <td key={c.id}>
                      <BaseCell vaultId={vaultId} columnId={c.id} rowPath={row.path} value={row.cells[c.id]} />
                    </td>
                  ))}
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
