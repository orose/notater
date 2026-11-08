import { Fragment } from 'react';
import { Link } from 'react-router';
import type { DocPath, VaultId, VaultValue } from '../../../shared/api-types';
import { docUrl } from '../../shared/api';
import { PropertyValue } from '../properties';

interface BaseCellProps {
  readonly vaultId: VaultId;
  readonly columnId: string;
  readonly rowPath: DocPath;
  readonly value: VaultValue | undefined;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** QA B10: `dd.MM.yyyy` / `dd.MM.yyyy HH:mm` i lokal tid. */
export function formatBaseDate(iso: string, hasTime: boolean): string {
  if (!hasTime) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
    return m ? `${m[3]}.${m[2]}.${m[1]}` : iso;
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function shortName(columnId: string): string {
  const i = columnId.indexOf('.');
  return i === -1 ? columnId : columnId.slice(i + 1);
}

export function BaseCell({ vaultId, columnId, rowPath, value }: BaseCellProps) {
  if (!value || value.type === 'null') return <span className="cell-empty">—</span>;
  if (columnId === 'file.name' && value.type === 'string') {
    return <Link to={docUrl(vaultId, rowPath)}>{value.value}</Link>;
  }
  if (value.type === 'date') {
    return (
      <time className="cell-date" dateTime={value.value}>
        {formatBaseDate(value.value, value.hasTime)}
      </time>
    );
  }
  if (value.type === 'boolean') return <span aria-label={value.value ? 'ja' : 'nei'}>{value.value ? '✓' : '–'}</span>;
  if (value.type === 'tag') return <span className="tag">#{value.value}</span>;
  if (value.type === 'list') {
    return (
      <span className="cell-list">
        {value.value.map((item, i) => (
          <Fragment key={i}>
            {i > 0 && item.type !== 'tag' ? ', ' : i > 0 ? ' ' : null}
            <BaseCell vaultId={vaultId} columnId={columnId} rowPath={rowPath} value={item} />
          </Fragment>
        ))}
      </span>
    );
  }
  return <PropertyValue vaultId={vaultId} name={shortName(columnId)} value={value} onTagClick={() => {}} />;
}
