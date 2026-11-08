import type { FocusEvent, MouseEvent } from 'react';
import { Link, type LinkProps } from 'react-router';
import type { DocPath, VaultId } from '../../../shared/api-types';
import { usePrefetchIntent } from '../api';

type PrefetchLinkProps = LinkProps & {
  readonly vaultId: VaultId;
  /** Dokumentet lenken går til; utelatt = ingen prefetch. */
  readonly docPath: DocPath | undefined;
};

/** Intern lenke som henter målet i forkant ved hover/fokus (PO-51). */
export function PrefetchLink({ vaultId, docPath, onMouseEnter, onMouseLeave, onFocus, ...rest }: PrefetchLinkProps) {
  const intent = usePrefetchIntent(vaultId, docPath);
  return (
    <Link
      {...rest}
      onMouseEnter={(event: MouseEvent<HTMLAnchorElement>) => {
        intent.onMouseEnter();
        onMouseEnter?.(event);
      }}
      onMouseLeave={(event: MouseEvent<HTMLAnchorElement>) => {
        intent.onMouseLeave();
        onMouseLeave?.(event);
      }}
      onFocus={(event: FocusEvent<HTMLAnchorElement>) => {
        intent.onFocus();
        onFocus?.(event);
      }}
    />
  );
}
