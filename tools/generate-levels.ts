// 레벨 후보를 무작위로 만들고 솔버로 걸러 월드당 12개를 난이도 편성표(SLOTS)에 맞춰 고른다.
// 통과 조건: 풀린다, 밀지 않고는 못 푼다, 그 던전의 블록과 기믹을 해답에서 쓴다,
// 쓸모없는 칸이 없다(모든 상태를 탐색해 캐릭터도 블록도 닿지 않는 칸·못 미는 블록은 벽으로 정리한 뒤 다시 검증),
// 해답 밖의 갈 수 있는 칸(헷갈리는 길)이 조금은 있다.
// 사용: npm run levels -- [월드당 초] [시드] [월드 번호 쉼표 목록]
// 월드별 결과를 tools/level-cache에 따로 저장하므로, 모자란 월드만 다시 돌리거나 여러 월드를 동시에 돌릴 수 있다.
// 여덟 월드의 결과가 모두 있으면 src/data/levels.json으로 합친다.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { BlockKind, DIR_CHARS, TILE_DOOR, TILE_ONEWAY, initialState, parseLevel, step, Dir, BoardDef } from '../src/core/board';
import { solve } from '../src/core/solver';
import { explore, findWaste, markMove } from '../src/core/reach';

interface WorldSpec {
  world: number;
  size: number;
  range: [number, number];
  symbols: string[]; // 이 월드에서 쓸 수 있는 움직이는 블록
  fresh: string[]; // 이 월드에서 처음 나오는 블록
  finale?: boolean; // 마지막 던전: 블록 종류와 기믹을 여러 가지 섞어 써야 한다
  gimmicks: Gimmick[]; // 이 던전의 바닥 기믹
}

type Gimmick = 'pit' | 'oneway' | 'slip' | 'portal' | 'door' | 'crumble';

const WORLDS: WorldSpec[] = [
  { world: 1, size: 6, range: [8, 20], symbols: ['B'], fresh: ['B'], gimmicks: ['pit'] },
  { world: 2, size: 6, range: [12, 25], symbols: ['B', 'H', 'V'], fresh: ['H', 'V'], gimmicks: ['oneway'] },
  { world: 3, size: 7, range: [15, 30], symbols: ['B', 'H', 'V', 'I'], fresh: ['I'], gimmicks: ['slip'] },
  { world: 4, size: 7, range: [20, 35], symbols: ['B', 'H', 'V', 'I', 'N'], fresh: ['N'], gimmicks: ['portal'] },
  { world: 5, size: 7, range: [18, 34], symbols: ['B', 'H', 'V', 'I', 'N'], fresh: [], gimmicks: ['door'] },
  { world: 6, size: 7, range: [18, 34], symbols: ['B', 'H', 'V', 'I', 'N'], fresh: [], gimmicks: ['crumble'] },
  { world: 7, size: 7, range: [18, 34], symbols: ['B', 'H', 'V', 'I', 'N', 'L'], fresh: ['L'], gimmicks: [] },
  {
    world: 8,
    size: 8,
    range: [25, 45],
    symbols: ['B', 'H', 'V', 'I', 'N', 'L'],
    fresh: [],
    finale: true,
    gimmicks: ['pit', 'oneway', 'slip', 'portal', 'door', 'crumble'],
  },
];

const INTRO_RANGE: [number, number] = [4, 8];
const MAX_MOVABLE = 6;
const PER_WORLD = 12; // 던전당 스테이지 수. src/game/store.ts의 LEVELS_PER_WORLD와 같아야 한다
const SOLVE_CAP = 200000;
const REACH_CAP = 250000; // 기기에서 힌트 탐색이 0.5초 안에 끝나도록 상태 수를 제한한다

function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Candidate {
  rows: string[];
  minMoves: number;
  pushes: number;
  solution: string;
  score: number;
  kindsPushed: number;
  intro: boolean;
  teaches: boolean; // 소개용인데 그 던전의 기믹까지 해답에서 쓴다
  role?: Role;
}

