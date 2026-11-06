import './note-view.css';
import { useEffect, useMemo, useRef } from 'react';
import { useLocation, useParams } from 'react-router';
import type { BaseDocument, DocPath, NoteDocument, VaultId } from '../../../shared/api-types';
import { assetUrl, baseName, docPathFromPathname, folderOf, isImagePath, isNotFound, useDocument, useVaults } from '../../shared/api';
import { Backlinks, OutgoingLinks, RailBacklinks, collectOutgoingLinks } from '../backlinks';
import { BaseBlock } from '../bases';
import { pushRecent } from '../recent';
import { InlineToc, Toc } from '../toc';
import { HastContent } from './HastContent';
import { splitLeadingTitle } from './leading-title';
import { MissingNotePage } from './MissingNotePage';
import { NoteHeader } from './NoteHeader';
import { readingMinutes } from './prepare-content';
import { useRailDimming } from './rail-overlap';
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
  const display = useMemo(() => (doc?.kind === 'note' ? splitLeadingTitle(doc) : null), [doc]);
  const title = display?.title ?? doc?.title ?? null;
  useDocTitle(image ? baseName(docPath) : title, vaultId);

  useEffect(() => {
    if (doc && title !== null && !query.isPlaceholderData) pushRecent(vaultId, { path: doc.path, title });
  }, [doc, title, query.isPlaceholderData, vaultId]);

  let body;
  if (image) {
    body = <AssetPage vaultId={vaultId} docPath={docPath} />;
  } else if (query.isError && (!doc || isNotFound(query.error))) {
    // BUG-006: også når en refetch gir 404 (fila slettet/omdøpt mens notatet var åpent) – ikke vis gammel data.
    body = isNotFound(query.error) ? (
      <main className="page" id="innhold" tabIndex={-1}>
        <div className="col">
          <MissingNotePage vaultId={vaultId} docPath={docPath} wasOpen={!!doc && doc.path === docPath} />
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
  } else if (display) {
    body = <NotePage doc={doc} display={display} busy={query.isPlaceholderData} />;
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

function isEmptyContent(content: NoteDocument['content']): boolean {
  return content.children.every((c) => c.type === 'text' && c.value.trim() === '');
}

interface NotePageProps {
  readonly doc: NoteDocument;
  /** Visningstittel, brødtekst og TOC etter PO-35 (`splitLeadingTitle`). */
  readonly display: ReturnType<typeof splitLeadingTitle>;
  readonly busy: boolean;
}

function NotePage({ doc, display, busy }: NotePageProps) {
  const minutes = useMemo(() => readingMinutes(doc.content), [doc.content]);
  const outgoing = useMemo(() => collectOutgoingLinks(doc.content, doc.path), [doc.content, doc.path]);
  const railRef = useRef<HTMLElement>(null);
  useRailDimming(railRef, display.content);
  return (
    <>
      <main className="page" id="innhold" tabIndex={-1} aria-busy={busy || undefined}>
        <div className="col">
          <NoteHeader doc={doc} title={display.title} readingMinutes={minutes} />
          <InlineToc entries={display.toc} />
          <article className="prose">
            {isEmptyContent(display.content) ? (
              <p className="empty-note">Notatet er tomt.</p>
            ) : (
              <HastContent vaultId={doc.vaultId} content={display.content} bases={doc.bases} />
            )}
          </article>
          {/* Utdragene inneholder lenketeksten (filnavnet), ikke visningstittelen. */}
          <Backlinks vaultId={doc.vaultId} title={doc.title} path={doc.path} backlinks={doc.backlinks} />
        </div>
      </main>
      <aside className="rail" aria-label="På denne siden" ref={railRef}>
        <Toc entries={display.toc} />
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
          <Backlinks vaultId={doc.vaultId} title={doc.title} path={doc.path} backlinks={doc.backlinks} />
        </div>
      </main>
      {/* PO-43: ingen høyre marg på .base-sider – basen får hele bredden. */}
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
