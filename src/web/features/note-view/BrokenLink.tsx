import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import type { VaultId } from '../../../shared/api-types';
import { docUrl } from '../../shared/api';
import { nodeText } from '../../shared/ui/node-text';
import { useOpenSearch } from '../search';

interface BrokenLinkProps {
  readonly vaultId: VaultId;
  readonly raw?: string;
  /** PO-7: alias-treff → «Mente du X?». Kontraktforslag: `data-vr-suggest` + `data-vr-suggest-title`. */
  readonly suggest?: string;
  readonly suggestTitle?: string;
  readonly children?: ReactNode;
}

/**
 * Brutt lenke (AK9): tydelig, men ikke stygg. Navigerer ikke (QA #29); viser en liten forklaring
 * med evt. alias-forslag og «Søk etter …» ved klikk/Enter.
 */
export function BrokenLink({ vaultId, raw, suggest, suggestTitle, children }: BrokenLinkProps) {
  const [open, setOpen] = useState(false);
  const popId = useId();
  const wrapRef = useRef<HTMLSpanElement>(null);
  const openSearch = useOpenSearch();
  const name = (raw ?? nodeText(children)).split('|')[0]?.split('#')[0]?.trim() || nodeText(children);
  const hint = suggest ? ` Mente du «${suggestTitle ?? suggest}»?` : '';

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  return (
    <span className="broken-wrap" ref={wrapRef}>
      <button
        type="button"
        className="wikilink broken"
        aria-expanded={open}
        aria-controls={open ? popId : undefined}
        title={`Notatet «${name}» finnes ikke ennå.${hint}`}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && open) {
            event.stopPropagation();
            setOpen(false);
          }
        }}
      >
        {children}
      </button>
      {open ? (
        <span id={popId} className="broken-pop" role="note">
          <span>Notatet «{name}» finnes ikke ennå.</span>
          {suggest ? (
            <span>
              {' '}
              Mente du <Link to={docUrl(vaultId, suggest)}>{suggestTitle ?? suggest}</Link>?
            </span>
          ) : null}
          <button
            type="button"
            className="broken-search"
            onClick={() => {
              setOpen(false);
              openSearch(name);
            }}
          >
            Søk etter «{name}»
          </button>
        </span>
      ) : null}
    </span>
  );
}
