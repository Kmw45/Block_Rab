// 실제 브라우저에서 게임을 처음부터 끝까지 돌려 보는 점검 스크립트.
// 사용: 개발 서버(npm run dev -- --port 5183)를 띄운 뒤 node tools/e2e.mjs [스크린샷 폴더]
import { chromium } from 'playwright-core';
import { readFileSync, mkdirSync } from 'node:fs';

const BASE = process.env.E2E_URL ?? 'http://localhost:5183/';
const shotDir = process.argv[2] ?? 'e2e-shots';
mkdirSync(shotDir, { recursive: true });
const levels = JSON.parse(readFileSync(new URL('../src/data/levels.json', import.meta.url), 'utf8'));
const KEY = { U: 'ArrowUp', R: 'ArrowRight', D: 'ArrowDown', L: 'ArrowLeft' };

const browser = await chromium.launch({ channel: 'msedge' });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
const shot = (name) => page.screenshot({ path: `${shotDir}/${name}.png` });
const check = (cond, msg) => {
  if (!cond) throw new Error('점검 실패: ' + msg);
  console.log('통과: ' + msg);
};

// 새 블록이나 기믹이 처음 나오면 뜨는 규칙 카드를 닫는다
let ruleCards = 0;
const dismissRule = async (shotName) => {
  await page.waitForTimeout(250);
  if (!(await page.locator('.rule-tag').count())) return;
  ruleCards += await page.locator('.rule').count();
  if (shotName) await shot(shotName);
  await page.click('.modal [data-a=ok]');
  await page.waitForSelector('.backdrop', { state: 'detached' });
};

await page.goto(BASE);
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForSelector('.title-screen');
await page.waitForTimeout(600);
await shot('01-title');
check((await page.evaluate(() => document.documentElement.scrollWidth)) <= 390, '타이틀이 화면 폭을 넘지 않는다');

// 처음 시작하면 도입 이야기 3장을 본 뒤 튜토리얼 4단계를 차례로 한다
await page.click('[data-a=start]');
await page.waitForSelector('.story-screen');
for (let i = 0; i < 3; i++) {
  await page.waitForTimeout(500);
  check((await page.textContent('.story-text')).trim().length > 0 && (await page.locator('.story-pic').count()) === 1, `도입 이야기 ${i + 1}장에 그림과 글이 있다`);
  await shot('01b-story-' + (i + 1));
  await page.click('.story-screen [data-a=next]');
}
check(await page.evaluate(() => JSON.parse(localStorage.getItem('block-labyrinth-save')).story), '도입 이야기를 본 것이 저장된다');
const TUT = ['RRDDLL', 'RRRDDL', 'DDRRDR', 'DDRRRD'];
for (let i = 0; i < TUT.length; i++) {
  await page.waitForSelector('.play-screen.tutorial');
  await page.waitForTimeout(700);
  const tipText = await page.textContent('.tip p');
  if (!tipText.trim()) throw new Error(`튜토리얼 ${i + 1}: 안내 문구가 비어 있음`);
  if (i === 0) check(await page.locator('.hand').isVisible(), '튜토리얼 1에 손 안내가 보인다');
  if (i === 1) await shot('02a-tutorial');
  if (i === 2) {
    // 붙어 있는 상자 두 개를 밀면 막히고, 되돌리기 안내로 바뀐다
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(200);
    check((await page.textContent('.tip p')) !== tipText, '막히면 안내 문구가 되돌리기 안내로 바뀐다');
    await page.keyboard.press('z');
  }
  for (const ch of TUT[i]) {
    await page.keyboard.press(KEY[ch]);
    await page.waitForTimeout(140);
  }
  await page.waitForSelector('.clear-title', { timeout: 5000 });
  await page.waitForTimeout(400);
  if (i === TUT.length - 1) await shot('02b-tutorial-done');
  await page.click('[data-a=go]');
}
await page.waitForSelector('.play-screen:not(.tutorial)');
check((await page.textContent('.stage-title b')) === '1-1', '튜토리얼을 마치면 1-1로 들어간다');
check((await page.evaluate(() => JSON.parse(localStorage.getItem('block-labyrinth-save')).tutorial)) === 4, '튜토리얼 완료가 저장된다');
await dismissRule();

