import { useState } from 'react';
import type { DocPath, TreeFile, TreeFolder, VaultId } from '../../../shared/api-types';
import { docUrl } from '../../shared/api';
import { Icon } from '../../shared/ui/Icon';
import { ancestorFolders, countNotes } from './tree-utils';
import { PrefetchLink } from '../../shared/ui/PrefetchLink';

interface FileTreeProps {
  readonly vaultId: VaultId;
  readonly root: TreeFolder;
  readonly currentPath: DocPath;
  readonly onNavigate?: () => void;
}

export function FileTree({ vaultId, root, currentPath, onNavigate }: FileTreeProps) {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set(ancestorFolders(currentPath)));
  const [seenPath, setSeenPath] = useState(currentPath);

  // Åpne forfedrene når man navigerer til et nytt notat (uten å lukke det brukeren har åpnet).
  if (seenPath !== currentPath) {
    setSeenPath(currentPath);
    const missing = ancestorFolders(currentPath).filter((p) => !expanded.has(p));
    if (missing.length > 0) setExpanded(new Set([...expanded, ...missing]));
  }

  const toggle = (path: string) => {
    const next = new Set(expanded);
    if (next.has(path)) next.delete(path);
    else next.add(path);
    setExpanded(next);
  };

  return (
    <ul className="tree">
      <TreeChildren
        vaultId={vaultId}
        folder={root}
        currentPath={currentPath}
        expanded={expanded}
        toggle={toggle}
        onNavigate={onNavigate}
      />
    </ul>
  );
}

interface TreeChildrenProps {
  readonly vaultId: VaultId;
  readonly folder: TreeFolder;
  readonly currentPath: DocPath;
  readonly expanded: ReadonlySet<string>;
  readonly toggle: (path: string) => void;
  readonly onNavigate?: () => void;
}

function TreeChildren({ vaultId, folder, currentPath, expanded, toggle, onNavigate }: TreeChildrenProps) {
  return (
    <>
      {folder.children.map((node) => {
        if (node.kind === 'folder') {
          const open = expanded.has(node.path);
          return (
            <li key={`d:${node.path}`}>
              <button type="button" className="dir" aria-expanded={open} onClick={() => toggle(node.path)}>
                <Icon name="chev" />
                <span className="dir-name">{node.name}</span>
                <span className="count">{countNotes(node)}</span>
              </button>
              {open ? (
                <ul>
                  <TreeChildren
                    vaultId={vaultId}
                    folder={node}
                    currentPath={currentPath}
                    expanded={expanded}
                    toggle={toggle}
                    onNavigate={onNavigate}
                  />
                </ul>
              ) : null}
            </li>
          );
        }
        return (
          <li key={`f:${node.path}`}>
            <FileLink vaultId={vaultId} file={node} current={node.path === currentPath} onNavigate={onNavigate} />
          </li>
        );
      })}
    </>
  );
}

export function FileLink({
  vaultId,
  file,
  current,
  onNavigate,
  detail,
}: {
  readonly vaultId: VaultId;
  readonly file: TreeFile;
  readonly current: boolean;
  readonly onNavigate?: () => void;
  readonly detail?: string;
}) {
  const dim = file.kind === 'unsupported' || file.kind === 'asset';
  return (
    <PrefetchLink
      vaultId={vaultId}
      docPath={file.kind === 'asset' ? undefined : file.path}
      to={docUrl(vaultId, file.path)}
      className={dim ? `file dim kind-${file.kind}` : `file kind-${file.kind}`}
      aria-current={current ? 'page' : undefined}
      onClick={onNavigate}
      title={file.path}
    >
      {file.kind === 'base' ? <Icon name="base" className="file-icon" /> : null}
      <span className="file-name">{file.name}</span>
      {detail ? <span className="count">{detail}</span> : null}
    </PrefetchLink>
  );
}
