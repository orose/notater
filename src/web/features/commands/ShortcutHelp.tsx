import { Fragment, useId, useMemo } from 'react';
import { Modal } from '../../shared/ui/Modal';
import { Icon } from '../../shared/ui/Icon';
import { RESERVED_NORMAL_KEYS } from '../keyboard';
import { shortcutGroups } from './model/shortcut-docs';

interface ShortcutHelpProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly platform: 'apple' | 'other';
}

/**
 * `?`-oversikten, «oppslagskortet» (F6, designsystem §11.8): alle hurtigtaster gruppert, generert fra
 * registeret (AK-1.1-07). Lukkes med Esc (native) og `?` (dialogens egen tast; motoren er inaktiv bak modal).
 */
export function ShortcutHelp({ open, onClose, platform }: ShortcutHelpProps) {
  const headingId = useId();
  return (
    <Modal
      open={open}
      onClose={onClose}
      labelledBy={headingId}
      className="refcard"
      onKeyDown={(event) => {
        if (event.key === '?' && !event.metaKey && !event.ctrlKey && !event.altKey) {
          event.preventDefault();
          event.currentTarget.close();
        }
      }}
    >
      <ShortcutHelpBody headingId={headingId} platform={platform} />
    </Modal>
  );
}

function Chords({ chords }: { readonly chords: readonly string[] }) {
  return (
    <>
      {chords.map((chord, j) => (
        <kbd key={j} className={chord === 'Space' ? 'k lead' : 'k'}>
          {chord}
        </kbd>
      ))}
    </>
  );
}

function ShortcutHelpBody({ headingId, platform }: { readonly headingId: string; readonly platform: 'apple' | 'other' }) {
  const groups = useMemo(() => shortcutGroups(platform), [platform]);
  return (
    <>
      <div className="rc-man" aria-hidden="true">
        <span>VAULT-LESER(1)</span>
        <span>Normal-modus</span>
        <span>VAULT-LESER(1)</span>
      </div>
      <div className="rc-head">
        <div>
          <h2 id={headingId}>Hurtigtaster</h2>
          <p className="rc-sub">
            Normal-modus · leder er <kbd className="k lead">Space</kbd>
          </p>
        </div>
        <button type="button" className="icon-btn" aria-label="Lukk" onClick={(event) => event.currentTarget.closest('dialog')?.close()}>
          <Icon name="close" />
        </button>
      </div>
      <div className="rc-grid">
        {groups.map((group) => (
          <section key={group.group} className="rc-group" aria-labelledby={`${headingId}-${group.group}`}>
            <h3 id={`${headingId}-${group.group}`} className="label">
              {group.label}
            </h3>
            <dl className="rc-list">
              {group.rows.map((row) => (
                <div
                  key={row.id}
                  className={row.kind === 'hint' ? 'rc-row hint' : 'rc-row'}
                  data-testid={row.kind === 'hint' ? 'hurtigtast-tips' : 'hurtigtast-rad'}
                  data-command-id={row.kind === 'command' ? row.id : undefined}
                  data-hint-id={row.kind === 'hint' ? row.id : undefined}
                >
                  <dt>
                    {row.chords.map((chords, i) => (
                      <Fragment key={i}>
                        {i > 0 ? (
                          <span className="sep" aria-label="eller">
                            {' / '}
                          </span>
                        ) : null}
                        <span className="keys-inline" data-testid={row.kind === 'command' ? 'hurtigtast-binding' : undefined}>
                          <Chords chords={chords} />
                        </span>
                      </Fragment>
                    ))}
                  </dt>
                  <dd>
                    <span data-testid={row.kind === 'command' ? 'hurtigtast-navn' : undefined} title={row.description || undefined}>
                      {row.label}
                    </span>
                  </dd>
                </div>
              ))}
            </dl>
            {group.commandOnly.length > 0 ? (
              <p className="rc-also">
                Bare som kommando:{' '}
                {group.commandOnly.map((ex, i) => (
                  <Fragment key={ex}>
                    {i > 0 ? ' ' : null}
                    <code>:{ex}</code>
                  </Fragment>
                ))}
              </p>
            ) : null}
          </section>
        ))}
      </div>
      <div className="rc-foot">
        <span>
          Esc eller ? lukker · <code>:hjelp</code> åpner også dette kortet
        </span>
        <span>
          Reservert for redigering senere: <span className="res-keys">{RESERVED_NORMAL_KEYS.join(' ')}</span>
        </span>
      </div>
    </>
  );
}
