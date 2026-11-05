import { Link } from 'react-router';
import type { VaultId } from '../../../shared/api-types';
import { docUrl } from '../../shared/api';
import type { OutgoingLink } from './outgoing-links';

export function OutgoingLinks({ vaultId, links }: { readonly vaultId: VaultId; readonly links: readonly OutgoingLink[] }) {
  if (links.length === 0) return null;
  return (
    <section>
      <span className="label">Lenker herfra</span>
      <ul className="rail-links">
        {links.map((link) =>
          link.target ? (
            <li key={link.target}>
              <Link to={docUrl(vaultId, link.target)}>{link.title}</Link>
              <small>
                {link.count === 1 ? '1 gang' : `${link.count} ganger`}
                {link.embed ? ' · embed' : ''}
              </small>
            </li>
          ) : (
            <li key={`u:${link.title}`} className="broken">
              <span className="broken-link" title={`Notatet «${link.title}» finnes ikke ennå`}>
                {link.title}
              </span>
              <small>finnes ikke</small>
            </li>
          ),
        )}
      </ul>
    </section>
  );
}
