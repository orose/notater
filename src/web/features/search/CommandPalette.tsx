import './search.css';
import { useEffect, useId, useMemo, useState, type KeyboardEvent, type ReactNode } from 'react';
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

/** Én palett for søk og kommandoer (F5): inndata som starter med `:` gir kommandomodus (ADR-007 §4). */
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

/** Hurtigtasten til høyre: én `<kbd>` per akkord. */
function ShortcutKeys({ chords }: { readonly chords: readonly string[] }) {
  return (
    <span className="keys">
      {chords.map((chord, i) => (
        <kbd key={i}>{chord}</kbd>
      ))}
    </span>
  );
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

function markRanges(text: string, ranges: ReadonlyArray<readonly [number, number]>): ReactNode {
  const sorted = [...ranges].sort((a, b) => a[0] - b[0]);
  const out: ReactNode[] = [];
  let pos = 0;
  sorted.forEach(([start, end], i) => {
    if (start < pos) return;
    if (start > pos) out.push(text.slice(pos, start));
    out.push(<mark key={i}>{text.slice(start, end)}</mark>);
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
  const commandMode = commands !== null && query.startsWith(':');
  return commandMode ? (
    <CommandList query={query} setQuery={setQuery} source={commands} />
  ) : (
    <SearchList vaultId={vaultId} query={query} setQuery={setQuery} />
  );
}

interface ListProps {
  readonly query: string;
  readonly setQuery: (query: string) => void;
}

/** Felles inndatafelt (combobox) for begge modi, slik at fokus og markør beholdes ved modusbytte. */
function PaletteInput({
  query,
  setQuery,
  listId,
  activeId,
  expanded,
  onKeyDown,
  onChange,
}: ListProps & {
  readonly listId: string;
  readonly activeId: string | undefined;
  readonly expanded: boolean;
  readonly onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  readonly onChange: () => void;
}) {
  return (
    <div className="palette-input">
      <Icon name="search" />
      <input
        type="search"
        role="combobox"
        aria-label="Søk i titler, aliaser og innhold"
        placeholder="Søk i titler, aliaser og innhold"
        aria-expanded={expanded}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={activeId}
        aria-describedby={`${listId}-mode`}
        autoComplete="off"
        spellCheck={false}
        value={query}
        autoFocus
        onFocus={(event) => {
          // `:` forhåndsutfylt: markøren etter kolonet.
          const end = event.currentTarget.value.length;
          event.currentTarget.setSelectionRange(end, end);
        }}
        onChange={(event) => {
          setQuery(event.target.value);
          onChange();
        }}
        onKeyDown={(event) => {
          if (isModifierPressed(event) && event.key.toLowerCase() === 'k') {
            // ⌘K veksler: paletten lukker selv (motoren er inaktiv bak modal, ADR-007 §6).
            event.preventDefault();
            closePalette(event.currentTarget);
            return;
          }
          if (event.key === 'Escape') {
            // Chrome tømmer ellers bare søkefeltet på første Esc.
            event.preventDefault();
            closePalette(event.currentTarget);
            return;
          }
          onKeyDown(event);
        }}
      />
      <kbd>esc</kbd>
    </div>
  );
}

function CommandList({ query, setQuery, source }: ListProps & { readonly source: PaletteCommandSource }) {
  const listId = useId();
  const [selected, setSelected] = useState(0);
  const items = useMemo(() => source.options(query.slice(1)), [source, query]);
  const current = Math.min(selected, Math.max(0, items.length - 1));
  const optionId = (i: number) => `${listId}-c-${i}`;

  const choose = (item: PaletteCommandItem | undefined, from: Element | null) => {
    if (!item || !item.enabled) return;
    if (item.completion !== null) {
      setQuery(`:${item.completion}`);
      setSelected(0);
      return;
    }
    // Lukk først (fokus tilbake), kjør i neste ramme: ingen stablede modaler (AR-1.1-12).
    closePalette(from);
    requestAnimationFrame(() => source.run(item));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (items.length === 0) return;
      const delta = event.key === 'ArrowDown' ? 1 : -1;
      setSelected((current + delta + items.length) % items.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      choose(items[current], event.currentTarget);
    }
  };

  useEffect(() => {
    document.getElementById(optionId(current))?.scrollIntoView({ block: 'nearest' });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- optionId er avledet av listId
  }, [current, items]);

  const trimmed = query.slice(1).trim();
  return (
    <>
      <PaletteInput
        query={query}
        setQuery={setQuery}
        listId={listId}
        activeId={items.length > 0 ? optionId(current) : undefined}
        expanded={items.length > 0}
        onKeyDown={onKeyDown}
        onChange={() => setSelected(0)}
      />
      <span id={`${listId}-mode`} className="sr-only">
        Kommandomodus. Slett kolonet for å søke i notater.
      </span>
      <ul className="results commands" id={listId} role="listbox" aria-label="Kommandoer">
        {items.map((item, i) => {
          const header =
            item.group !== null && (i === 0 || items[i - 1]?.group !== item.group) ? (
              <li className="grp label" role="presentation" key={`g-${item.group}`}>
                {item.group}
              </li>
            ) : null;
          return [
            header,
            <li
              key={item.key}
              id={optionId(i)}
              className="res cmd"
              role="option"
              aria-selected={i === current}
              aria-disabled={item.enabled ? undefined : true}
              data-command-id={item.commandId}
              data-current={item.current || undefined}
              onMouseMove={() => i !== current && setSelected(i)}
              onClick={(event) => choose(item, event.currentTarget)}
            >
              <span className="t">
                {markRanges(item.label, item.highlights)}
                {item.current ? <span className="cur"> (valgt)</span> : null}
              </span>
              {item.shortcut ? <ShortcutKeys chords={item.shortcut} /> : null}
              {item.enabled ? (
                item.detail ? <span className="x">{item.detail}</span> : null
              ) : (
                <span className="x why">{item.reason}</span>
              )}
            </li>,
          ];
        })}
      </ul>
      {items.length === 0 ? (
        <div className="palette-empty mini-state">
          <strong>Ingen kommando for «{trimmed}»</strong>
          Prøv et kortere ord, eller slett kolonet for å søke i notater.
        </div>
      ) : null}
      <div className="palette-foot">
        <span>
          <kbd>↑</kbd> <kbd>↓</kbd> velg
        </span>
        <span>
          <kbd>↵</kbd> kjør
        </span>
        <span>
          <kbd>⌫</kbd> over <kbd>:</kbd> søk i notater
        </span>
      </div>
    </>
  );
}

function SearchList({ vaultId, query, setQuery }: ListProps & { readonly vaultId: VaultId }) {
  const debounced = useDebounced(query, 120);
  const search = useSearch(vaultId, debounced, 30);
  const vaults = useVaults();
  const recent = useRecentDocs(vaultId);
  const navigate = useNavigate();
  const listId = useId();
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

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (options.length === 0) return;
      const delta = event.key === 'ArrowDown' ? 1 : -1;
      setSelected((current + delta + options.length) % options.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      openOption(options[current], isModifierPressed(event));
    }
  };

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
  const waiting = trimmed !== '' && (debounced.trim() !== trimmed || search.isFetching) && options.length === 0;

  return (
    <>
      <PaletteInput
        query={query}
        setQuery={setQuery}
        listId={listId}
        activeId={options[current]?.id}
        expanded={options.length > 0}
        onKeyDown={onKeyDown}
        onChange={() => setSelected(0)}
      />
      <span id={`${listId}-mode`} className="sr-only">
        Skriv : for kommandoer.
      </span>
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
      <div className="palette-foot">
        <span>
          <kbd>↑</kbd> <kbd>↓</kbd> velg
        </span>
        <span>
          <kbd>↵</kbd> åpne
        </span>
        <span>
          <kbd>{modifierLabel()}</kbd> <kbd>↵</kbd> åpne i ny fane
        </span>
        {typeof noteCount === 'number' ? (
          <span className="count">{noteCount.toLocaleString('nb-NO')} notater</span>
        ) : null}
      </div>
    </>
  );
}
