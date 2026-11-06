import { Link, useNavigate } from 'react-router';
import type { DocPath, VaultId } from '../../../shared/api-types';
import { baseName, docUrl, useBacklinks } from '../../shared/api';
import { Icon } from '../../shared/ui/Icon';
import { Backlinks } from '../backlinks';
import { useOpenSearch } from '../search';

interface MissingNotePageProps {
  readonly vaultId: VaultId;
  readonly docPath: DocPath;
}

/** «Ukjent notat» (designsystem §7.13, QA-URL-07). */
export function MissingNotePage({ vaultId, docPath }: MissingNotePageProps) {
  const navigate = useNavigate();
  const openSearch = useOpenSearch();
  const name = baseName(docPath).replace(/\.md$/i, '');
  const file = /\.[a-z0-9]+$/i.test(docPath) ? docPath : `${docPath}.md`;
  const canGoBack = typeof window !== 'undefined' && (window.history.state?.idx ?? 0) > 0;
  const linked = useBacklinks(vaultId, docPath);
  const backlinks = linked.data?.backlinks ?? [];

  return (
    <>
      <div className="state missing-note">
        <span className="glyph" aria-hidden="true">
          ∅
        </span>
        <span className="label">{file}</span>
        <h1 className="state-title">Dette notatet er ikke skrevet ennå</h1>
        <p>
          Filen <em>{name}</em> finnes ikke i vaultet. Når du oppretter den i Obsidian, dukker den opp her automatisk.
        </p>
        <div className="actions">
          {canGoBack ? (
            <button type="button" className="btn primary" onClick={() => navigate(-1)}>
              ← Tilbake
            </button>
          ) : (
            <Link className="btn primary" to={docUrl(vaultId, '')}>
              ← Til forsiden
            </Link>
          )}
          <button type="button" className="btn" onClick={() => openSearch(name)}>
            <Icon name="search" />
            Søk etter «{name}»
          </button>
        </div>
      </div>
      {/* PO-28: hvem som lenker hit, slik at notatet kan skrives med kontekst. */}
      {backlinks.length > 0 ? <Backlinks vaultId={vaultId} title={name} backlinks={backlinks} heading="Lenket fra" /> : null}
    </>
  );
}
