import './bases.css';
import { useId, useRef, useState, type KeyboardEvent } from 'react';
import { Link } from 'react-router';
import type { BaseResult, BaseView, DocPath, VaultId } from '../../../shared/api-types';
import { baseName, docUrl } from '../../shared/api';
import { Icon } from '../../shared/ui/Icon';
import { BaseKanban } from './BaseKanban';
import { BaseTable } from './BaseTable';

interface BaseBlockProps {
  readonly vaultId: VaultId;
  readonly result: BaseResult | undefined;
  /** `.base`-fila ved embed; utelatt for ```base-blokker. */
  readonly sourcePath?: DocPath;
  /** PO-12: `![[X.base#View]]` viser kun navngitt view. */
  readonly viewName?: string;
}

function viewCount(view: BaseView): number | null {
  return view.type === 'unsupported' ? null : view.totalRows;
}

function ViewBody({ vaultId, view }: { readonly vaultId: VaultId; readonly view: BaseView }) {
  if (view.type === 'table') return <BaseTable vaultId={vaultId} view={view} />;
  if (view.type === 'kanban') return <BaseKanban vaultId={vaultId} view={view} />;
  return (
    <div className="mini-state">
      <strong>View-typen «{view.originalType}» støttes ikke.</strong>
      Bare tabell og kanban vises her. Åpne basen i Obsidian for denne visningen.
    </div>
  );
}

/** `vr-base` og `.base`-dokumenter (designsystem §7.9–7.10). */
export function BaseBlock({ vaultId, result, sourcePath, viewName }: BaseBlockProps) {
  const id = useId();
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const allViews = result?.views ?? [];
  const named = viewName ? allViews.filter((v) => v.name === viewName) : [];
  const views = named.length > 0 ? named : allViews;
  const [active, setActive] = useState(0);
  const current = views[Math.min(active, views.length - 1)];
  const title = sourcePath ? baseName(sourcePath).replace(/\.base$/i, '') : null;
  const warnings = [...(result?.warnings ?? []), ...(current?.warnings ?? [])];
  const count = current ? viewCount(current) : null;

  const select = (index: number) => {
    setActive(index);
    tabRefs.current[index]?.focus();
  };
  const onTabKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const n = views.length;
    if (event.key === 'ArrowRight') select((index + 1) % n);
    else if (event.key === 'ArrowLeft') select((index - 1 + n) % n);
    else if (event.key === 'Home') select(0);
    else if (event.key === 'End') select(n - 1);
    else return;
    event.preventDefault();
  };

  return (
    <section className="base" aria-label={title ? `Base: ${title}` : 'Base i notatet'}>
      <div className="base-head">
        {sourcePath ? (
          <Link className="src" to={docUrl(vaultId, sourcePath)}>
            <Icon name="base" />
            {baseName(sourcePath)}
          </Link>
        ) : (
          <span className="src">
            <Icon name="base" />
            Base i notatet
          </span>
        )}
        {count !== null ? <span className="total">{count === 1 ? '1 resultat' : `${count} resultater`}</span> : null}
      </div>
      {views.length > 1 ? (
        <div className="tabs" role="tablist" aria-label="Visninger">
          {views.map((view, i) => (
            <button
              key={`${view.name}-${i}`}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              type="button"
              role="tab"
              className="tab"
              id={`${id}-t${i}`}
              aria-controls={`${id}-p`}
              aria-selected={view === current}
              tabIndex={view === current ? 0 : -1}
              onClick={() => setActive(i)}
              onKeyDown={(event) => onTabKey(event, i)}
            >
              {view.name}
              {viewCount(view) !== null ? <span className="n">{viewCount(view)}</span> : null}
            </button>
          ))}
        </div>
      ) : null}
      <div
        className="tabpanel"
        id={`${id}-p`}
        role={views.length > 1 ? 'tabpanel' : undefined}
        aria-labelledby={views.length > 1 ? `${id}-t${views.indexOf(current as BaseView)}` : undefined}
      >
        {current ? (
          <ViewBody vaultId={vaultId} view={current} />
        ) : (
          <div className="mini-state">
            <strong>Basen kunne ikke vises.</strong>
            Definisjonen mangler eller kunne ikke leses.
          </div>
        )}
      </div>
      {warnings.map((w, i) => (
        <p key={i} className="base-warn" title={w.source}>
          <Icon name="warning" />
          {w.message}
        </p>
      ))}
    </section>
  );
}
