import './navigation.css';
import { useState } from 'react';
import type { DocPath, VaultId } from '../../../shared/api-types';
import { useSearch, useTags, useTree } from '../../shared/api';
import { Icon } from '../../shared/ui/Icon';
import { LiveStatus } from '../live-reload';
import { useOpenSearch } from '../search';
import { VaultPicker } from '../vault-picker';
import { FileLink, FileTree } from './FileTree';
import { useRecentDocs } from '../recent';
import { countNotes, flattenFiles } from './tree-utils';
import { shortcutLabel } from '../../shared/ui/shortcuts';

type Filter = 'alle' | 'nylig' | 'bases';

interface SidebarProps {
  readonly id: string;
  readonly vaultId: VaultId;
  readonly currentPath: DocPath;
  /** Mobil: skuffen er åpen. */
  readonly open: boolean;
  readonly onOpenTheme: () => void;
  readonly onNavigate: () => void;
}

/** Sidepanel (designsystem §7.1). På mobil er det samme element en skuff. */
export function Sidebar({ id, vaultId, currentPath, open, onOpenTheme, onNavigate }: SidebarProps) {
  const tree = useTree(vaultId);
  const tags = useTags(vaultId);
  const openSearch = useOpenSearch();
  const recent = useRecentDocs(vaultId);
  const [filter, setFilter] = useState<Filter>('alle');
  const [tag, setTag] = useState<string | null>(null);
  const tagHits = useSearch(vaultId, tag ? `#${tag}` : '', 50);

  const root = tree.data?.root;
  const chips: ReadonlyArray<readonly [Filter, string]> = [
    ['alle', 'Alle'],
    ['nylig', 'Nylig'],
    ['bases', 'Bases'],
  ];

  let list: React.ReactNode;
  if (tag) {
    const hits = tagHits.data?.hits ?? [];
    list = (
      <section className="nav-section" aria-labelledby={`${id}-tag`}>
        <h2 className="label" id={`${id}-tag`}>
          Tagget #{tag} <span>{tagHits.data ? hits.length : ''}</span>
        </h2>
        <ul className="tree flat">
          {hits.map((hit) => (
            <li key={hit.path}>
              <FileLink
                vaultId={vaultId}
                file={{ kind: hit.kind, name: hit.title, path: hit.path }}
                current={hit.path === currentPath}
                onNavigate={onNavigate}
              />
            </li>
          ))}
        </ul>
        {tagHits.data && hits.length === 0 ? <p className="nav-empty">Ingen notater med denne taggen.</p> : null}
      </section>
    );
  } else if (filter === 'nylig') {
    list = (
      <section className="nav-section" aria-labelledby={`${id}-recent`}>
        <h2 className="label" id={`${id}-recent`}>
          Nylig åpnet
        </h2>
        {recent.length === 0 ? <p className="nav-empty">Ingen notater åpnet ennå.</p> : null}
        <ul className="tree flat">
          {recent.map((d) => (
            <li key={d.path}>
              <FileLink
                vaultId={vaultId}
                file={{ kind: d.path.endsWith('.base') ? 'base' : 'note', name: d.title, path: d.path }}
                current={d.path === currentPath}
                onNavigate={onNavigate}
              />
            </li>
          ))}
        </ul>
      </section>
    );
  } else if (filter === 'bases' && root) {
    const bases = flattenFiles(root, (f) => f.kind === 'base');
    list = (
      <section className="nav-section" aria-labelledby={`${id}-bases`}>
        <h2 className="label" id={`${id}-bases`}>
          Bases <span>{bases.length}</span>
        </h2>
        <ul className="tree flat">
          {bases.map((f) => (
            <li key={f.path}>
              <FileLink vaultId={vaultId} file={f} current={f.path === currentPath} onNavigate={onNavigate} />
            </li>
          ))}
        </ul>
      </section>
    );
  } else {
    list = (
      <section className="nav-section" aria-labelledby={`${id}-folders`}>
        <h2 className="label" id={`${id}-folders`}>
          Mapper <span>{root ? countNotes(root).toLocaleString('nb-NO') : ''}</span>
        </h2>
        {root ? <FileTree vaultId={vaultId} root={root} currentPath={currentPath} onNavigate={onNavigate} /> : null}
        {tree.isError ? <p className="nav-empty">Fikk ikke lest filtreet.</p> : null}
      </section>
    );
  }

  return (
    <nav className="sidebar" id={id} aria-label="Vault" data-open={open ? 'true' : 'false'}>
      <VaultPicker vaultId={vaultId} />

      <div>
        <button type="button" className="search-btn" onClick={() => openSearch()}>
          <Icon name="search" />
          <span>Søk i notater</span>
          <kbd aria-hidden="true">{shortcutLabel('K')}</kbd>
        </button>
        <div className="filter-row" role="group" aria-label="Filter">
          {chips.map(([value, label]) => (
            <button
              key={value}
              type="button"
              className="chip"
              aria-pressed={!tag && filter === value}
              onClick={() => {
                setTag(null);
                setFilter(value);
              }}
            >
              {label}
            </button>
          ))}
          {tag ? (
            <button type="button" className="chip" aria-pressed="true" aria-label={`Fjern filter #${tag}`} onClick={() => setTag(null)}>
              #{tag} ×
            </button>
          ) : null}
        </div>
      </div>

      {list}

      {tags.data && tags.data.tags.length > 0 ? (
        <section className="nav-section" aria-labelledby={`${id}-tags`}>
          <h2 className="label" id={`${id}-tags`}>
            Tagger
          </h2>
          <div className="tag-cloud">
            {tags.data.tags.map((t) => (
              <button key={t.tag} type="button" aria-pressed={tag === t.tag} onClick={() => setTag(t.tag)}>
                #{t.tag} <b>{t.count}</b>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <div className="sidebar-foot">
        <LiveStatus />
        <button type="button" className="icon-btn" onClick={onOpenTheme}>
          <Icon name="theme" />
          Utseende
        </button>
      </div>
    </nav>
  );
}
