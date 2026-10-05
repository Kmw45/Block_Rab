// 지금 게임의 화면을 한 번에 찍는다(화면 시안의 참조용). 개발 서버가 5183 포트에 떠 있어야 한다.
// 사용: node tools/shot-screens.mjs [결과 폴더]   결과: <폴더>/title.png, story.png, select.png, play.png, clear.png, cosmetics.png, settings.png
import { chromium } from 'playwright-core';
import { readFileSync, mkdirSync } from 'node:fs';

const BASE = process.env.E2E_URL ?? 'http://localhost:5183/';
const out = process.argv[2] ?? 'art/concepts/screens/current';
mkdirSync(out, { recursive: true });
const levels = JSON.parse(readFileSync(new URL('../src/data/levels.json', import.meta.url), 'utf8'));
const KEY = { U: 'ArrowUp', R: 'ArrowRight', D: 'ArrowDown', L: 'ArrowLeft' };

const browser = await chromium.launch({ channel: 'msedge' });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
page.on('pageerror', (e) => console.error('page error:', String(e)));
const shot = async (name) => {
  await page.screenshot({ path: `${out}/${name}.png` });
  console.log('찍음: ' + name);
};
const dismissRule = async () => {
  await page.waitForTimeout(300);
  if (!(await page.locator('.rule-tag').count())) return;
  await page.click('.modal [data-a=ok]');
  await page.waitForSelector('.backdrop', { state: 'detached' });
};

// 진행 기록이 조금 있는 상태로 찍는다: 던전 1을 다 깨고 던전 2를 하는 중
await page.goto(BASE);
await page.evaluate((ids) => {
  const key = 'block-labyrinth-save';
  const save = JSON.parse(localStorage.getItem(key) ?? '{}');
  save.stars = Object.fromEntries(ids.map((id, i) => [id, i % 3 === 1 ? 2 : 3]));
  save.tutorial = 4;
  save.story = true;
  save.gold = 1480;
  save.lastLevel = '2-5';
  localStorage.setItem(key, JSON.stringify(save));
}, levels.slice(0, 16).map((l) => l.id));

await page.goto(BASE);
await page.waitForSelector('.title-screen');
await page.waitForTimeout(1500);
await shot('title');

await page.click('[data-a=settings]');
await page.waitForSelector('.setting');
await page.waitForTimeout(400);
await shot('settings');

await page.goto(BASE + '?go=story');
await page.waitForSelector('.story-screen');
await page.waitForTimeout(1200);
await shot('story');

await page.goto(BASE + '?go=select');
await page.waitForSelector('.select-screen');
await page.evaluate(() => document.querySelector('.world-list').scrollTo(0, 0));
await page.waitForTimeout(1000);
await shot('select');

const lv = levels.find((l) => l.id === '2-5');
await page.goto(BASE + '?go=play:2-5');
await page.waitForSelector('.play-screen canvas');
await dismissRule();
for (const ch of lv.solution.slice(0, 4)) {
  await page.keyboard.press(KEY[ch]);
  await page.waitForTimeout(260);
}
await page.waitForTimeout(600);
await shot('play');

for (const ch of lv.solution.slice(4)) {
  await page.keyboard.press(KEY[ch]);
  await page.waitForTimeout(40);
}
await page.waitForSelector('.clear-title', { timeout: 8000 });
await page.waitForTimeout(1800);
await shot('clear');

await page.goto(BASE + '?go=cosmetics&gold=1480');
await page.waitForSelector('.cosmetics-screen');
await page.waitForTimeout(1200);
await shot('cosmetics');

await browser.close();
