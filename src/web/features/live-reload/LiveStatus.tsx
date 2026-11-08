import { useContext } from 'react';
import { LiveContext } from './live-context';

function clock(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}.${String(date.getMinutes()).padStart(2, '0')}`;
}

/** «● Synkronisert 14.02» / «Frakoblet – prøver igjen» (designsystem §7.1, §7.13). */
export function LiveStatus() {
  const { status, lastSync, pulse } = useContext(LiveContext);
  const text =
    status === 'offline'
      ? 'Frakoblet – prøver igjen'
      : status === 'connecting' || !lastSync
        ? 'Kobler til …'
        : `Synkronisert ${clock(lastSync)}`;
  return (
    <span
      className="live"
      role="status"
      data-state={status}
      key={pulse}
      data-pulse={pulse > 0 ? 'true' : undefined}
      title="Live-oppdatering fra vaultet"
    >
      {text}
    </span>
  );
}