// 던전 한 곳의 12칸 편성. [역할, 본편 후보를 쉬운 순으로 줄 세웠을 때의 위치(0~1)]
// 레퍼런스: Patrick's Parabox는 작은 판에서 규칙 하나를 가르친 뒤 넓은 판에서 응용시키고,
// 캔디크러시 계열은 난이도를 톱니 모양으로 올린다(고비 뒤에 쉬운 판을 두어 이탈을 막는다).
// 그래서 소개 1 → 연습 2 → 응용 2 → 고비 → 쉬어가기 → 응용 2 → 고비 → 쉬어가기 → 보스 순이다.
type Role = 'intro' | 'easy' | 'mid' | 'hard' | 'rest' | 'boss';
const SLOTS: [Role, number][] = [
  ['intro', 0],
  ['easy', 0.05],
  ['easy', 0.18],
  ['mid', 0.35],
  ['mid', 0.5],
  ['hard', 0.8],
  ['rest', 0.25],
  ['mid', 0.58],
  ['mid', 0.68],
  ['hard', 0.9],
  ['rest', 0.42],
  ['boss', 1],
];
const MIN_OPEN = 0.45; // 정리한 뒤에도 판의 이만큼은 벽이 아니어야 한다
const MIN_DECOY = 3; // 본편은 해답 밖의 갈 수 있는 칸이 이만큼은 있어야 한다

function kindGroup(k: BlockKind): string {
  return k === 'railH' || k === 'railV' ? 'rail' : k;
}

function isFresh(spec: WorldSpec, k: BlockKind): boolean {
  const sym = k === 'normal' ? 'B' : k === 'railH' ? 'H' : k === 'railV' ? 'V' : k === 'ice' ? 'I' : k === 'link' ? 'L' : 'N';
  return spec.fresh.includes(sym);
}

// 마지막으로 살펴본 해답에서 무너진 바닥의 수
let lastCrumbles = 0;

// 해답을 따라가며 실제로 쓰인 기믹을 모은다
function gimmicksUsed(def: BoardDef, path: Dir[]): Set<Gimmick> {
  const used = new Set<Gimmick>();
  lastCrumbles = 0;
  let s = initialState(def);
  for (const d of path) {
    const r = step(def, s, d);
    if (r.sunk) used.add('pit');
    if (r.teleported) used.add('portal');
    if (r.crumbled >= 0) {
      used.add('crumble');
      lastCrumbles++;
    }
    if (def.tile[r.walkTo] === TILE_DOOR || (r.pushed >= 0 && def.tile[r.to] === TILE_DOOR)) used.add('door');
    const t = def.tile[r.walkTo];
    if (t >= TILE_ONEWAY && t < TILE_ONEWAY + 4) used.add('oneway');
    const pushDist = r.pushed >= 0 ? Math.abs(r.to - r.from) / (d % 2 === 0 ? def.w : 1) : 0;
    if (r.slid > 0 || (pushDist > 1 && def.kinds[r.pushed] !== 'ice')) used.add('slip');
    s = r.state;
  }
  return used;
}

// 움직이는 블록을 전부 고정 블록으로 바꾼 판. 이 판이 풀리면 밀 필요가 없는 레벨이다.
function freezeAll(rows: string[]): string[] {
  return rows.map((r) => r.replace(/[BHVI123L]/g, 'X'));
}
// 새 블록을 고정 블록으로 바꾼 판. 이 판이 풀리면 새 블록 없이도 풀리는 레벨이다.
function freezeFresh(rows: string[], spec: WorldSpec): string[] {
  const set = new Set(spec.fresh.map((s) => (s === 'N' ? '123' : s)).join(''));
  return rows.map((r) => [...r].map((ch) => (set.has(ch) ? 'X' : ch)).join(''));
}

