import type { NoteDocument, PropertyEntry } from '../../../shared/api-types';
import { folderOf } from '../../shared/api';
import { PropertyList, formatDateTime } from '../properties';
import { useOpenSearch } from '../search';

/** PO-21: ingress fra `description`, deretter `summary`. */
function ingress(properties: readonly PropertyEntry[]): string | null {
  for (const key of ['description', 'summary']) {
    const entry = properties.find((p) => p.key.toLowerCase() === key);
    if (entry?.value.type === 'string' && entry.value.value.trim()) return entry.value.value.trim();
  }
  return null;
}

interface NoteHeaderProps {
  readonly doc: NoteDocument;
  /** Visningstittel (PO-35): første H1 eller filnavnet. */
  readonly title: string;
  readonly readingMinutes: number;
}

/** Notat-header (designsystem §7.2). */
export function NoteHeader({ doc, title, readingMinutes }: NoteHeaderProps) {
  const openSearch = useOpenSearch();
  const folder = folderOf(doc.path);
  const dek = ingress(doc.properties);
  const onTag = (tag: string) => openSearch(`#${tag}`);

  return (
    <header className="note-head">
      {folder ? (
        <p className="crumbs label" aria-label="Plassering">
          {folder.split('/').map((segment, i) => (
            <span key={i} className="crumb">
              {i > 0 ? <span className="sep" aria-hidden="true">/</span> : null}
              <span>{segment}</span>
            </span>
          ))}
        </p>
      ) : null}
      <h1 className="title">{title}</h1>
      {dek ? <p className="dek">{dek}</p> : null}
      <PropertyList vaultId={doc.vaultId} properties={doc.properties} aliases={doc.aliases} onTagClick={onTag} />
      <div className="head-foot">
        {doc.tags.length > 0 ? (
          <ul className="tags" aria-label="Tagger">
            {doc.tags.map((tag) => (
              <li key={tag}>
                <button type="button" className="tag" onClick={() => onTag(tag)}>
                  #{tag}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <p className="meta">
          <time dateTime={doc.mtime}>Endret {formatDateTime(doc.mtime)}</time> · {readingMinutes} min lesing
        </p>
      </div>
    </header>
  );
}
