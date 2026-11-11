// URL-tilstand (ADR-010 §4): `?lysbilde=<id>` på notatets egen URL. Parameteren finnes ⇔ presentasjonen vises.
// Tom verdi (`?lysbilde=`) = «start ved leseposisjonen» (settes av `present.start`, byttes ut med en ekte id
// med replace så snart kortstokken er bygget). Ren TS.

export const SLIDE_PARAM = 'lysbilde';

/** `null` = ingen presentasjon; `''` = start ved leseposisjonen; ellers lysbilde-id. */
export function slideParam(search: string): string | null {
  return new URLSearchParams(search).get(SLIDE_PARAM);
}

/** Ny `search` med lysbildet satt (`null` fjerner parameteren). Andre parametre beholdes. */
export function withSlideParam(search: string, id: string | null): string {
  const params = new URLSearchParams(search);
  if (id === null) params.delete(SLIDE_PARAM);
  else params.set(SLIDE_PARAM, id);
  const next = params.toString();
  return next ? `?${next}` : '';
}