function randomRows(spec: WorldSpec, rnd: () => number): string[] {
  const n = spec.size;
  const cells: string[] = new Array(n * n).fill('.');
  const free = () => {
    for (;;) {
      const i = (rnd() * cells.length) | 0;
      if (cells[i] === '.') return i;
    }
  };
  const wallCount = Math.round(n * n * (0.14 + rnd() * 0.2));
  for (let i = 0; i < wallCount; i++) cells[free()] = '#';
  const fixedCount = (rnd() * 4) | 0;
  for (let i = 0; i < fixedCount; i++) cells[free()] = 'X';
  cells[free()] = 'P';
  cells[free()] = 'E';
  for (const g of spec.gimmicks) {
    if (spec.gimmicks.length > 1 && rnd() < 0.5) continue;
    if (g === 'pit') for (let i = 1 + ((rnd() * 2) | 0); i > 0; i--) cells[free()] = 'O';
    if (g === 'oneway') for (let i = 1 + ((rnd() * 3) | 0); i > 0; i--) cells[free()] = '^>v<'[(rnd() * 4) | 0];
    if (g === 'slip') for (let i = 4 + ((rnd() * 7) | 0); i > 0; i--) cells[free()] = '~';
    if (g === 'portal') {
      cells[free()] = '@';
      cells[free()] = '@';
    }
    if (g === 'door') {
      for (let i = 1 + ((rnd() * 2) | 0); i > 0; i--) cells[free()] = 's';
      for (let i = 1 + ((rnd() * 2) | 0); i > 0; i--) cells[free()] = 'D';
    }
    if (g === 'crumble') for (let i = 4 + ((rnd() * 7) | 0); i > 0; i--) cells[free()] = 'c';
  }

  const movable = 2 + ((rnd() * (MAX_MOVABLE - 1)) | 0);
  const freshCount = spec.fresh.length ? 1 + ((rnd() * 3) | 0) : 0;
  for (let i = 0; i < movable; i++) {
    const pool = i < freshCount ? spec.fresh : spec.symbols;
    let sym = pool[(rnd() * pool.length) | 0];
    if (sym === 'N') sym = String(1 + ((rnd() * 3) | 0));
    cells[free()] = sym;
  }
  const rows: string[] = [];
  for (let y = 0; y < n; y++) rows.push(cells.slice(y * n, y * n + n).join(''));
  return rows;
}

