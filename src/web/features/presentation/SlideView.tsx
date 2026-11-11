// Ett lysbilde (L1–L4, designsystem §12.4). Samme komponent i visning, målelerret (ADR-010 §2) og oversikt, så
// målt og vist layout er identisk per konstruksjon. Bare visningen bærer QAs testid-er (testplanen §6).

import type { Element, ElementContent, RootContent } from 'hast';
import { createContext, memo, useContext, useMemo, type CSSProperties, type ReactNode } from 'react';
import type { BaseResult, NoteDocument, PropertyEntry } from '../../../shared/api-types';
import { folderOf } from '../../shared/api';
import { HastBlock, useContentComponents, type ComponentOverrides } from '../note-view';
import { ALWAYS_HIDDEN, PropertyValue, formatDate, formatDateTime, ingressOf } from '../properties';
import { CONTINUED_SUFFIX, type AgendaItem, type Slide, type SlideUnit } from './model';

/** `view` = det publikum ser; `measure` = målelerret (A2); `thumb` = miniatyr i oversikten. */
export type SlideMode = 'view' | 'measure' | 'thumb';

/** Det alle lysbildene i en kortstokk deler. */
export interface DeckInfo {
  readonly vaultId: string;
  readonly doc: NoteDocument;
  readonly bases: Readonly<Record<string, BaseResult>>;
  readonly title: string;
  readonly agenda: readonly AgendaItem[];
  /** Delpunktene per agendapunkt (L3). */
  readonly subtitles: readonly (readonly string[])[];
  /** Lysbildenummeret der hvert agendapunkt starter (L2). */
  readonly startNumbers: readonly number[];
  readonly total: number;
}

const KIND_LABEL: Record<Slide['kind'], string> = { title: 'tittel', agenda: 'agenda', transition: 'overgang', content: 'innhold' };

const ModeContext = createContext<SlideMode>('view');

// ------------------------------------------------------------------------------------------ HAST-overstyringer

type Props = Record<string, unknown> & { readonly children?: ReactNode };

/** Overskrifter inne i et lysbilde: under lysbildetittelen (h2), uten anker og fold-pil (ADR-010 §6). */
function SubHeading({ children }: Props) {
  return <h3 className="slide-sub">{children}</h3>;
}

/** Mermaid i målelerret og miniatyrer: fast plassholder (AR-2-10). */
function FigurePlaceholder() {
  return <div className="slide-figure-placeholder" aria-hidden="true" />;
}

function useOverrides(mode: SlideMode): ComponentOverrides {
  return useMemo<ComponentOverrides>(
    () => (defaults) => {
      const link = defaults.a as unknown as (p: Props) => ReactNode;
      const out: Record<string, (p: Props) => ReactNode> = {
        h1: SubHeading,
        h2: SubHeading,
        h3: SubHeading,
        h4: SubHeading,
        h5: SubHeading,
        h6: SubHeading,
        // A4: notene vises nederst på lysbildet; referansen uten lenke (målet finnes ikke i lysbildet).
        'vr-sidenote': () => null,
        a: (p) => (p['data-footnote-ref'] !== undefined ? <span className="fn-n">{p.children}</span> : link(p)),
      };
      if (mode !== 'view') out['vr-mermaid'] = FigurePlaceholder;
      return out as unknown as ReturnType<ComponentOverrides>;
    },
    [mode],
  );
}

function withUnitAttr(node: RootContent | ElementContent, index: number): RootContent {
  if (node.type !== 'element') return node as RootContent;
  return { ...node, properties: { ...node.properties, dataUnit: String(index) } } as Element;
}

interface UnitGroup {
  readonly key: string;
  readonly list: SlideUnit['list'] | null;
  readonly items: ReadonlyArray<{ readonly unit: SlideUnit; readonly index: number }>;
}

function groupUnits(units: readonly SlideUnit[]): UnitGroup[] {
  const groups: UnitGroup[] = [];
  units.forEach((unit, index) => {
    const last = groups[groups.length - 1];
    if (unit.listKey !== null && last && last.list && last.key === unit.listKey) {
      (last.items as Array<{ unit: SlideUnit; index: number }>).push({ unit, index });
      return;
    }
    groups.push({ key: unit.listKey ?? `u${index}`, list: unit.listKey !== null ? (unit.list ?? null) : null, items: [{ unit, index }] });
  });
  return groups;
}

