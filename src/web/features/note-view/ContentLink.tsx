import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router';
import type { VaultId } from '../../../shared/api-types';
import { useOpenSearch } from '../search';
import { BrokenLink } from './BrokenLink';

type ContentLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  readonly vaultId: VaultId;
  readonly 'data-vr-link'?: string;
  readonly 'data-vr-target'?: string;
  readonly 'data-vr-anchor'?: string;
  readonly 'data-vr-raw'?: string;
  readonly 'data-vr-tag'?: string;
  readonly 'data-vr-suggest'?: string;
  readonly 'data-vr-suggest-title'?: string;
  readonly 'data-vr-ambiguous'?: string;
  readonly 'data-vr-alternatives'?: string;
  readonly 'data-vr-anchor-missing'?: string;
  readonly children?: ReactNode;
};

/** Navigasjonsstate: målseksjonen finnes ikke (README-QA regel 7). Leses av `useDocumentScroll`. */
export interface LinkNavigationState {
  readonly anchorMissing?: boolean;
}

function parseAlternatives(raw: string | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((p): p is string => typeof p === 'string') : [];
  } catch {
    return [];
  }
}

/** PO-8/PO-26: diskret forklaring på tvetydige lenker. */
function ambiguityTitle(count: string, target: string | undefined, alternatives: string[]): string {
  const others = alternatives.length > 0 ? ` (også: ${alternatives.join(', ')})` : '';
  return `Tvetydig lenke: ${count} notater passer. Viser «${target ?? ''}»${others}.`;
}

function cx(...names: Array<string | undefined | false>): string {
  return names.filter(Boolean).join(' ');
}

/** `a` i notatinnhold (api.md «Lenker – a»). */
export function ContentLink(props: ContentLinkProps) {
  const {
    vaultId,
    'data-vr-link': kind,
    'data-vr-target': target,
    'data-vr-anchor': anchor,
    'data-vr-raw': raw,
    'data-vr-tag': tag,
    'data-vr-suggest': suggest,
    'data-vr-suggest-title': suggestTitle,
    'data-vr-ambiguous': ambiguous,
    'data-vr-alternatives': alternatives,
    'data-vr-anchor-missing': anchorMissing,
    href,
    className,
    children,
    target: _ignoredTarget,
    rel: _ignoredRel,
    ...rest
  } = props;
  void _ignoredTarget;
  void _ignoredRel;
  const openSearch = useOpenSearch();

  if (kind === 'unresolved') {
    return (
      <BrokenLink vaultId={vaultId} raw={raw} suggest={suggest} suggestTitle={suggestTitle}>
        {children}
      </BrokenLink>
    );
  }

  if (kind === 'tag') {
    return (
      <button type="button" className="tag inline-tag" onClick={() => openSearch(`#${tag ?? ''}`)}>
        {children}
      </button>
    );
  }

  if (kind === 'internal' && href) {
    const missing = anchorMissing === 'true';
    const title = ambiguous
      ? ambiguityTitle(ambiguous, target, parseAlternatives(alternatives))
      : missing
        ? 'Fant ikke seksjonen i notatet – lenken går til toppen.'
        : undefined;
    const state: LinkNavigationState | undefined = missing ? { anchorMissing: true } : undefined;
    return (
      <Link
        {...rest}
        to={href}
        state={state}
        title={title}
        className={cx('wikilink', ambiguous && 'ambiguous', missing && 'anchor-missing', className)}
        data-target={target}
        data-anchor={anchor}
      >
        {children}
      </Link>
    );
  }

  if (kind === 'external' || (href && /^(https?:|mailto:)/i.test(href))) {
    return (
      <a {...rest} href={href} className={cx('external', className)} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    );
  }

  if (href?.startsWith('#')) {
    return (
      <Link {...rest} to={{ hash: href }} className={className}>
        {children}
      </Link>
    );
  }

  return (
    <a {...rest} href={href} className={className}>
      {children}
    </a>
  );
}
