import { Link } from 'react-router';
import type { Backlink } from '../../../shared/api-types';

/** PO-44: høyre marg viser bare en kompakt lenke ned til tilbakelenkene (primærvisningen er nederst). */
export function RailBacklinks({ backlinks }: { readonly backlinks: readonly Backlink[] }) {
  if (backlinks.length === 0) return null;
  return (
    <section>
      <Link className="rail-jump" to={{ hash: '#tilbakelenker' }}>
        Tilbakelenker ({backlinks.length}) ↓
      </Link>
    </section>
  );
}
