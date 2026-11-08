import { useViewSettings } from './use-view-settings';

/**
 * Statuslinjeflagg for aktive visningsvalg (designsystem §11.3/§11.4): `[full]` og `[diskré]` (bare på notatet
 * det gjelder) i sidepanelets bunn, som knapper som bytter tilbake. Leseoptimalisert er standard og har ikke noe flagg. (Ikke i mobil-topplinjen, PO-67.)
 */
export function ViewFlags({ discreet }: { readonly discreet?: { readonly on: boolean; readonly onToggle: () => void } }) {
  const { width, setWidth } = useViewSettings();
  const full = width === 'full';
  if (!full && !discreet?.on) return null;
  return (
    <div className="flags" aria-label="Aktive visningsvalg" role="group">
      {full ? (
        <button type="button" className="flag" title="Full bredde er på – Space w bytter" onClick={() => setWidth('readable')}>
          full
        </button>
      ) : null}
      {discreet?.on ? (
        <button type="button" className="flag" title="Diskré embedding er på for dette notatet – Space d bytter" onClick={discreet.onToggle}>
          diskré
        </button>
      ) : null}
    </div>
  );
}
