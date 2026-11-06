import { useViewSettings } from './use-view-settings';

/**
 * Statuslinjeflagg for aktive visningsvalg (designsystem §11.3): `[full]` i sidepanelets bunn, som en knapp
 * som bytter tilbake. Leseoptimalisert er standard og har ikke noe flagg. (Ikke i mobil-topplinjen, PO-67.)
 */
export function ViewFlags() {
  const { width, setWidth } = useViewSettings();
  if (width !== 'full') return null;
  return (
    <div className="flags" aria-label="Aktive visningsvalg" role="group">
      <button type="button" className="flag" title="Full bredde er på – Space w bytter" onClick={() => setWidth('readable')}>
        full
      </button>
    </div>
  );
}
