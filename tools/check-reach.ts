// 레벨마다 "퍼즐에 전혀 쓰이지 않는 칸"이 있는지 점검한다.
// 시작 상태에서 갈 수 있는 모든 상태를 끝까지 탐색해, 캐릭터가 한 번이라도 지날 수 있는 칸과
// 블록이 한 번이라도 놓일 수 있는 칸을 모은다. 어느 쪽에도 들지 않는 빈칸은 죽은 칸이다.
// 해답에는 안 쓰이지만 갈 수는 있는 칸(헷갈리게 하는 부가 길)은 문제가 아니므로 수만 센다.
// 사용: npx tsx tools/check-reach.ts [최대 상태 수(기본 3000000)] [레벨 id 쉼표 목록]
import { readFileSync } from 'node:fs';
import { BoardDef, DIR_CHARS, Dir, TILE_DOOR, TILE_PIT, initialState, neighbor, parseLevel, step } from '../src/core/board';
import { explore as exploreAll, markMove } from '../src/core/reach';

interface Level {
  id: string;
  rows: string[];
  solution: string;
}
const raw = JSON.parse(readFileSync(new URL('../src/data/levels.json', import.meta.url), 'utf8'));
const all: Level[] = Array.isArray(raw) ? raw : raw.levels;
const maxStates = Number(process.argv[2]) || 3000000;
const only = process.argv[3]?.split(',');
const levels = only ? all.filter((l) => only.includes(l.id)) : all;

// 탐색이 한도에 걸린 레벨용: 블록·구덩이·문·일방통행을 모두 무시하고 벽만 따져 닿는 칸.
// 여기서도 안 닿으면 어떤 경우에도 못 가는 칸이다.
function optimistic(def: BoardDef): Uint8Array {
  const seen = new Uint8Array(def.w * def.h);
  const stack = [def.start];
  seen[def.start] = 1;
  if (def.portals.length) def.portals.forEach((p) => stack.push(p));
  while (stack.length) {
    const c = stack.pop()!;
    if (c !== def.start && !seen[c]) continue;
    for (let d = 0; d < 4; d++) {
      const nb = neighbor(def, c, d as Dir);
      if (nb < 0 || def.solid[nb] !== 0 || seen[nb]) continue;
      seen[nb] = 1;
      stack.push(nb);
    }
    if (def.portals.includes(c)) def.portals.forEach((p) => !seen[p] && ((seen[p] = 1), stack.push(p)));
  }
  return seen;
}

let bad = 0;
let unsure = 0;
let totalOpen = 0;
let totalDecoy = 0;
let stuckBlocks = 0;
const xy = (def: BoardDef, c: number) => `(${(c % def.w) + 1},${((c / def.w) | 0) + 1})`;

for (const lv of levels) {
  const def = parseLevel(lv.rows);
  const t0 = Date.now();
  const r = exploreAll(def, maxStates);
  const opt = r.limited ? optimistic(def) : null;

  // 해답이 지나는 칸
  const onPath = new Uint8Array(def.w * def.h);
  let s = initialState(def);
  onPath[s.p] = 1;
  for (const ch of lv.solution) {
    const d = DIR_CHARS.indexOf(ch) as Dir;
    const res = step(def, s, d);
    markMove(def, s.p, d, res.walkTo, res.state.p, onPath);
    res.state.b.forEach((c) => (onPath[c] = 1));
    s = res.state;
  }
  initialState(def).b.forEach((c) => (onPath[c] = 1));

  const dead: number[] = []; // 캐릭터도 블록도 절대 닿지 않는 빈칸
  const deadPit: number[] = []; // 절대 메워지지 않는 구덩이(벽과 같은 역할)
  const deadDoor: number[] = []; // 아무도 지나지 않는 문
  const maybe: number[] = []; // 한도 때문에 판정하지 못한 칸
  let open = 0;
  let decoy = 0;
  for (let c = 0; c < def.w * def.h; c++) {
    if (def.solid[c] !== 0) continue;
    open++;
    if (r.player[c] || r.block[c]) {
      if (!onPath[c]) decoy++;
      continue;
    }
    if (opt && opt[c]) maybe.push(c);
    else if (def.tile[c] === TILE_PIT) deadPit.push(c);
    else if (def.tile[c] === TILE_DOOR) deadDoor.push(c);
    else dead.push(c);
  }
  const stuck = def.kinds.map((_, i) => i).filter((i) => !r.moved[i] && !r.limited);
  totalOpen += open;
  totalDecoy += decoy;
  stuckBlocks += stuck.length;

  const notes: string[] = [];
  if (dead.length) notes.push(`죽은 칸 ${dead.length}개 ${dead.map((c) => xy(def, c)).join(' ')}`);
  if (deadDoor.length) notes.push(`아무도 못 지나는 문 ${deadDoor.length}개 ${deadDoor.map((c) => xy(def, c)).join(' ')}`);
  if (deadPit.length) notes.push(`메울 수 없는 구덩이 ${deadPit.length}개 ${deadPit.map((c) => xy(def, c)).join(' ')}`);
  if (stuck.length) notes.push(`한 번도 밀 수 없는 블록 ${stuck.length}개 ${stuck.map((i) => xy(def, def.startPos[i])).join(' ')}`);
  if (maybe.length) notes.push(`미확정 ${maybe.length}칸(상태 ${maxStates} 한도)`);
  if (dead.length || deadDoor.length) bad++;
  if (r.limited) unsure++;
  const head = `${lv.id.padEnd(5)} 칸 ${String(open).padStart(3)}  부가 길 ${String(decoy).padStart(2)}  상태 ${String(r.states).padStart(8)}  ${((Date.now() - t0) / 1000).toFixed(1)}s`;
  console.log(notes.length ? `${head}  << ${notes.join(' / ')}` : head);
  if (dead.length || deadDoor.length) {
    // 죽은 칸을 ?로 표시한 지도
    const mark = new Set([...dead, ...deadDoor]);
    lv.rows.forEach((row, y) => console.log('      ' + [...row].map((ch, x) => (mark.has(y * def.w + x) ? '?' : ch)).join('')));
  }
}

console.log(`\n레벨 ${levels.length}개: 죽은 칸이 있는 레벨 ${bad}개, 한도에 걸려 일부 미확정인 레벨 ${unsure}개`);
console.log(`빈칸 ${totalOpen}개 중 해답에는 안 쓰이지만 갈 수 있는 칸(부가 길) ${totalDecoy}개(${((totalDecoy / totalOpen) * 100).toFixed(0)}%), 한 번도 밀 수 없는 블록 ${stuckBlocks}개`);
