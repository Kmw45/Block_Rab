import {
  BlockKind,
  BoardDef,
  Dir,
  DIR_CHARS,
  State,
  TILE_ONEWAY,
  TILE_PIT,
  TILE_PORTAL,
  TILE_CRUMBLE,
  TILE_DOOR,
  TILE_SLIP,
  TILE_SWITCH,
  doorsOpen,
  initialState,
  parseLevel,
  step,
} from '../core/board';
import { solve } from '../core/solver';
import { DEFAULT_SKIN, DEFAULT_TRAIL, ITEMS, Item, ItemType, RARITY_COLOR, RARITY_ORDER, Rarity } from '../data/items';
import { TUTORIALS } from '../data/tutorial';
import { WORLDS } from '../data/worlds';
import { ads } from '../game/ads';
import { applyAudioSettings, sfx, vibrate } from '../game/audio';
import { StringKey, t } from '../game/i18n';
import {
  AD_MIN_GAP_MS,
  ClearReward,
  DEV_MODE,
  GACHA_COST,
  GachaResult,
  LEVELS_PER_WORLD,
  LEVELS,
  LevelInfo,
  WORLD_COUNT,
  adDrawsLeft,
  addBonusGold,
  allCollected,
  canSkip,
  currentLevel,
  drawGacha,
  drawsUntilGuarantee,
  equip,
  isWorldCleared,
  isWorldUnlocked,
  nextLevel,
  owns,
  persist,
  recordClear,
  resetSave,
  save,
  skipLevel,
  starsFor,
  totalStars,
  useAdDraw,
  worldLevels,
  worldStars,
} from '../game/store';
import { BoardView } from '../render/boardView';
import { AnimName, SHEET_SCALE, drawBlock, drawCharacter, drawTrail } from '../render/draw';
import { burst } from '../render/fx';
import { getSheet, getSprite } from '../render/sprites';

const app = document.getElementById('app')!;
let dispose: (() => void) | null = null;

const svg = (body: string, filled = false) =>
  `<svg viewBox="0 0 24 24" ${filled ? 'fill="currentColor"' : 'fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"'}>${body}</svg>`;
const ICON = {
  back: svg('<path d="M15 5l-7 7 7 7"/>'),
  settings: svg('<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2.2"/><circle cx="9" cy="17" r="2.2"/>'),
  undo: svg('<path d="M9 6L4 11l5 5M4 11h9.5a5.5 5.5 0 010 11H10"/>'),
  restart: svg('<path d="M19.5 12a7.5 7.5 0 11-2.2-5.3M19.5 3.5v4.2h-4.2"/>'),
  hint: svg('<path d="M9.5 18h5M10.5 21h3M12 3a6 6 0 00-3.6 10.8c.7.6 1.1 1.3 1.1 2.2h5c0-.9.4-1.6 1.1-2.2A6 6 0 0012 3z"/>'),
  skip: svg('<path d="M4 5l8 7-8 7zM13 5l8 7-8 7z"/>', true),
  lock: svg('<rect x="5" y="11" width="14" height="10" rx="2.5" fill="currentColor"/><path d="M8 11V8a4 4 0 018 0v3"/>'),
  star: svg('<path d="M12 2.2l3 6.2 6.8 1-4.9 4.8 1.2 6.8L12 17.8 5.9 21l1.2-6.8-4.9-4.8 6.8-1z"/>', true),
  gem: svg('<path d="M6 3h12l4 6-10 12L2 9z"/><path d="M2 9h20M9 3l-2 6 5 12 5-12-2-6" stroke="rgba(0,0,0,.25)" stroke-width="1" fill="none"/>', true),
};

function mount(node: HTMLElement, world?: number): void {
  dispose?.();
  dispose = null;
  const th = WORLDS[(world ?? 1) - 1];
  const root = document.documentElement.style;
  root.setProperty('--bg-top', th.bgTop);
  root.setProperty('--bg-bottom', th.bgBottom);
  root.setProperty('--accent', th.accent);
  root.setProperty('--accent-dark', th.accentDark);
  node.classList.add('screen');
  app.replaceChildren(node);
}

function html(markup: string): HTMLElement {
  const el = document.createElement('div');
  el.innerHTML = markup.trim();
  return el.firstElementChild as HTMLElement;
}

function toast(text: string): void {
  document.querySelector('.toast')?.remove();
  const el = html(`<div class="toast">${text}</div>`);
  document.body.appendChild(el);
  setTimeout(() => el.classList.add('out'), 1700);
  setTimeout(() => el.remove(), 2100);
}

function modal(markup: string, dismissable = true): { el: HTMLElement; close: () => void } {
  const el = html(`<div class="backdrop"><div class="modal">${markup}</div></div>`);
  const close = () => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 180);
  };
  if (dismissable) el.addEventListener('click', (e) => e.target === el && close());
  document.body.appendChild(el);
  return { el, close };
}

function confirmModal(text: string, onOk: () => void): void {
  const m = modal(
    `<p class="modal-text">${text}</p><div class="row"><button class="btn ghost" data-a="no">${t('cancel')}</button><button class="btn" data-a="ok">${t('ok')}</button></div>`,
  );
  m.el.querySelector('[data-a=no]')!.addEventListener('click', m.close);
  m.el.querySelector('[data-a=ok]')!.addEventListener('click', () => {
    m.close();
    onOk();
  });
}

// 그림이 있으면 그림을, 없으면 선으로 그린 아이콘을 쓴다
function art(key: string, fallback: string, cls = 'art-icon'): string {
  const img = getSprite(key);
  return img ? `<img class="${cls}" src="${img.src}" alt="" draggable="false" />` : fallback;
}

// 그림으로 된 동전과 배경을 CSS에 연결한다. 그림을 다 불러온 뒤 한 번 부른다.
export function applyArt(): void {
  const root = document.documentElement;
  const coin = getSprite('ui_coin');
  if (coin) {
    root.style.setProperty('--coin-img', `url("${coin.src}")`);
    root.classList.add('has-coin');
  }
  // UI 키트 그림을 CSS 변수로 넘긴다. 하나라도 없으면 기존 CSS 모양을 그대로 쓴다.
  const kit = ['btn_gold', 'btn_stone', 'btn_square', 'panel', 'frame', 'ribbon', 'stage_open', 'stage_cleared', 'stage_locked', 'pill', 'card'];
  if (kit.every((k) => getSprite('ui_' + k))) {
    for (const k of kit) root.style.setProperty('--ui-' + k.replace('_', '-'), `url("${getSprite('ui_' + k)!.src}")`);
    root.classList.add('has-ui');
  }
  const bg = getSprite('ui_bg');
  if (bg) {
    root.style.setProperty('--bg-img', `url("${bg.src}")`);
    root.classList.add('has-bg');
  }
}

function starsHtml(n: number, cls = ''): string {
  const star = art('ui_star', ICON.star, '');
  return `<span class="stars ${cls}">${[0, 1, 2].map((i) => `<i class="${i < n ? 'on' : ''}">${star}</i>`).join('')}</span>`;
}

const goldPill = () => `<div class="gold-pill"><span class="coin"></span><b>${save.gold.toLocaleString()}</b></div>`;

function worldName(world: number): string {
  const w = WORLDS[world - 1];
  return save.lang === 'ko' ? w.ko : w.en;
}

