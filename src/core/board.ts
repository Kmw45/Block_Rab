// 게임 규칙. 화면과 분리된 순수 코드이며 플레이, 솔버, 힌트, 레벨 검증이 함께 쓴다.

export type Dir = 0 | 1 | 2 | 3; // 위, 오른쪽, 아래, 왼쪽
export const DIR_CHARS = 'URDL';
export const DX = [0, 1, 0, -1];
export const DY = [-1, 0, 1, 0];

export type BlockKind = 'normal' | 'railH' | 'railV' | 'ice' | 'count';

export const SOLID_WALL = 1;
export const SOLID_FIXED = 2;

// 바닥 기믹. 일방통행은 TILE_ONEWAY + 방향(0~3)이다.
export const TILE_NONE = 0;
export const TILE_PIT = 1; // 구덩이: 블록을 밀어 넣어 메워야 지나갈 수 있다
export const TILE_ONEWAY = 2; // 2~5: 화살표 방향으로 움직일 때만 들어갈 수 있다
export const TILE_SLIP = 6; // 빙판: 올라서면 막힐 때까지 미끄러진다
export const TILE_PORTAL = 7; // 마법진: 밟으면 짝이 되는 마법진으로 옮겨진다

export const SUNK = -2; // 구덩이에 빠져 바닥이 된 블록의 횟수 값

export interface BoardDef {
  w: number;
  h: number;
  solid: Uint8Array; // 0 = 바닥, 1 = 벽, 2 = 고정 블록
  tile: Uint8Array;
  portals: number[]; // 없거나 두 칸
  exit: number;
  start: number;
  kinds: BlockKind[];
  startPos: number[];
  startCount: number[]; // 횟수 블록만 1~3, 나머지는 -1(제한 없음)
}

export interface State {
  p: number;
  b: number[];
  c: number[];
}

export interface StepResult {
  ok: boolean;
  state: State;
  pushed: number; // 밀린 블록 번호, 없으면 -1
  from: number;
  to: number;
  bumpCell: number; // 막혔을 때 부딪힌 칸, 격자 밖이면 -1
  bumpBlock: number;
  won: boolean;
  becameFixed: boolean; // 횟수 블록이 0이 됨
  sunk: boolean; // 밀린 블록이 구덩이를 메움
  walkTo: number; // 캐릭터가 걸어서(미끄러져서) 도착한 칸. 마법진을 탔다면 순간이동 전 칸
  slid: number; // 캐릭터가 빙판에서 더 미끄러진 칸 수
  teleported: boolean;
}

const KIND_BY_SYMBOL: Record<string, BlockKind> = { B: 'normal', H: 'railH', V: 'railV', I: 'ice' };
const ONEWAY_SYMBOLS = '^>v<';

export function parseLevel(rows: string[]): BoardDef {
  const h = rows.length;
  const w = rows[0].length;
  const solid = new Uint8Array(w * h);
  const tile = new Uint8Array(w * h);
  const portals: number[] = [];
  const kinds: BlockKind[] = [];
  const startPos: number[] = [];
  const startCount: number[] = [];
  let exit = -1;
  let start = -1;
  for (let y = 0; y < h; y++) {
    if (rows[y].length !== w) throw new Error(`줄 길이가 다릅니다: ${y}`);
    for (let x = 0; x < w; x++) {
      const ch = rows[y][x];
      const i = y * w + x;
      if (ch === '.') continue;
      if (ch === '#') solid[i] = SOLID_WALL;
      else if (ch === 'X') solid[i] = SOLID_FIXED;
      else if (ch === 'O') tile[i] = TILE_PIT;
      else if (ch === '~') tile[i] = TILE_SLIP;
      else if (ch === '@') {
        tile[i] = TILE_PORTAL;
        portals.push(i);
      } else if (ONEWAY_SYMBOLS.includes(ch)) tile[i] = TILE_ONEWAY + ONEWAY_SYMBOLS.indexOf(ch);
      else if (ch === 'P') {
        if (start >= 0) throw new Error('캐릭터가 둘 이상입니다');
        start = i;
      } else if (ch === 'E') {
        if (exit >= 0) throw new Error('출구가 둘 이상입니다');
        exit = i;
      } else if (ch >= '1' && ch <= '3') {
        kinds.push('count');
        startPos.push(i);
        startCount.push(Number(ch));
      } else if (KIND_BY_SYMBOL[ch]) {
        kinds.push(KIND_BY_SYMBOL[ch]);
        startPos.push(i);
        startCount.push(-1);
      } else throw new Error(`허용되지 않은 기호: ${ch}`);
    }
  }
  if (start < 0) throw new Error('캐릭터가 없습니다');
  if (exit < 0) throw new Error('출구가 없습니다');
  if (portals.length !== 0 && portals.length !== 2) throw new Error('마법진은 두 개가 짝이어야 합니다');
  return { w, h, solid, tile, portals, exit, start, kinds, startPos, startCount };
}

export function initialState(def: BoardDef): State {
  return { p: def.start, b: def.startPos.slice(), c: def.startCount.slice() };
}

