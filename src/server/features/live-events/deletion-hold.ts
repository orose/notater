import { appendFileSync } from 'node:fs';
/** Klassifisering av én bunt vault-relative disk-stier (gjøres mot disk og gjeldende snapshot). */
export interface BatchClassification {
  /** Stier som ikke lenger finnes på disk (slettede filer eller mapper). */
  readonly deleted: readonly string[];
  /** Stier som finnes på disk (nye eller endrede filer). */
  readonly present: readonly string[];
  /**
   * Tilbakeholdte eller nye slettinger (fra `held` eller `deleted`) som er samme fil som en ny fil i
   * bunten (inode + størrelse eller innholdshash). Disse sendes sammen med bunten, så de pares.
   */
  readonly release: readonly string[];
}

export interface DeletionHoldOptions {
  /** Hvor lenge en sletting holdes tilbake (PO-78: 300 ms). 0 = av. */
  readonly windowMs: number;
  /** `held` = slettinger som allerede holdes tilbake (før denne bunten). */
  readonly classify: (paths: readonly string[], held: readonly string[]) => Promise<BatchClassification>;
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
 * `renamed` ikke pares (PO-49). Slettinger holdes derfor tilbake i et kort vindu. Kommer det en ny fil som
 * er samme fil (inode + størrelse eller innholdshash), sendes slettingen sammen med den, slik at paringen
 * skjer i samme oppdatering. Andre nye filer slipper den ikke løs. Umatchede slettinger sendes alene når
 * vinduet går ut (vinduet starter på nytt for hver bunt med nye slettinger).
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
        const { deleted, present, release: matched } = await options.classify(paths, [...held]);
        appendFileSync('/tmp/claude-0/-home-user-notater/42d2d3a4-f504-5d51-84b3-820da0930dd8/scratchpad/batches.log', `${process.pid} ${Date.now()} ${JSON.stringify({ deleted, present, matched, held: [...held] })}\n`);
        if (closed) return;
        // En sti som finnes igjen (f.eks. atomisk lagring) er ikke lenger slettet.
        for (const path of present) held.delete(path);
        for (const path of deleted) held.add(path);
        if (options.windowMs <= 0) {
          const batch = [...takeHeld(), ...present];
          if (batch.length > 0) options.apply(batch);
          return;
        }
        const released = matched.filter((path) => held.delete(path));
        // Slettingene først: de skjedde før de nye filene (rekkefølgen betyr noe for slettede mapper).
        const batch = [...released, ...present];
        if (batch.length > 0) options.apply(batch);
        if (deleted.length > 0) {
          stopTimer();
          timer = setTimeout(release, options.windowMs);
        }
        if (held.size === 0) stopTimer();
      });
    },
    close() {
      closed = true;
      held.clear();
      stopTimer();
    },
  };
}
