// 캐릭터 동작이 게임 화면에서 재생되는지 확인한다. 사용: node tools/shot-anim.mjs <출력 폴더>
// 캐릭터 주변만 잘라 숨쉬기 두 장, 이동 직후, 막힌 블록을 미는 순간을 한 줄로 이어 붙인다.
import { chromium } from 'playwright-core';
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

const base = process.env.E2E_URL ?? 'http://localhost:5183/';
const out = process.argv[2] ?? 'e2e-shots';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge' });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
const failed = [];
page.on('response', (r) => r.status() >= 400 && failed.push(`${r.status()} ${r.url()}`));

await page.goto(base + '?dev&go=play:1-1');
await page.waitForSelector('.play-screen canvas');
if (await page.locator('.rule-tag').count()) {
  await page.click('.modal [data-a=ok]');
  await page.waitForSelector('.backdrop', { state: 'detached' });
}
await page.waitForTimeout(1500);
const box = await page.locator('.board-wrap').boundingBox();
const clip = { x: box.x, y: box.y + box.height * 0.22, width: box.width, height: box.height * 0.56 };
const shots = [];
const snap = async () => shots.push(await page.screenshot({ clip }));

await snap(); // 숨쉬기
await page.waitForTimeout(600);
await snap(); // 숨쉬기의 다른 순간
for (const key of ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp']) {
  await page.keyboard.press(key);
  await page.waitForTimeout(70);
  await snap(); // 이동하거나 미는(또는 막힌) 순간
  await page.waitForTimeout(500);
}

const meta = await sharp(shots[0]).metadata();
const scale = 0.5;
const w = Math.round(meta.width * scale);
const h = Math.round(meta.height * scale);
const cols = 3;
const rows = Math.ceil(shots.length / cols);
const tiles = await Promise.all(shots.map((s) => sharp(s).resize(w, h).png().toBuffer()));
await sharp({ create: { width: w * cols, height: h * rows, channels: 4, background: '#000' } })
  .composite(tiles.map((input, i) => ({ input, left: (i % cols) * w, top: Math.floor(i / cols) * h })))
  .png()
  .toFile(`${out}/anim-strip.png`);
console.log('동작 시트 요청 실패:', failed.filter((f) => f.includes('/anim/')).join(', ') || '없음');
console.log('페이지 오류:', errors.join(' | ') || '없음');
await browser.close();
