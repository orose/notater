/** Klassifisering av én bunt vault-relative disk-stier (gjøres mot disk og gjeldende snapshot). */
export interface BatchClassification {
  /** Stier som ikke lenger finnes på disk (slettede filer eller mapper). */
  readonly deleted: readonly string[];
  /** Stier som finnes på disk (nye eller endrede filer). */
  readonly present: readonly string[];
  /** Minst én av `present` er en ny fil (ikke i snapshotet) – en mulig ny plass for en omdøpt fil. */
  readonly hasNew: boolean;
}

export interface DeletionHoldOptions {
  /** Hvor lenge en sletting holdes tilbake (PO-78: 300 ms). 0 = av. */
  readonly windowMs: number;
  readonly classify: (paths: readonly string[]) => Promise<BatchClassification>;
  /** Sender stier videre til indeksoppdateringen (kalles i samme rekkefølge som buntene kom). */
  readonly apply: (paths: readonly string[]) => void;
  readonly log?: (message: string) => void;
}

export interface DeletionHold {
  push(paths: readonly string[]): void;
  /** Stopper vinduet; tilbakeholdte slettinger forkastes. */
  close(): void;
}

/**
 * PO-78: en omdøping/flytting kan deles over to debounce-bunter (unlink i én, add i neste), og da kan
 * `renamed` ikke pares (PO-49). Slettinger holdes derfor tilbake i et kort vindu. Kommer det en bunt med
 * en ny fil innen vinduet, sendes slettingene sammen med den, slik at paringen (inode + størrelse eller
 * innholdshash) skjer i samme oppdatering. Ellers sendes de alene når vinduet går ut.
 * Endrede og nye filer sendes alltid straks; bare slettinger forsinkes.
 */
export function createDeletionHold(options: DeletionHoldOptions): DeletionHold {
  const held = new Set<string>();
  let timer: NodeJS.Timeout | null = null;
  let closed = false;
  // Buntene klassifiseres asynkront; kjeden bevarer rekkefølgen.
  let chain: Promise<void> = Promise.resolve();

  const stopTimer = (): void => {
    if (timer) clearTimeout(timer);
    timer = null;
  };
  const takeHeld = (): string[] => {
    const paths = [...held];
    held.clear();
    stopTimer();
    return paths;
  };
  const schedule = (task: () => Promise<void> | void): void => {
    chain = chain.then(task).catch((error: unknown) => {
      options.log?.(`Live reload: kunne ikke behandle endringer: ${error instanceof Error ? error.message : String(error)}`);
    });
  };
  const release = (): void =>
    schedule(() => {
      timer = null;
      if (closed || held.size === 0) return;
      options.apply(takeHeld());
    });

  return {
    push(paths) {
      schedule(async () => {
        if (closed) return;
        const { deleted, present, hasNew } = await options.classify(paths);
        if (closed) return;
        // En sti som finnes igjen (f.eks. atomisk lagring) er ikke lenger slettet.
        for (const path of present) held.delete(path);
        for (const path of deleted) held.add(path);
        if (options.windowMs <= 0 || (hasNew && held.size > 0)) {
          // Slettingene først: de skjedde før de nye filene (rekkefølgen betyr noe for slettede mapper).
          const batch = [...takeHeld(), ...present];
          if (batch.length > 0) options.apply(batch);
          return;
        }
        if (present.length > 0) options.apply(present);
        if (deleted.length > 0) {
          stopTimer();
          timer = setTimeout(release, options.windowMs);
        } else if (held.size === 0) stopTimer();
      });
    },
    close() {
      closed = true;
      held.clear();
      stopTimer();
    },
  };
}
