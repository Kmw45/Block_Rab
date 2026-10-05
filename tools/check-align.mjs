// 화면마다 글자와 아이콘이 제 틀의 좌우 가운데에 있는지 잰다. 개발 서버가 5183 포트에 떠 있어야 한다.
// 사용: node tools/check-align.mjs [스크린샷 폴더]   틀 폭의 3%(최소 2px) 넘게 치우친 것을 적는다.
import { chromium } from 'playwright-core';
import { readFileSync, mkdirSync } from 'node:fs';

const BASE = process.env.E2E_URL ?? 'http://localhost:5183/';
const out = process.argv[2];
if (out) mkdirSync(out, { recursive: true });
const levels = JSON.parse(readFileSync(new URL('../src/data/levels.json', import.meta.url), 'utf8'));
const KEY = { U: 'ArrowUp', R: 'ArrowRight', D: 'ArrowDown', L: 'ArrowLeft' };

// [틀, 그 안에서 가운데에 있어야 하는 내용(없으면 틀의 내용 전체)]
const TARGETS = {
  title: [['.btn.play'], ['.round-btn'], ['.hud-pill'], ['.icon-btn'], ['.home-dock']],
  story: [['.story-book', '.story-text'], ['.story-book', '.story-dots'], ['.story-book', '.story-next'], ['.story-next'], ['.story-skip'], ['.story-book', '.story-frame']],
  select: [['.world.front', '.card-plate'], ['.plate-no', 'b'], ['.card-plate h2'], ['.world.front', '.world-stars'], ['.world.front .stage'], ['.world.front .stage-wrap', '.stars'], ['.world.front', '.stage-grid'], ['.select-screen', '.pager'], ['.pill-btn'], ['.icon-btn'], ['.round-btn'], ['.select-screen', '.world.front']],
  play: [['.hud-chip'], ['.round-btn'], ['.ctrl'], ['.play-screen', '.board-wrap'], ['.play-screen', '.controls'], ['.play-screen', '.topbar']],
  clear: [['.backdrop.sheet', '.clear-title'], ['.clear-title'], ['.backdrop.sheet', '.modal'], ['.modal', '.stars.big'], ['.stats > div'], ['.btn.bonus'], ['.modal .btn.big'], ['.modal .row .btn'], ['.modal', '.row']],
  cosmetics: [['.tabs button'], ['.cosmetics-screen', '.tabs'], ['.draw-btn'], ['.round-btn'], ['.hud-pill'], ['.dress-room', '.dress-fox'], ['.cosmetics-screen', '.strip-dots'], ['.item.equipped', 'em'], ['.item.missing', 'em'], ['.pity'], ['.rates']],
  settings: [['.modal', 'h2'], ['.modal .btn'], ['.setting.link'], ['.setting.danger']],
};

const browser = await chromium.launch({ channel: 'msedge' });
let bad = 0;
for (const lang of ['ko', 'en']) {
  // 휴대폰 세 가지 폭과, PC 브라우저 창(가로로 넓고 세로가 짧다)
  for (const [width, height] of [[360, 778], [390, 844], [430, 932], [1280, 800]]) {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2, hasTouch: true });
    await page.goto(BASE);
    await page.evaluate(
      ([ids, lang]) => {
        const save = JSON.parse(localStorage.getItem('block-labyrinth-save') ?? '{}');
        Object.assign(save, { stars: Object.fromEntries(ids.map((id, i) => [id, i % 3 === 1 ? 2 : 3])), tutorial: 4, story: true, gold: 12480, lastLevel: '2-5', lang });
        localStorage.setItem('block-labyrinth-save', JSON.stringify(save));
      },
      [levels.slice(0, 16).map((l) => l.id), lang],
    );
    const measure = async (name) => {
      await page.waitForTimeout(900);
      if (out) await page.screenshot({ path: `${out}/${name}-${lang}-${width}.png` });
      const rows = await page.evaluate((targets) => {
        const res = [];
        for (const [boxSel, innerSel] of targets) {
          for (const box of document.querySelectorAll(boxSel)) {
            const b = box.getBoundingClientRect();
            if (!b.width || b.right < 0 || b.left > innerWidth) continue;
            let r;
            if (innerSel) {
              const el = box.matches(innerSel) ? box : (box.querySelector(innerSel) ?? document.querySelector(innerSel));
              if (!el) continue;
              r = el.getBoundingClientRect();
              // 글자만 든 요소는 요소가 아니라 글자가 실제로 놓인 자리를 잰다
              if (el.children.length === 0 && el.textContent.trim()) {
                const range = document.createRange();
                range.selectNodeContents(el);
                r = range.getBoundingClientRect();
              }
            } else {
              const range = document.createRange();
              range.selectNodeContents(box);
              r = range.getBoundingClientRect();
              // 배지처럼 틀 밖에 따로 붙인 것은 빼고 잰다
              const kids = [...box.children].filter((c) => getComputedStyle(c).position !== 'absolute');
              if (kids.length) {
                const xs = kids.map((c) => c.getBoundingClientRect());
                const texts = [...box.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim());
                for (const t of texts) {
                  const tr = document.createRange();
                  tr.selectNode(t);
                  xs.push(tr.getBoundingClientRect());
                }
                r = { left: Math.min(...xs.map((x) => x.left)), right: Math.max(...xs.map((x) => x.right)), width: 1 };
              }
            }
            if (!r.width) continue;
            const off = (r.left + r.right) / 2 - (b.left + b.right) / 2;
            res.push({ sel: boxSel + (innerSel ? ' > ' + innerSel : ''), text: (box.textContent ?? '').trim().slice(0, 12), off: Math.round(off * 10) / 10, w: Math.round(b.width), over: r.left < b.left - 1 || r.right > b.right + 1 });
          }
        }
        return res;
      }, TARGETS[name]);
      for (const r of rows) {
        if (Math.abs(r.off) > Math.max(2, r.w * 0.03) || r.over) {
          bad++;
          console.log(`${name} ${lang} ${width}px  ${r.sel} "${r.text}"  ${r.off > 0 ? '오른쪽' : '왼쪽'}으로 ${Math.abs(r.off)}px (틀 ${r.w}px)${r.over ? '  틀을 넘침' : ''}`);
        }
      }
    };

    await page.goto(BASE);
    await page.waitForSelector('.title-screen');
    await measure('title');
    await page.click('[data-a=settings]');
    await page.waitForSelector('.setting');
    await measure('settings');
    await page.goto(BASE + '?go=story');
    await page.waitForSelector('.story-screen');
    await measure('story');
    await page.goto(BASE + '?go=select');
    await page.waitForSelector('.select-screen');
    await measure('select');
    const lv = levels.find((l) => l.id === '2-5');
    await page.goto(BASE + '?go=play:2-5');
    await page.waitForSelector('.play-screen canvas');
    await page.waitForTimeout(300);
    if (await page.locator('.rule-tag').count()) {
      await page.click('.modal [data-a=ok]');
      await page.waitForSelector('.backdrop', { state: 'detached' });
    }
    await measure('play');
    for (const ch of lv.solution) {
      await page.keyboard.press(KEY[ch]);
      await page.waitForTimeout(40);
    }
    await page.waitForSelector('.clear-title', { timeout: 8000 });
    await page.waitForTimeout(1500);
    await measure('clear');
    await page.goto(BASE + '?go=cosmetics&gold=12480');
    await page.waitForSelector('.cosmetics-screen');
    await measure('cosmetics');
    await page.close();
  }
}
await browser.close();
console.log(bad ? `치우친 곳 ${bad}군데` : '치우친 곳 없음');
