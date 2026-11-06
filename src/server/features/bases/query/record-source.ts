import type { VaultValue } from '../../../../shared/api-types';
import type { FileSubject, LinkValue } from '../expression/values';

/** En rad-kandidat: en fil i vaultet, sett gjennom uttrykksspråket, pluss visningsverdier. */
export interface BaseRecord extends FileSubject {
  /** Note-property typet for visning (api.md «Delte verdityper»), lenker oppløst. */
  displayProperty(key: string): VaultValue;
}

/** RecordSource (ADR-003): det Bases trenger av indeksen. Bases avhenger ikke av indeks-implementasjonen (DIP). */
export interface RecordSource {
  /** Alle filer i vaultet, i stabil rekkefølge. */
  records(): readonly BaseRecord[];
  record(filePath: string): BaseRecord | null;
  /** Løser lenketekst (`Kunde`, `[[Kunde|K]]`, `domene/Kunde.md`) relativt til en fil. */
  resolveLink(text: string, from: FileSubject): LinkValue;
}
