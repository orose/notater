import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import { docPathFromPathname, docUrl, useVaults } from '../shared/api';
import { LiveReloadProvider } from '../features/live-reload';
import { Sidebar, Topbar } from '../features/navigation';
import { DocumentPage } from '../features/note-view';
import { CommandProvider, useCommands } from '../features/commands';
import { OutlineHost } from '../features/outline';
import { SearchProvider } from '../features/search';
import { ThemePicker } from '../features/theme';
import { DiscreetMoveSync, ViewFlags, ZenChrome, useViewSettings } from '../features/view-settings';
import { useLiveState } from '../features/live-reload';
import { VaultHome } from './VaultHome';

const DRAWER_ID = 'sidebar';

/** App-layout (designsystem §7.1): sidepanel/skuff, topplinje (mobil), lesekolonne + høyre marg. */
export function VaultLayout() {
  const { vaultId = '' } = useParams();
  const location = useLocation();
  const vaults = useVaults();
  const docPath = docPathFromPathname(location.pathname, vaultId);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const menuRef = useRef<HTMLButtonElement>(null);
  const [lastPath, setLastPath] = useState(location.pathname);

  // Lukk skuffen ved navigasjon.
  if (lastPath !== location.pathname) {
    setLastPath(location.pathname);
    if (drawerOpen) setDrawerOpen(false);
  }

  useEffect(() => {
    if (!drawerOpen) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        // Konsumert her: system.escape (f.eks. avslutt zen) skal ikke også kjøre (ADR-007 §6).
        event.preventDefault();
        setDrawerOpen(false);
        menuRef.current?.focus();
      }
    };
    const onDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!document.getElementById(DRAWER_ID)?.contains(target) && !menuRef.current?.contains(target)) {
        setDrawerOpen(false);
      }
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [drawerOpen]);

  const known = vaults.data?.vaults.some((v) => v.id === vaultId);
  if (vaults.data && !known) {
    return (
      <main className="page standalone" id="innhold">
        <div className="state">
          <span className="glyph" aria-hidden="true">
            ∅
          </span>
          <h1 className="state-title">Fant ikke vaultet «{vaultId}»</h1>
          <p>Vaultet finnes ikke i konfigurasjonen. Velg et av disse:</p>
          <ul className="vault-list">
            {vaults.data.vaults.map((v) => (
              <li key={v.id}>
                <Link to={docUrl(v.id, '')}>{v.name}</Link>
              </li>
            ))}
          </ul>
        </div>
      </main>
    );
  }

  const where = docPath ? docPath.split('/').join(' / ') : (vaults.data?.vaults.find((v) => v.id === vaultId)?.name ?? '');

  return (
    <SearchProvider vaultId={vaultId}>
      <OutlineHost>
      <CommandProvider vaultId={vaultId} docPath={docPath} onOpenAppearance={() => setThemeOpen(true)}>
      <LiveReloadProvider vaultId={vaultId}>
        <a className="skip-link" href="#innhold">
          Hopp til innhold
        </a>
        <Topbar
          where={where}
          drawerId={DRAWER_ID}
          drawerOpen={drawerOpen}
          menuRef={menuRef}
          onToggleDrawer={() => setDrawerOpen((o) => !o)}
          onOpenTheme={() => setThemeOpen(true)}
        />
        <div className="app">
          <Sidebar
            id={DRAWER_ID}
            vaultId={vaultId}
            currentPath={docPath}
            open={drawerOpen}
            onOpenTheme={() => setThemeOpen(true)}
            onNavigate={() => setDrawerOpen(false)}
            flags={<LayoutFlags vaultId={vaultId} docPath={docPath} />}
          />
          <div className="main">{docPath ? <DocumentPage /> : <VaultHome vaultId={vaultId} />}</div>
        </div>
        <AppearanceDialog open={themeOpen} onClose={() => setThemeOpen(false)} vaultId={vaultId} docPath={docPath} />
        <MovedNotes vaultId={vaultId} />
        <ZenChrome />
      </LiveReloadProvider>
      </CommandProvider>
      </OutlineHost>
    </SearchProvider>
  );
}

interface DocProps {
  readonly vaultId: string;
  readonly docPath: string;
}

/** Diskré-bryteren for notatet som er åpent: kjøres som kommando (samme toast og tilgjengelighet som Space d). */
function useDiscreetControl({ vaultId, docPath }: DocProps) {
  const { run, availability } = useCommands();
  const { isDiscreet } = useViewSettings();
  const state = availability('view.toggleDiscreet');
  return {
    checked: docPath ? isDiscreet(vaultId, docPath) : false,
    disabledReason: state.enabled ? null : state.reason,
    onToggle: () => run('view.toggleDiscreet'),
  };
}

/** Utseende med diskré-bryter og knapp til hurtigtastoversikten (F2, F6), som eies av kommandoregisteret. */
function AppearanceDialog({ open, onClose, ...doc }: { readonly open: boolean; readonly onClose: () => void } & DocProps) {
  const { openShortcuts } = useCommands();
  const discreet = useDiscreetControl(doc);
  return <ThemePicker open={open} onClose={onClose} onOpenShortcuts={openShortcuts} discreet={discreet} />;
}

function LayoutFlags(doc: DocProps) {
  const discreet = useDiscreetControl(doc);
  return <ViewFlags discreet={{ on: discreet.checked, onToggle: discreet.onToggle }} />;
}

/** PO-49: diskré-valget følger notatet ved omdøping mens leseren er åpen. */
function MovedNotes({ vaultId }: { readonly vaultId: string }) {
  const { moved } = useLiveState();
  return <DiscreetMoveSync vaultId={vaultId} moved={moved} />;
}
