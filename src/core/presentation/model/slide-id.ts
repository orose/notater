// Stabile lysbilde-id-er (ADR-010 §4). Ren TS.
//
// Grammatikk (alle deler er URL-trygge; `.` forekommer aldri i en slug fra github-slugger):
//   tittel | agenda | innledning                      faste lysbilder
//   overgang.<agendanøkkel>                           overgang (L3)
//   <nøkkel>                                          innhold: agendapunktets innledning/eneste lysbilde, eller underoverskriften
//   <id>.del<k>   (k ≥ 2)                             del k etter `---` (S5)
//   <id>.forts<m> (m ≥ 2)                             fortsettelse etter automatisk tilpasning (A2)
//
// Nøkler er slug av overskriftsteksten (ikke disposisjonens id: `~e<n>-<i>` er posisjonell og endres når et
// embed legges til foran). Slugger-en er forhåndsmatet med de faste id-ene, så en overskrift «Agenda» blir `agenda-1`.

export const TITLE_SLIDE_ID = 'tittel';
export const AGENDA_SLIDE_ID = 'agenda';
export const PREAMBLE_SLIDE_ID = 'innledning';
export const TRANSITION_PREFIX = 'overgang';

/** Id-er som må forhåndsmates i slugger-en, så ingen overskrift får dem. */
export const RESERVED_SLIDE_KEYS: readonly string[] = [TITLE_SLIDE_ID, AGENDA_SLIDE_ID, PREAMBLE_SLIDE_ID, TRANSITION_PREFIX];

export interface ParsedSlideId {
  /** Id uten `.del`/`.forts`. */
  readonly base: string;
  /** 1-basert del (S5). */
  readonly part: number;
  /** 1-basert fortsettelse (A2). */
  readonly continuation: number;
}

export function transitionSlideId(agendaKey: string): string {
  return `${TRANSITION_PREFIX}.${agendaKey}`;
}

/** `base` + del + fortsettelse; 1 utelates. */
export function formatSlideId(base: string, part = 1, continuation = 1): string {
  return `${base}${part > 1 ? `.del${part}` : ''}${continuation > 1 ? `.forts${continuation}` : ''}`;
}

const SUFFIX = /^(.*?)(?:\.del([2-9]|[1-9]\d+))?(?:\.forts([2-9]|[1-9]\d+))?$/;

/** Inversen av `formatSlideId`. Ugyldige suffiks blir stående i `base`. */
export function parseSlideId(id: string): ParsedSlideId {
  const m = SUFFIX.exec(id);
  if (!m) return { base: id, part: 1, continuation: 1 };
  return { base: m[1] ?? id, part: m[2] ? Number(m[2]) : 1, continuation: m[3] ? Number(m[3]) : 1 };
}
