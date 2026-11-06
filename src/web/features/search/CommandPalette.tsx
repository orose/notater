import './search.css';
import { useEffect, useMemo, useId, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import type { SearchHit, VaultId } from '../../../shared/api-types';
import { PREFETCH_DELAY_MS, docUrl, folderOf, usePrefetch, useSearch, useVaults } from '../../shared/api';
import { Icon } from '../../shared/ui/Icon';
import { Modal } from '../../shared/ui/Modal';
import { useRecentDocs } from '../recent';
import { isModifierPressed, modifierLabel } from '../../shared/ui/shortcuts';
import type { PaletteCommandItem, PaletteCommandSource } from './search-context';

interface CommandPaletteProps {
  readonly vaultId: VaultId;
  readonly open: boolean;
  readonly initialQuery: string;
  /** Kommandomodus (`:`). Uten kilde finnes bare søk. */
  readonly commands: PaletteCommandSource | null;
  readonly onClose: () => void;
}

/**
 * Én palett for søk og kommandoer (F5, designsystem §11.7). Inndata som starter med `:` gir kommandomodus;
 * kolonet blir i feltets verdi, men tegnes som prompt foran feltet (PO-63). `⌫` på tom linje går tilbake til søk.
 */
export function CommandPalette({ vaultId, open, initialQuery, commands, onClose }: CommandPaletteProps) {
  return (
    <Modal open={open} onClose={onClose} label="Hurtigsøk" className="palette">
      <PaletteBody vaultId={vaultId} initialQuery={initialQuery} commands={commands} />
    </Modal>
  );
}

function closePalette(from: Element | null): void {
  (from?.closest('dialog') ?? document.querySelector<HTMLDialogElement>('dialog.palette[open]'))?.close();
}

/** Tasttegn: én `<kbd>` per akkord; `Space` (leder) i kommandofarge. */
function Keys({ chords }: { readonly chords: readonly string[] }) {
  return (
    <>
      {chords.map((chord, i) => (
        <kbd key={i} className={chord === 'Space' ? 'k lead' : 'k'}>
          {chord}
        </kbd>
      ))}
    </>
  );
}

type Action = 'up' | 'down' | 'enter' | 'enter-new-tab' | 'tab';

/** Det en liste (søk eller kommandoer) gir paletten. */
interface ListView {
  readonly activeId: string | undefined;
  readonly expanded: boolean;
  /** Håndterer en navigasjonstast; `true` = tasten er brukt. */
  readonly act: (action: Action, from: Element) => boolean;
  readonly reset: () => void;
  readonly body: ReactNode;
  readonly foot: ReactNode;
}

interface Option {
  readonly id: string;
  readonly group: 'Nylig åpnet' | 'Notater' | 'Innhold';
  readonly path: string;
  readonly title: ReactNode;
  readonly sub?: ReactNode;
  readonly extra?: ReactNode;
}

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

/** Understreker søkeordene i en tittel (treff i aksent – ikke gul bakgrunn, designsystem §7.11). */
function markTerms(text: string, query: string): ReactNode {
  const terms = query
    .toLowerCase()
    .replace(/^#/, '')
    .split(/\s+/)
    .filter((t) => t.length > 0);
  if (terms.length === 0) return text;
  const lower = text.toLowerCase();
  const ranges: Array<[number, number]> = [];
  for (const term of terms) {
    let i = lower.indexOf(term);
    while (i !== -1) {
      ranges.push([i, i + term.length]);
      i = lower.indexOf(term, i + term.length);
    }
  }
  return markRanges(text, ranges);
}

function markRanges(text: string, ranges: ReadonlyArray<readonly [number, number]>, Tag: 'mark' | 'b' = 'mark'): ReactNode {
  const sorted = [...ranges].sort((a, b) => a[0] - b[0]);
  const out: ReactNode[] = [];
  let pos = 0;
  sorted.forEach(([start, end], i) => {
    if (start < pos) return;
    if (start > pos) out.push(text.slice(pos, start));
    out.push(<Tag key={i}>{text.slice(start, end)}</Tag>);
    pos = end;
  });
  if (pos < text.length) out.push(text.slice(pos));
  return out;
}

function hitToOption(hit: SearchHit, query: string, prefix: string): Option {
  const folder = folderOf(hit.path);
  if (hit.matchedField === 'content') {
    return {
      id: `${prefix}-${hit.path}`,
      group: 'Innhold',
      path: hit.path,
      title: hit.title,
      sub: folder,
      extra: hit.snippet ? markRanges(hit.snippet.text, hit.snippet.highlights) : undefined,
    };
  }
  return {
    id: `${prefix}-${hit.path}`,
    group: 'Notater',
    path: hit.path,
    title: (
      <>
        {markTerms(hit.title, query)}
        {hit.matchedField === 'alias' && hit.alias ? <span className="alias"> alias: {hit.alias}</span> : null}
      </>
    ),
    sub: folder,
  };
}

interface PaletteBodyProps {
  readonly vaultId: VaultId;
  readonly initialQuery: string;
  readonly commands: PaletteCommandSource | null;
}

function PaletteBody({ vaultId, initialQuery, commands }: PaletteBodyProps) {
  const [query, setQuery] = useState(initialQuery);
  const listId = useId();
  const commandMode = commands !== null && query.startsWith(':');
  // Begge listene er alltid montert som hooks, så feltet beholder fokus og markør ved modusbytte.
  const search = useSearchList(vaultId, commandMode ? '' : query, listId);
  const command = useCommandList(commands, commandMode ? query.slice(1) : null, listId, setQuery);
  const view = commandMode ? command : search;

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    if (isModifierPressed(event) && event.key.toLowerCase() === 'k') {
      // ⌘K veksler: paletten lukker selv (motoren er inaktiv bak modal, ADR-007 §6).
      event.preventDefault();
      closePalette(input);
      return;
    }
    if (event.key === 'Escape') {
      // Chrome tømmer ellers bare søkefeltet på første Esc.
      event.preventDefault();
      closePalette(input);
      return;
    }
    const ctrlOnly = event.ctrlKey && !event.metaKey && !event.altKey;
    let action: Action | null = null;
    if (event.key === 'ArrowDown' || (ctrlOnly && event.key.toLowerCase() === 'n')) action = 'down';
    else if (event.key === 'ArrowUp' || (ctrlOnly && event.key.toLowerCase() === 'p')) action = 'up';
    else if (event.key === 'Enter') action = isModifierPressed(event) ? 'enter-new-tab' : 'enter';
    else if (event.key === 'Tab' && !event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey) action = 'tab';
    if (action && view.act(action, input)) event.preventDefault();
  };

  return (
    <>
      <div className={commandMode ? 'palette-input is-cmd' : 'palette-input'}>
        {commandMode ? (
          <span className="prompt" aria-hidden="true">
            :
          </span>
        ) : (
          <Icon name="search" />
        )}
        <span className="palette-field">
          <input
            type="search"
            role="combobox"
            aria-label={commandMode ? 'Kommando' : 'Søk i notater'}
            placeholder={commandMode ? undefined : 'Søk i titler, aliaser og innhold'}
            aria-expanded={view.expanded}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={view.activeId}
            aria-describedby={`${listId}-mode`}
            autoComplete="off"
            spellCheck={false}
            value={query}
            autoFocus
            onFocus={(event) => {
              const end = event.currentTarget.value.length;
              event.currentTarget.setSelectionRange(end, end);
            }}
            onSelect={(event) => {
              // Kolonet er prompt: markøren skal ikke stå foran det (PO-63).
              const input = event.currentTarget;
              if (commandMode && input.selectionStart === 0 && input.selectionEnd === 0) input.setSelectionRange(1, 1);
            }}
            onChange={(event) => {
              setQuery(event.target.value);
              search.reset();
              command.reset();
            }}
            onKeyDown={onKeyDown}
          />
          {commandMode && query === ':' ? (
            <span className="cmd-placeholder" aria-hidden="true">
              bredde, zen, tema …
            </span>
          ) : null}
        </span>
        <kbd className="k esc">Esc</kbd>
      </div>
      <span id={`${listId}-mode`} className="sr-only">
        {commandMode ? 'Kommandomodus. Slett kolonet for å søke i notater.' : 'Skriv : for kommandoer.'}
      </span>
      {view.body}
      <div className="palette-foot">{view.foot}</div>
    </>
  );
}

function Hint({ keys, children, optional }: { readonly keys: readonly string[]; readonly children: ReactNode; readonly optional?: boolean }) {
  return (
    <span className={optional ? 'hint hint-opt' : 'hint'}>
      <Keys chords={keys} /> {children}
    </span>
  );
}

// ---------------------------------------------------------------------------------------------- kommandoer

function useCommandList(
  source: PaletteCommandSource | null,
  query: string | null,
  listId: string,
  setQuery: (query: string) => void,
): ListView {
  const [selected, setSelected] = useState(0);
  const list = useMemo(() => (source && query !== null ? source.options(query) : { items: [], argument: null }), [source, query]);
  const items = list.items;
  const current = Math.min(selected, Math.max(0, items.length - 1));
  const optionId = (i: number) => `${listId}-c-${i}`;

  useEffect(() => {
    if (query === null) return;
    document.getElementById(`${listId}-c-${current}`)?.scrollIntoView({ block: 'nearest' });
  }, [current, items, listId, query]);

  const choose = (item: PaletteCommandItem | undefined, from: Element) => {
    if (!item || !source) return;
    if (item.enabled && item.completion !== null) {
      setQuery(`:${item.completion}`);
      setSelected(0);
      return;
    }
    // Lukk først (fokus tilbake), kjør i neste ramme: ingen stablede modaler (AR-1.1-12).
    // Deaktivert: kjøringen gir bare begrunnelsen som toast.
    closePalette(from);
    requestAnimationFrame(() => source.run(item));
  };

  const act = (action: Action, from: Element): boolean => {
    if (query === null) return false;
    if (action === 'up' || action === 'down') {
      if (items.length > 0) setSelected((current + (action === 'down' ? 1 : -1) + items.length) % items.length);
      return true;
    }
    if (action === 'tab') {
      const item = items[current];
      if (!item) return false;
      setQuery(`:${item.fill}`);
      setSelected(0);
      return true;
    }
    choose(items[current], from);
    return true;
  };

  const trimmed = (query ?? '').trim();
  const grouped = items.some((i) => i.group !== null);
  const body =
    query === null ? null : (
      <>
        <ul className="results commands" id={listId} role="listbox" aria-label={list.argument ? list.argument.label : 'Kommandoer'}>
          {list.argument ? (
            <li className="cmd-crumb" role="presentation">
              <code>:{list.argument.ex}</code>
              <span className="label">velg {list.argument.label.toLowerCase()}</span>
            </li>
          ) : null}
          {items.map((item, i) => {
            const header =
              !list.argument && grouped && item.group !== null && (i === 0 || items[i - 1]?.group !== item.group) ? (
                <li className="grp label" role="presentation" key={`g-${item.group}`}>
                  {item.group}
                </li>
              ) : null;
            const common = {
              id: optionId(i),
              role: 'option',
              'aria-selected': i === current,
              'aria-disabled': item.enabled ? undefined : true,
              'data-command-id': item.commandId,
              onMouseMove: () => i !== current && setSelected(i),
              onClick: (event: MouseEvent<HTMLLIElement>) => choose(item, event.currentTarget),
            } as const;
            return [
              header,
              item.kind === 'argument' ? (
                <li key={item.key} className="res arg" {...common}>
                  {item.visual?.swatch ? (
                    <span className="arg-sw" aria-hidden="true">
                      {item.visual.swatch.map((color, k) => (
                        <i key={k} style={{ background: color }} />
                      ))}
                    </span>
                  ) : (
                    <span className={`arg-spec arg-spec-${item.args.type ?? ''}`} aria-hidden="true">
                      {item.visual?.specimen ?? ''}
                    </span>
                  )}
                  <span>
                    <span className="arg-name">{markRanges(item.label, item.highlights)}</span>
                    {item.detail ? <span className="arg-desc">{item.detail}</span> : null}
                  </span>
                  {item.current ? <span className="arg-now">● NÅ</span> : <span />}
                </li>
              ) : (
                <li key={item.key} className="res cmd" {...common}>
                  <span className="cmd-ex">
                    :{markRanges(item.ex, item.exHighlights, 'b')}
                    {item.argumentLabel ? ` ‹${item.argumentLabel}›` : null}
                  </span>
                  <span className="cmd-name">
                    {markRanges(item.label, item.highlights)}
                    {item.state ? (
                      <span className="st">
                        {item.argumentLabel ? '' : 'nå: '}
                        {item.state}
                      </span>
                    ) : null}
                  </span>
                  <span className="cmd-keys">{item.shortcut ? <Keys chords={item.shortcut} /> : null}</span>
                  {item.enabled ? null : <span className="cmd-why">{item.reason}</span>}
                </li>
              ),
            ];
          })}
        </ul>
        {items.length === 0 ? (
          list.argument ? (
            <div className="cmd-err" role="status">
              <span className="code">E475</span>
              <strong>Ugyldig argument «{trimmed.slice(list.argument.ex.length).trim()}».</strong> Slett litt og velg en av verdiene.
            </div>
          ) : (
            <div className="cmd-err" role="status">
              <span className="code">E492</span>
              <strong>Ingen kommando heter «{trimmed}».</strong> Prøv <code>:hjelp</code>, eller tøm linjen for å se alle.
            </div>
          )
        ) : null}
      </>
    );

  return {
    activeId: items.length > 0 ? optionId(current) : undefined,
    expanded: items.length > 0,
    act,
    reset: () => setSelected(0),
    body,
    foot: (
      <>
        <span className="mode-tag">kommando</span>
        <Hint keys={['↑', '↓']}>velg</Hint>
        <Hint keys={['⇥']}>fullfør</Hint>
        <Hint keys={['↵']}>kjør</Hint>
        <Hint keys={['⌫']} optional>
          på tom linje: tilbake til søk
        </Hint>
        {source ? <span className="count">{source.count} kommandoer</span> : null}
      </>
    ),
  };
}

// ---------------------------------------------------------------------------------------------- søk

function useSearchList(vaultId: VaultId, query: string, listId: string): ListView {
  const debounced = useDebounced(query, 120);
  const search = useSearch(vaultId, debounced, 30);
  const vaults = useVaults();
  const recent = useRecentDocs(vaultId);
  const navigate = useNavigate();
  const [selected, setSelected] = useState(0);

  const trimmed = query.trim();
  const options = useMemo<Option[]>(() => {
    if (!trimmed) {
      return recent.slice(0, 5).map((d) => ({
        id: `${listId}-r-${d.path}`,
        group: 'Nylig åpnet' as const,
        path: d.path,
        title: d.title,
        sub: folderOf(d.path),
      }));
    }
    const hits = search.data?.hits ?? [];
    const opts = hits.map((hit) => hitToOption(hit, debounced, listId));
    // Gruppér: notater først, så innhold (stabil rekkefølge innen gruppe).
    return [...opts.filter((o) => o.group === 'Notater'), ...opts.filter((o) => o.group === 'Innhold')];
  }, [trimmed, recent, search.data, debounced, listId]);

  const current = Math.min(selected, Math.max(0, options.length - 1));

  const openOption = (option: Option | undefined, newTab: boolean) => {
    if (!option) return;
    const url = docUrl(vaultId, option.path);
    if (newTab) {
      window.open(url, '_blank', 'noopener');
      return;
    }
    navigate(url);
    document.querySelector<HTMLDialogElement>('dialog.palette[open]')?.close();
  };

  const waiting = trimmed !== '' && (debounced.trim() !== trimmed || search.isFetching) && options.length === 0;
  // Enter før søket har svart (rask skriving): åpne første treff når det kommer.
  const pendingEnter = useRef<string | null>(null);
  const act = (action: Action): boolean => {
    if (action === 'up' || action === 'down') {
      if (options.length > 0) setSelected((current + (action === 'down' ? 1 : -1) + options.length) % options.length);
      return true;
    }
    if (action === 'enter' || action === 'enter-new-tab') {
      if (options.length === 0 && waiting && action === 'enter') pendingEnter.current = trimmed;
      else openOption(options[current], action === 'enter-new-tab');
      return true;
    }
    return false;
  };
  useEffect(() => {
    if (pendingEnter.current === null || options.length === 0) return;
    const wanted = pendingEnter.current;
    pendingEnter.current = null;
    if (wanted === trimmed) openOption(options[0], false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- kjøres når treffene kommer
  }, [options]);

  useEffect(() => {
    document.getElementById(options[current]?.id ?? '')?.scrollIntoView({ block: 'nearest' });
  }, [current, options]);

  // PO-51: valgt treff hentes i forkant, så Enter åpner det uten venting.
  const prefetch = usePrefetch();
  const selectedPath = options[current]?.path;
  useEffect(() => {
    if (!selectedPath) return undefined;
    const timer = setTimeout(() => prefetch(vaultId, selectedPath), PREFETCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [prefetch, selectedPath, vaultId]);

  const noteCount = vaults.data?.vaults.find((v) => v.id === vaultId)?.noteCount;

  const body = (
    <>
      <ul className="results" id={listId} role="listbox" aria-label="Søkeresultater">
        {options.map((option, i) => {
          const header =
            i === 0 || options[i - 1]?.group !== option.group ? (
              <li className="grp label" role="presentation" key={`g-${option.group}`}>
                {option.group}
              </li>
            ) : null;
          return [
            header,
            <li
              key={option.id}
              id={option.id}
              className="res"
              role="option"
              aria-selected={i === current}
              onMouseMove={() => i !== current && setSelected(i)}
              onClick={(event) => openOption(option, isModifierPressed(event))}
            >
              <span className="t">{option.title}</span>
              {option.sub ? <span className="p">{option.sub}</span> : null}
              {option.extra ? <span className="x">{option.extra}</span> : null}
            </li>,
          ];
        })}
      </ul>
      {trimmed && !waiting && options.length === 0 ? (
        <div className="palette-empty mini-state">
          <strong>Ingen treff for «{trimmed}»</strong>
          Prøv et kortere ord, eller søk på en tagg med <kbd>#</kbd> foran.
        </div>
      ) : null}
      {!trimmed && options.length === 0 ? (
        <p className="palette-hint">
          Skriv for å søke i titler, aliaser og innhold. Start med <kbd>#</kbd> for tagger, <kbd>:</kbd> for kommandoer.
        </p>
      ) : null}
    </>
  );

  return {
    activeId: options[current]?.id,
    expanded: options.length > 0,
    act,
    reset: () => setSelected(0),
    body,
    foot: (
      <>
        <span className="mode-tag">søk</span>
        <Hint keys={['↑', '↓']}>velg</Hint>
        <Hint keys={['↵']}>åpne</Hint>
        <Hint keys={[`${modifierLabel()} ↵`]} optional>
          ny fane
        </Hint>
        <Hint keys={[':']}>kommandoer</Hint>
        {typeof noteCount === 'number' ? <span className="count">{noteCount.toLocaleString('nb-NO')} notater</span> : null}
      </>
    ),
  };
}
