// 진행, 골드, 뽑기 상태. 기기 로컬에만 저장한다.
import levelData from '../data/levels.json';
import { DEFAULT_SKIN, DEFAULT_TRAIL, ITEMS, ITEM_BY_ID, Item, RARITY_WEIGHT } from '../data/items';

export interface LevelInfo {
  id: string;
  world: number;
  index: number;
  rows: string[];
  minMoves: number;
  pushes: number;
  solution: string;
}

export const LEVELS = levelData as LevelInfo[];
export const LEVELS_PER_WORLD = 6;
export const WORLD_COUNT = 5;

export const GOLD_FIRST_CLEAR = 30;
export const GOLD_PER_STAR = 20;
export const GOLD_REPLAY = 5;
export const REPLAY_DAILY_LIMIT = 10;
export const GACHA_COST = 40;
export const PITY_STREAK = 3; // 중복이 이만큼 이어지면 다음은 새 아이템 확정

export interface SaveData {
  version: 1;
  stars: Record<string, number>;
  best: Record<string, number>;
  skipped: string | null;
  gold: number;
  owned: string[];
  skin: string;
  trail: string;
  dupStreak: number;
  replayDay: string;
  replayCount: number;
  clearsSinceAd: number;
  lastLevel: string;
  tutorial: number; // 끝낸 튜토리얼 단계 수
  tips: string[]; // 이미 본 블록 설명
  sfx: boolean;
  music: boolean;
  vibration: boolean;
  lang: 'ko' | 'en';
}

// 개발자 모드: 주소에 ?dev를 붙이면 모든 월드가 열리고 광고 화면을 건너뛴다.
// 일반 플레이 기록을 건드리지 않도록 저장 공간을 따로 쓴다.
export const DEV_MODE = typeof location !== 'undefined' && new URLSearchParams(location.search).has('dev');

const KEY = DEV_MODE ? 'block-labyrinth-save-dev' : 'block-labyrinth-save';

function defaults(): SaveData {
  return {
    version: 1,
    stars: {},
    best: {},
    skipped: null,
    gold: 0,
    owned: [],
    skin: DEFAULT_SKIN,
    trail: DEFAULT_TRAIL,
    dupStreak: 0,
    replayDay: '',
    replayCount: 0,
    clearsSinceAd: 0,
    lastLevel: '1-1',
    tutorial: 0,
    tips: [],
    sfx: true,
    music: true,
    vibration: true,
    lang: typeof navigator !== 'undefined' && navigator.language.startsWith('ko') ? 'ko' : 'en',
  };
}

export let save: SaveData = defaults();

export function loadSave(): void {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) save = { ...defaults(), ...JSON.parse(raw) };
  } catch {
    save = defaults();
  }
}

export function persist(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch {
    // 저장 공간을 쓸 수 없어도 게임은 계속된다
  }
}

export function resetSave(): void {
  const keep = { sfx: save.sfx, music: save.music, vibration: save.vibration, lang: save.lang };
  save = { ...defaults(), ...keep };
  persist();
}

export function starsFor(moves: number, minMoves: number): number {
  if (moves <= minMoves) return 3;
  if (moves <= minMoves * 1.5) return 2;
  return 1;
}

export function worldLevels(world: number): LevelInfo[] {
  return LEVELS.filter((l) => l.world === world);
}

export function isPassed(id: string): boolean {
  return (save.stars[id] ?? 0) > 0 || save.skipped === id;
}

export function isWorldUnlocked(world: number): boolean {
  return DEV_MODE || world === 1 || worldLevels(world - 1).every((l) => isPassed(l.id));
}

export function worldStars(world: number): number {
  return worldLevels(world).reduce((n, l) => n + (save.stars[l.id] ?? 0), 0);
}

export function nextLevel(id: string): LevelInfo | null {
  const i = LEVELS.findIndex((l) => l.id === id);
  const next = LEVELS[i + 1];
  return next && isWorldUnlocked(next.world) ? next : null;
}

export function canSkip(id: string): boolean {
  if ((save.stars[id] ?? 0) > 0 || save.skipped === id) return false;
  // 건너뛴 레벨을 아직 깨지 않았다면 또 건너뛸 수 없다
  return save.skipped === null || (save.stars[save.skipped] ?? 0) > 0;
}

export function skipLevel(id: string): void {
  save.skipped = id;
  persist();
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export interface ClearReward {
  stars: number;
  newStars: number;
  gold: number;
  firstClear: boolean;
  bestMoves: number;
}

export function recordClear(level: LevelInfo, moves: number): ClearReward {
  const stars = starsFor(moves, level.minMoves);
  const prev = save.stars[level.id] ?? 0;
  const firstClear = prev === 0;
  const newStars = Math.max(0, stars - prev);
  let gold = newStars * GOLD_PER_STAR;
  if (firstClear) {
    gold += GOLD_FIRST_CLEAR;
  } else {
    if (save.replayDay !== today()) {
      save.replayDay = today();
      save.replayCount = 0;
    }
    if (save.replayCount < REPLAY_DAILY_LIMIT) {
      save.replayCount++;
      gold += GOLD_REPLAY;
    }
  }
  save.stars[level.id] = Math.max(prev, stars);
  save.best[level.id] = Math.min(save.best[level.id] ?? Infinity, moves);
  save.gold += gold;
  save.clearsSinceAd++;
  persist();
  return { stars, newStars, gold, firstClear, bestMoves: save.best[level.id] };
}

export function allCollected(): boolean {
  return save.owned.length >= ITEMS.length;
}

export function drawsUntilGuarantee(): number {
  return PITY_STREAK - save.dupStreak + 1;
}

function weightedPick(pool: Item[], rnd: () => number): Item {
  let total = 0;
  for (const it of pool) total += RARITY_WEIGHT[it.rarity];
  let roll = rnd() * total;
  for (const it of pool) {
    roll -= RARITY_WEIGHT[it.rarity];
    if (roll < 0) return it;
  }
  return pool[pool.length - 1];
}

export interface GachaResult {
  item: Item;
  isNew: boolean;
  guaranteed: boolean;
}

// 상태만 받아 한 번 뽑는다. 모의 실험과 테스트에서도 같은 함수를 쓴다.
export function rollGacha(owned: Set<string>, dupStreak: number, rnd: () => number): GachaResult & { dupStreak: number } {
  const guaranteed = dupStreak >= PITY_STREAK;
  const pool = guaranteed ? ITEMS.filter((i) => !owned.has(i.id)) : ITEMS;
  const item = weightedPick(pool, rnd);
  const isNew = !owned.has(item.id);
  return { item, isNew, guaranteed, dupStreak: isNew ? 0 : dupStreak + 1 };
}

export function drawGacha(rnd: () => number = Math.random): GachaResult | null {
  if (save.gold < GACHA_COST || allCollected()) return null;
  const r = rollGacha(new Set(save.owned), save.dupStreak, rnd);
  save.gold -= GACHA_COST;
  save.dupStreak = r.dupStreak;
  if (r.isNew) save.owned.push(r.item.id);
  persist();
  return { item: r.item, isNew: r.isNew, guaranteed: r.guaranteed };
}

export function equip(id: string): void {
  const item = ITEM_BY_ID.get(id);
  if (id === DEFAULT_SKIN) save.skin = id;
  else if (id === DEFAULT_TRAIL) save.trail = id;
  else if (item && save.owned.includes(id)) {
    if (item.type === 'skin') save.skin = id;
    else save.trail = id;
  }
  persist();
}
