const pad = (n: number) => String(n).padStart(2, '0');

/** QA B10: `dd.MM.yyyy` / `dd.MM.yyyy HH:mm` i lokal tid. */
export function formatBaseDate(iso: string, hasTime: boolean): string {
  if (!hasTime) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
    return m ? `${m[3]}.${m[2]}.${m[1]}` : iso;
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
