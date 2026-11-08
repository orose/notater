import './toc.css';
import type { CSSProperties } from 'react';
import type { TocEntry } from '../../../shared/api-types';
import { TocList } from './TocList';
import { tocTree, visibleToc } from './toc-tree';
import { useScrollSpy } from './use-scroll-spy';

/** TOC i høyre marg med scroll-spy og lesefremdrift (AK16). */
export function Toc({ entries }: { readonly entries: readonly TocEntry[] }) {
  const visible = visibleToc(entries);
  const { activeId, progress } = useScrollSpy(visible.map((e) => e.id));
  if (visible.length === 0) return null;
  return (
    <section className="rail-toc">
      <span className="label">Innhold</span>
      <div className="progress" aria-hidden="true">
        <i style={{ '--p': `${(progress * 100).toFixed(1)}%` } as CSSProperties} />
      </div>
      <nav className="toc" aria-label="Innhold">
        <TocList nodes={tocTree(visible)} activeId={activeId} />
      </nav>
    </section>
  );
}
