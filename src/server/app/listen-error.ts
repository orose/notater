/** Forståelige norske meldinger når serveren ikke får lytte på porten (i stedet for en stakk). */

/** Foreslått alternativ port i meldingen. */
const SUGGESTED_PORT = 4400;

/** Norsk melding for kjente lyttefeil; `null` for andre feil (de kastes videre med stakk). */
export function describeListenError(error: unknown, host: string, port: number): string | null {
  const code = typeof error === 'object' && error !== null ? (error as NodeJS.ErrnoException).code : undefined;
  const alternative = port === SUGGESTED_PORT ? SUGGESTED_PORT + 1 : SUGGESTED_PORT;
  const hint = `npm start -- --port ${alternative}`;
  if (code === 'EADDRINUSE') {
    return `Porten ${port} på ${host} er allerede i bruk (kjører leseren allerede?). Stopp den andre prosessen, eller velg en annen port: ${hint}`;
  }
  if (code === 'EACCES') {
    return `Mangler tilgang til port ${port} på ${host}. Velg en port over 1024: ${hint}`;
  }
  return null;
}
