import './theme.css';
import { useId } from 'react';
import { Icon } from '../../shared/ui/Icon';
import { Modal } from '../../shared/ui/Modal';
import { PALETTES, PALETTE_INFO, TYPES, TYPE_INFO, type ThemeModePreference, type ThemeType } from './theme-state';
import { useTheme } from './use-theme';
import { modifierLabel } from '../../shared/ui/shortcuts';

const MODE_LABELS: ReadonlyArray<readonly [ThemeModePreference, string]> = [
  ['light', 'Lys'],
  ['dark', 'Mørk'],
  ['system', 'System'],
];

const TYPE_OPTIONS: ReadonlyArray<{ readonly id: ThemeType; readonly name: string; readonly desc: string }> = TYPES.map((id) => ({
  id,
  name: TYPE_INFO[id].name,
  desc: TYPE_INFO[id].description,
}));

interface ThemePickerProps {
  readonly open: boolean;
  readonly onClose: () => void;
  /** Åpner hurtigtastoversikten (F6). Dialogen lukkes først, så modalene ikke stables. */
  readonly onOpenShortcuts?: () => void;
}

export function ThemePicker({ open, onClose, onOpenShortcuts }: ThemePickerProps) {
  const headingId = useId();
  return (
    <Modal open={open} onClose={onClose} labelledBy={headingId} className="theme-panel">
      <ThemePickerBody headingId={headingId} onOpenShortcuts={onOpenShortcuts} />
    </Modal>
  );
}

function ThemePickerBody({ headingId, onOpenShortcuts }: { readonly headingId: string; readonly onOpenShortcuts?: (() => void) | undefined }) {
  const { preferences, resolvedMode, setPreferences } = useTheme();
  const name = useId();

  return (
    <>
      <h2 id={headingId}>
        Utseende
        <button
          type="button"
          className="icon-btn"
          aria-label="Lukk"
          onClick={(event) => event.currentTarget.closest('dialog')?.close()}
        >
          <Icon name="close" />
        </button>
      </h2>
      <form method="dialog" onSubmit={(event) => event.preventDefault()}>
        <fieldset>
          <legend className="label">Modus</legend>
          <div className="seg">
            {MODE_LABELS.map(([value, label]) => (
              <label key={value}>
                <input
                  type="radio"
                  name={`${name}-mode`}
                  value={value}
                  checked={preferences.mode === value}
                  onChange={() => setPreferences({ mode: value })}
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="label">Typografi</legend>
          <div className="opts opts-3">
            {TYPE_OPTIONS.map((option) => (
              <label key={option.id} className="opt">
                <input
                  type="radio"
                  name={`${name}-type`}
                  value={option.id}
                  checked={preferences.type === option.id}
                  onChange={() => setPreferences({ type: option.id })}
                />
                <span className={`specimen specimen-${option.id}`} aria-hidden="true">
                  {option.id === 'tidsskrift' ? (
                    <>
                      Aa<i>g</i>
                    </>
                  ) : option.id === 'terminal' ? (
                    <>
                      Aa<span className="specimen-mono">-&gt;</span>
                    </>
                  ) : (
                    'Il1'
                  )}
                </span>
                <span className="name">{option.name}</span>
                <span className="desc">{option.desc}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="label">Palett</legend>
          <div className="opts">
            {PALETTES.map((id) => {
              const info = PALETTE_INFO[id];
              const swatch = info[resolvedMode];
              return (
                <label key={id} className="opt">
                  <input
                    type="radio"
                    name={`${name}-palette`}
                    value={id}
                    checked={preferences.palette === id}
                    onChange={() => setPreferences({ palette: id })}
                  />
                  <span className="swatch" aria-hidden="true">
                    <i style={{ background: swatch.bg }} />
                    <i style={{ background: swatch.text }} />
                    <i style={{ background: swatch.accent }} />
                    <i style={{ background: swatch.accent2 }} />
                  </span>
                  <span className="name">{info.name}</span>
                  {info.recommendedFor === preferences.type ? (
                    <span className="rec">Anbefalt</span>
                  ) : (
                    <span className="desc">{info.description}</span>
                  )}
                </label>
              );
            })}
          </div>
        </fieldset>

        <label className="switch-row">
          <span>
            <span className="name">Ornamentikk</span>
            <span className="desc">Initial og seksjonsnummer i Tidsskrift</span>
          </span>
          <input
            type="checkbox"
            role="switch"
            className="switch"
            checked={preferences.ornaments}
            onChange={(event) => setPreferences({ ornaments: event.target.checked })}
          />
        </label>

        <p className="theme-hint">
          Valget lagres i denne nettleseren. <kbd>{modifierLabel()}</kbd> <kbd>.</kbd> eller <kbd>Space</kbd> <kbd>m</kbd>{' '}
          bytter lys/mørk.
        </p>
        {onOpenShortcuts ? (
          <button
            type="button"
            className="btn theme-shortcuts"
            onClick={(event) => {
              event.currentTarget.closest('dialog')?.close();
              requestAnimationFrame(() => onOpenShortcuts());
            }}
          >
            Hurtigtaster
          </button>
        ) : null}
      </form>
    </>
  );
}
