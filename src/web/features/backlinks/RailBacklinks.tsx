import { Link } from 'react-router';
import type { Backlink } from '../../../shared/api-types';

/** Kompakt liste i høyre marg; hopper til full seksjon nederst. */
export function RailBacklinks({ backlinks }: { readonly backlinks: readonly Backlink[] }) {
  if (backlinks.length === 0) return null;
  return (
    <section>
      <span className="label">Tilbakelenker</span>
      <ul className="rail-links">
        {backlinks.map((b) => (
          <li key={b.source}>
            <Link to={{ hash: '#tilbakelenker' }}>{b.sourceTitle}</Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
