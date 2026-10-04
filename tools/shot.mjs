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
// 규칙 카드가 떠 있으면 닫고 찍는다
if (await page.locator('.rule-tag').count()) {
  await page.click('.modal [data-a=ok]');
  await page.waitForSelector('.backdrop', { state: 'detached' });
}
// 세 번째 인자로 bottom을 주면 스테이지 목록을 끝까지 내린 뒤 찍는다
if (process.argv[4] === 'bottom') await page.evaluate(() => document.querySelector('.world-list')?.scrollTo(0, 1e6));
await page.waitForTimeout(1000);
await page.screenshot({ path: out });
await browser.close();
