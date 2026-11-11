// Query-parametre for overlegg på notatets egen rute (ADR-010 §4: `?lysbilde=`). Endres bare disse, er det ingen
// navigasjon i lesevisningen: den skal verken rulle (AR-2-21) eller nullstille folding (Q-13).

export const OVERLAY_PARAMS: readonly string[] = ['lysbilde'];

export interface Place {
  readonly pathname: string;
  readonly search: string;
  readonly hash: string;
}

function withoutOverlays(search: string): string {
  const params = new URLSearchParams(search);
  for (const name of OVERLAY_PARAMS) params.delete(name);
  params.sort();
  return params.toString();
}

/**
 * Sann når to plasseringer bare skiller seg i overlegg-parametrene (samme sti, hash og øvrig query). Lik plassering
 * (f.eks. søketreff i notatet som er åpent) er en vanlig navigasjon, ikke et overlegg.
 */
export function onlyOverlayChanged(a: Place, b: Place): boolean {
  return a.pathname === b.pathname && a.hash === b.hash && a.search !== b.search && withoutOverlays(a.search) === withoutOverlays(b.search);
}
