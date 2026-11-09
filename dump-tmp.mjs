import { chromium } from '@playwright/test';
const [,, note, w='1440', h='900'] = process.argv;
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: +w, height: +h } });
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text()); });
p.on('pageerror', (e) => console.log('PAGEERR', e.message));
await p.goto(`http://127.0.0.1:4731/v/test/${encodeURIComponent(note)}?lysbilde=tittel`);
await p.waitForSelector('[data-testid="lysbilde"]:not([hidden])', { timeout: 10000 });
await p.waitForTimeout(500);
const n = await p.evaluate(() => document.querySelector('[data-testid="lysbildenummer"]').textContent);
console.log('nummer', n);
const total = +n.split('/')[1];
for (let i = 0; i < total; i++) {
  const info = await p.evaluate(() => { const el = [...document.querySelectorAll('[data-testid="lysbilde"]')].find(e => !e.hidden); const body = el.querySelector('[data-testid="lysbilde-innhold"]'); return `${el.dataset.slideIndex} ${el.dataset.slideId} ${el.dataset.slideType} fit=${el.style.getPropertyValue('--slide-fit')} ${body ? body.scrollHeight + '/' + body.clientHeight : ''}`; });
  console.log(info);
  await p.keyboard.press('j');
  await p.waitForTimeout(50);
}
if (process.argv[5]) await p.screenshot({ path: process.argv[5] });
await b.close();
