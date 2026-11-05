import { useEffect, useMemo } from 'react';
import { useLocation, useParams } from 'react-router';
import type { BaseDocument, DocPath, NoteDocument, VaultId } from '../../../shared/api-types';
import { assetUrl, baseName, docPathFromPathname, folderOf, isImagePath, isNotFound, useDocument, useVaults } from '../../shared/api';
import { Backlinks, OutgoingLinks, RailBacklinks, collectOutgoingLinks } from '../backlinks';
import { BaseBlock } from '../bases';
import { pushRecent } from '../recent';
import { InlineToc, Toc } from '../toc';
import { HastContent } from './HastContent';
import { MissingNotePage } from './MissingNotePage';
import { NoteHeader } from './NoteHeader';
import { readingMinutes } from './prepare-content';
import { useDocumentScroll } from './use-document-scroll';

function useVaultName(vaultId: VaultId): string {
  const vaults = useVaults();
  return vaults.data?.vaults.find((v) => v.id === vaultId)?.name ?? vaultId;
}

function useDocTitle(title: string | null, vaultId: VaultId) {
  const vaultName = useVaultName(vaultId);
  useEffect(() => {
    document.title = title ? `${title} · ${vaultName}` : vaultName;
  }, [title, vaultName]);
}

/** Rute: `/v/:vaultId/<DocPath>`. */
export function DocumentPage() {
  const { vaultId = '' } = useParams();
  const location = useLocation();
  const docPath = docPathFromPathname(location.pathname, vaultId);
  return <DocumentView key={vaultId} vaultId={vaultId} docPath={docPath} />;
}

interface DocumentViewProps {
  readonly vaultId: VaultId;
  readonly docPath: DocPath;
}

export function DocumentView({ vaultId, docPath }: DocumentViewProps) {
  const image = isImagePath(docPath);
  const query = useDocument(vaultId, docPath, !image);
  const doc = query.data;
  const ready = image || (!!doc && !query.isPlaceholderData) || query.isError;
  const { toast, dismissToast } = useDocumentScroll(ready, `${vaultId}/${docPath}`);
  useDocTitle(image ? baseName(docPath) : (doc?.title ?? null), vaultId);

  useEffect(() => {
    if (doc && !query.isPlaceholderData) pushRecent(vaultId, { path: doc.path, title: doc.title });
  }, [doc, query.isPlaceholderData, vaultId]);

  let body;
  if (image) {
    body = <AssetPage vaultId={vaultId} docPath={docPath} />;
  } else if (query.isError && !doc) {
    body = isNotFound(query.error) ? (
      <main className="page" id="innhold" tabIndex={-1}>
        <div className="col">
          <MissingNotePage vaultId={vaultId} docPath={docPath} />
        </div>
      </main>
    ) : (
      <main className="page" id="innhold" tabIndex={-1}>
        <div className="col">
          <div className="mini-state error-state" role="alert">
            <strong>Kunne ikke hente notatet</strong>
            {query.error instanceof Error ? query.error.message : 'Ukjent feil.'}{' '}
            <button type="button" className="btn" onClick={() => void query.refetch()}>
              Prøv igjen
            </button>
          </div>
        </div>
      </main>
    );
  } else if (!doc) {
    body = <main className="page" id="innhold" tabIndex={-1} aria-busy="true" />;
  } else if (doc.kind === 'base') {
    body = <BasePage doc={doc} busy={query.isPlaceholderData} />;
  } else {
    body = <NotePage doc={doc} busy={query.isPlaceholderData} />;
  }

  return (
    <>
      {body}
      {toast ? (
        <div className="toast" role="status">
          {toast}
          <button type="button" className="icon-btn" aria-label="Lukk melding" onClick={dismissToast}>
            ×
          </button>
        </div>
      ) : null}
    </>
  );
}

function isEmptyContent(doc: NoteDocument): boolean {
  return doc.content.children.every((c) => c.type === 'text' && c.value.trim() === '');
}

function NotePage({ doc, busy }: { readonly doc: NoteDocument; readonly busy: boolean }) {
  const minutes = useMemo(() => readingMinutes(doc.content), [doc.content]);
  const outgoing = useMemo(() => collectOutgoingLinks(doc.content, doc.path), [doc.content, doc.path]);
  return (
    <>
      <main className="page" id="innhold" tabIndex={-1} aria-busy={busy || undefined}>
        <div className="col">
          <NoteHeader doc={doc} readingMinutes={minutes} />
          <InlineToc entries={doc.toc} />
          <article className="prose">
            {isEmptyContent(doc) ? (
              <p className="empty-note">Notatet er tomt.</p>
            ) : (
              <HastContent vaultId={doc.vaultId} content={doc.content} bases={doc.bases} />
            )}
          </article>
          <Backlinks vaultId={doc.vaultId} title={doc.title} backlinks={doc.backlinks} />
        </div>
      </main>
      <aside className="rail" aria-label="På denne siden">
        <Toc entries={doc.toc} />
        <OutgoingLinks vaultId={doc.vaultId} links={outgoing} />
        <RailBacklinks backlinks={doc.backlinks} />
      </aside>
    </>
  );
}

function BasePage({ doc, busy }: { readonly doc: BaseDocument; readonly busy: boolean }) {
  const folder = folderOf(doc.path);
  return (
    <>
      <main className="page page-wide" id="innhold" tabIndex={-1} aria-busy={busy || undefined}>
        <div className="col col-wide">
          <header className="note-head">
            {folder ? <p className="crumbs label">{folder.replaceAll('/', ' / ')}</p> : null}
            <h1 className="title">{doc.title}</h1>
          </header>
          <div className="prose">
            <BaseBlock vaultId={doc.vaultId} result={doc.result} sourcePath={doc.path} />
          </div>
          <Backlinks vaultId={doc.vaultId} title={doc.title} backlinks={doc.backlinks} />
        </div>
      </main>
      <aside className="rail" aria-label="På denne siden">
        <RailBacklinks backlinks={doc.backlinks} />
      </aside>
    </>
  );
}

function AssetPage({ vaultId, docPath }: DocumentViewProps) {
  const name = baseName(docPath);
  return (
    <main className="page" id="innhold" tabIndex={-1}>
      <div className="col">
        <header className="note-head">
          {folderOf(docPath) ? <p className="crumbs label">{folderOf(docPath).replaceAll('/', ' / ')}</p> : null}
          <h1 className="title">{name}</h1>
        </header>
        <figure className="asset-figure">
          <img src={assetUrl(vaultId, docPath)} alt={name} />
        </figure>
      </div>
    </main>
  );
}
