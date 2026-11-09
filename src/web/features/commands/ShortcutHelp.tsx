import { Fragment, useId, useMemo } from 'react';
import { Modal } from '../../shared/ui/Modal';
import { Icon } from '../../shared/ui/Icon';
import { RESERVED_NORMAL_KEYS, type KeyMode } from '../keyboard';
import { shortcutGroups } from './model/shortcut-docs';

interface ShortcutHelpProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly platform: 'apple' | 'other';
  /** `present` viser presentasjonsmodusens taster (ADR-010 §3, AK-2-10). Standard: normal. */
  readonly mode?: KeyMode;
}

/**
 * `?`-oversikten, «oppslagskortet» (F6, designsystem §11.8): alle hurtigtaster gruppert, generert fra
 * registeret (AK-1.1-07). Par slås sammen til én rad (PO-69). Kontrakt (testplanen §6): enkel rad har
 * `data-command-id` på raden; i en par-rad har hver kommando sitt eget element med `data-command-id` inne i
 * raden. Hvert tastealternativ står i `data-testid="hurtigtast-binding"` med én `<kbd>` per akkord. Lukkes med Esc (native) og `?` (dialogens egen tast; motoren er inaktiv bak modal).
 */
export function ShortcutHelp({ open, onClose, platform, mode = 'normal' }: ShortcutHelpProps) {
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
      <ShortcutHelpBody headingId={headingId} platform={platform} mode={mode} />
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

function Separator() {
  return (
    <span className="sep" aria-label="eller">
      {' / '}
    </span>
  );
}

function ShortcutHelpBody({ headingId, platform, mode }: { readonly headingId: string; readonly platform: 'apple' | 'other'; readonly mode: KeyMode }) {
  const groups = useMemo(() => shortcutGroups(platform, mode), [platform, mode]);
  const present = mode === 'present';
  return (
    <>
      <div className="rc-man" aria-hidden="true">
        <span>VAULT-LESER(1)</span>
        <span>{present ? 'Presentasjon' : 'Normal-modus'}</span>
        <span>VAULT-LESER(1)</span>
      </div>
      <div className="rc-head">
        <div>
          <h2 id={headingId}>Hurtigtaster</h2>
          {present ? (
            <p className="rc-sub">Presentasjon · Space er neste lysbilde, Esc avslutter</p>
          ) : (
            <p className="rc-sub">
              Normal-modus · leder er <kbd className="k lead">Space</kbd>
            </p>
          )}
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
                  data-command-id={row.commands.length === 1 ? row.commands[0]?.id : undefined}
                  data-command-ids={row.kind === 'command' ? row.commands.map((c) => c.id).join(' ') : undefined}
                  data-hint-id={row.kind === 'hint' ? row.id : undefined}
                >
                  <dt>
                    {row.kind === 'command'
                      ? row.commands.map((command, i) => (
                          <Fragment key={command.id}>
                            {i > 0 ? <Separator /> : null}
                            <span
                              className="rc-cmd"
                              data-command-id={row.commands.length > 1 ? command.id : undefined}
                              title={row.commands.length > 1 ? command.name : undefined}
                            >
                              {command.bindings.map((binding, j) => (
                                <Fragment key={j}>
                                  {j > 0 ? <Separator /> : null}
                                  <span className="keys-inline" data-testid="hurtigtast-binding">
                                    <Chords chords={binding.chords} />
                                  </span>
                                </Fragment>
                              ))}
                            </span>
                          </Fragment>
                        ))
                      : row.bindings.map((binding, i) => (
                          <Fragment key={i}>
                            {i > 0 ? <Separator /> : null}
                            <span className="keys-inline">
                              <Chords chords={binding.chords} />
                            </span>
                          </Fragment>
                        ))}
                  </dt>
                  <dd>
                    <span data-testid={row.kind === 'command' ? 'hurtigtast-navn' : undefined}>{row.label}</span>
                    {row.description ? <span className="d">{row.description}</span> : null}
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
        {present ? null : (
          <span>
            Reservert for redigering senere: <span className="res-keys">{RESERVED_NORMAL_KEYS.join(' ')}</span>
          </span>
        )}
      </div>
    </>
  );
}
