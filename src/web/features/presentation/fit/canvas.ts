// Lerretets mål i web (ADR-011 §1: blir igjen i web – det er lerretet, ikke algoritmen).

/**
 * Logisk lerret i CSS-piksler (A1). Visningen er alltid 1920 logiske piksler bred og skaleres med
 * `transform: scale(k)`, k = min(bredde/1920, høyde/1080), så layout og måling er uavhengige av vindusstørrelsen.
 * UX' `--lp` (`100cqw / 1920`) blir dermed nøyaktig 1px i både lerret og målelerret.
 */
export const CANVAS = { width: 1920, height: 1080 } as const;
