import { Children, type ReactNode } from 'react';
import { Link } from 'react-router';
import type { VaultId } from '../../../shared/api-types';
import { docUrl } from '../../shared/api';

interface EmbedProps {
  readonly vaultId: VaultId;
  readonly 'data-status'?: string;
  readonly 'data-target'?: string;
  readonly 'data-anchor'?: string;
  readonly 'data-title'?: string;
  readonly 'data-raw'?: string;
  readonly children?: ReactNode;
}

function isEmpty(children: ReactNode): boolean {
  return Children.toArray(children).every((child) => typeof child === 'string' && child.trim() === '');
}

/** `vr-embed` (designsystem §7.6). Barna er ferdig rendret innhold fra målet. */
export function Embed(props: EmbedProps) {
  const status = props['data-status'] ?? 'missing';
  const target = props['data-target'];
  const anchor = props['data-anchor'];
  const title = props['data-title'] ?? target ?? props['data-raw'] ?? '';
  const link = target ? (
    <Link className="link wikilink" to={docUrl(props.vaultId, target, anchor)}>
      {title}
    </Link>
  ) : null;

  if (status === 'ok') {
    return (
      <section className="embed" aria-label={`Innebygd: ${title}`}>
        <header className="embed-head">
          <span className="label">Innebygd fra</span>
          {link}
          {target ? (
            <Link className="open" to={docUrl(props.vaultId, target)}>
              Åpne notat →
            </Link>
          ) : null}
        </header>
        <div className="embed-body">
          {isEmpty(props.children) ? <p className="embed-empty">Notatet er tomt.</p> : props.children}
        </div>
      </section>
    );
  }

  if (status === 'cycle') {
    return (
      <div className="mini-state embed-state">
        <strong>Innbygging stoppet: syklus</strong>
        {link ? <>Notatet {link} bygger inn seg selv. Det vises som lenke i stedet.</> : 'Notatet vises som lenke i stedet.'}
      </div>
    );
  }

  if (status === 'depth-limit') {
    return (
      <div className="mini-state embed-state">
        <strong>Innbygging stoppet: for mange nivåer</strong>
        {link ? <>Åpne {link} for å lese videre.</> : null}
      </div>
    );
  }

  return (
    <div className="mini-state embed-state">
      <strong>Fant ikke «{props['data-raw'] ?? title}»</strong>
      Notatet eller seksjonen finnes ikke i vaultet.
    </div>
  );
}
