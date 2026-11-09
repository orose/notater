import { chromium } from '@playwright/test';
const [,, note, id, expr] = process.argv;
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
await p.goto(`http://127.0.0.1:4731/v/test/${encodeURIComponent(note)}?lysbilde=${encodeURIComponent(id)}`);
await p.waitForSelector('[data-testid="lysbilde"]:not([hidden])', { timeout: 10000 });
await p.waitForTimeout(800);
console.log(await p.evaluate(expr));
await b.close();