function itemName(item: Item): string {
  return save.lang === 'ko' ? item.ko : item.en;
}

// ───────── 설정 ─────────

function showSettings(rerender: () => void): void {
  const toggle = (key: 'sfx' | 'music' | 'vibration') =>
    `<button class="setting" data-k="${key}"><span>${t(key)}</span><i class="switch ${save[key] ? 'on' : ''}"></i></button>`;
  const m = modal(`
    <h2>${t('settings')}</h2>
    ${toggle('sfx')}${toggle('music')}${toggle('vibration')}
    <button class="setting" data-k="lang"><span>${t('language')}</span><b>${save.lang === 'ko' ? '한국어' : 'English'}</b></button>
    <button class="setting link" data-k="story">${t('storyReplay')}</button>
    <a class="setting link" href="./privacy.html" target="_blank" rel="noopener">${t('privacy')}</a>
    <button class="setting danger" data-k="reset">${t('reset')}</button>
    <button class="btn" data-k="close">${t('ok')}</button>`);
  m.el.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-k]');
    if (!btn) return;
    const k = btn.dataset.k!;
    if (k === 'sfx' || k === 'music' || k === 'vibration') {
      save[k] = !save[k];
      btn.querySelector('.switch')!.classList.toggle('on', save[k]);
      persist();
      applyAudioSettings();
      if (k === 'vibration') vibrate(30);
    } else if (k === 'lang') {
      save.lang = save.lang === 'ko' ? 'en' : 'ko';
      persist();
      m.close();
      rerender();
      showSettings(rerender);
    } else if (k === 'story') {
      m.close();
      showStory(rerender);
    } else if (k === 'reset') {
      confirmModal(t('resetConfirm'), () => {
        resetSave();
        m.close();
        showTitle();
      });
    } else m.close();
  });
}

// ───────── 타이틀 ─────────

// 화면 위에서 움직이는 캐릭터(홈, 결과 창). 캔버스가 화면에서 사라지면 스스로 멈춘다.
// clip: 지금 재생할 동작과 그 동작 안에서의 시간을 돌려준다.
function startMascot(canvas: HTMLCanvasElement, clip: (time: number) => { name: AnimName; t: number }): void {
  const ctx = canvas.getContext('2d')!;
  const size = canvas.width;
  const frame = (ms: number) => {
    if (!canvas.isConnected) return;
    requestAnimationFrame(frame);
    const time = ms / 1000;
    ctx.clearRect(0, 0, size, size);
    // 동작 시트 한 칸이 캔버스에 꼭 들어가게 그린다(귀와 점프가 잘리지 않게)
    drawCharacter(ctx, save.skin, size / 2, size * 0.645, (size / SHEET_SCALE) * 0.98, 2, time, 1, clip(time));
  };
  requestAnimationFrame(frame);
}

// 보물 상자 동작 시트의 구성: [시작 프레임, 프레임 수, 초당 프레임]. tools/make-chest.mjs의 CLIPS와 같아야 한다.
const CHEST_ANIMS = { idle: [0, 16, 10], shake: [16, 20, 20] } as const;
const CHEST_COLS = 6;
const CHEST_FRAME = 256;

// 플레이 화면에서 뒤로 갈 곳. 홈의 플레이 버튼으로 들어왔으면 홈, 스테이지 메뉴에서 골랐으면 메뉴로 돌아간다.
let playOrigin: 'home' | 'select' = 'home';

// 홈 화면. 플레이 버튼 하나로 이어서 하고, 스테이지 메뉴는 따로 둔다.
export function showTitle(): void {
  const needTutorial = !DEV_MODE && save.tutorial < TUTORIALS.length && Object.keys(save.stars).length === 0;
  const cur = currentLevel();
  const hasFreeDraw = !allCollected() && adDrawsLeft() > 0;
  const homeBg = getSprite('ui_home_bg');
  const el = html(`
    <div class="title-screen ${homeBg ? 'home' : ''}">
      ${homeBg ? `<div class="home-scene" style="background-image:url('${homeBg.src}')"></div>` : ''}
      <div class="home-top">${goldPill()}<span class="total-stars">${starsHtml(1)}<b>${totalStars()}</b>/${LEVELS.length * 3}</span></div>
      <button class="icon-btn corner" data-a="settings">${art('icon_settings', ICON.settings)}</button>
      ${homeBg ? '<canvas class="mascot" width="400" height="400"></canvas>' : art('ui_title_art', '', 'key-art')}
      <canvas class="hero ${homeBg || getSprite('ui_title_art') ? 'over-art' : ''}" width="560" height="400"></canvas>
      <h1 class="logo">${t('title')}</h1>
      <p class="tagline">${t('subtitle')}</p>
      <button class="btn big play" data-a="start">
        ${needTutorial ? t('start') : `${t('play')}<small>${cur.world}-${cur.index} · ${worldName(cur.world)}</small>`}
      </button>
      <div class="home-row">
        <button class="btn ghost" data-a="stages">${t('stages')}</button>
        <button class="btn ghost" data-a="cosmetics">${art('icon_gem', ICON.gem)}${t('cosmetics')}${hasFreeDraw ? '<i class="dot"></i>' : ''}</button>
      </div>
    </div>`);
  mount(el, needTutorial ? 1 : cur.world);
  el.querySelector('[data-a=stages]')!.addEventListener('click', showSelect);
  el.querySelector('[data-a=cosmetics]')!.addEventListener('click', showCosmetics);
  // 처음이면 스테이지 선택보다 튜토리얼을 먼저 한다
  el.querySelector('[data-a=start]')!.addEventListener('click', () => {
    // 이미 진행 기록이 있는 사람에게는 튜토리얼을 강요하지 않는다
    const go = () => {
      if (needTutorial) showTutorial(save.tutorial);
      else {
        playOrigin = 'home';
        showPlay(cur);
      }
    };
    // 도입 이야기는 처음 한 번만 보여 준다
    if (!DEV_MODE && !save.story) showStory(go);
    else go();
  });
  el.querySelector('[data-a=settings]')!.addEventListener('click', () => showSettings(showTitle));
  // 홈의 캐릭터: 평소에는 숨쉬고, 오래 두면 졸고, 누르면 깨어나 폴짝 뛴다
  const mascot = el.querySelector<HTMLCanvasElement>('.mascot');
  if (mascot) {
    getSheet(save.skin);
    let jumpAt = -9;
    let awakeAt = -1;
    let last = 0;
    mascot.addEventListener('pointerdown', () => {
      jumpAt = last;
      awakeAt = last;
      sfx.star(1);
    });
    startMascot(mascot, (time) => {
      last = time;
      if (awakeAt < 0) awakeAt = time;
      if (time - jumpAt < 1) return { name: 'win', t: time - jumpAt };
      return { name: time - awakeAt > 12 ? 'sleep' : 'idle', t: time };
    });
  }
  if (homeBg || getSprite('ui_title_art')) return; // 그림이 있으면 움직이는 도형 그림은 쓰지 않는다

  // 블록을 미는 캐릭터를 보여주는 움직이는 그림
  const canvas = el.querySelector('canvas')!;
  const ctx = canvas.getContext('2d')!;
  let raf = 0;
  const frame = (ms: number) => {
    raf = requestAnimationFrame(frame);
    const time = ms / 1000;
    const s = 110;
    ctx.clearRect(0, 0, 560, 400);
    const cycle = (time * 0.45) % 1;
    const push = cycle < 0.6 ? cycle / 0.6 : 1;
    const ease = 1 - (1 - push) * (1 - push);
    const x = 110 + ease * 120;
    drawBlock(ctx, 'ice', 470, 120 + Math.sin(time * 1.6) * 6, s * 0.8, -1, 0, time);
    drawBlock(ctx, 'railH', 90, 110 + Math.sin(time * 1.3 + 2) * 6, s * 0.8, -1, 0, time);
    drawBlock(ctx, 'count', 450, 310 + Math.sin(time * 1.9 + 1) * 5, s * 0.75, 3, 0, time);
    drawBlock(ctx, 'normal', x + s, 240, s, -1, 0, time);
    drawCharacter(ctx, save.skin, x, 240, s, 1, time, 1 + Math.sin(push * Math.PI * 6) * 0.04);
  };
  raf = requestAnimationFrame(frame);
  dispose = () => cancelAnimationFrame(raf);
}

