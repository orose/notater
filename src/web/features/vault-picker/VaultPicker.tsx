import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router';
import type { VaultId } from '../../../shared/api-types';
import { docUrl, useVaults } from '../../shared/api';
import { Icon } from '../../shared/ui/Icon';

/** Vaultnavn + «n vaults ▾»-bytter (B6, designsystem §7.1). */
export function VaultPicker({ vaultId }: { readonly vaultId: VaultId }) {
  const { data } = useVaults();
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const vaults = data?.vaults ?? [];
  const current = vaults.find((v) => v.id === vaultId);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="vault" ref={wrapRef}>
      <span className="vault-name">{current?.name ?? vaultId}</span>
      {vaults.length > 1 ? (
        <>
          <button
            ref={buttonRef}
            type="button"
            className="vault-switch"
            aria-label={`Bytt vault (${vaults.length} konfigurert)`}
            aria-expanded={open}
            aria-controls={menuId}
            onClick={() => setOpen((o) => !o)}
          >
            {vaults.length} vaults <Icon name="down" />
          </button>
          {open ? (
            <ul className="vault-menu" id={menuId} aria-label="Vaults">
              {vaults.map((v) => (
                <li key={v.id}>
                  <Link
                    to={docUrl(v.id, '')}
                    aria-current={v.id === vaultId ? 'true' : undefined}
                    onClick={() => setOpen(false)}
                  >
                    <span>{v.name}</span>
                    <small>
                      {v.status === 'error'
                        ? 'feil'
                        : v.noteCount !== null
                          ? `${v.noteCount.toLocaleString('nb-NO')} notater`
                          : 'ikke indeksert'}
                    </small>
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