/** Enhetene: én `div.slide-unit[data-unit]` per blokk; listepunkter i felles liste med `data-unit` på `li`. */
export const SlideUnits = memo(function SlideUnits({ units, scrollUnits, deck }: { readonly units: readonly SlideUnit[]; readonly scrollUnits: readonly number[]; readonly deck: DeckInfo }) {
  const mode = useContext(ModeContext);
  const components = useContentComponents(deck.vaultId, deck.bases, useOverrides(mode));
  const groups = useMemo(() => groupUnits(units), [units]);
  const nodes = useMemo(() => units.map((u, i) => withUnitAttr(u.node, i)), [units]);
  return (
    <>
      {groups.map((g) => {
        if (g.list) {
          const Tag = g.list.tagName === 'ol' ? 'ol' : 'ul';
          const first = g.items[0]?.unit.list?.index ?? 0;
          const baseStart = typeof g.list.properties.start === 'number' ? g.list.properties.start : 1;
          const className = Array.isArray(g.list.properties.className) ? g.list.properties.className.join(' ') : undefined;
          return (
            <Tag key={g.key + first} className={className} start={Tag === 'ol' && first > 0 ? baseStart + first : undefined}>
              {g.items.map(({ index }) => (
                <HastBlock key={index} node={nodes[index] as RootContent} components={components} />
              ))}
            </Tag>
          );
        }
        const { unit, index } = g.items[0] as { unit: SlideUnit; index: number };
        const scroller = scrollUnits.includes(index);
        return (
          <div key={g.key} className={scroller ? 'slide-unit is-scroller' : 'slide-unit'} data-unit={index} data-overflow={unit.overflow}>
            <HastBlock node={unit.node as RootContent} components={components} />
          </div>
        );
      })}
    </>
  );
});

// ------------------------------------------------------------------------------------------ lysbildene

function slideAttrs(slide: Slide, mode: SlideMode, active: boolean) {
  const view = mode === 'view';
  return {
    'data-kind': KIND_LABEL[slide.kind],
    'data-slide-id': slide.id,
    ...(view
      ? {
          'data-testid': 'lysbilde',
          'data-slide-type': KIND_LABEL[slide.kind],
          'data-slide-index': String(slide.number),
          role: 'group',
          'aria-roledescription': 'lysbilde',
          'aria-label': slide.label,
          hidden: !active,
          inert: !active,
        }
      : { 'aria-hidden': true }),
  };
}

function Footnotes({ slide, deck }: { readonly slide: Slide; readonly deck: DeckInfo }) {
  if (slide.footnotes.length === 0) return null;
  return (
    <ol className="slide-notes" aria-label="Fotnoter">
      {slide.footnotes.map((f) => (
        <li key={f.number}>
          <span className="n" aria-hidden="true">
            {f.number}
          </span>
          <span>
            <SlideUnits units={[{ node: { type: 'element', tagName: 'span', properties: {}, children: [...f.content] }, overflow: 'flow', listKey: null }]} scrollUnits={[]} deck={deck} />
          </span>
        </li>
      ))}
    </ol>
  );
}

function ContentSlide({ slide, deck, mode, active }: SlideProps) {
  const view = mode === 'view';
  const heading = slide.heading;
  const continued = heading !== null && heading.endsWith(CONTINUED_SUFFIX);
  const base = heading === null ? null : continued ? heading.slice(0, -CONTINUED_SUFFIX.length) : heading;
  const agendaNo = slide.agendaIndex !== null ? slide.agendaIndex + 1 : null;
  const headless = heading === null && (slide.address.part > 1 || slide.address.continuation > 1);
  return (
    <section className={heading === null ? 'slide slide-content is-headless' : 'slide slide-content'} {...slideAttrs(slide, mode, active)} style={{ '--slide-fit': String(slide.scale) } as CSSProperties}>
      {headless ? <p className="kicker-forts">{`${deck.title}${CONTINUED_SUFFIX}`}</p> : null}
      {base !== null ? (
        <h2
          className="slide-title"
          data-testid={view ? 'lysbilde-overskrift' : undefined}
          data-sec={agendaNo !== null ? `§ ${agendaNo}` : undefined}
          data-sec-pad={agendaNo !== null ? `${String(agendaNo).padStart(2, '0')} /` : undefined}
        >
          {base}
          {continued || mode === 'measure' ? <span className={continued ? 'forts' : 'forts forts-measure'}>{CONTINUED_SUFFIX}</span> : null}
        </h2>
      ) : null}
      <div className="slide-body" data-fit-box="" data-testid={view ? 'lysbilde-innhold' : undefined}>
        <SlideUnits units={slide.units} scrollUnits={slide.scrollUnits} deck={deck} />
      </div>
      <Footnotes slide={slide} deck={deck} />
    </section>
  );
}

