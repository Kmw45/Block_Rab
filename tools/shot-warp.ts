// 순간이동 직후에 블록이 사라지지 않는지 확인한다. 사용: npx tsx tools/shot-warp.ts <출력 png>
// 마법진을 타는 수가 있는 첫 스테이지를 찾아, 순간이동 직전·직후·정착 후를 한 줄로 이어 붙인다.
import { chromium } from 'playwright-core';
import sharp from 'sharp';
import { DIR_CHARS, Dir, initialState, parseLevel, step } from '../src/core/board';
import levels from '../src/data/levels.json';

const KEY: Record<string, string> = { U: 'ArrowUp', R: 'ArrowRight', D: 'ArrowDown', L: 'ArrowLeft' };
let target: { id: string; solution: string; at: number } | null = null;
for (const lv of levels) {
  const def = parseLevel(lv.rows);
  let s = initialState(def);
  for (let i = 0; i < lv.solution.length && !target; i++) {
    const r = step(def, s, DIR_CHARS.indexOf(lv.solution[i]) as Dir);
    if (r.teleported && def.kinds.length >= 3) target = { id: lv.id, solution: lv.solution, at: i };
    s = r.state;
  }
  if (target) break;
}
if (!target) throw new Error('순간이동이 있는 스테이지를 찾지 못함');
console.log(`스테이지 ${target.id}, ${target.at + 1}번째 수에서 순간이동`);

const browser = await chromium.launch({ channel: 'msedge' });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await page.goto((process.env.E2E_URL ?? 'http://localhost:5183/') + `?dev&go=play:${target.id}`);
await page.waitForSelector('.play-screen canvas');
if (await page.locator('.rule-tag').count()) {
  await page.click('.modal [data-a=ok]');
  await page.waitForSelector('.backdrop', { state: 'detached' });
}
await page.waitForTimeout(1200);
for (const ch of target.solution.slice(0, target.at)) {
  await page.keyboard.press(KEY[ch]);
  await page.waitForTimeout(260);
}
const box = (await page.locator('.board-wrap').boundingBox())!;
const clip = { x: box.x, y: box.y + box.height * 0.2, width: box.width, height: box.height * 0.6 };
const shots: Buffer[] = [];
shots.push(await page.screenshot({ clip }));
await page.keyboard.press(KEY[target.solution[target.at]]);
for (const wait of [200, 60, 60, 400]) {
  await page.waitForTimeout(wait);
  shots.push(await page.screenshot({ clip }));
}
const meta = await sharp(shots[0]).metadata();
const w = Math.round(meta.width! * 0.42);
const h = Math.round(meta.height! * 0.42);
const tiles = await Promise.all(shots.map((s) => sharp(s).resize(w, h).png().toBuffer()));
await sharp({ create: { width: w * tiles.length, height: h, channels: 4, background: '#000' } })
  .composite(tiles.map((input, i) => ({ input, left: i * w, top: 0 })))
  .png()
  .toFile(process.argv[2] ?? 'warp.png');
await browser.close();
