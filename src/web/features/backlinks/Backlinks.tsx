import './backlinks.css';
import { useId, type ReactNode } from 'react';
import { Link } from 'react-router';
import type { Backlink, VaultId } from '../../../shared/api-types';
import { docUrl, folderOf } from '../../shared/api';

interface BacklinksProps {
  readonly vaultId: VaultId;
  /** Tittelen på dette notatet – utheves i utdragene. */
  readonly title: string;
  readonly backlinks: readonly Backlink[];
  readonly heading?: string;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Uthever notattittelen i utdraget (serveren sender ikke treffposisjon). */
function highlight(snippet: string, title: string): ReactNode {
  if (!title.trim()) return snippet;
  const parts = snippet.split(new RegExp(`(${escapeRegExp(title)})`, 'i'));
  return parts.map((part, i) => (i % 2 === 1 ? <mark key={i}>{part}</mark> : part));
}

/** Tilbakelenker etter notatet (designsystem §7.5, AK10). */
export function Backlinks({ vaultId, title, backlinks, heading = 'Tilbakelenker' }: BacklinksProps) {
  const headingId = useId();
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
              <span className="bl-path">{folderOf(b.source) || '/'}</span>
              {b.snippet ? <p className="bl-ctx">{highlight(b.snippet, title)}</p> : null}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
