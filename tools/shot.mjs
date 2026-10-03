// 개발 서버의 한 화면을 휴대폰 크기로 찍는다. 사용: node tools/shot.mjs "?go=play:1-3" out.png
import { chromium } from 'playwright-core';

const [query = '', out = 'shot.png'] = process.argv.slice(2);
const browser = await chromium.launch({ channel: 'msedge' });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
page.on('pageerror', (e) => console.error('page error:', String(e)));
await page.goto((process.env.E2E_URL ?? 'http://localhost:5183/') + query);
const t0 = Date.now();
await page.waitForSelector('#app .screen', { timeout: 20000 });
console.log(`첫 화면까지 ${Date.now() - t0}ms`);
await page.waitForTimeout(1000);
await page.screenshot({ path: out });
await browser.close();
