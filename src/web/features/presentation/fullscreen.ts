// Fullskjerm (ADR-010 §4, PO-88, PO-92). Alltid på `document.documentElement` (ikke lerretet), slik at paletten,
// `?`-kortet, varselsonen og live-statusen fortsatt vises. Må kalles synkront i en brukergest (tast/klikk/palett-Enter);
// avvist eller ikke støttet ⇒ presentasjonen går videre i vinduet.
//
// PO-92: ingen Keyboard Lock. Nettleseren tar første Esc og går ut av fullskjerm; presentasjonen fortsetter (toast
// «Esc igjen avslutter»). Det er samme oppførsel i alle nettlesere, og delt vindu i Teams virker.

export type FullscreenOutcome = 'entered' | 'already' | 'denied' | 'unsupported';

export function isPresentationFullscreen(doc: Document = document): boolean {
  return doc.fullscreenElement !== null && doc.fullscreenElement !== undefined;
}

export async function enterPresentationFullscreen(doc: Document = document): Promise<FullscreenOutcome> {
  if (isPresentationFullscreen(doc)) return 'already';
  const root = doc.documentElement;
  if (!doc.fullscreenEnabled || typeof root.requestFullscreen !== 'function') return 'unsupported';
  try {
    // Kallet skjer synkront (før første await) – innenfor brukergesten.
    await root.requestFullscreen({ navigationUI: 'hide' });
  } catch {
    return 'denied';
  }
  return 'entered';
}

export async function exitPresentationFullscreen(doc: Document = document): Promise<void> {
  if (!isPresentationFullscreen(doc) || typeof doc.exitFullscreen !== 'function') return;
  try {
    await doc.exitFullscreen();
  } catch {
    // allerede ute
  }
}
