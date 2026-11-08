/**
 * Holder oversikt over pågående HTTP-forespørsler, slik at bakgrunnsarbeid (søkeindeks, Shiki-oppvarming,
 * forhåndsrendering) bare kjører når serveren er ledig. Bakgrunnsarbeid deles i små biter og venter på
 * `idle()` mellom hver bit; en forespørsel venter dermed på høyst én bit (AK17, BUG-008).
 */
export interface ActivityTracker {
  /** Markerer starten på en forespørsel; returnerer en (idempotent) avslutningsfunksjon. */
  begin(): () => void;
  /** Løses i en senere event-loop-runde når ingen forespørsler pågår. */
  idle(): Promise<void>;
  readonly busy: boolean;
}

export interface ActivityOptions {
  /**
   * Hvor lenge det må ha vært stille etter siste forespørsel før bakgrunnsarbeid slipper til (ms).
   * Mens brukeren navigerer (forespørsler med korte mellomrom) holdes bakgrunnsarbeidet unna.
   */
  readonly quietMs?: number;
}

export function createActivityTracker(options: ActivityOptions = {}): ActivityTracker {
  const quietMs = options.quietMs ?? 0;
  let inFlight = 0;
  let lastEnd = -Infinity;
  let waiters: Array<() => void> = [];
  let scheduled = false;

  const release = (): void => {
    if (scheduled) return;
    scheduled = true;
    const wait = Math.max(0, lastEnd + quietMs - performance.now());
    const fire = (): void => {
      scheduled = false;
      if (inFlight > 0 || waiters.length === 0) return;
      if (performance.now() < lastEnd + quietMs) {
        release();
        return;
      }
      const ready = waiters;
      waiters = [];
      for (const resolve of ready) resolve();
    };
    if (wait > 0) setTimeout(fire, wait);
    else setImmediate(fire);
  };

  return {
    begin() {
      inFlight++;
      let ended = false;
      return () => {
        if (ended) return;
        ended = true;
        inFlight--;
        lastEnd = performance.now();
        if (inFlight === 0) release();
      };
    },
    idle() {
      return new Promise<void>((resolve) => {
        waiters.push(resolve);
        if (inFlight === 0) release();
      });
    },
    get busy() {
      return inFlight > 0;
    },
  };
}

/** Uten sporing: bare gi fra seg event-loopen (tester og verktøy). */
export const yieldToEventLoop = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));
