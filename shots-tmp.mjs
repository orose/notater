import { chromium } from '@playwright/test';
const OUT = '/tmp/claude-0/-home-user-notater/42d2d3a4-f504-5d51-84b3-820da0930dd8/scratchpad/v2fe';
const note = 'presentasjon/Statusmøte uke 45';
const shots = [
  ['01-tittel', 'tittel'], ['02-agenda', 'agenda'], ['03-overgang', 'overgang.jobbes-med-nå'],
  ['04-innhold-kode', 'leveranse-b--tastaturmotor'], ['07-kanban', 'oppgaver'], ['13-oversikt', 'oppgaver', 'o'],
  ['05-mermaid', 'flyt-i-presentasjonen'], ['06-tabell-fotnote', 'plan-q1'],
];
const themes = [['tidsskrift', 'papir', 'light'], ['terminal', 'fosfor', 'dark']];
const b = await chromium.launch();
for (const [type, palette, mode] of themes) {
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  await p.emulateMedia({ reducedMotion: 'reduce', colorScheme: mode });
  p.on('pageerror', (e) => console.log('PAGEERR', e.message));
  for (const [name, id, key] of shots) {
    await p.goto(`http://127.0.0.1:4731/v/test/${encodeURIComponent(note)}?type=${type}&palette=${palette}&mode=${mode}&lysbilde=${encodeURIComponent(id)}`);
    await p.waitForSelector('[data-testid="lysbilde"]:not([hidden])', { timeout: 10000 });
    await p.evaluate(() => document.querySelectorAll('.notice-zone .toast button').forEach((b) => b.click()));
    if (key) { await p.keyboard.press(key); await p.waitForSelector('dialog.overview[open]'); }
    await p.waitForTimeout(1500);
    await p.screenshot({ path: `${OUT}/${name}-${type}-${palette}-${mode}.png` });
  }
  await p.close();
}
await b.close();
