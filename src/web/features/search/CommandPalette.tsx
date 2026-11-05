import './search.css';
import { useEffect, useId, useMemo, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import type { SearchHit, VaultId } from '../../../shared/api-types';
import { docUrl, folderOf, useSearch, useVaults } from '../../shared/api';
import { Icon } from '../../shared/ui/Icon';
import { Modal } from '../../shared/ui/Modal';
import { useRecentDocs } from '../recent';

interface CommandPaletteProps {
  readonly vaultId: VaultId;
  readonly open: boolean;
  readonly initialQuery: string;
  readonly onClose: () => void;
}

export function CommandPalette({ vaultId, open, initialQuery, onClose }: CommandPaletteProps) {
  return (
    <Modal open={open} onClose={onClose} label="Hurtigsøk" className="palette">
      <PaletteBody vaultId={vaultId} initialQuery={initialQuery} />
    </Modal>
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

function PaletteBody({ vaultId, initialQuery }: { readonly vaultId: VaultId; readonly initialQuery: string }) {
  const [query, setQuery] = useState(initialQuery);
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
    } else if (event.key === 'Escape') {
      // Chrome tømmer ellers bare søkefeltet på første Esc.
      event.preventDefault();
      event.currentTarget.closest('dialog')?.close();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      openOption(options[current], event.metaKey || event.ctrlKey);
    }
  };

  useEffect(() => {
    document.getElementById(options[current]?.id ?? '')?.scrollIntoView({ block: 'nearest' });
  }, [current, options]);

  const noteCount = vaults.data?.vaults.find((v) => v.id === vaultId)?.noteCount;
  const waiting = trimmed !== '' && (debounced.trim() !== trimmed || search.isFetching) && options.length === 0;

  return (
    <>
      <div className="palette-input">
        <Icon name="search" />
        <input
          type="search"
          role="combobox"
          aria-label="Søk i titler, aliaser og innhold"
          placeholder="Søk i titler, aliaser og innhold"
          aria-expanded={options.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={options[current]?.id}
          autoComplete="off"
          spellCheck={false}
          value={query}
          autoFocus
          onChange={(event) => {
            setQuery(event.target.value);
            setSelected(0);
          }}
          onKeyDown={onKeyDown}
        />
        <kbd>esc</kbd>
      </div>
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
              onClick={(event) => openOption(option, event.metaKey || event.ctrlKey)}
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
        <p className="palette-hint">Skriv for å søke i titler, aliaser og innhold. Start med # for tagger.</p>
      ) : null}
      <div className="palette-foot">
        <span>
          <kbd>↑</kbd> <kbd>↓</kbd> velg
        </span>
        <span>
          <kbd>↵</kbd> åpne
        </span>
        <span>
          <kbd>⌘</kbd> <kbd>↵</kbd> åpne i ny fane
        </span>
        {typeof noteCount === 'number' ? (
          <span className="count">{noteCount.toLocaleString('nb-NO')} notater</span>
        ) : null}
      </div>
    </>
  );
}