// ───────── 도입 이야기 ─────────

const STORY_PAGES = 3;

// 그림 한 장에 글 한 줄씩 넘겨 본다. 끝나거나 건너뛰면 done으로 이어진다.
export function showStory(done: () => void): void {
  let page = 0;
  const el = html(`
    <div class="story-screen">
      <button class="link-btn story-skip" data-a="skip">${t('storySkip')}</button>
      <div class="story-frame"></div>
      <div class="story-caption"></div>
      <div class="story-dots">${'<i></i>'.repeat(STORY_PAGES)}</div>
      <button class="btn big" data-a="next"></button>
    </div>`);
  const show = () => {
    const img = getSprite('story_' + (page + 1));
    // 통째로 다시 넣어 그림과 글이 들어오는 움직임을 처음부터 재생한다
    el.querySelector('.story-frame')!.innerHTML = img ? `<div class="story-pic" style="background-image:url('${img.src}')"></div>` : '';
    el.querySelector('.story-caption')!.innerHTML = `<p class="story-text pre">${t(('story' + (page + 1)) as StringKey)}</p>`;
    el.querySelectorAll('.story-dots i').forEach((dot, i) => dot.classList.toggle('on', i === page));
    el.querySelector('[data-a=next]')!.textContent = t(page === STORY_PAGES - 1 ? 'storyStart' : 'storyNext');
  };
  const finish = () => {
    save.story = true;
    persist();
    done();
  };
  mount(el, WORLD_COUNT);
  show();
  el.querySelector('[data-a=skip]')!.addEventListener('click', finish);
  el.querySelector('[data-a=next]')!.addEventListener('click', () => {
    if (++page >= STORY_PAGES) finish();
    else show();
  });
}

// ───────── 스테이지 선택 ─────────

// 던전 테마 그림을 그 구역의 CSS 변수로 넘긴다
function themeVars(world: number): string {
  const vars: string[] = [];
  const add = (name: string, key: string) => {
    const img = getSprite(key);
    if (img) vars.push(`--${name}:url('${img.src}')`);
  };
  add('stage-open', 'ui_stage_open_' + world);
  add('stage-cleared', 'ui_stage_cleared_' + world);
  add('banner', 'ui_banner_' + world);
  return vars.join(';');
}

export function showSelect(): void {
  const lastWorld = Number(save.lastLevel.split('-')[0]) || 1;
  const totalStars = LEVELS.reduce((n, l) => n + (save.stars[l.id] ?? 0), 0);
  let list = '';
  for (let w = 1; w <= WORLD_COUNT; w++) {
    const th = WORLDS[w - 1];
    const unlocked = isWorldUnlocked(w);
    // 던전을 모두 지나면 그곳에 빛이 돌아온다. 머리 그림이 밝아진다.
    const lit = isWorldCleared(w);
    const cells = worldLevels(w)
      .map((lv) => {
        const stars = save.stars[lv.id] ?? 0;
        const state = !unlocked ? 'locked' : stars > 0 ? 'cleared' : save.skipped === lv.id ? 'skipped' : 'open';
        return `<div class="stage-wrap"><button class="stage ${state}" data-id="${lv.id}">${unlocked ? lv.index : art('ui_lock', ICON.lock)}</button>${starsHtml(stars)}</div>`;
      })
      .join('');
    list += `
      <section class="world ${unlocked ? '' : 'locked'} ${lit ? 'lit' : ''} ${getSprite('ui_banner_' + w) ? 'themed' : ''}" data-world="${w}" style="--accent:${th.accent};--accent-dark:${th.accentDark};${themeVars(w)}">
        <div class="world-head">
          ${art('emblem_' + w, '', 'emblem')}
          <span class="world-no">${t('world')} ${w}</span>
          <h2>${worldName(w)}</h2>
          <span class="world-stars">${ICON.star}${worldStars(w)}/${LEVELS_PER_WORLD * 3}</span>
          <p class="world-story">${lit ? `<b class="world-lit">${t('worldLit')}</b>` : ''}${save.lang === 'ko' ? th.storyKo : th.storyEn}</p>
        </div>
        <div class="stage-grid">${cells}</div>
      </section>`;
  }
  const el = html(`
    <div class="select-screen">
      <header class="topbar">
        <button class="icon-btn" data-a="back">${art('icon_back', ICON.back)}</button>
        ${goldPill()}
        <span class="grow"></span>
        <button class="pill-btn" data-a="cosmetics">${art('icon_gem', ICON.gem)}${t('cosmetics')}</button>
        <button class="icon-btn" data-a="settings">${art('icon_settings', ICON.settings)}</button>
      </header>
      <div class="world-list">
        ${DEV_MODE ? '<div class="dev-banner">DEV · 스테이지와 치장 전부 열림 · 광고 없음 · 별도 저장</div>' : ''}
        <div class="select-summary">
          <span class="total-stars">${starsHtml(1)}<b>${totalStars}</b>/${LEVELS.length * 3}</span>
          <button class="link-btn" data-a="tutorial">${t('tutReplay')}</button>
        </div>
        ${list}
      </div>
    </div>`);
  mount(el, lastWorld);
  el.querySelector('[data-a=tutorial]')!.addEventListener('click', () => showTutorial(0));
  el.querySelector('[data-a=back]')!.addEventListener('click', showTitle);
  el.querySelector('[data-a=cosmetics]')!.addEventListener('click', showCosmetics);
  el.querySelector('[data-a=settings]')!.addEventListener('click', () => showSettings(showSelect));
  el.querySelector('.world-list')!.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('.stage');
    if (!btn) return;
    const lv = LEVELS.find((l) => l.id === btn.dataset.id)!;
    if (!isWorldUnlocked(lv.world)) {
      sfx.deny();
      toast(t('locked', { n: lv.world - 1 }));
      return;
    }
    playOrigin = 'select';
    showPlay(lv);
  });
  if (lastWorld > 1) el.querySelector(`[data-world="${lastWorld}"]`)?.scrollIntoView({ block: 'start' });
}

// ───────── 플레이 ─────────

// 튜토리얼 단계를 플레이 화면으로 연다
export function showTutorial(index: number): void {
  const tut = TUTORIALS[index];
  showPlay({ id: tut.id, world: 1, index: index + 1, rows: tut.rows, minMoves: tut.solution.length, pushes: 0, solution: tut.solution }, index);
}

