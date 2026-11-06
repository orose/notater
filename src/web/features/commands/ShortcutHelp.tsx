import { useId, useMemo } from 'react';
import { Modal } from '../../shared/ui/Modal';
import { Icon } from '../../shared/ui/Icon';
import { shortcutGroups } from './model/shortcut-docs';

interface ShortcutHelpProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly platform: 'apple' | 'other';
}

/**
 * `?`-oversikten (F6): alle hurtigtaster gruppert, generert fra registeret (AK-1.1-07). Lukkes med Esc
 * (native) og `?` (dialogens egen tast; motoren er inaktiv bak modal).
 */
export function ShortcutHelp({ open, onClose, platform }: ShortcutHelpProps) {
  const headingId = useId();
  return (
    <Modal
      open={open}
      onClose={onClose}
      labelledBy={headingId}
      className="shortcut-help"
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

function ShortcutHelpBody({ headingId, platform }: { readonly headingId: string; readonly platform: 'apple' | 'other' }) {
  const groups = useMemo(() => shortcutGroups(platform), [platform]);
  return (
    <>
      <h2 id={headingId}>
        Hurtigtaster
        <button type="button" className="icon-btn" aria-label="Lukk" onClick={(event) => event.currentTarget.closest('dialog')?.close()}>
          <Icon name="close" />
        </button>
      </h2>
      <div className="shortcut-groups">
        {groups.map((group) => (
          <section key={group.group} className="shortcut-group" aria-labelledby={`${headingId}-${group.group}`}>
            <h3 id={`${headingId}-${group.group}`} className="label">
              {group.label}
            </h3>
            <ul>
              {group.rows.map((row) => (
                <li
                  key={row.id}
                  className={row.kind === 'hint' ? 'shortcut-row hint' : 'shortcut-row'}
                  data-testid={row.kind === 'hint' ? 'hurtigtast-tips' : 'hurtigtast-rad'}
                  data-command-id={row.kind === 'command' ? row.id : undefined}
                  data-hint-id={row.kind === 'hint' ? row.id : undefined}
                >
                  <span className="name" data-testid={row.kind === 'command' ? 'hurtigtast-navn' : undefined}>
                    {row.label}
                  </span>
                  <span className="bindings">
                    {row.chords.map((chords, i) => (
                      <span key={i} className="binding" data-testid={row.kind === 'command' ? 'hurtigtast-binding' : undefined}>
                        {i > 0 ? <span className="or">eller</span> : null}
                        {chords.map((chord, j) => (
                          <kbd key={j}>{chord}</kbd>
                        ))}
                      </span>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <p className="shortcut-foot">
        <kbd>Space</kbd> er leader: trykk og vent for å se fortsettelsene. Tastene virker ikke når du skriver i et felt.
      </p>
    </>
  );
}