function evaluate(rows: string[], spec: WorldSpec, repaired = false): Candidate | null {
  const def = parseLevel(rows);
  const frozenAll = parseLevel(freezeAll(rows));
  if (solve(frozenAll, initialState(frozenAll), { maxStates: SOLVE_CAP }).status !== 'unsolvable') return null;

  const res = solve(def, initialState(def), { maxStates: SOLVE_CAP });
  if (res.status !== 'solved') return null;
  const moves = res.path.length;
  const inMain = moves >= spec.range[0] && moves <= spec.range[1];
  const inIntro = moves >= INTRO_RANGE[0] && moves <= INTRO_RANGE[1];
  if (!inMain && !inIntro) return null;
  const intro = !inMain;
  if (res.pushes < (intro ? 1 : 2)) return null;

  const groups = new Set(res.pushedBlocks.map((i) => kindGroup(def.kinds[i])));
  const used = gimmicksUsed(def, res.path);
  // 본편 레벨은 해답에서 그 던전의 기믹을 실제로 써야 한다
  if (!intro && spec.gimmicks.length && !spec.gimmicks.some((g) => used.has(g))) return null;
  // 무너지는 바닥 던전은 바닥이 두 칸 이상 무너져야 그 규칙이 드러난다
  if (!intro && !spec.finale && spec.gimmicks[0] === 'crumble' && lastCrumbles < 2) return null;
  // 쌍둥이 블록은 둘 이상이어야 의미가 있다
  if (def.kinds.filter((k) => k === 'link').length === 1) return null;
  if (spec.fresh.length) {
    if (!res.pushedBlocks.some((i) => isFresh(spec, def.kinds[i]))) return null;
    const frozen = parseLevel(freezeFresh(rows, spec));
    if (solve(frozen, initialState(frozen), { maxStates: SOLVE_CAP }).status !== 'unsolvable') return null;
  } else if (spec.finale && !intro && (groups.size < 2 || groups.size + used.size < 4)) {
    return null; // 마지막 던전은 블록 종류와 기믹을 합쳐 4가지 이상 써야 한다
  } else if (spec.finale && intro && groups.size < 2) {
    return null;
  }

  // 모든 상태를 탐색해 퍼즐에 전혀 쓰이지 않는 것을 찾는다
  const reach = explore(def, REACH_CAP);
  const waste = findWaste(def, reach);
  if (!waste) return null;
  if (waste.dead.length || waste.deadDoors.length || waste.deadPits.length || waste.stuck.length) {
    if (repaired) return null;
    // 쌍둥이 블록은 고정 블록으로 바꾸면 나머지의 움직임이 달라지므로 고치지 않고 버린다
    if (waste.stuck.some((i) => def.kinds[i] === 'link')) return null;
    // 닿지 않는 칸은 벽으로, 못 미는 블록은 고정 블록으로 바꾼다. 어차피 닿지 않으므로 풀이는 그대로다.
    const cells = rows.join('').split('');
    [...waste.dead, ...waste.deadDoors, ...waste.deadPits].forEach((c) => (cells[c] = '#'));
    waste.stuck.forEach((i) => (cells[def.startPos[i]] = 'X'));
    if (cells.filter((ch) => ch === '@').length === 1) return null;
    const fixed = rows.map((_, y) => cells.slice(y * def.w, (y + 1) * def.w).join(''));
    return evaluate(fixed, spec, true);
  }
  let open = 0;
  for (let c = 0; c < def.w * def.h; c++) if (def.solid[c] === 0) open++;
  if (open < def.w * def.h * MIN_OPEN) return null;

  // 해답 밖의 갈 수 있는 칸: 헷갈리게 하는 길
  const onPath = new Uint8Array(def.w * def.h);
  let s = initialState(def);
  onPath[s.p] = 1;
  s.b.forEach((c) => (onPath[c] = 1));
  for (const d of res.path) {
    const r = step(def, s, d);
    markMove(def, s.p, d, r.walkTo, r.state.p, onPath);
    r.state.b.forEach((c) => (onPath[c] = 1));
    s = r.state;
  }
  let decoys = 0;
  for (let c = 0; c < def.w * def.h; c++) if (def.solid[c] === 0 && !onPath[c]) decoys++;
  if (!intro && decoys < MIN_DECOY) return null;

  return {
    rows,
    minMoves: moves,
    pushes: res.pushes,
    solution: res.path.map((d) => DIR_CHARS[d]).join(''),
    // 난이도: 해답 길이와 밀기 수에, 헤맬 수 있는 넓이(가능한 상태 수)를 더한다
    score: moves + res.pushes * 2 + Math.log2(reach.states) * 1.5,
    kindsPushed: groups.size,
    intro,
    teaches: intro && (!spec.gimmicks.length || spec.gimmicks.some((g) => used.has(g))),
  };
}

// 좌우·상하로 뒤집은 배치도 같은 레벨로 본다
function variants(rows: string[]): string[] {
  const flipH = rows.map((r) => [...r].reverse().join(''));
  const flipV = rows.slice().reverse();
  const both = flipH.slice().reverse();
  return [rows, flipH, flipV, both].map((r) => r.join('/'));
}

// 편성표의 칸마다 그 난이도 위치에 가장 가까운 후보를 고른다. 결과는 편성표 순서다.
function pick(cands: Candidate[]): Candidate[] {
  const teach = cands.filter((c) => c.intro && c.teaches);
  const intros = (teach.length ? teach : cands.filter((c) => c.intro)).sort((a, b) => a.score - b.score);
  const mains = cands.filter((c) => !c.intro).sort((a, b) => a.score - b.score);
  const out: Candidate[] = [];
  const used = new Set<number>();
  for (const [role, q] of SLOTS) {
    if (role === 'intro' && intros.length) {
      out.push({ ...intros[Math.floor(intros.length / 2)], role });
      continue;
    }
    const want = Math.round(q * (mains.length - 1));
    let idx = -1;
    for (let d = 0; d < mains.length && idx < 0; d++) {
      if (want - d >= 0 && !used.has(want - d)) idx = want - d;
      else if (want + d < mains.length && !used.has(want + d)) idx = want + d;
    }
    if (idx < 0) continue;
    used.add(idx);
    out.push({ ...mains[idx], role });
  }
  return out;
}

