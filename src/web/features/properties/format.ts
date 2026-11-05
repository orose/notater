// Norsk formatering av verdier (designsystem §7.2: «3. nov. 2026», «14.02»).

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})/;

function dateFormatter(timeZone?: string) {
  return new Intl.DateTimeFormat('nb-NO', { day: 'numeric', month: 'short', year: 'numeric', timeZone });
}

function timeText(date: Date, timeZone?: string): string {
  const parts = new Intl.DateTimeFormat('nb-NO', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone }).formatToParts(date);
  const hour = parts.find((p) => p.type === 'hour')?.value ?? '00';
  const minute = parts.find((p) => p.type === 'minute')?.value ?? '00';
  return `${hour}.${minute}`;
}

export function formatDate(iso: string, hasTime: boolean, timeZone?: string): string {
  if (!hasTime) {
    const m = DATE_ONLY.exec(iso);
    if (!m) return iso;
    const date = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
    return dateFormatter('UTC').format(date);
  }
  return formatDateTime(iso, timeZone);
}

export function formatDateTime(iso: string, timeZone?: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return `${dateFormatter(timeZone).format(date)}, ${timeText(date, timeZone)}`;
}

export type StatusKind = 'todo' | 'doing' | 'done';

const DONE = /^(done|ferdig|fullført|fullfort|aktiv|active|closed|lukket|ok|godkjent|completed?)$/i;
const DOING = /^(doing|pågår|pagar|i gang|igang|in[- ]?progress|progress|wip|review|under arbeid)$/i;

export function statusKind(value: string): StatusKind {
  const v = value.trim();
  if (DONE.test(v)) return 'done';
  if (DOING.test(v)) return 'doing';
  return 'todo';
}
