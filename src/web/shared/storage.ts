// Generisk primitiv (ADR-008): `localStorage` kan kaste (privat modus, blokkert lagring). Da gjelder
// valgene bare økten, uten feilmelding. Brukes av `theme` og `view-settings`.

export function safeLocalStorage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}
