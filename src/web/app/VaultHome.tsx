import { Link } from 'react-router';
import type { TreeFile, VaultId } from '../../shared/api-types';
import { docUrl, useTree, useVaults } from '../shared/api';
import { DocumentView } from '../features/note-view';
import { shortcutLabel } from '../shared/ui/shortcuts';

const HOME_NAMES = ['velkommen', 'index', 'readme'];

/** `/v/:vaultId`: Velkommen/index/README på rot hvis den finnes, ellers en oversikt (api.md). */
export function VaultHome({ vaultId }: { readonly vaultId: VaultId }) {
  const tree = useTree(vaultId);
  const vaults = useVaults();
  if (!tree.data) return <main className="page" id="innhold" tabIndex={-1} aria-busy={tree.isPending || undefined} />;

  const rootFiles = tree.data.root.children.filter((c): c is TreeFile => c.kind === 'note');
  const home = HOME_NAMES.map((n) => rootFiles.find((f) => f.name.toLowerCase() === n)).find(Boolean);
  if (home) return <DocumentView vaultId={vaultId} docPath={home.path} />;

  const name = vaults.data?.vaults.find((v) => v.id === vaultId)?.name ?? vaultId;
  return (
    <main className="page" id="innhold" tabIndex={-1}>
      <div className="col">
        <header className="note-head">
          <h1 className="title">{name}</h1>
          <p className="dek">Velg et notat i sidepanelet, eller søk med {shortcutLabel('K')}.</p>
        </header>
        <ul className="overview">
          {tree.data.root.children.map((node) =>
            node.kind === 'folder' ? (
              <li key={node.path}>
                <span className="label">{node.name}</span>
              </li>
            ) : (
              <li key={node.path}>
                <Link to={docUrl(vaultId, node.path)}>{node.name}</Link>
              </li>
            ),
          )}
        </ul>
      </div>
    </main>
  );
}
