import { BoardDef, Dir, State, stateKey, step } from './board';

export interface SolveOptions {
  maxStates?: number;
  timeMs?: number;
  exhaustive?: boolean; // 해답을 찾은 뒤에도 끝까지 탐색해 도달 가능한 상태 수를 센다
}

export interface SolveResult {
  status: 'solved' | 'unsolvable' | 'limit';
  path: Dir[];
  pushes: number;
  pushedBlocks: number[]; // 해답에서 민 블록 번호(중복 없음)
  states: number;
}

// 너비 우선 탐색. 최소 이동 수의 해답을 돌려준다.
export function solve(def: BoardDef, from: State, opts: SolveOptions = {}): SolveResult {
  const maxStates = opts.maxStates ?? 400000;
  const deadline = opts.timeMs ? Date.now() + opts.timeMs : 0;
  const out: SolveResult = { status: 'unsolvable', path: [], pushes: 0, pushedBlocks: [], states: 1 };
  if (from.p === def.exit) {
    out.status = 'solved';
    return out;
  }

  const states: State[] = [from];
  const parent: number[] = [-1];
  const via: number[] = [-1];
  const pushedBy: number[] = [-1];
  const seen = new Set<string>([stateKey(from)]);
  let goal = -1;
  let limited = false;

  search: for (let head = 0; head < states.length; head++) {
    if (deadline && (head & 1023) === 0 && Date.now() > deadline) {
      limited = true;
      break;
    }
    const cur = states[head];
    for (let d = 0; d < 4; d++) {
      const r = step(def, cur, d as Dir);
      if (!r.ok) continue;
      if (r.won) {
        if (goal < 0) {
          states.push(r.state);
          parent.push(head);
          via.push(d);
          pushedBy.push(r.pushed);
          goal = states.length - 1;
          if (!opts.exhaustive) break search;
        }
        continue; // 출구에 들어가면 그 뒤는 탐색하지 않는다
      }
      const key = stateKey(r.state);
      if (seen.has(key)) continue;
      seen.add(key);
      states.push(r.state);
      parent.push(head);
      via.push(d);
      pushedBy.push(r.pushed);
      if (states.length >= maxStates) {
        limited = true;
        break search;
      }
    }
  }

  out.states = states.length;
  if (goal >= 0) {
    out.status = limited && opts.exhaustive ? 'limit' : 'solved';
    const blocks = new Set<number>();
    for (let i = goal; parent[i] >= 0; i = parent[i]) {
      out.path.push(via[i] as Dir);
      if (pushedBy[i] >= 0) {
        out.pushes++;
        blocks.add(pushedBy[i]);
      }
    }
    out.path.reverse();
    out.pushedBlocks = [...blocks];
  } else if (limited) {
    out.status = 'limit';
  }
  return out;
}
