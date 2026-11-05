import type { TocEntry } from '../../../shared/api-types';
import { Icon } from '../../shared/ui/Icon';
import { TocList } from './TocList';
import { tocTree, visibleToc } from './toc-tree';

/** Sammenleggbar «Innhold» øverst i notatet når høyre marg er skjult (< 1100 px). */
export function InlineToc({ entries }: { readonly entries: readonly TocEntry[] }) {
  const visible = visibleToc(entries);
  if (visible.length === 0) return null;
  return (
    <details className="toc-inline">
      <summary>
        <span className="label">Innhold</span>
        <Icon name="chev" className="chev" />
      </summary>
      <nav className="toc" aria-label="Innhold (kompakt)">
        <TocList nodes={tocTree(visible)} activeId={null} />
      </nav>
    </details>
  );
}
