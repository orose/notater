// Posisjon ved live reload, reload og nivåbytte (ADR-010 §5). Ren TS.

import { formatSlideId, parseSlideId } from './slide-id';
import type { SlideAddress } from './slide-types';

export interface Locatable {
  readonly id: string;
  readonly address: SlideAddress;
}

export type ResolveReason = 'exact' | 'base' | 'address' | 'neighbour' | 'clamped' | 'empty';

export interface ResolvedSlide {
  /** Indeks i `next`, eller -1 når kortstokken er tom. */
  readonly index: number;
  readonly reason: ResolveReason;
}

function sameAddress(a: SlideAddress, b: SlideAddress): boolean {
  return a.kind === b.kind && a.agenda === b.agenda && a.slide === b.slide && a.part === b.part && a.continuation === b.continuation;
}

/**
 * Finner lysbildet `wanted` i den nye kortstokken, med reserver i fast rekkefølge:
 * 1. eksakt id;
 * 2. samme id med kortere suffiks (`x.del2.forts3` → `x.del2` → `x`): tilpasningen ga færre deler;
 * 3. samme strukturelle adresse i forrige kortstokk (overskriften ble omdøpt);
 * 4. nærmeste naboer fra forrige kortstokk som fortsatt finnes: først etterfølgerne, så forgjengerne;
 * 5. samme indeks, begrenset til kortstokken.
 */
export function resolveSlide(next: readonly Locatable[], wanted: string, previous: readonly Locatable[] = []): ResolvedSlide {
  if (next.length === 0) return { index: -1, reason: 'empty' };
  const byId = new Map(next.map((s, i) => [s.id, i]));

  const exact = byId.get(wanted);
  if (exact !== undefined) return { index: exact, reason: 'exact' };

  const { base, part } = parseSlideId(wanted);
  for (const candidate of [formatSlideId(base, part), formatSlideId(base)]) {
    const hit = byId.get(candidate);
    if (hit !== undefined && candidate !== wanted) return { index: hit, reason: 'base' };
  }

  const oldIndex = previous.findIndex((s) => s.id === wanted);
  const old = previous[oldIndex];
  if (old) {
    const byAddress = next.findIndex((s) => sameAddress(s.address, old.address));
    if (byAddress !== -1) return { index: byAddress, reason: 'address' };
    for (let i = oldIndex + 1; i < previous.length; i++) {
      const hit = byId.get((previous[i] as Locatable).id);
      if (hit !== undefined) return { index: hit, reason: 'neighbour' };
    }
    for (let i = oldIndex - 1; i >= 0; i--) {
      const hit = byId.get((previous[i] as Locatable).id);
      if (hit !== undefined) return { index: hit, reason: 'neighbour' };
    }
  }
  return { index: Math.max(0, Math.min(next.length - 1, oldIndex === -1 ? 0 : oldIndex)), reason: 'clamped' };
}