// tut: 튜토리얼 단계 번호. 튜토리얼에서는 별과 골드 없이 다음 수를 계속 안내한다.
export function showPlay(level: LevelInfo, tut?: number): void {
  const isTut = tut !== undefined;
  const tutData = isTut ? TUTORIALS[tut] : null;
  const lang = save.lang === 'ko' ? 0 : 1;
  if (!isTut) {
    save.lastLevel = level.id;
    persist();
  }
  const freeHint = level.index === 1;
  const el = html(`
    <div class="play-screen ${isTut ? 'tutorial' : ''}">
      <header class="topbar">
        <button class="icon-btn" data-a="back">${art('icon_back', ICON.back)}</button>
        <div class="stage-title"><small>${isTut ? t('tutorial') : worldName(level.world)}</small><b>${isTut ? `${tut + 1}/${TUTORIALS.length}` : `${level.world}-${level.index}`}</b></div>
        <span class="grow"></span>
        ${
          isTut
            ? `<button class="pill-btn ghost" data-a="tutskip">${t('tutSkip')}</button>`
            : `<div class="moves"><small>${t('moves')}</small><b data-moves>0</b><span class="target"></span></div>
               <button class="icon-btn" data-a="skip" title="${t('skip')}">${art('icon_skip', ICON.skip)}</button>`
        }
      </header>
      ${isTut ? `<div class="tip"><p></p></div>` : ''}
      <div class="board-wrap"><canvas></canvas>${isTut ? `<div class="hand">${art('ui_hand', '👆', '')}</div>` : ''}</div>
      <footer class="controls">
        <button class="ctrl" data-a="undo">${art('icon_undo', ICON.undo)}<span>${t('undo')}</span></button>
        <button class="ctrl" data-a="restart">${art('icon_restart', ICON.restart)}<span>${t('restart')}</span></button>
        <button class="ctrl accent" data-a="hint">${art('icon_hint', ICON.hint)}<span>${t('hint')}</span><em>${freeHint ? t('hintFree') : 'AD'}</em></button>
      </footer>
    </div>`);
  mount(el, level.world);

  const def: BoardDef = parseLevel(level.rows);
  let state: State = initialState(def);
  let history: State[] = [];
  let finished = false;
  let busy = false;
  const movesEl = el.querySelector<HTMLElement>('[data-moves]');
  const targetEl = el.querySelector<HTMLElement>('.target');
  const tipEl = el.querySelector<HTMLElement>('.tip p');
  const handEl = el.querySelector<HTMLElement>('.hand');
  const canvas = el.querySelector('canvas')!;
  const view = new BoardView(canvas);
  view.skin = save.skin;
  view.trail = save.trail;
  view.load(def, WORLDS[level.world - 1], state);

  // 지금 끝내면 받을 별과, 그 별을 지키는 이동 수 한도를 보여준다
  const twoStarLimit = Math.floor(level.minMoves * 1.5);
  let shownStars = 0;
  const refresh = () => {
    if (!movesEl || !targetEl) return;
    const moves = history.length;
    movesEl.textContent = String(moves);
    movesEl.classList.remove('bump');
    void movesEl.offsetWidth;
    movesEl.classList.add('bump');
    const stars = starsFor(moves, level.minMoves);
    if (stars !== shownStars) {
      const lost = shownStars > stars;
      shownStars = stars;
      targetEl.innerHTML = starsHtml(stars) + (stars === 3 ? `<em>≤${level.minMoves}</em>` : stars === 2 ? `<em>≤${twoStarLimit}</em>` : '');
      if (lost) {
        // 받을 수 있는 별이 하나 줄었다
        targetEl.classList.remove('lost');
        void targetEl.offsetWidth;
        targetEl.classList.add('lost');
        sfx.starLost();
        vibrate(20);
      }
    }
  };
  refresh();
  movesEl?.classList.remove('bump');

  // 튜토리얼: 안내 문구와 다음 수 화살표
  const tip = (text?: [string, string]) => {
    if (!tipEl || !text) return;
    tipEl.textContent = text[lang];
    tipEl.parentElement!.classList.remove('pop');
    void tipEl.offsetWidth;
    tipEl.parentElement!.classList.add('pop');
  };
  const guide = () => {
    if (!isTut || finished) return;
    const res = solve(def, state);
    view.setHint(res.status === 'solved' ? res.path.slice(0, 2) : []);
  };
  let tutPushed = false;
  let tutBumped = false;
  if (tutData) {
    tip(tutData.start);
    guide();
    const first = DIR_CHARS.indexOf(tutData.solution[0]);
    handEl!.style.setProperty('--dx', String([0, 1, 0, -1][first]));
    handEl!.style.setProperty('--dy', String([-1, 0, 1, 0][first]));
  }

  const move = (dir: Dir) => {
    if (finished || busy) return;
    const res = step(def, state, dir);
    if (!res.ok) {
      view.bump(res, dir);
      sfx.bump();
      if (res.bumpBlock >= 0) vibrate(15);
      clearTimeout(holdTimer);
      holdDir = null;
      if (tutData && !tutBumped && res.bumpBlock >= 0) {
        tutBumped = true;
        tip(tutData.bumped);
      }
      return;
    }
    handEl?.remove();
    const doorWasOpen = doorsOpen(def, state);
    history.push(state);
    state = res.state;
    if (doorsOpen(def, state) !== doorWasOpen) sfx.door();
    if (res.crumbled >= 0) sfx.crack();
    view.applyStep(res, dir);
    if (tutData && res.pushed >= 0 && !tutPushed) {
      tutPushed = true;
      tip(tutData.pushed);
    }
    guide();
    if (res.pushed >= 0) {
      if (def.kinds[res.pushed] === 'ice') sfx.slide(Math.abs(res.to - res.from) / (dir % 2 === 0 ? def.w : 1));
      else sfx.push();
      if (res.becameFixed) sfx.lock();
      if (res.sunk) sfx.sink();
      vibrate(10);
    } else if (res.slid > 0) sfx.slide(res.slid);
    else sfx.move();
    if (res.teleported) sfx.warp();
    refresh();
    if (res.won) win();
  };

  const win = () => {
    finished = true;
    stopHold();
    view.playWin();
    sfx.clear();
    vibrate([30, 40, 60]);
    if (isTut) {
      save.tutorial = Math.max(save.tutorial, tut + 1);
      persist();
      setTimeout(() => showTutorialClear(tut), 1120);
      return;
    }
    const moves = history.length;
    const wasCleared = isWorldCleared(level.world);
    const reward = recordClear(level, moves);
    const worldDone = !wasCleared && isWorldCleared(level.world);
    setTimeout(() => showClear(level, moves, reward, worldDone), 1120);
  };

  const undo = () => {
    if (finished || busy || !history.length) return;
    state = history.pop()!;
    view.setState(state, false, false);
    sfx.undo();
    refresh();
    guide();
  };

  const restart = () => {
    if (finished || busy || !history.length) return;
    state = initialState(def);
    history = [];
    view.setState(state, false, true);
    sfx.undo();
    refresh();
    guide();
  };

  // 풀 수 있던 마지막 상태를 이분 탐색으로 찾는다. 한번 막히면 그 뒤 상태는 모두 막힌 상태다.
  const rewindToSolvable = () => {
    let lo = 0;
    let hi = history.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (solve(def, history[mid]).status === 'solved') lo = mid;
      else hi = mid - 1;
    }
    state = history[lo];
    history = history.slice(0, lo);
    view.setState(state, false, true);
    refresh();
  };

  const hint = () => {
    if (finished || busy) return;
    busy = true;
    toast(t('thinking'));
    setTimeout(async () => {
      let res = solve(def, state, { timeMs: 1500 });
      if (res.status === 'limit' && !history.length) {
        res = { ...res, status: 'solved', path: [...level.solution].map((c) => DIR_CHARS.indexOf(c) as Dir) };
      }
      document.querySelector('.toast')?.remove();
      if (res.status === 'unsolvable') {
        busy = false;
        sfx.deny();
        const m = modal(`<h2>${t('unsolvable')}</h2><button class="btn" data-a="rewind">${t('rewind')}</button>`);
        m.el.querySelector('[data-a=rewind]')!.addEventListener('click', () => {
          m.close();
          rewindToSolvable();
        });
        return;
      }
      if (res.status === 'limit') {
        busy = false;
        restartHintFallback();
        return;
      }
      if (!freeHint) await ads.rewarded();
      busy = false;
      view.setHint(res.path.slice(0, 3));
      sfx.hint();
    }, 30);
  };

  // 탐색이 시간 안에 끝나지 않으면 처음 상태로 돌아가 저장된 해답으로 안내한다
  const restartHintFallback = () => {
    state = initialState(def);
    history = [];
    view.setState(state, false, true);
    refresh();
    view.setHint([...level.solution].slice(0, 3).map((c) => DIR_CHARS.indexOf(c) as Dir));
    sfx.hint();
  };

  const skip = () => {
    if (finished || busy) return;
    if (!canSkip(level.id)) {
      sfx.deny();
      toast(t('skipDenied'));
      return;
    }
    confirmModal(t('skipConfirm'), async () => {
      await ads.rewarded();
      skipLevel(level.id);
      const next = nextLevel(level.id);
      if (next) showPlay(next);
      else showSelect();
    });
  };
  const skipBtn = el.querySelector<HTMLElement>('[data-a=skip]');
  if (skipBtn && (save.stars[level.id] ?? 0) > 0) skipBtn.style.visibility = 'hidden';
  if (!isTut) showRuleCard(def);

  // 스와이프하면 한 칸, 누르고 있으면 같은 방향으로 계속 이동한다
  let anchor: [number, number] | null = null;
  let holdDir: Dir | null = null;
  let holdTimer = 0;
  const stopHold = () => {
    clearTimeout(holdTimer);
    holdDir = null;
    anchor = null;
  };
  const repeat = () => {
    if (holdDir === null) return;
    move(holdDir);
    holdTimer = window.setTimeout(repeat, 170);
  };
  const board = el.querySelector<HTMLElement>('.board-wrap')!;
  board.addEventListener('pointerdown', (e) => {
    anchor = [e.clientX, e.clientY];
    board.setPointerCapture(e.pointerId);
  });
  board.addEventListener('pointermove', (e) => {
    if (!anchor) return;
    const dx = e.clientX - anchor[0];
    const dy = e.clientY - anchor[1];
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 22) return;
    const dir = (Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : dy > 0 ? 2 : 0) as Dir;
    anchor = [e.clientX, e.clientY];
    // 같은 방향으로 더 끄는 것은 누르고 있는 것으로 본다. 방향을 바꿀 때만 새로 이동한다.
    if (dir === holdDir) return;
    clearTimeout(holdTimer);
    holdDir = dir;
    move(dir);
    holdTimer = window.setTimeout(repeat, 280);
  });
  board.addEventListener('pointerup', stopHold);
  board.addEventListener('pointercancel', stopHold);

  const KEYS: Record<string, Dir> = { ArrowUp: 0, ArrowRight: 1, ArrowDown: 2, ArrowLeft: 3, w: 0, d: 1, s: 2, a: 3 };
  const onKey = (e: KeyboardEvent) => {
    if (document.querySelector('.backdrop')) return;
    const dir = KEYS[e.key];
    if (dir !== undefined) {
      e.preventDefault();
      move(dir);
    } else if (e.key === 'z' || e.key === 'Backspace') undo();
    else if (e.key === 'r') restart();
    else if (e.key === 'h') hint();
  };
  addEventListener('keydown', onKey);

  el.addEventListener('click', (e) => {
    const a = (e.target as HTMLElement).closest<HTMLElement>('[data-a]')?.dataset.a;
    if (a === 'back') {
      if (isTut || playOrigin === 'home') showTitle();
      else showSelect();
    } else if (a === 'undo') undo();
    else if (a === 'restart') restart();
    else if (a === 'hint' && !isTut) hint();
    else if (a === 'skip') skip();
    else if (a === 'tutskip') {
      save.tutorial = TUTORIALS.length;
      persist();
      showSelect();
    }
  });

  dispose = () => {
    removeEventListener('keydown', onKey);
    stopHold();
    view.stop();
  };
}

