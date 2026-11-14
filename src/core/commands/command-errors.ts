// Feiltekstene på kommandolinjen (AR-3-24): samme tekster og koder i web-paletten og terminalens `:`-linje.

import type { ArgumentError } from './command-types';

function listLevels(levels: readonly number[]): string {
  const names = levels.map((l) => `h${l}`);
  return names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} og ${names[names.length - 1]}`;
}

export function levelsSentence(levels: readonly number[]): string {
  return levels.length === 0 ? 'Notatet har ingen overskrifter.' : `Notatet har overskrifter på nivå ${listLevels(levels)}.`;
}

/** S4 / PO-101: E475 = ugyldig argument, E486 = nivået finnes ikke i notatet. */
export function presentLevelError(input: string, validLevels: readonly number[]): ArgumentError | null {
  const value = input.trim().toLowerCase();
  if (value === '' || value === 'auto') return null;
  const m = /^h([1-6])$/.exec(value);
  if (!m) {
    return {
      code: 'E475',
      title: `Ugyldig nivå «${input.trim()}».`,
      detail: `Skriv auto eller h1–h6, f.eks. :presenter h3. ${levelsSentence(validLevels)}`,
    };
  }
  if (validLevels.includes(Number(m[1]))) return null;
  return {
    code: 'E486',
    title: `Ingen overskrifter på nivå ${value} i notatet.`,
    detail: `Lysbildene blir ikke delt annerledes. ${validLevels.length > 0 ? `Gyldige nivåer: ${listLevels(validLevels)}.` : levelsSentence(validLevels)} Valget er ikke lagret.`,
  };
}

/** Generell E475 når argumentet ikke er en av verdiene. */
export function invalidArgumentError(argument: string): ArgumentError {
  return { code: 'E475', title: `Ugyldig argument «${argument}».`, detail: 'Slett litt og velg en av verdiene.' };
}

/** E492: ingen kommando heter det som er skrevet. */
export function unknownCommandError(input: string): ArgumentError {
  return { code: 'E492', title: `Ingen kommando heter «${input}».`, detail: 'Prøv :hjelp, eller tøm linjen for å se alle.' };
}