// 플레이 화면에서 뒤로 가면 홈이고, 홈의 플레이 버튼은 이어서 할 스테이지를 보여준다
await page.click('[data-a=back]');
await page.waitForSelector('.title-screen');
check((await page.textContent('[data-a=start]')).includes('1-1'), '홈의 플레이 버튼이 이어서 할 스테이지(1-1)를 보여준다');
await shot('02c-home');
await page.click('[data-a=start]');
await page.waitForSelector('.play-screen:not(.tutorial)');
check((await page.textContent('.stage-title b')) === '1-1', '플레이 버튼을 누르면 바로 1-1이 열린다');
await page.click('[data-a=back]');
await page.waitForSelector('.title-screen');
await page.click('[data-a=stages]');
await page.waitForSelector('.select-screen');
await shot('02-select');
check((await page.locator('.stage').count()) === 96, '스테이지 96개가 보인다');
check((await page.locator('.stage.locked').count()) === 84, '월드 2~8은 잠겨 있다');
check(
  await page.evaluate(() => [...document.querySelectorAll('.topbar > *')].every((e) => e.getBoundingClientRect().right <= innerWidth)),
  '상단 버튼이 화면 안에 있다',
);

// 던전은 카드로 넘겨 본다. 잠긴 던전 카드를 가운데로 가져와 스테이지를 누르면 안내가 뜬다
check((await page.locator('.pager i').count()) === 8 && (await page.locator('.world.front').getAttribute('data-world')) === '1', '던전 카드 8장 중 지금 던전이 가운데에 있다');
await page.locator('.pager i').nth(1).click();
await page.waitForSelector('.world.front[data-world="2"]');
await page.waitForTimeout(500);
await page.locator('.world.front .stage.locked').first().click();
check(await page.locator('.toast').isVisible(), '잠긴 월드 안내가 뜬다');

// 모든 레벨을 저장된 해답으로 클리어한다
for (const lv of levels) {
  await page.goto(`${BASE}?go=play:${lv.id}`);
  await page.waitForSelector('.play-screen canvas');
  await page.waitForTimeout(250);
  await dismissRule(lv.world === 3 && lv.index <= 2 ? '03a-rule-card' : undefined);
  if (lv.index === 1 || lv.id === '8-12') await shot(`play-${lv.id}`);
  if (lv.id === '3-2') {
    // 막히는 방향 입력, 되돌리기, 재시작
    await page.keyboard.press(KEY[lv.solution[0]]);
    await page.keyboard.press('z');
    check((await page.textContent('[data-moves]')) === '0', '되돌리기로 이동 수가 0으로 돌아간다');
    await page.keyboard.press(KEY[lv.solution[0]]);
    await page.click('[data-a=restart]');
    check((await page.textContent('[data-moves]')) === '0', '재시작으로 이동 수가 0으로 돌아간다');
    // 힌트(광고 자리 표시가 떴다가 닫힌다)
    await page.click('[data-a=hint]');
    await page.waitForSelector('.ad-placeholder');
    await page.waitForSelector('.ad-placeholder', { state: 'detached', timeout: 8000 });
    await page.waitForTimeout(300);
    await shot('03-hint');
  }
  for (const ch of lv.solution) {
    await page.keyboard.press(KEY[ch]);
    await page.waitForTimeout(lv.id === '1-1' ? 120 : 15);
  }
  await page.waitForSelector('.clear-title', { timeout: 5000 });
  await page.waitForTimeout(1500);
  const stars = await page.locator('.stars.big i.on').count();
  if (stars !== 3) throw new Error(`${lv.id}: 최소 이동 수로 깼는데 별이 ${stars}개`);
  // 던전의 마지막 스테이지를 깼을 때만 던전 완료 연출이 나온다
  if (lv.index === 12) {
    if (!(await page.locator('.world-done').count())) throw new Error(`${lv.id}: 던전 완료 표시가 없음`);
    if (lv.id === '1-12') await shot('04b-world-done');
  } else if (await page.locator('.world-done').count()) throw new Error(`${lv.id}: 던전을 다 깨지 않았는데 완료 표시가 나옴`);
  if (lv.id === '1-1') {
    await shot('04-clear');
    // 광고를 보고 보상을 두 배로 받는다
    const before = await page.evaluate(() => JSON.parse(localStorage.getItem('block-labyrinth-save')).gold);
    await page.click('[data-a=bonus]');
    await page.waitForSelector('.ad-placeholder');
    await page.waitForSelector('.ad-placeholder', { state: 'detached', timeout: 8000 });
    await page.waitForTimeout(200);
    const after = await page.evaluate(() => JSON.parse(localStorage.getItem('block-labyrinth-save')).gold);
    check(after === before * 2 && (await page.locator('[data-a=bonus]').count()) === 0, `광고 보상으로 골드가 2배가 되고 버튼이 사라진다 (${before} -> ${after})`);
    await page.click('[data-a=next]');
    await page.waitForSelector('.play-screen');
    await dismissRule();
    check((await page.textContent('.stage-title b')) === '1-2', '"다음 레벨"로 1-2에 들어간다');
  }
}
console.log('통과: 96개 레벨을 모두 저장된 해답으로 클리어, 전부 별 3개');
console.log('통과: 던전 완료 연출이 각 던전의 마지막 스테이지에서만 나온다');
check(ruleCards === 10, `블록 4종과 기믹 6종의 규칙 카드가 한 번씩 뜬다 (실제 ${ruleCards}개)`);

