// Agendalinjen = kolumnetittelen (designsystem §12.5, AK-2-06). Felles krom utenfor lysbildene, byttes uten toning.
// Avkortes `full → kort → min` når den ikke får plass. Lerretet er logisk (1920 lp), så valget avhenger bare av teksten.

import { useLayoutEffect, useRef, useState } from 'react';
import type { AgendaItem, SlideProgress } from './model';

export type AgendaLineMode = 'full' | 'kort' | 'min';

/** Punktene som vises i en modus, og om det er skjulte punkter før/etter (ren funksjon). */
export function agendaWindow(count: number, current: number | null, mode: AgendaLineMode): { readonly from: number; readonly to: number } {
  if (mode === 'full' || count === 0) return { from: 0, to: count - 1 };
  const c = current ?? 0;
  const span = mode === 'kort' ? 1 : 0;
  return { from: Math.max(0, c - span), to: Math.min(count - 1, c + span) };
}

const NEXT: Record<AgendaLineMode, AgendaLineMode | null> = { full: 'kort', kort: 'min', min: null };

interface Props {
  readonly agenda: readonly AgendaItem[];
  readonly current: number | null;
  readonly progress: SlideProgress | null;
}

export function AgendaLine({ agenda, current, progress }: Props) {
  const ref = useRef<HTMLOListElement>(null);
  const key = `${agenda.map((a) => a.text).join('\n')}|${current}|${progress?.count ?? ''}`;
  const [state, setState] = useState<{ key: string; mode: AgendaLineMode }>({ key, mode: 'full' });
  const mode = state.key === key ? state.mode : 'full';
  if (state.key !== key) setState({ key, mode: 'full' });

  useLayoutEffect(() => {
    const ol = ref.current;
    if (!ol) return;
    const next = NEXT[mode];
    if (next && ol.scrollWidth > ol.clientWidth + 1) setState({ key, mode: next });
  }, [key, mode]);

  const { from, to } = agendaWindow(agenda.length, current, mode);
  return (
    <header className="runhead" aria-label="Agenda">
      <ol className="runhead-list" data-testid="agendalinje" aria-label="Agenda" data-mode={mode} ref={ref}>
        {from > 0 ? (
          <li className="ell" aria-hidden="true" data-testid="agenda-ellipse" data-side="før">
            …
          </li>
        ) : null}
        {agenda.slice(from, to + 1).map((item) => {
          const isCurrent = item.index === current;
          return (
            <li key={item.key} className={isCurrent ? 'cur' : undefined} aria-current={isCurrent ? 'step' : undefined} data-n={String(item.index + 1)}>
              <span className="t">{item.text}</span>
              {isCurrent && progress ? ' ' : null}
              {isCurrent && progress ? (
                <span className="pos" data-testid="agenda-progresjon" aria-label={`lysbilde ${progress.index} av ${progress.count} i punktet`}>
                  {`${progress.index}/${progress.count}`}
                </span>
              ) : null}
            </li>
          );
        })}
        {to < agenda.length - 1 ? (
          <li className="ell" aria-hidden="true" data-testid="agenda-ellipse" data-side="etter">
            …
          </li>
        ) : null}
      </ol>
    </header>
  );
}
