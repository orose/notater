import type { BaseWarning } from '../../../../shared/api-types';

/** Samler advarsler uten duplikater (én per unikt uttrykk/nøkkel, ikke per rad – ADR-003). */
export interface WarningSink {
  add(warning: BaseWarning): void;
  list(): BaseWarning[];
}

export function createWarningSink(initial: readonly BaseWarning[] = []): WarningSink {
  const seen = new Map<string, BaseWarning>();
  const sink: WarningSink = {
    add(warning) {
      const key = `${warning.code}\u0000${warning.source ?? ''}\u0000${warning.message}`;
      if (!seen.has(key)) seen.set(key, warning);
    },
    list: () => [...seen.values()],
  };
  for (const w of initial) sink.add(w);
  return sink;
}
