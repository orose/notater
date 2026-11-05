import type { Ref } from 'react';
import { Icon } from '../../shared/ui/Icon';
import { useOpenSearch } from '../search';

interface TopbarProps {
  readonly where: string;
  readonly drawerId: string;
  readonly drawerOpen: boolean;
  readonly menuRef: Ref<HTMLButtonElement>;
  readonly onToggleDrawer: () => void;
  readonly onOpenTheme: () => void;
}

/** Topplinje på smal skjerm (< 860 px): meny, brødsmule, søk, tema. Trykkflater ≥ 44 px. */
export function Topbar({ where, drawerId, drawerOpen, menuRef, onToggleDrawer, onOpenTheme }: TopbarProps) {
  const openSearch = useOpenSearch();
  return (
    <header className="topbar">
      <button
        ref={menuRef}
        type="button"
        className="icon-btn"
        aria-label={drawerOpen ? 'Lukk navigasjon' : 'Åpne navigasjon'}
        aria-controls={drawerId}
        aria-expanded={drawerOpen}
        onClick={onToggleDrawer}
      >
        <Icon name="menu" />
      </button>
      <span className="where">{where}</span>
      <button type="button" className="icon-btn" aria-label="Søk (⌘K)" onClick={() => openSearch()}>
        <Icon name="search" />
      </button>
      <button type="button" className="icon-btn" aria-label="Utseende" onClick={onOpenTheme}>
        <Icon name="theme" />
      </button>
    </header>
  );
}
