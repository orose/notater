// Rutenettet (designsystem-terminal §1.1–1.2): marg, sats (maks 160, sentrert), målbredde 72, luft og rader.

export interface Grid {
  readonly cols: number;
  readonly rows: number;
  /** Satsens venstrekant. */
  readonly x: number;
  readonly sats: number;
  readonly maal: number;
  /** Ekstra luft: 0 / 1 / 2 ved 24 / 36 / 50 rader. */
  readonly luft: number;
  /** Første innholdsrad (under agendalinjen). */
  readonly top: number;
  /** Siste rad innhold kan bruke. */
  readonly bottom: number;
  readonly status: number;
}

export const SATS_MAX = 160;
export const MAAL = 72;

export function gridFor(cols: number, rows: number): Grid {
  let margin = Math.max(4, Math.round(cols * 0.067));
  let sats = cols - 2 * margin;
  if (sats > SATS_MAX) {
    sats = SATS_MAX;
    margin = Math.floor((cols - sats) / 2);
  }
  const luft = Math.max(0, Math.floor((rows - 24) / 12));
  return {
    cols,
    rows,
    x: margin,
    sats,
    maal: Math.min(sats, MAAL),
    luft,
    top: 2 + luft,
    bottom: rows - 3 - Math.max(0, Math.floor((rows - 24) / 24)),
    status: rows - 1,
  };
}
