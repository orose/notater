import { Fragment } from 'react';
import { Link } from 'react-router';
import type { VaultId, VaultValue } from '../../../shared/api-types';
import { docUrl } from '../../shared/api';
import { formatDate, statusKind } from '../../../core/format';

interface PropertyValueProps {
  readonly vaultId: VaultId;
  readonly name: string;
  readonly value: VaultValue;
  readonly onTagClick: (tag: string) => void;
}

const SAFE_URL = /^(https?:\/\/|mailto:)/i;

export function PropertyValue({ vaultId, name, value, onTagClick }: PropertyValueProps) {
  switch (value.type) {
    case 'null':
      return <span className="empty">ikke satt</span>;
    case 'string':
      if (SAFE_URL.test(value.value)) {
        const label = value.value.replace(/^https?:\/\//i, '').replace(/\/$/, '');
        return (
          <a className="link external" href={value.value} target="_blank" rel="noopener noreferrer">
            {label}
          </a>
        );
      }
      if (name.toLowerCase() === 'status') {
        return (
          <span className="status" data-s={statusKind(value.value)}>
            {value.value}
          </span>
        );
      }
      if (value.value.trim() === '') return <span className="empty">ikke satt</span>;
      return <>{value.value}</>;
    case 'number':
      return <span className="num">{String(value.value)}</span>;
    case 'boolean':
      return <input type="checkbox" className="prop-bool" checked={value.value} disabled readOnly aria-label={name} />;
    case 'date':
      return <time dateTime={value.value}>{formatDate(value.value, value.hasTime)}</time>;
    case 'tag':
      return (
        <button type="button" className="tag" onClick={() => onTagClick(value.value)}>
          #{value.value}
        </button>
      );
    case 'link':
      return value.target ? (
        <Link className="link wikilink" to={docUrl(vaultId, value.target)}>
          {value.display}
        </Link>
      ) : (
        <span className="wikilink broken" title={`Notatet «${value.display}» finnes ikke ennå`}>
          {value.display}
        </span>
      );
    case 'list':
      if (value.value.length === 0) return <span className="empty">ikke satt</span>;
      return (
        <>
          {value.value.map((item, i) => (
            <Fragment key={i}>
              {i > 0 && item.type !== 'tag' ? ', ' : i > 0 ? ' ' : null}
              <PropertyValue vaultId={vaultId} name={name} value={item} onTagClick={onTagClick} />
            </Fragment>
          ))}
        </>
      );
  }
}
