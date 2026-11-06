import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { Link } from 'react-router';
import type { BaseKanbanView, BaseRow, VaultId } from '../../../shared/api-types';
import { baseName, docUrl } from '../../shared/api';
import { BaseCell } from './BaseCell';

function cardTitle(row: BaseRow): string {
  const name = row.cells['file.name'];
  return name && name.type === 'string' ? name.value : baseName(row.path);
}

export type ScrollEdges = 'none' | 'start' | 'end' | 'both';

/** PO-43: hvilke kanter som har mer innhold (styrer fade-hintet). Ren funksjon. */
export function scrollEdges(scrollLeft: number, clientWidth: number, scrollWidth: number): ScrollEdges {
  const before = scrollLeft > 1;
  const after = scrollLeft + clientWidth < scrollWidth - 1;
  if (before && after) return 'both';
  if (before) return 'start';
  if (after) return 'end';
  return 'none';
}

function useScrollEdges() {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState<ScrollEdges>('none');
  const update = useCallback(() => {
    const el = ref.current;
    if (el) setEdges(scrollEdges(el.scrollLeft, el.clientWidth, el.scrollWidth));
  }, []);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [update]);
  return { ref, edges, update };
}

/** Kanban (designsystem §7.10). Read-only: ingen dra-og-slipp (B1). */
export function BaseKanban({ vaultId, view }: { readonly vaultId: VaultId; readonly view: BaseKanbanView }) {
  const fields = view.columns.filter((c) => c.id !== 'file.name');
  const { ref, edges, update } = useScrollEdges();
  // PO-43: kolonnene deler bredden likt; først når de ikke får plass (min-bredde i CSS) scroller kanbanen internt.
  const style = { '--lanes': String(view.groups.length) } as CSSProperties;
  return (
    <div
      ref={ref}
      className="kanban"
      data-edges={edges}
      style={style}
      tabIndex={0}
      role="region"
      aria-label={`Kanban: ${view.name}`}
      onScroll={update}
    >
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
