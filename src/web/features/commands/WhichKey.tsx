export interface WhichKeyItem {
  readonly chord: string;
  readonly hint: string;
  readonly name: string;
  /** Nå-tilstand («full», «av»), vist dempet til høyre. */
  readonly state: string | null;
  readonly enabled: boolean;
  readonly reason: string | null;
}

/**
 * Which-key (F7, designsystem §11.8): fortsettelsene etter leder, vist etter `--leader-delay` uten neste
 * tast (AR-1.1-09). Ikke en dialog: fokus blir der det var, og neste tast kjøres. Esc eller klikk lukker.
 */
export function WhichKey({ leader, items }: { readonly leader: string; readonly items: readonly WhichKeyItem[] }) {
  return (
    <div className="whichkey" data-testid="leader-hint" role="status" aria-live="polite" aria-label={`${leader}: leder`}>
      <div className="wk-head">
        <kbd className="k lead">{leader}</kbd>
        <span className="label">leder</span>
        <span className="esc">Esc avbryter</span>
      </div>
      <ul className="wk-grid">
        {items.map((item) => (
          <li key={item.chord} className={item.enabled ? undefined : 'off'} title={item.enabled ? item.name : `${item.name}: ${item.reason ?? ''}`}>
            <kbd className="k">{item.chord}</kbd>
            <span className="arrow" aria-hidden="true">
              →
            </span>
            <span>{item.hint}</span>
            {item.enabled ? null : <span className="sr-only"> ({item.reason})</span>}
            {item.state ? <span className="wk-st">{item.state}</span> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
