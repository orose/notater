import './backlinks.css';
import { useId, type ReactNode } from 'react';
import { Link } from 'react-router';
import type { Backlink, DocPath, VaultId } from '../../../shared/api-types';
import { baseName, docUrl, folderOf } from '../../shared/api';

interface BacklinksProps {
  readonly vaultId: VaultId;
  /** Tittelen på dette notatet – utheves i utdragene. */
  readonly title: string;
  /** Dokumentets sti; filnavnet (med endelse for ikke-notater, f.eks. `Oppgaver.base`) utheves også (PO-45). */
  readonly path?: DocPath;
  readonly backlinks: readonly Backlink[];
  readonly heading?: string;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Uthever lenketeksten i utdraget (serveren sender ikke treffposisjon). Lengste term først (PO-45). */
function highlight(snippet: string, terms: readonly string[]): ReactNode {
  const unique = [...new Set(terms.map((t) => t.trim()).filter(Boolean))].sort((a, b) => b.length - a.length);
  if (unique.length === 0) return snippet;
  const parts = snippet.split(new RegExp(`(${unique.map(escapeRegExp).join('|')})`, 'i'));
  return parts.map((part, i) => (i % 2 === 1 ? <mark key={i}>{part}</mark> : part));
}

/** Tilbakelenker etter notatet (designsystem §7.5, AK10). */
export function Backlinks({ vaultId, title, path, backlinks, heading = 'Tilbakelenker' }: BacklinksProps) {
  const headingId = useId();
  const terms = path ? [baseName(path), title] : [title];
  return (
    <section className="backlinks" id="tilbakelenker" aria-labelledby={headingId}>
      <div className="backlinks-head">
        <h2 id={headingId}>{heading}</h2>
        {backlinks.length > 0 ? (
          <span className="label">{backlinks.length === 1 ? '1 notat' : `${backlinks.length} notater`}</span>
        ) : null}
      </div>
      {backlinks.length === 0 ? (
        <p className="bl-empty">Ingen notater lenker hit ennå.</p>
      ) : (
        <ol>
          {backlinks.map((b) => (
            <li key={b.source}>
              <Link className="bl-title" to={docUrl(vaultId, b.source)}>
                {b.sourceTitle}
              </Link>
              <span className="bl-path">
                {folderOf(b.source) || '/'}
                {b.fromProperty ? <span className="bl-prop"> · fra egenskap</span> : null}
              </span>
              {b.snippet ? <p className="bl-ctx">{highlight(b.snippet, terms)}</p> : null}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
