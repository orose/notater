export interface WhichKeyItem {
  readonly chord: string;
  readonly hint: string;
  readonly name: string;
  readonly enabled: boolean;
  readonly reason: string | null;
}

/**
 * Which-key (F7): fortsettelsene etter leader, vist etter ~400 ms uten neste tast (AR-1.1-09).
 * Ikke en dialog: fokus blir der det var, neste tast kjøres. Esc eller klikk lukker.
 */
export function WhichKey({ leader, items }: { readonly leader: string; readonly items: readonly WhichKeyItem[] }) {
  return (
    <div className="which-key" data-testid="leader-hint" role="status" aria-label={`${leader} – fortsettelser`}>
      <span className="which-key-lead">
        <kbd>{leader}</kbd>
        <span aria-hidden="true">…</span>
      </span>
      <ul>
        {items.map((item) => (
          <li key={item.chord} className={item.enabled ? undefined : 'off'} title={item.enabled ? item.name : `${item.name}: ${item.reason ?? ''}`}>
            <kbd>{item.chord}</kbd>
            <span className="hint">{item.hint}</span>
            {item.enabled ? null : <span className="sr-only"> ({item.reason})</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