// 칸 하나를 바꾼 배치. 캐릭터와 출구는 그대로 두고 움직이는 블록 수 제한을 지킨다.
function mutate(rows: string[], spec: WorldSpec, rnd: () => number): string[] {
  const n = spec.size;
  const cells = rows.join('').split('');
  const movable = cells.filter((ch) => 'BHVI123L'.includes(ch)).length;
  if (rnd() < 0.12) {
    // 캐릭터나 출구를 빈 칸으로 옮긴다
    const who = rnd() < 0.5 ? 'P' : 'E';
    const empties = cells.map((ch, i) => (ch === '.' ? i : -1)).filter((i) => i >= 0);
    if (empties.length) {
      cells[cells.indexOf(who)] = '.';
      cells[empties[(rnd() * empties.length) | 0]] = who;
    }
  } else
  for (let guard = 0; guard < 50; guard++) {
    const i = (rnd() * cells.length) | 0;
    if (cells[i] === 'P' || cells[i] === 'E') continue;
    const wasMovable = 'BHVI123L'.includes(cells[i]);
    const roll = rnd();
    let sym: string;
    if (roll < 0.26) sym = '.';
    else if (roll < 0.46) sym = '#';
    else if (roll < 0.52) sym = 'X';
    else if (roll < 0.68) {
      const g = spec.gimmicks[(rnd() * spec.gimmicks.length) | 0];
      if (!g) continue;
      sym =
        g === 'pit' ? 'O' : g === 'slip' ? '~' : g === 'portal' ? '@' : g === 'crumble' ? 'c' : g === 'door' ? (rnd() < 0.5 ? 's' : 'D') : '^>v<'[(rnd() * 4) | 0];
    } else {
      if (!wasMovable && movable >= MAX_MOVABLE) continue;
      sym = spec.symbols[(rnd() * spec.symbols.length) | 0];
      if (sym === 'N') sym = String(1 + ((rnd() * 3) | 0));
    }
    if (sym === cells[i]) continue;
    cells[i] = sym;
    break;
  }
  // 마법진은 없거나 정확히 두 개여야 한다
  const portals = cells.map((ch, i) => (ch === '@' ? i : -1)).filter((i) => i >= 0);
  if (portals.length === 1) {
    const empties = cells.map((ch, i) => (ch === '.' ? i : -1)).filter((i) => i >= 0);
    if (empties.length) cells[empties[(rnd() * empties.length) | 0]] = '@';
    else cells[portals[0]] = '.';
  }
  for (let i = 2; i < portals.length; i++) cells[portals[i]] = '.';
  const out: string[] = [];
  for (let y = 0; y < n; y++) out.push(cells.slice(y * n, y * n + n).join(''));
  return out;
}

const CLIMB_CAP = 60000;

// 풀리는 배치에서 시작해, 해답이 길어지는 변형만 받아들이며 목표 길이까지 키운다.
function climbScore(rows: string[], spec: WorldSpec): { score: number; moves: number } | null {
  const def = parseLevel(rows);
  const r = solve(def, initialState(def), { maxStates: CLIMB_CAP });
  if (r.status !== 'solved' || r.pushes < 1 || r.path.length > spec.range[1]) return null;
  const groups = new Set(r.pushedBlocks.map((i) => kindGroup(def.kinds[i])));
  // 새 블록(조합 월드는 블록 종류 수)을 쓰는 해답을 유지하도록 점수에 넣는다
  const usesFresh = spec.fresh.length
    ? r.pushedBlocks.some((i) => isFresh(spec, def.kinds[i]))
      ? 1
      : 0
    : Math.min(groups.size, 3);
  const used = gimmicksUsed(def, r.path);
  const usesGimmick = spec.gimmicks.filter((g) => used.has(g)).length;
  return { score: r.path.length + r.pushes * 2 + usesFresh * 20 + Math.min(usesGimmick, 2) * 15, moves: r.path.length };
}

