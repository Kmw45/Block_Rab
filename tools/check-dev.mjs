// 개발자 모드 주소가 동작하는지 확인한다. 사용: node tools/check-dev.mjs <기본 주소> [스크린샷 경로]
import { chromium } from 'playwright-core';

const base = process.argv[2] ?? 'http://localhost:5183/';
const browser = await chromium.launch({ channel: 'msedge' });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
page.on('pageerror', (e) => console.log('페이지 오류:', String(e)));

await page.goto(base + '?dev');
await page.waitForSelector('.select-screen', { timeout: 20000 });
console.log(`?dev: 스테이지 ${await page.locator('.stage').count()}개, 잠긴 칸 ${await page.locator('.stage.locked').count()}개, 안내 띠 ${await page.locator('.dev-banner').count()}개`);
if (process.argv[3]) await page.screenshot({ path: process.argv[3] });

// 마지막 월드의 스테이지를 눌러 바로 들어가지는지
await page.locator('.stage[data-id="5-6"]').click();
await page.waitForSelector('.play-screen');
console.log('목록에서 5-6 진입:', await page.textContent('.stage-title b'));

await page.goto(base + '?dev&go=play:3-4');
await page.waitForSelector('.play-screen');
console.log('?dev&go=play:3-4 진입:', await page.textContent('.stage-title b'));

// 일반 주소는 그대로 잠겨 있어야 한다
await page.goto(base);
await page.waitForSelector('.title-screen');
console.log('일반 주소: 타이틀 화면으로 시작, 일반 저장 기록', await page.evaluate(() => localStorage.getItem('block-labyrinth-save') === null ? '없음(건드리지 않음)' : '있음'));
await browser.close();