// ───────── 튜토리얼 클리어와 새 블록 설명 ─────────

function showTutorialClear(index: number): void {
  const last = index + 1 >= TUTORIALS.length;
  const m = modal(
    `<h2 class="clear-title">${t(last ? 'tutDone' : 'tutGreat')}</h2>
     <canvas class="mascot small" width="260" height="260"></canvas>
     ${last ? `<p class="modal-text pre">${t('tutDoneText')}</p>${starsHtml(3, 'big')}` : ''}
     <button class="btn big" data-a="go">${t(last ? 'tutStart' : 'tutNext')}</button>`,
    false,
  );
  burst(innerWidth / 2, innerHeight * 0.4, ['#ffd24d', '#ffffff', WORLDS[0].accent], last ? 80 : 30, last ? 620 : 380);
  startMascot(m.el.querySelector<HTMLCanvasElement>('.mascot')!, jumpOnce());
  m.el.querySelector('[data-a=go]')!.addEventListener('click', () => {
    m.close();
    if (last) {
      playOrigin = 'home';
      showPlay(LEVELS[0]);
    }
    else showTutorial(index + 1);
  });
}

// 새 블록이나 새 바닥 기믹이 처음 나오는 스테이지에서 규칙을 한 번 보여준다
interface Rule {
  key: string;
  sprite: string;
  symbol: string;
  title: StringKey;
  text: StringKey;
}
const BLOCK_RULES: Partial<Record<BlockKind, Rule>> = {
  railH: { key: 'rail', sprite: 'block_railH', symbol: '↔', title: 'ruleRail', text: 'ruleRailText' },
  railV: { key: 'rail', sprite: 'block_railH', symbol: '↔', title: 'ruleRail', text: 'ruleRailText' },
  ice: { key: 'ice', sprite: 'block_ice', symbol: '❄', title: 'ruleIce', text: 'ruleIceText' },
  count: { key: 'count', sprite: 'block_count', symbol: '3', title: 'ruleCount', text: 'ruleCountText' },
  link: { key: 'link', sprite: 'block_link', symbol: '∞', title: 'ruleLink', text: 'ruleLinkText' },
};
const TILE_RULES: Rule[] = [
  { key: 'pit', sprite: 'tile_pit', symbol: '●', title: 'rulePit', text: 'rulePitText' },
  { key: 'oneway', sprite: 'tile_oneway', symbol: '↑', title: 'ruleOneway', text: 'ruleOnewayText' },
  { key: 'slip', sprite: 'tile_ice', symbol: '~', title: 'ruleSlip', text: 'ruleSlipText' },
  { key: 'portal', sprite: 'tile_portal', symbol: '◎', title: 'rulePortal', text: 'rulePortalText' },
  { key: 'door', sprite: 'tile_door', symbol: '▥', title: 'ruleDoor', text: 'ruleDoorText' },
  { key: 'crumble', sprite: 'tile_crumble', symbol: '▦', title: 'ruleCrumble', text: 'ruleCrumbleText' },
];

