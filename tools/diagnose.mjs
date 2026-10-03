// 페이지를 열어 오류, 실패한 요청, 끝나지 않은 요청을 출력한다. 사용: node tools/diagnose.mjs <url>
import { chromium } from 'playwright-core';

const url = process.argv[2] ?? 'http://localhost:5183/';
const browser = await chromium.launch({ channel: 'msedge' });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const pending = new Set();
page.on('pageerror', (e) => console.log('페이지 오류:', String(e)));
page.on('console', (m) => m.type() === 'error' && console.log('콘솔 오류:', m.text()));
page.on('request', (r) => pending.add(r.url()));
page.on('requestfinished', (r) => pending.delete(r.url()));
page.on('requestfailed', (r) => {
  pending.delete(r.url());
  console.log('요청 실패:', r.url(), r.failure()?.errorText);
});
page.on('response', (r) => r.status() >= 400 && console.log('응답', r.status(), r.url()));
await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(8000);
console.log('첫 화면:', (await page.locator('#app .screen').count()) ? '있음' : '없음');
console.log('끝나지 않은 요청:', [...pending].join('\n  ') || '없음');
await browser.close();
