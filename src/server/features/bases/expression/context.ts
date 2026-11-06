import type { FileSubject, LinkValue, Value } from './values';

/** Alt en evaluering trenger utenfra. Implementeres av query-laget; evaluatoren gjør ingen I/O. */
export interface EvalContext {
  /** Raden (filen) som evalueres. */
  readonly file: FileSubject;
  /** `this`: filen som viser basen (vertsnotatet for ```base-blokker), hvis kjent. */
  readonly thisFile: FileSubject | null;
  /** `formula.<navn>`; syklusvern håndteres av implementasjonen. */
  formula(name: string): Value;
  /** Løser lenketekst (`"Kunde"`, `"[[Kunde]]"`, `"domene/Kunde.md"`) relativt til en fil. */
  resolveLink(text: string, from: FileSubject): LinkValue;
  /** Nåtid i ms (injiseres for deterministiske tester). */
  nowMs(): number;
}
