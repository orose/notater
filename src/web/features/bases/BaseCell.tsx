import { Fragment } from 'react';
import { Link } from 'react-router';
import type { DocPath, VaultId, VaultValue } from '../../../shared/api-types';
import { docUrl } from '../../shared/api';
import { formatBaseDate } from '../../../core/format';
import { PropertyValue } from '../properties';

interface BaseCellProps {
  readonly vaultId: VaultId;
  readonly columnId: string;
  readonly rowPath: DocPath;
  readonly value: VaultValue | undefined;
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