function AgendaSlide({ slide, deck, mode, active }: SlideProps) {
  const view = mode === 'view';
  const current = slide.kind === 'transition' ? slide.agendaIndex : null;
  return (
    <section className="slide slide-agenda" {...slideAttrs(slide, mode, active)} style={{ '--slide-fit': String(slide.scale) } as CSSProperties}>
      <h2 className="ag-label">Agenda</h2>
      <div className="ag-body" data-fit-box="" data-testid={view ? 'lysbilde-innhold' : undefined}>
        <div className="ag-cols" aria-hidden="true">
          lysbilde
        </div>
        <ol className="ag-list" data-testid={view ? 'agendaliste' : undefined}>
          {deck.agenda.map((item) => {
            const state = current === null ? undefined : item.index < current ? 'tidligere' : item.index === current ? 'nå' : 'kommende';
            const subs = deck.subtitles[item.index] ?? [];
            return (
              <li
                key={item.key}
                className="ag-item"
                data-state={state}
                aria-current={state === 'nå' ? 'step' : undefined}
                data-no={`§ ${item.index + 1}`}
                data-no-pad={String(item.index + 1).padStart(2, '0')}
                data-n={String(item.index + 1)}
                data-page={String(deck.startNumbers[item.index] ?? '')}
              >
                <span className="ag-now" aria-hidden="true" />
                <span className="ag-t">{item.text}</span>
                <span className="ag-lead" aria-hidden="true" />
                {state === 'nå' && subs.length > 0 ? (
                  <span
                    className="ag-sub"
                    aria-hidden="true"
                    data-sub={subs.join(' · ')}
                    data-tree={subs.map((s, i) => `${i === subs.length - 1 ? '└──' : '├──'} ${s}`).join('\n')}
                  />
                ) : null}
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

function visibleProperties(properties: readonly PropertyEntry[]): PropertyEntry[] {
  const hide = new Set(ALWAYS_HIDDEN.map((k) => k.toLowerCase()));
  return properties.filter((p) => !hide.has(p.key.toLowerCase()));
}

/** Properties som i notat-headeren (skjulte er filtrert på serveren, PO-29), uten tagger (PO-90). */
function TitleProperties({ deck }: { readonly deck: DeckInfo }) {
  const props = visibleProperties(deck.doc.properties);
  if (props.length === 0 && deck.doc.aliases.length === 0) return null;
  return (
    <dl className="t-props">
      {props.map((p) => (
        <div key={p.key}>
          <dt>{p.key}</dt>
          <dd>
            {/* Én <time> på lysbildet: endringsdatoen (datoer i egenskaper vises som tekst). */}
            {p.value.type === 'date' ? formatDate(p.value.value, p.value.hasTime) : <PropertyValue vaultId={deck.vaultId} name={p.key} value={p.value} onTagClick={() => {}} />}
          </dd>
        </div>
      ))}
      {deck.doc.aliases.length > 0 ? (
        <div>
          <dt>Aliaser</dt>
          <dd>{deck.doc.aliases.join(', ')}</dd>
        </div>
      ) : null}
    </dl>
  );
}

function TitleSlide({ slide, deck, mode, active }: SlideProps) {
  const view = mode === 'view';
  const folder = folderOf(deck.doc.path);
  const dek = ingressOf(deck.doc.properties);
  const Heading = view ? 'h1' : 'p';
  return (
    <section className="slide slide-title-page" {...slideAttrs(slide, mode, active)} style={{ '--slide-fit': String(slide.scale) } as CSSProperties}>
      <div className="t-grid" data-testid={view ? 'lysbilde-innhold' : undefined} data-title-box="">
        {folder ? (
          <p className="t-kick">
            {folder.split('/').map((seg, i) => (
              <span key={i}>
                {i > 0 ? (
                  <span className="sep" aria-hidden="true">
                    /
                  </span>
                ) : null}
                {seg}
              </span>
            ))}
          </p>
        ) : null}
        <Heading className="t-title" data-testid={view ? 'lysbilde-overskrift' : undefined}>
          {slide.heading}
        </Heading>
        {dek ? <p className="t-dek">{dek}</p> : null}
        {slide.units.length > 0 ? (
          <div className="t-pre" data-fit-box="">
            <SlideUnits units={slide.units} scrollUnits={[]} deck={deck} />
          </div>
        ) : null}
        <TitleProperties deck={deck} />
        <p className="t-foot">
          <time className="meta" dateTime={deck.doc.mtime}>
            Endret {formatDateTime(deck.doc.mtime)}
          </time>
        </p>
      </div>
    </section>
  );
}

interface SlideProps {
  readonly slide: Slide;
  readonly deck: DeckInfo;
  readonly mode: SlideMode;
  readonly active: boolean;
}

export const SlideView = memo(function SlideView({ slide, deck, mode, active }: SlideProps) {
  let body: ReactNode;
  if (slide.kind === 'title') body = <TitleSlide slide={slide} deck={deck} mode={mode} active={active} />;
  else if (slide.kind === 'content') body = <ContentSlide slide={slide} deck={deck} mode={mode} active={active} />;
  else body = <AgendaSlide slide={slide} deck={deck} mode={mode} active={active} />;
  return <ModeContext.Provider value={mode}>{body}</ModeContext.Provider>;
});