function showRuleCard(def: BoardDef): void {
  const rules: Rule[] = [];
  const add = (r?: Rule) => r && !save.tips.includes(r.key) && !rules.some((x) => x.key === r.key) && rules.push(r);
  def.kinds.forEach((k) => add(BLOCK_RULES[k]));
  def.tile.forEach((tile) => {
    if (tile === TILE_PIT) add(TILE_RULES[0]);
    else if (tile >= TILE_ONEWAY && tile < TILE_ONEWAY + 4) add(TILE_RULES[1]);
    else if (tile === TILE_SLIP) add(TILE_RULES[2]);
    else if (tile === TILE_PORTAL) add(TILE_RULES[3]);
    else if (tile === TILE_SWITCH || tile === TILE_DOOR) add(TILE_RULES[4]);
    else if (tile === TILE_CRUMBLE) add(TILE_RULES[5]);
  });
  if (!rules.length) return;
  rules.forEach((r) => save.tips.push(r.key));
  persist();
  const rows = rules
    .map(
      (r) => `<div class="rule">
        ${art(r.sprite, `<span class="rule-symbol">${r.symbol}</span>`, 'rule-img')}
        <div><h3>${t(r.title)}</h3><p class="pre">${t(r.text)}</p></div>
      </div>`,
    )
    .join('');
  const m = modal(`<span class="rule-tag">${t('newRule')}</span><div class="rule-list">${rows}</div><button class="btn" data-a="ok">${t('gotIt')}</button>`);
  m.el.querySelector('[data-a=ok]')!.addEventListener('click', m.close);
}
// ───────── 클리어 ─────────

// 결과 창의 캐릭터: 한 번 뛰고 나서는 숨쉬기로 돌아간다
function jumpOnce(): (time: number) => { name: AnimName; t: number } {
  let t0 = -1;
  return (time) => {
    if (t0 < 0) t0 = time;
    const t = time - t0;
    return t < 1 ? { name: 'win', t } : { name: 'idle', t };
  };
}

// worldDone: 이번 클리어로 그 던전을 처음 모두 지났다. 이때만 가장 큰 축하를 한다.
function showClear(level: LevelInfo, moves: number, reward: ClearReward, worldDone: boolean): void {
  const { stars, gold } = reward;
  const next = nextLevel(level.id);
  const nextWorld = worldDone && level.world < WORLD_COUNT ? level.world + 1 : 0;
  const m = modal(
    `
    <h2 class="clear-title">${t(worldDone ? 'worldCleared' : 'cleared')}</h2>
    <canvas class="mascot small" width="260" height="260"></canvas>
    ${starsHtml(0, 'big')}
    <div class="stats">
      <div><small>${t('yourMoves')}</small><b>${moves}</b></div>
      <div><small>${t('minMoves')}</small><b>${level.minMoves}</b></div>
      <div class="gold"><small>${t('earned')}</small><b><span class="coin"></span>+<span data-gold>0</span></b></div>
    </div>
    ${worldDone ? `<p class="world-done">${nextWorld ? `${art('emblem_' + nextWorld, '', 'emblem')}<span>${t('worldNext')}<b>${worldName(nextWorld)}</b></span>` : `<span><b>${t('allCleared')}</b></span>`}</p>` : ''}
    ${gold > 0 ? `<button class="btn ghost bonus" data-a="bonus"><span class="ad-chip">AD</span>${t('bonusAd', { n: gold })}</button>` : ''}
    ${next ? `<button class="btn big" data-a="next">${t('next')}</button>` : ''}
    <div class="row">
      <button class="btn ghost" data-a="retry">${t('retry')}</button>
      <button class="btn ghost" data-a="stages">${t('stages')}</button>
      <button class="btn ghost" data-a="home">${t('home')}</button>
    </div>`,
    false,
  );
  startMascot(m.el.querySelector<HTMLCanvasElement>('.mascot')!, worldDone ? (time) => ({ name: 'win', t: time % 1.5 }) : jumpOnce());
  if (worldDone) sfx.fanfare();
  const starEls = m.el.querySelectorAll<HTMLElement>('.stars.big i');
  for (let i = 0; i < stars; i++) {
    setTimeout(() => {
      if (!m.el.isConnected) return;
      starEls[i].classList.add('on', 'pop');
      sfx.star(i);
      const r = starEls[i].getBoundingClientRect();
      burst(r.left + r.width / 2, r.top + r.height / 2, ['#ffd24d', '#fff3b0', '#ffffff'], 14, 260);
    }, 250 + i * 330);
  }
  setTimeout(() => {
    if (!m.el.isConnected) return;
    // 색종이는 던전을 다 깼을 때와 별 3개를 처음 받았을 때만 쓴다
    if (worldDone || (stars === 3 && reward.newStars > 0)) {
      const th = WORLDS[level.world - 1];
      burst(innerWidth / 2, innerHeight * 0.35, [th.accent, '#ffd24d', '#ffffff', '#ff7d6b', '#7fd4ff'], worldDone ? 170 : 60, worldDone ? 760 : 560);
      if (worldDone) vibrate([40, 60, 40, 60, 90]);
    }
    const goldEl = m.el.querySelector<HTMLElement>('[data-gold]')!;
    if (gold > 0) sfx.coin();
    const t0 = performance.now();
    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / 500);
      goldEl.textContent = String(Math.round(gold * k));
      if (k < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, 250 + stars * 330);

  m.el.addEventListener('click', async (e) => {
    const a = (e.target as HTMLElement).closest<HTMLElement>('[data-a]')?.dataset.a;
    if (!a) return;
    if (a === 'bonus') {
      // 보상 2배: 광고를 본 뒤 같은 양을 한 번 더 준다. 한 번만 받을 수 있다.
      const btn = m.el.querySelector<HTMLElement>('[data-a=bonus]')!;
      btn.remove();
      await ads.rewarded();
      addBonusGold(gold);
      sfx.coin();
      m.el.querySelector<HTMLElement>('[data-gold]')!.textContent = String(gold * 2);
      return;
    }
    m.close();
    if (a === 'retry') showPlay(level);
    else if (a === 'stages') showSelect();
    else if (a === 'home') showTitle();
    else if (a === 'next' && next) {
      // 전면 광고는 레벨 사이에만, 3개 클리어마다 한 번, 월드 1에서는 띄우지 않는다
      if (level.world === 1) save.clearsSinceAd = 0;
      else if (save.clearsSinceAd >= 3 && Date.now() - save.lastAdAt > AD_MIN_GAP_MS) {
        save.clearsSinceAd = 0;
        persist();
        await ads.interstitial();
      }
      showPlay(next);
    }
  });
}

// ───────── 꾸미기와 뽑기 ─────────

function drawItemPreview(canvas: HTMLCanvasElement, id: string, type: ItemType, owned: boolean): void {
  const size = canvas.width;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, size, size);
  if (type === 'skin') drawCharacter(ctx, id, size / 2, size * 0.56, size * 1.05, 2, 1.2);
  else if (id !== DEFAULT_TRAIL) {
    const s = size / 3;
    const marks = [0, 1, 2].map((x) => ({ x, y: 1, dir: 1, born: 9.4 + x * 0.25 }));
    drawTrail(ctx, id, marks, 10, 0, 0, s);
  } else {
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = size * 0.05;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size * 0.2, 0, Math.PI * 2);
    ctx.moveTo(size * 0.36, size * 0.64);
    ctx.lineTo(size * 0.64, size * 0.36);
    ctx.stroke();
  }
  if (!owned) {
    // 아직 없는 아이템은 그림자로 보여준다
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = '#0d0a16';
    ctx.fillRect(0, 0, size, size);
    ctx.globalCompositeOperation = 'source-over';
  }
}