function climb(spec: WorldSpec, rnd: () => number): Candidate | null {
  let rows: string[] = [];
  let best = -1;
  for (let i = 0; i < 200 && best < 0; i++) {
    rows = randomRows(spec, rnd);
    best = climbScore(rows, spec)?.score ?? -1;
  }
  if (best < 0) return null;

  const target = spec.range[0] + rnd() * (spec.range[1] - spec.range[0]);
  let found: Candidate | null = null;
  let stale = 0;
  for (let iter = 0; iter < 1500 && stale < 300; iter++) {
    const next = mutate(rows, spec, rnd);
    const r = climbScore(next, spec);
    if (!r || r.score < best) {
      stale++;
      continue;
    }
    if (r.score > best) stale = 0;
    rows = next;
    best = r.score;
    if (r.moves >= spec.range[0]) {
      const c = evaluate(rows, spec);
      if (c && !c.intro) {
        found = c;
        if (r.moves >= target) break;
      }
    }
  }
  return found;
}

const seconds = Number(process.argv[2] ?? 40);
const seed = Number(process.argv[3] ?? 20261003);
const onlyWorlds = process.argv[4]?.split(',').map(Number);
const CACHE = new URL('./level-cache/', import.meta.url);
mkdirSync(CACHE, { recursive: true });

for (const spec of WORLDS.filter((w) => !onlyWorlds || onlyWorlds.includes(w.world))) {
  const rnd = mulberry32(seed + spec.world * 7919);
  const seenLayouts = new Set<string>();
  const passed: Candidate[] = [];
  let tried = 0;
  const start = Date.now();
  const end = start + seconds * 1000;
  const introEnd = start + seconds * 150;
  const minPushes = spec.world === 1 ? 2 : 3;
  while (Date.now() < end) {
    tried++;
    let c: Candidate | null;
    if (Date.now() < introEnd) {
      c = evaluate(randomRows(spec, rnd), spec);
      if (c && !c.intro) c = null;
    } else {
      c = climb(spec, rnd);
      if (c && c.pushes < minPushes) c = null;
    }
    if (!c) continue;
    const vs = variants(c.rows);
    if (vs.some((v) => seenLayouts.has(v))) continue;
    vs.forEach((v) => seenLayouts.add(v));
    passed.push(c);
  }
  const chosen = pick(passed);
  const mains = passed.filter((c) => !c.intro).length;
  console.log(
    `월드 ${spec.world}: 후보 ${tried}개 중 통과 ${passed.length}개 (소개용 ${passed.length - mains}, 본편 ${mains}) -> ` +
      chosen.map((c) => `${c.role}:${c.minMoves}수/${c.pushes}밀기`).join(', '),
  );
  if (chosen.length < PER_WORLD) {
    console.error(`월드 ${spec.world}: ${PER_WORLD}개를 채우지 못했습니다 (${chosen.length}개)`);
    continue;
  }
  const out = chosen.map((c, i) => ({
    id: `${spec.world}-${i + 1}`,
    world: spec.world,
    index: i + 1,
    rows: c.rows,
    minMoves: c.minMoves,
    pushes: c.pushes,
    solution: c.solution,
    role: c.role,
  }));
  writeFileSync(new URL(`world-${spec.world}.json`, CACHE), JSON.stringify(out));
}

// 모든 월드의 결과가 있으면 합친다
const missing = WORLDS.filter((w) => !existsSync(new URL(`world-${w.world}.json`, CACHE))).map((w) => w.world);
if (missing.length) {
  console.log(`아직 결과가 없는 월드: ${missing.join(', ')}`);
} else {
  const levels = WORLDS.flatMap((w) => JSON.parse(readFileSync(new URL(`world-${w.world}.json`, CACHE), 'utf8')));
  writeFileSync(new URL('../src/data/levels.json', import.meta.url), JSON.stringify(levels, null, 1) + '\n');
  console.log(`levels.json에 ${levels.length}개 저장`);
}