const data = await page.evaluate(() => JSON.parse(localStorage.getItem('block-labyrinth-save')));
check(data.gold === 8730, `첫 클리어와 별 골드 8,640에 광고 보상 90을 더해 8,730 (실제 ${data.gold})`);

// 스와이프 입력
await page.goto(`${BASE}?go=play:1-1`);
await page.waitForSelector('.play-screen canvas');
const box = await page.locator('.board-wrap').boundingBox();
const cx = box.x + box.width / 2;
const cy = box.y + box.height / 2;
const delta = { U: [0, -60], R: [60, 0], D: [0, 60], L: [-60, 0] }[levels[0].solution[0]];
await page.mouse.move(cx, cy);
await page.mouse.down();
await page.mouse.move(cx + delta[0], cy + delta[1], { steps: 4 });
await page.mouse.up();
check((await page.textContent('[data-moves]')) === '1', '스와이프로 한 칸 이동한다');

// 최소 이동 수를 넘기면 별을 잃었다는 표시가 난다
let sawLost = false;
for (let i = 0; i < 40 && !sawLost; i++) {
  await page.keyboard.press(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'][i % 4]);
  await page.waitForTimeout(40);
  sawLost = await page.evaluate(() => document.querySelector('.target')?.classList.contains('lost') ?? false);
  if (await page.locator('.clear-title').count()) break;
}
check(sawLost, '이동 수가 한도를 넘으면 별을 잃는 표시가 난다');

await page.goto(`${BASE}?go=select`);
await page.waitForSelector('.select-screen');
check((await page.locator('.stage.cleared').count()) === 96, '클리어한 96칸이 채워진다');
await page.evaluate(() => document.querySelector('.world-list').scrollTo(0, 0));
await shot('05-select-cleared');

// 뽑기: 골드가 떨어질 때까지 돌린다
await page.click('[data-a=cosmetics]');
await page.waitForSelector('.cosmetics-screen');
// 연속 뽑기: 골드가 넉넉하면 최대인 10회가 된다
check((await page.textContent('[data-a=multi]')).includes('10'), '골드가 충분하면 10연속 버튼이 보인다');
await page.click('[data-a=multi]');
await page.waitForSelector('.multi-card', { timeout: 5000 });
await page.waitForTimeout(900);
await shot('06a-multi-result');
check((await page.locator('.multi-card').count()) === 10, '10연속 결과에 10개가 나온다');
check((await page.evaluate(() => JSON.parse(localStorage.getItem('block-labyrinth-save')).gold)) === 7430, '10연속에 1,300골드를 쓴다');
await page.click('.modal [data-a=ok]');
await page.waitForSelector('.backdrop', { state: 'detached' });
await page.waitForTimeout(100);

// 광고 뽑기: 골드를 쓰지 않고, 하루 2회까지
await page.click('[data-a=addraw]');
await page.waitForSelector('.reveal', { timeout: 12000 });
await page.click('.modal [data-a=ok]');
await page.waitForSelector('.backdrop', { state: 'detached' });
await page.waitForTimeout(100);
const adState = await page.evaluate(() => JSON.parse(localStorage.getItem('block-labyrinth-save')));
check(adState.gold === 7430 && adState.adDrawCount === 1, '광고 뽑기는 골드를 쓰지 않고 오늘 횟수를 1 올린다');

// 상자가 흔들리는 동안 누르면 기다리지 않고 결과로 넘어간다
await page.click('[data-a=draw]');
await page.waitForTimeout(150);
const skipAt = Date.now();
await page.click('.chest');
await page.waitForSelector('.reveal', { timeout: 1200 });
check(Date.now() - skipAt < 1000, `뽑기 연출을 눌러서 건너뛸 수 있다 (${Date.now() - skipAt}ms)`);
await page.click('.modal [data-a=ok]');
await page.waitForSelector('.backdrop', { state: 'detached' });
await page.waitForTimeout(100);

let draws = 11;
for (;;) {
  const gold = await page.evaluate(() => JSON.parse(localStorage.getItem('block-labyrinth-save')).gold);
  if (gold < 130 || (await page.locator('[data-a=draw]').isDisabled())) break;
  await page.click('[data-a=draw]');
  if (draws === 11) {
    await page.waitForTimeout(1300);
    await shot('06-chest-open');
  }
  await page.waitForSelector('.reveal', { timeout: 5000 });
  if (draws === 11) {
    await page.waitForTimeout(400);
    await shot('07-reveal');
  }
  await page.click('.modal [data-a=ok]');
  await page.waitForSelector('.backdrop', { state: 'detached' });
  await page.waitForTimeout(80);
  draws++;
}
const after = await page.evaluate(() => JSON.parse(localStorage.getItem('block-labyrinth-save')));
console.log(`통과: 뽑기 ${draws}회, 보유 ${after.owned.length}/30종, 남은 골드 ${after.gold}`);
check(draws >= 30 && after.owned.length >= 24, '뽑기로 유물이 모인다');
await shot('08-inventory');

// 얻은 스킨과 자국을 장착하고 플레이 화면에 반영되는지 본다
await page.click('[data-tab=skin]');
await page.locator('.item:not(.missing)').last().click();
await page.click('[data-tab=trail]');
await page.locator('.item:not(.missing)').last().click();
await shot('09-trails');
const equipped = await page.evaluate(() => JSON.parse(localStorage.getItem('block-labyrinth-save')));
check(equipped.skin !== 'default' && equipped.trail !== 'none', `스킨(${equipped.skin})과 자국(${equipped.trail})이 장착된다`);
await page.goto(`${BASE}?go=play:4-3`);
await page.waitForSelector('.play-screen canvas');
for (const ch of levels.find((l) => l.id === '4-3').solution.slice(0, 9)) {
  await page.keyboard.press(KEY[ch]);
  await page.waitForTimeout(90);
}
await shot('10-play-with-skin');

// 9회분 골드만 있으면 9연속이 된다
await page.goto(BASE + '?go=cosmetics&gold=1220');
await page.waitForSelector('.cosmetics-screen');
if (await page.locator('[data-a=draw]').isEnabled()) {
  const label = await page.textContent('[data-a=multi]');
  check(label.includes('9') && label.includes('1170'), `1,220골드면 9연속 1,170골드 버튼이 된다 (실제: ${label.trim()})`);
} else console.log('건너뜀: 유물을 모두 모아 연속 뽑기 버튼이 없음');

// 설정
await page.goto(BASE);
await page.click('[data-a=settings]');
await page.waitForSelector('.setting');
await shot('11-settings');
await page.click('[data-k=lang]');
await page.waitForTimeout(300);
check((await page.textContent('.logo')) === 'Block Labyrinth', '언어를 영어로 바꾸면 제목이 바뀐다');

check(errors.length === 0, `콘솔 오류 없음 ${errors.join(' | ')}`);
await browser.close();
console.log('전체 점검 통과');