let cosmeticsTab: ItemType = 'skin';
const MULTI_MAX = 10;

export function showCosmetics(): void {
  const done = allCollected();
  const multi = Math.min(MULTI_MAX, Math.floor(save.gold / GACHA_COST)); // 한 번에 뽑을 수 있는 횟수
  const rates = RARITY_ORDER.map((r) => {
    const pct = { common: 60, rare: 28, epic: 10, legendary: 2 }[r];
    return `<span style="--c:${RARITY_COLOR[r]}"><i></i>${t(r as StringKey)} ${pct}%</span>`;
  }).join('');
  const closed = getSprite('ui_chest_closed');
  const open = getSprite('ui_chest_open');
  const chestImages = closed && open ? `<img class="closed" src="${closed.src}" alt="" /><img class="open" src="${open.src}" alt="" />` : '';
  const el = html(`
    <div class="cosmetics-screen">
      <header class="topbar">
        <button class="icon-btn" data-a="back">${art('icon_back', ICON.back)}</button>
        <h1>${t('cosmetics')}</h1>
        <span class="grow"></span>
        ${goldPill()}
      </header>
      <section class="gacha">
        <div class="chest" data-state="idle">
          <div class="rays"></div>
          <div class="art">${chestImages ? chestImages : `<svg viewBox="0 0 200 170">
            <rect x="34" y="78" width="132" height="34" fill="#1c1208"/>
            <rect class="chest-glow" x="34" y="78" width="132" height="34"/>
            <g class="lid">
              <path d="M22 84 Q22 22 100 22 Q178 22 178 84 Z" fill="#9a6230"/>
              <path d="M22 84 Q22 22 100 22 Q178 22 178 84" fill="none" stroke="#e8b84a" stroke-width="9"/>
              <rect x="88" y="24" width="24" height="60" fill="#e8b84a"/>
              <rect x="22" y="76" width="156" height="10" rx="3" fill="#e8b84a"/>
            </g>
            <rect x="22" y="86" width="156" height="72" rx="10" fill="#7a4a22"/>
            <rect x="22" y="86" width="156" height="14" fill="#5d3616"/>
            <rect x="22" y="86" width="16" height="72" rx="6" fill="#e8b84a"/>
            <rect x="162" y="86" width="16" height="72" rx="6" fill="#e8b84a"/>
            <rect x="88" y="86" width="24" height="72" fill="#e8b84a"/>
            <rect x="86" y="96" width="28" height="30" rx="7" fill="#fff0b8" stroke="#a87a1a" stroke-width="3"/>
            <circle cx="100" cy="108" r="4.5" fill="#5d3616"/><rect x="98" y="108" width="4" height="10" fill="#5d3616"/>
          </svg>`}</div>
        </div>
        <h2>${t('chest')}</h2>
        <div class="draw-row">
          <button class="btn big" data-a="draw" ${done ? 'disabled' : ''}>
            ${done ? t('allCollected') : `${t('draw')} <span class="coin"></span>${GACHA_COST}`}
          </button>
          ${!done && multi >= 2 ? `<button class="btn big multi" data-a="multi">${t('drawMulti', { n: multi })} <span class="coin"></span>${multi * GACHA_COST}</button>` : ''}
        </div>
        ${done ? '' : `<p class="pity">${t('guarantee', { n: drawsUntilGuarantee() })}</p>`}
        ${!done && adDrawsLeft() > 0 ? `<button class="ad-draw" data-a="addraw"><span class="ad-chip">AD</span>${t('adDraw', { n: adDrawsLeft() })}</button>` : ''}
        <div class="rates" title="${t('rates')}">${rates}</div>
      </section>
      <nav class="tabs">
        <button data-tab="skin" class="${cosmeticsTab === 'skin' ? 'on' : ''}">${t('skins')}</button>
        <button data-tab="trail" class="${cosmeticsTab === 'trail' ? 'on' : ''}">${t('trails')}</button>
      </nav>
      <div class="inventory"></div>
    </div>`);
  mount(el, Number(save.lastLevel.split('-')[0]) || 1);

  const inv = el.querySelector<HTMLElement>('.inventory')!;
  const fill = () => {
    const base = cosmeticsTab === 'skin' ? DEFAULT_SKIN : DEFAULT_TRAIL;
    const entries: { id: string; name: string; rarity: Rarity | null }[] = [
      { id: base, name: t(cosmeticsTab === 'skin' ? 'defaultSkin' : 'noTrail'), rarity: null },
      ...ITEMS.filter((i) => i.type === cosmeticsTab).map((i) => ({ id: i.id, name: itemName(i), rarity: i.rarity })),
    ];
    const equipped = cosmeticsTab === 'skin' ? save.skin : save.trail;
    inv.innerHTML = entries
      .map((e) => {
        const owned = e.rarity === null || owns(e.id);
        return `<button class="item ${owned ? '' : 'missing'} ${equipped === e.id ? 'equipped' : ''}" data-id="${e.id}" style="--c:${e.rarity ? RARITY_COLOR[e.rarity] : '#6d6785'}">
          <canvas width="144" height="144"></canvas><span>${owned ? e.name : '???'}</span>${equipped === e.id ? `<em>${t('equipped')}</em>` : ''}</button>`;
      })
      .join('');
    inv.querySelectorAll<HTMLElement>('.item').forEach((b, i) => {
      const e = entries[i];
      drawItemPreview(b.querySelector('canvas')!, e.id, cosmeticsTab, e.rarity === null || owns(e.id));
    });
  };
  fill();

  inv.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('.item');
    if (!btn) return;
    if (btn.classList.contains('missing')) {
      sfx.deny();
      return;
    }
    equip(btn.dataset.id!);
    fill();
  });

  const chest = el.querySelector<HTMLElement>('.chest')!;
  let drawing = false;

  // Rev2D로 만든 상자 동작: 평소에는 들썩이고, 뽑을 때는 흔들린다. 시트가 없으면 CSS 흔들림을 그대로 쓴다.
  if (chestImages) {
    const canvas = document.createElement('canvas');
    canvas.className = 'chest-anim';
    canvas.width = canvas.height = CHEST_FRAME * 2;
    chest.querySelector('.art')!.appendChild(canvas);
    const ctx = canvas.getContext('2d')!;
    let state = '';
    let stateAt = 0;
    const frame = (ms: number) => {
      if (!canvas.isConnected) return;
      requestAnimationFrame(frame);
      const sheet = getSheet('chest');
      if (!sheet) return;
      chest.classList.add('has-anim');
      const time = ms / 1000;
      if (chest.dataset.state !== state) {
        state = chest.dataset.state ?? 'idle';
        stateAt = time;
      }
      if (state === 'open') return;
      const [start, count, fps] = CHEST_ANIMS[state === 'shake' ? 'shake' : 'idle'];
      const n = Math.floor((time - (state === 'shake' ? stateAt : 0)) * fps);
      const f = start + (state === 'shake' ? Math.min(count - 1, n) : n % count);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(sheet, (f % CHEST_COLS) * CHEST_FRAME, Math.floor(f / CHEST_COLS) * CHEST_FRAME, CHEST_FRAME, CHEST_FRAME, 0, 0, canvas.width, canvas.height);
    };
    requestAnimationFrame(frame);
  }
  // 상자 연출: 1초 흔들리다 열리고 결과를 보여준다. 흔드는 동안 상자나 버튼을 누르면 바로 넘어간다.
  let skipDraw: (() => void) | null = null;
  const chestSequence = (color: string, onOpen: () => void, onReveal: () => void) => {
    drawing = true;
    el.querySelector('.gold-pill b')!.textContent = save.gold.toLocaleString();
    chest.style.setProperty('--ray', color);
    chest.dataset.state = 'shake';
    sfx.chestShake();
    vibrate([20, 60, 20, 60, 20, 60, 40]);
    let opened = false;
    const open = () => {
      if (opened || !chest.isConnected) return;
      opened = true;
      chest.dataset.state = 'open';
      onOpen();
    };
    const reveal = () => {
      skipDraw = null;
      if (!chest.isConnected) return;
      open();
      onReveal();
    };
    const openTimer = window.setTimeout(open, 1000);
    const revealTimer = window.setTimeout(reveal, 1750);
    skipDraw = () => {
      skipDraw = null;
      clearTimeout(openTimer);
      clearTimeout(revealTimer);
      open();
      window.setTimeout(reveal, 260);
    };
  };
  // 결과 창이 닫히면 화면을 다시 그린다
  const afterClose = (m: { el: HTMLElement; close: () => void }, done: () => void) => {
    m.el.querySelector('[data-a=ok]')!.addEventListener('click', m.close);
    new MutationObserver((_, obs) => {
      if (!m.el.isConnected) {
        obs.disconnect();
        done();
      }
    }).observe(document.body, { childList: true });
  };

  const draw = (free = false) => {
    if (drawing) return;
    if (!free && save.gold < GACHA_COST) {
      sfx.deny();
      toast(t('needGold'));
      return;
    }
    const result = drawGacha(Math.random, free);
    if (!result) return;
    const color = RARITY_COLOR[result.item.rarity];
    const tier = RARITY_ORDER.indexOf(result.item.rarity);
    chestSequence(
      color,
      () => {
        // 빛의 색이 등급을 알려준다
        if (result.isNew) sfx.reveal(tier);
        else sfx.dud();
        const r = chest.getBoundingClientRect();
        burst(r.left + r.width / 2, r.top + r.height * 0.45, [color, '#ffffff', color], result.isNew ? 30 + tier * 30 : 12, 380 + tier * 120);
      },
      () => {
        const m = modal(`
          <div class="reveal ${result.isNew ? 'new' : 'dup'}" style="--c:${color}">
            <div class="reveal-rays"></div>
            <canvas width="240" height="240"></canvas>
            <span class="rarity">${t(result.item.rarity as StringKey)}</span>
            <h2>${itemName(result.item)}</h2>
            <p>${result.isNew ? t('newItem') : t('duplicate')}</p>
          </div>
          <button class="btn" data-a="ok">${t('ok')}</button>`);
        drawItemPreview(m.el.querySelector('canvas')!, result.item.id, result.item.type, true);
        afterClose(m, () => {
          cosmeticsTab = result.isNew ? result.item.type : cosmeticsTab;
          showCosmetics();
        });
      },
    );
  };

  // 광고를 보고 골드 없이 한 번 뽑는다. 하루 횟수 제한이 있다.
  const adDraw = async () => {
    if (drawing || adDrawsLeft() <= 0) return;
    await ads.rewarded();
    useAdDraw();
    draw(true);
  };

  // 가진 골드만큼 한 번에 여러 번 뽑는다. 최대 10회이고, 9회분 골드만 있으면 9회가 된다.
  const drawMulti = () => {
    if (drawing) return;
    const count = Math.min(MULTI_MAX, Math.floor(save.gold / GACHA_COST));
    const results: GachaResult[] = [];
    for (let i = 0; i < count; i++) {
      const r = drawGacha();
      if (!r) break; // 도중에 모두 모으면 멈춘다. 남은 횟수의 골드는 쓰지 않는다.
      results.push(r);
    }
    if (!results.length) {
      sfx.deny();
      toast(t('needGold'));
      return;
    }
    const tierOf = (r: GachaResult) => RARITY_ORDER.indexOf(r.item.rarity);
    const best = results.reduce((a, b) => (tierOf(b) > tierOf(a) ? b : a));
    const color = RARITY_COLOR[best.item.rarity];
    const newCount = results.filter((r) => r.isNew).length;
    chestSequence(
      color,
      () => {
        if (newCount) sfx.reveal(tierOf(best));
        else sfx.dud();
        const r = chest.getBoundingClientRect();
        burst(r.left + r.width / 2, r.top + r.height * 0.45, [color, '#ffffff', '#ffd24d'], 40 + results.length * 8, 520);
      },
      () => {
        const cards = results
          .map(
            (r, i) => `<div class="multi-card ${r.isNew ? 'new' : 'dup'}" style="--c:${RARITY_COLOR[r.item.rarity]};animation-delay:${i * 70}ms">
              <canvas width="120" height="120"></canvas><span>${itemName(r.item)}</span>${r.isNew ? '<em>NEW</em>' : ''}</div>`,
          )
          .join('');
        const m = modal(`
          <h2 class="clear-title">${t('multiResult')}</h2>
          <div class="multi-grid">${cards}</div>
          <p class="multi-sum">${t('multiSum', { n: results.length, k: newCount })}</p>
          <button class="btn" data-a="ok">${t('ok')}</button>`);
        m.el.querySelectorAll('canvas').forEach((c, i) => drawItemPreview(c, results[i].item.id, results[i].item.type, true));
        afterClose(m, showCosmetics);
      },
    );
  };

  el.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (skipDraw && target.closest('.gacha')) {
      skipDraw();
      return;
    }
    const tab = target.closest<HTMLElement>('[data-tab]')?.dataset.tab as ItemType | undefined;
    if (tab) {
      cosmeticsTab = tab;
      el.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('on', (b as HTMLElement).dataset.tab === tab));
      fill();
      return;
    }
    const a = target.closest<HTMLElement>('[data-a]')?.dataset.a;
    if (a === 'back' && !drawing) showTitle();
    else if (a === 'draw') draw();
    else if (a === 'addraw') void adDraw();
    else if (a === 'multi') drawMulti();
  });
}
