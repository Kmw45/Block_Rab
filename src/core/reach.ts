// 한 레벨에서 일어날 수 있는 모든 상태를 탐색해, 퍼즐에 실제로 쓰일 수 있는 칸을 가려낸다.
// 레벨 생성기(쓸모없는 칸 정리), 점검 도구(tools/check-reach.ts), 테스트가 함께 쓴다.
import { BoardDef, Dir, State, TILE_DOOR, TILE_PIT, initialState, neighbor, stateKey, step } from './board';

export interface Reach {
  player: Uint8Array; // 캐릭터가 한 번이라도 지날 수 있는 칸
  block: Uint8Array; // 블록이 한 번이라도 놓일 수 있는 칸(처음 자리 포함)
  moved: Uint8Array; // 블록마다: 한 번이라도 밀 수 있는가
  limited: boolean; // 상태 수 한도에 걸려 끝까지 보지 못했다
  states: number;
}

// 한 수에서 캐릭터가 지나는 칸을 모두 표시한다(빙판에서 미끄러진 칸, 마법진으로 옮겨진 칸 포함)
export function markMove(def: BoardDef, from: number, dir: Dir, walkTo: number, end: number, seen: Uint8Array): void {
  for (let c = neighbor(def, from, dir); c >= 0; c = neighbor(def, c, dir)) {
    seen[c] = 1;
    if (c === walkTo) break;
  }
  seen[end] = 1;
}

export function explore(def: BoardDef, maxStates = 3000000): Reach {
  const n = def.w * def.h;
  const player = new Uint8Array(n);
  const block = new Uint8Array(n);
  const moved = new Uint8Array(def.kinds.length);
  const start = initialState(def);
  player[start.p] = 1;
  start.b.forEach((c) => (block[c] = 1));
  const queue: State[] = [start];
  const seen = new Set<string>([stateKey(start)]);
  let limited = false;
  search: for (let head = 0; head < queue.length; head++) {
    const cur = queue[head];
    for (let d = 0; d < 4; d++) {
      const r = step(def, cur, d as Dir);
      if (!r.ok) continue;
      markMove(def, cur.p, d as Dir, r.walkTo, r.state.p, player);
      r.state.b.forEach((c, i) => {
        block[c] = 1;
        if (c !== cur.b[i]) moved[i] = 1;
      });
      if (r.won) continue;
      const key = stateKey(r.state);
      if (seen.has(key)) continue;
      seen.add(key);
      queue.push(r.state);
      if (queue.length >= maxStates) {
        limited = true;
        break search;
      }
    }
    queue[head] = undefined as unknown as State; // 지난 상태는 버려 메모리를 아낀다
  }
  return { player, block, moved, limited, states: seen.size };
}

export interface Waste {
  dead: number[]; // 캐릭터도 블록도 절대 닿지 않는 빈칸
  deadDoors: number[]; // 아무도 지나지 못하는 문
  deadPits: number[]; // 절대 메워지지 않는 구덩이(벽과 다를 바 없다)
  stuck: number[]; // 한 번도 밀 수 없는 블록의 번호
}

// 퍼즐에 전혀 쓰이지 않는 것들. 탐색이 한도에 걸렸으면 판정할 수 없으므로 null.
export function findWaste(def: BoardDef, r: Reach): Waste | null {
  if (r.limited) return null;
  const out: Waste = { dead: [], deadDoors: [], deadPits: [], stuck: [] };
  for (let c = 0; c < def.w * def.h; c++) {
    if (def.solid[c] !== 0 || r.player[c] || r.block[c]) continue;
    if (def.tile[c] === TILE_PIT) out.deadPits.push(c);
    else if (def.tile[c] === TILE_DOOR) out.deadDoors.push(c);
    else out.dead.push(c);
  }
  def.kinds.forEach((_, i) => !r.moved[i] && out.stuck.push(i));
  return out;
}
