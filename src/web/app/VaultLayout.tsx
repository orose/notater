import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import { docPathFromPathname, docUrl, useVaults } from '../shared/api';
import { LiveReloadProvider } from '../features/live-reload';
import { Sidebar, Topbar } from '../features/navigation';
import { DocumentPage } from '../features/note-view';
import { CommandProvider, useCommands } from '../features/commands';
import { SearchProvider } from '../features/search';
import { ThemePicker } from '../features/theme';
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
          />
          <div className="main">{docPath ? <DocumentPage /> : <VaultHome vaultId={vaultId} />}</div>
        </div>
        <AppearanceDialog open={themeOpen} onClose={() => setThemeOpen(false)} />
      </LiveReloadProvider>
      </CommandProvider>
    </SearchProvider>
  );
}

/** Utseende med knapp til hurtigtastoversikten (F6), som eies av kommandoregisteret. */
function AppearanceDialog({ open, onClose }: { readonly open: boolean; readonly onClose: () => void }) {
  const { openShortcuts } = useCommands();
  return <ThemePicker open={open} onClose={onClose} onOpenShortcuts={openShortcuts} />;
}
