import { Link } from 'react-router';
import type { TocNode } from './toc-tree';

interface TocListProps {
  readonly nodes: readonly TocNode[];
  readonly activeId: string | null;
  readonly sub?: boolean;
}

export function TocList({ nodes, activeId, sub = false }: TocListProps) {
  return (
    <ol className={sub ? 'sub' : undefined}>
      {nodes.map((node) => (
        <li key={node.entry.id}>
          <Link
            to={{ hash: `#${encodeURIComponent(node.entry.id)}` }}
            aria-current={activeId === node.entry.id ? 'true' : undefined}
          >
            {node.entry.text}
          </Link>
          {node.children.length > 0 ? <TocList nodes={node.children} activeId={activeId} sub /> : null}
        </li>
      ))}
    </ol>
  );
}
