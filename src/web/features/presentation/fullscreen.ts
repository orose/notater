// Fullskjerm (ADR-010 §4). Alltid på `document.documentElement` (ikke lerretet), slik at paletten, `?`-kortet,
// varselsonen og live-statusen fortsatt vises. Må kalles synkront i en brukergest (tast/klikk/palett-Enter);
// avvist eller ikke støttet ⇒ presentasjonen går videre i vinduet.

export type FullscreenOutcome = 'entered' | 'already' | 'denied' | 'unsupported';

type LockableKeyboard = { lock?: (keys?: readonly string[]) => Promise<void>; unlock?: () => void };

function keyboardOf(): LockableKeyboard | undefined {
  return (navigator as Navigator & { keyboard?: LockableKeyboard }).keyboard;
}

export async function enterPresentationFullscreen(doc: Document = document): Promise<FullscreenOutcome> {
  if (doc.fullscreenElement) return 'already';
  const root = doc.documentElement;
  if (!doc.fullscreenEnabled || typeof root.requestFullscreen !== 'function') return 'unsupported';
  try {
    await root.requestFullscreen({ navigationUI: 'hide' });
  } catch {
    return 'denied';
  }
  // Chromium: Esc leveres til siden (lukk oversikt før avslutt); brukeren holder Esc for å forlate fullskjerm.
  try {
    await keyboardOf()?.lock?.(['Escape']);
  } catch {
    // ikke støttet / ikke tillatt – Esc forlater da fullskjerm direkte (se ADR-010 §4)
  }
  return 'entered';
}

export async function exitPresentationFullscreen(doc: Document = document): Promise<void> {
  try {
    keyboardOf()?.unlock?.();
  } catch {
    // ignorer
  }
  if (!doc.fullscreenElement || typeof doc.exitFullscreen !== 'function') return;
  try {
    await doc.exitFullscreen();
  } catch {
    // allerede ute
  }
}