export function neighbor(def: BoardDef, cell: number, dir: Dir): number {
  const x = (cell % def.w) + DX[dir];
  const y = ((cell / def.w) | 0) + DY[dir];
  if (x < 0 || y < 0 || x >= def.w || y >= def.h) return -1;
  return y * def.w + x;
}

// 그 칸에 서 있는 블록. 구덩이를 메운 블록은 바닥으로 본다.
export function blockAt(s: State, cell: number): number {
  for (let i = 0; i < s.b.length; i++) if (s.b[i] === cell && s.c[i] !== SUNK) return i;
  return -1;
}

function isOpenPit(def: BoardDef, s: State, cell: number): boolean {
  if (def.tile[cell] !== TILE_PIT) return false;
  for (let i = 0; i < s.b.length; i++) if (s.b[i] === cell && s.c[i] === SUNK) return false;
  return true;
}

function onewayAllows(def: BoardDef, cell: number, dir: Dir): boolean {
  const t = def.tile[cell];
  return t < TILE_ONEWAY || t >= TILE_ONEWAY + 4 || t - TILE_ONEWAY === dir;
}

function canPush(kind: BlockKind, count: number, dir: Dir): boolean {
  if (kind === 'railH') return dir === 1 || dir === 3;
  if (kind === 'railV') return dir === 0 || dir === 2;
  if (kind === 'count') return count > 0;
  return true;
}

// 블록이 들어갈 수 있는 칸인가. 출구와 마법진은 블록으로 막을 수 없다.
function blockCanEnter(def: BoardDef, s: State, cell: number, dir: Dir): boolean {
  return (
    cell >= 0 &&
    def.solid[cell] === 0 &&
    cell !== def.exit &&
    def.tile[cell] !== TILE_PORTAL &&
    onewayAllows(def, cell, dir) &&
    blockAt(s, cell) < 0
  );
}

// 캐릭터가 밀지 않고 그냥 들어갈 수 있는 칸인가
function playerCanEnter(def: BoardDef, s: State, cell: number, dir: Dir): boolean {
  return cell >= 0 && def.solid[cell] === 0 && onewayAllows(def, cell, dir) && !isOpenPit(def, s, cell) && blockAt(s, cell) < 0;
}

export function step(def: BoardDef, s: State, dir: Dir): StepResult {
  const res: StepResult = {
    ok: false,
    state: s,
    pushed: -1,
    from: -1,
    to: -1,
    bumpCell: -1,
    bumpBlock: -1,
    won: false,
    becameFixed: false,
    sunk: false,
    walkTo: -1,
    slid: 0,
    teleported: false,
  };
  const target = neighbor(def, s.p, dir);
  if (target < 0) return res;
  res.bumpCell = target;
  if (def.solid[target] !== 0 || !onewayAllows(def, target, dir)) return res;

  let b = s.b;
  let c = s.c;
  const bi = blockAt(s, target);
  if (bi < 0) {
    if (isOpenPit(def, s, target)) return res;
  } else {
    res.bumpBlock = bi;
    const kind = def.kinds[bi];
    if (!canPush(kind, s.c[bi], dir)) return res;
    let dest = neighbor(def, target, dir);
    if (!blockCanEnter(def, s, dest, dir)) return res;
    // 얼음 블록이거나 빙판 위라면 계속 미끄러지고, 구덩이를 만나면 빠진다
    while (!isOpenPit(def, s, dest) && (kind === 'ice' || def.tile[dest] === TILE_SLIP)) {
      const next = neighbor(def, dest, dir);
      if (!blockCanEnter(def, s, next, dir)) break;
      dest = next;
    }
    b = s.b.slice();
    b[bi] = dest;
    if (kind === 'count') {
      c = s.c.slice();
      c[bi]--;
      res.becameFixed = c[bi] === 0;
    }
    if (isOpenPit(def, s, dest)) {
      if (c === s.c) c = s.c.slice();
      c[bi] = SUNK;
      res.sunk = true;
      res.becameFixed = false;
    }
    res.pushed = bi;
    res.from = target;
    res.to = dest;
  }

  const next: State = { p: target, b, c };
  // 빙판에서는 막힐 때까지 미끄러진다. 미끄러지는 동안에는 블록을 밀지 못한다.
  while (def.tile[next.p] === TILE_SLIP && next.p !== def.exit) {
    const ahead = neighbor(def, next.p, dir);
    if (!playerCanEnter(def, next, ahead, dir)) break;
    next.p = ahead;
    res.slid++;
  }
  res.walkTo = next.p;
  if (def.tile[next.p] === TILE_PORTAL) {
    const other = def.portals[0] === next.p ? def.portals[1] : def.portals[0];
    if (blockAt(next, other) < 0) {
      next.p = other;
      res.teleported = true;
    }
  }
  res.ok = true;
  res.state = next;
  res.won = next.p === def.exit;
  return res;
}

export function stateKey(s: State): string {
  return s.p + '|' + s.b.join(',') + '|' + s.c.join(',');
}
