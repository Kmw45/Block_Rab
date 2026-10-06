// 보드 화면. 상태 변화를 받아 움직임과 효과만 재생한다. 규칙은 core에 있다.
import {
  BoardDef,
  DX,
  DY,
  Dir,
  SOLID_FIXED,
  SOLID_WALL,
  SUNK,
  State,
  StepResult,
  TILE_CRUMBLE,
  TILE_DOOR,
  TILE_ONEWAY,
  TILE_PIT,
  TILE_PORTAL,
  TILE_SLIP,
  TILE_SWITCH,
  blockAt,
  doorsOpen,
} from '../core/board';
import { WorldTheme } from '../data/worlds';
import { AnimName, TRAIL_LIFE, TrailMark, drawBlock, drawCharacter, drawFixed, drawStarShape, drawTrail, rr } from './draw';
import { getSheet, getSprite, getTinted } from './sprites';

const TAU = Math.PI * 2;
// 캐릭터 칸 가운데에서 꼬리 끝의 결정까지의 거리(칸 단위). 왼쪽을 볼 때는 좌우가 뒤집힌다.
const SLEEP_AFTER = 14; // 이만큼(초) 조작이 없으면 존다
const CRYSTAL_X = -0.48;
const CRYSTAL_Y = 0.18;
// 위를 보고 앉은 뒷모습에서는 꼬리가 오른쪽에 있다
const BACK_CRYSTAL_X = 0.29;
const BACK_CRYSTAL_Y = 0.07;
// 등을 보이는 동작. 앞모습 동작과 바뀌는 순간에는 종이를 뒤집듯 납작해졌다가 펴진다
const BACK_ANIMS: ReadonlySet<AnimName> = new Set(['walkU', 'pushU', 'idleB', 'bumpB']);
const TURN_TIME = 0.12;
const MOVE_TIME = 0.16;
// 디오라마 판(board_N 그림, 폭 900px로 줄인 것)에서 잰 치수(px): side는 좌우 턱, top은 위쪽 턱, bottom은 아래쪽 턱과 앞 단면을 합친 높이.
// slant는 그림이 위로 갈수록 좁아지는 정도(맨 위에서 한쪽이 안으로 들어온 px)다. 판의 칸은 반듯한 네모이므로 그릴 때 이만큼 펴서 쓴다(straighten).
// 그림마다 다르므로 그림을 다시 뽑으면 다시 잰다. 턱보다 조금 작게 적어야 판 안쪽 색이 바닥 밖으로 비치지 않는다.
const SLABS: { side: number; top: number; bottom: number; slant: number }[] = [
  { side: 62, top: 60, bottom: 205, slant: 22 },
  { side: 68, top: 45, bottom: 250, slant: 42 },
  { side: 50, top: 46, bottom: 178, slant: 35 },
  { side: 36, top: 26, bottom: 180, slant: 42 },
  { side: 46, top: 37, bottom: 186, slant: 38 },
  { side: 58, top: 42, bottom: 190, slant: 40 },
  { side: 76, top: 48, bottom: 204, slant: 41 },
  { side: 47, top: 22, bottom: 186, slant: 35 },
];
const straightened = new Map<HTMLImageElement, HTMLCanvasElement>();
const SLAB_FRONT = 0.62; // 앞 단면은 위에서 내려다본 것처럼 세로로 눌러 그린다
// 클리어: 여우가 빛기둥을 타고 떠올라(WIN_RISE부터) 별에 닿는 순간(WIN_MERGE) 별이 터진다
const WIN_RISE = 0.5;
const WIN_MERGE = 1.05;
const STAR_HEIGHT = 0.46; // 출구 위에 떠 있는 별의 높이(칸 단위)

// 막혔을 때 부딪힌 것. 흔들림과 소리가 이것에 따라 달라진다
export type BumpKind = 'edge' | 'wall' | 'fixed' | 'door' | 'oneway' | 'pit' | 'normal' | 'rail' | 'ice' | 'link' | 'locked';
const SLIDE_TIME_PER_CELL = 0.055;

interface Tween {
  fx: number;
  fy: number;
  tx: number;
  ty: number;
  t0: number;
  dur: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  size: number;
  color: string;
  grav: number;
  star?: boolean;
  tex?: string; // fx_* 그림. 없으면 도형으로 그린다
  grow?: number; // 수명 동안 커지는 배율
  rot?: number;
}

// 색을 흰색 쪽으로 밝힌다. 회색 그림에 곱할 월드 색을 만들 때 쓴다.
// 판의 틀과 줄눈 색(화면 시안의 크림색 판)
const BOARD_FRAME = '#f6ecd2';
const BOARD_GROUT = '#dccba4';

function now(): number {
  return performance.now() / 1000;
}

function tweenPos(t: Tween, time: number): [number, number] {
  const k = Math.min(1, Math.max(0, (time - t.t0) / t.dur));
  const e = 1 - (1 - k) * (1 - k) * (1 - k);
  return [t.fx + (t.tx - t.fx) * e, t.fy + (t.ty - t.fy) * e];
}

export class BoardView {
  private ctx: CanvasRenderingContext2D;
  private def!: BoardDef;
  private theme!: WorldTheme;
  private state!: State;
  private player: Tween = { fx: 0, fy: 0, tx: 0, ty: 0, t0: 0, dur: 1 };
  private blocks: Tween[] = [];
  private lock: number[] = [];
  private shakeBlock = -1;
  private shakeT0 = -9;
  private shakeDir: Dir = 0;
  private look: Dir = 2;
  private moveT0 = -9;
  private particles: Particle[] = [];
  private marks: TrailMark[] = [];
  private hint: Dir[] = [];
  private hintT0 = -9;
  private lastActT = now(); // 마지막으로 조작한 시각. 오래 지나면 캐릭터가 존다
  private winT0 = -1;
  private introT0 = -9;
  private warpT0 = -9; // 순간이동으로 나타난 시각. 캐릭터만 다시 튀어나온다
  private camShake = 0; // 화면 흔들림 세기(칸 단위)
  private pulseT0: number[] = [];
  private sink: number[] = [];
  // 캐릭터 동작: 움직이거나 밀 때 잠깐 걷기·밀기를 재생하고, 끝나면 숨쉬기로 돌아간다
  private animName: AnimName = 'idle';
  private animT0 = 0;
  private backShown = false; // 지금 등을 보이고 있는지
  private turnT0 = -9; // 앞뒤로 돌기 시작한 시각
  private turnFrom?: { name: AnimName; t: number; look: Dir }; // 도는 앞 절반 동안 보여 줄, 돌기 직전의 모습
  private shown?: { name: AnimName; t: number; look: Dir };
  private world = 1; // 던전 번호. 판, 벽, 바닥 그림을 고른다
  private shakeLink = false; // 쌍둥이 블록은 함께 흔들린다
  private cellFx = new Map<number, { t0: number; dir: Dir; kind: BumpKind | 'press' }>(); // 칸마다의 반응(벽의 흔들림, 문의 덜컹거림 등)
  private rings: { x: number; y: number; t0: number; life: number; color: string; r0: number; r1: number }[] = []; // 바닥에 누워 퍼지는 고리
  private starAng = 0; // 출구의 별이 도는 각도
  private animUntil = 0; // 구덩이에 가라앉은 정도(0~1)
  private pending: { at: number; run: () => void }[] = [];
  private last = now();
  private raf = 0;
  private cell = 40;
  private ox = 0;
  private oy = 0;
  private cssW = 0;
  private cssH = 0;
  private observer: ResizeObserver;
  skin = 'default';
  trail = 'none';

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(canvas);
  }

  load(def: BoardDef, theme: WorldTheme, state: State, world = 1): void {
    this.def = def;
    this.theme = theme;
    this.world = world;
    this.cellFx.clear();
    this.rings = [];
    this.particles = [];
    this.hint = [];
    this.winT0 = -1;
    this.look = 2;
    this.backShown = false;
    this.turnT0 = -9;
    this.blocks = def.kinds.map(() => ({ fx: 0, fy: 0, tx: 0, ty: 0, t0: 0, dur: 1 }));
    this.lock = def.kinds.map(() => 0);
    this.pulseT0 = def.kinds.map(() => -9);
    this.pending = [];
    this.camShake = 0;
    this.introT0 = now();
    this.setState(state, true);
    this.resize();
    if (!this.raf) this.raf = requestAnimationFrame(this.frame);
  }

  stop(): void {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private xy(cell: number): [number, number] {
    return [cell % this.def.w, (cell / this.def.w) | 0];
  }

  private retarget(t: Tween, cell: number, dur: number, instant: boolean): void {
    const time = now();
    const [x, y] = this.xy(cell);
    if (instant) {
      t.fx = t.tx = x;
      t.fy = t.ty = y;
      t.t0 = 0;
      t.dur = 1;
      return;
    }
    if (t.tx === x && t.ty === y) return;
    [t.fx, t.fy] = tweenPos(t, time);
    t.tx = x;
    t.ty = y;
    t.t0 = time;
    t.dur = dur;
  }

  // 되돌리기와 재시작처럼 임의의 상태로 맞출 때 쓴다
  setState(state: State, instant = false, resetTrail = true): void {
    this.state = state;
    this.retarget(this.player, state.p, MOVE_TIME, instant);
    state.b.forEach((cell, i) => this.retarget(this.blocks[i], cell, MOVE_TIME, instant));
    if (instant) {
      this.lock = state.c.map((c) => (c === 0 ? 1 : 0));
      this.sink = state.c.map((c) => (c === SUNK ? 1 : 0));
    }
    if (resetTrail) {
      const [x, y] = this.xy(state.p);
      this.marks = [{ x, y, dir: 2, born: now() }];
    } else if (this.marks.length > 1) {
      this.marks.pop();
    }
    this.hint = [];
  }

  applyStep(res: StepResult, dir: Dir): void {
    const time = now();
    const before = this.state;
    this.state = res.state;
    this.look = dir;
    // 쌍둥이 블록처럼 민 블록 말고도 함께 움직인 블록이 있으면 같이 옮긴다
    res.state.b.forEach((cell, i) => {
      if (i !== res.pushed && cell !== before.b[i]) {
        this.retarget(this.blocks[i], cell, MOVE_TIME, false);
        this.pending.push({ at: time + MOVE_TIME, run: () => (this.pulseT0[i] = now()) });
      }
    });
    if (res.crumbled >= 0) {
      // 밟고 떠난 바닥이 무너진다
      const [kx, ky] = this.xy(res.crumbled);
      this.camShake = Math.max(this.camShake, 0.03);
      for (let i = 0; i < 9; i++) {
        this.spawn(kx + 0.5, ky + 0.55, { color: 'rgba(120,90,80,0.8)', speed: 1.3, life: 0.5, size: 0.22, tex: 'fx_dust', grow: 1 });
      }
    }
    // 스위치가 눌리거나 풀리면 스위치에서 고리가 퍼지고 문이 덜컹거린다
    if (doorsOpen(this.def, before) !== doorsOpen(this.def, res.state)) {
      this.pending.push({
        at: time + MOVE_TIME * 0.8,
        run: () => {
          const t0 = now();
          const open = doorsOpen(this.def, this.state);
          for (const sw of this.def.switches) {
            if (open !== blockAt(this.state, sw) >= 0) continue;
            const [sx, sy] = this.xy(sw);
            this.cellFx.set(sw, { t0, dir, kind: 'press' });
            this.rings.push({ x: sx + 0.5, y: sy + 0.5, t0, life: 0.5, color: '#ffd978', r0: 0.2, r1: 0.9 });
          }
          this.def.tile.forEach((t, cell) => {
            if (t !== TILE_DOOR) return;
            const [dx, dy] = this.xy(cell);
            this.cellFx.set(cell, { t0, dir, kind: 'door' });
            for (let i = 0; i < 5; i++) this.spawn(dx + 0.5, dy + 0.6, { color: 'rgba(210,200,190,0.7)', speed: 0.9, life: 0.45, size: 0.2, tex: 'fx_dust', grow: 1 });
            if (open) for (let i = 0; i < 5; i++) this.spawn(dx + 0.5, dy + 0.5, { color: '#ffe2a8', speed: 1.6, life: 0.4, size: 0.12, tex: 'fx_spark' });
          });
        },
      });
    }
    this.moveT0 = time;
    this.lastActT = time;
    // 빙판에서는 미끄러진 칸 수만큼 길게 움직이고, 마법진을 탔다면 도착한 뒤 순간이동한다
    const walkDur = MOVE_TIME + res.slid * SLIDE_TIME_PER_CELL;
    // 가는 쪽을 본다: 옆으로는 옆모습, 위로는 뒷모습, 아래로는 앞모습
    const way = dir === 0 ? 'U' : dir === 2 ? 'D' : 'S';
    const clip: AnimName = `${res.pushed >= 0 ? 'push' : 'walk'}${way}`;
    this.playAnim(clip, (res.pushed >= 0 ? 0.3 : MOVE_TIME + 0.04) + res.slid * SLIDE_TIME_PER_CELL);
    this.retarget(this.player, res.walkTo, walkDur, false);
    if (res.slid > 0) this.moveT0 = time + walkDur - MOVE_TIME;
    if (res.teleported) {
      const dest = res.state.p;
      const from = res.walkTo;
      this.pending.push({
        at: time + walkDur,
        run: () => {
          this.retarget(this.player, dest, MOVE_TIME, true);
          this.warpT0 = now();
          for (const cell of [from, dest]) {
            const [wx, wy] = this.xy(cell);
            this.spawn(wx + 0.5, wy + 0.5, { color: '#c9a6ff', speed: 0, life: 0.5, size: 0.5, tex: 'fx_ring', grow: 2.6 });
            for (let i = 0; i < 8; i++) this.spawn(wx + 0.5, wy + 0.5, { color: '#d9c2ff', speed: 2, life: 0.45, size: 0.14, tex: 'fx_spark' });
          }
        },
      });
    }
    const [px, py] = this.xy(res.state.p);
    this.marks.push({ x: px, y: py, dir, born: time });
    if (this.marks.length > 90) this.marks.shift();

    if (res.pushed >= 0) {
      const dist = Math.abs(res.to - res.from) / (dir % 2 === 0 ? this.def.w : 1);
      const kind = this.def.kinds[res.pushed];
      this.retarget(this.blocks[res.pushed], res.to, kind === 'ice' ? Math.max(MOVE_TIME, dist * SLIDE_TIME_PER_CELL) : MOVE_TIME, false);
      const [fx, fy] = this.xy(res.from);
      const [tx, ty] = this.xy(res.to);
      const dur = kind === 'ice' ? Math.max(MOVE_TIME, dist * SLIDE_TIME_PER_CELL) : MOVE_TIME;
      const block = res.pushed;
      if (kind === 'ice') {
        for (let i = 0; i <= dist * 5; i++) {
          const k = i / (dist * 5 || 1);
          this.spawn(fx + 0.5 + DX[dir] * dist * k, fy + 0.5 + DY[dir] * dist * k, {
            color: i % 2 ? '#ffffff' : '#bfe9ff',
            speed: 0.6,
            life: 0.5 + Math.random() * 0.5,
            size: 0.035 + Math.random() * 0.04,
            star: i % 3 === 0,
          });
        }
        // 얼음이 멈추는 순간의 충격
        this.pending.push({
          at: time + dur,
          run: () => {
            this.pulseT0[block] = now();
            this.camShake = Math.max(this.camShake, 0.03 + dist * 0.012);
            const ix = tx + 0.5 + DX[dir] * 0.42;
            const iy = ty + 0.5 + DY[dir] * 0.42;
            this.spawn(ix, iy, { color: '#bfe9ff', speed: 0, life: 0.35, size: 0.35, tex: 'fx_ring', grow: 2.2 });
            for (let i = 0; i < 9; i++) {
              this.spawn(ix, iy, { color: '#e4f7ff', speed: 2.4, life: 0.4, size: 0.16, tex: 'fx_spark', vx: -DX[dir] * 1.2, vy: -DY[dir] * 1.2 });
            }
          },
        });
      } else {
        this.pending.push({ at: time + dur, run: () => (this.pulseT0[block] = now()) });
        for (let i = 0; i < 6; i++) {
          this.spawn(fx + 0.5 - DX[dir] * 0.3 + (Math.random() - 0.5) * 0.5, fy + 0.72 - DY[dir] * 0.3, {
            color: 'rgba(230,215,190,0.75)',
            speed: 0.7,
            life: 0.4 + Math.random() * 0.3,
            size: 0.2 + Math.random() * 0.12,
            vx: -DX[dir] * 0.8,
            vy: -DY[dir] * 0.8 - 0.3,
            tex: 'fx_dust',
            grow: 0.9,
          });
        }
      }
      if (res.sunk) {
        // 구덩이를 메우는 순간
        this.pending.push({
          at: time + dur,
          run: () => {
            this.camShake = Math.max(this.camShake, 0.06);
            for (let i = 0; i < 10; i++) {
              this.spawn(tx + 0.5, ty + 0.55, { color: 'rgba(230,215,190,0.75)', speed: 1.4, life: 0.5, size: 0.24, tex: 'fx_dust', grow: 1.1 });
            }
          },
        });
      }
      if (res.becameFixed) {
        this.camShake = Math.max(this.camShake, 0.05);
        this.spawn(tx + 0.5, ty + 0.5, { color: '#ff9a7d', speed: 0, life: 0.45, size: 0.5, tex: 'fx_ring', grow: 2 });
        for (let i = 0; i < 14; i++) {
          this.spawn(tx + 0.5, ty + 0.5, { color: i % 2 ? '#8d879f' : '#ff9a7d', speed: 2.2, life: 0.5, size: 0.06 });
        }
      }
    }
    if (this.hint.length && this.hint[0] === dir) this.hint = this.hint.slice(1);
    else this.hint = [];
  }

  // 막혔을 때: 부딪힌 것이 무엇인지 돌려주고(소리를 고르는 데 쓴다), 그것에 맞는 반응을 보여 준다
  bump(res: StepResult, dir: Dir): BumpKind {
    const { def, state } = this;
    const t0 = now();
    this.shakeBlock = res.bumpBlock;
    this.shakeT0 = t0;
    this.lastActT = t0;
    this.shakeDir = dir;
    this.look = dir;
    this.playAnim(dir === 0 ? 'bumpB' : 'bump', 0.4);

    const cell = res.bumpCell;
    const tile = cell >= 0 ? def.tile[cell] : 0;
    let kind: BumpKind;
    if (cell < 0) kind = 'edge';
    else if (def.solid[cell] === SOLID_WALL) kind = 'wall';
    else if (def.solid[cell] === SOLID_FIXED) kind = 'fixed';
    else if (tile >= TILE_ONEWAY && tile < TILE_ONEWAY + 4 && tile - TILE_ONEWAY !== dir) kind = 'oneway';
    else if (tile === TILE_DOOR && !doorsOpen(def, state)) kind = 'door';
    else if (res.bumpBlock >= 0) {
      const k = def.kinds[res.bumpBlock];
      kind = k === 'count' ? 'locked' : k === 'railH' || k === 'railV' ? 'rail' : k;
    } else kind = 'pit';
    this.shakeLink = kind === 'link';
    if (cell >= 0) this.cellFx.set(cell, { t0, dir, kind });

    // 부딪힌 자리(두 칸의 경계)에서 튀는 것들
    const [px, py] = this.xy(state.p);
    const hx = px + 0.5 + DX[dir] * 0.5;
    const hy = py + 0.5 + DY[dir] * 0.5;
    const back = { vx: -DX[dir] * 0.9, vy: -DY[dir] * 0.9 };
    const dust = (n: number, color = 'rgba(225,214,196,0.75)') => {
      for (let i = 0; i < n; i++) this.spawn(hx + (Math.random() - 0.5) * 0.3, hy + 0.1, { color, speed: 0.6, life: 0.35 + Math.random() * 0.25, size: 0.17 + Math.random() * 0.1, tex: 'fx_dust', grow: 0.9, ...back });
    };
    const chips = (n: number, color: string, star = false) => {
      for (let i = 0; i < n; i++) this.spawn(hx, hy, { color, speed: 1.6, life: 0.4 + Math.random() * 0.25, size: 0.045 + Math.random() * 0.035, grav: 4, star, vx: back.vx * 1.4, vy: back.vy * 1.4 - 0.8 });
    };
    const sparks = (n: number, color: string) => {
      for (let i = 0; i < n; i++) this.spawn(hx, hy, { color, speed: 2, life: 0.3, size: 0.13, tex: 'fx_spark', ...back });
    };
    if (kind === 'wall') {
      dust(4);
      chips(3, '#9a94a6');
    } else if (kind === 'fixed' || kind === 'locked') {
      dust(4);
      this.camShake = Math.max(this.camShake, 0.02);
      if (kind === 'locked') this.rings.push({ x: hx + DX[dir] * 0.5, y: hy + DY[dir] * 0.5, t0, life: 0.35, color: '#ff9a7d', r0: 0.25, r1: 0.6 });
    } else if (kind === 'edge') {
      dust(3);
      this.camShake = Math.max(this.camShake, 0.025);
    } else if (kind === 'door') {
      sparks(6, '#ffc7a0');
      this.camShake = Math.max(this.camShake, 0.02);
    } else if (kind === 'oneway') {
      // 화살표가 가리키는 쪽으로 바람이 밀어낸다
      const d = (tile - TILE_ONEWAY) as Dir;
      const [cx, cy] = this.xy(cell);
      for (let i = 0; i < 7; i++) this.spawn(cx + 0.5 + (Math.random() - 0.5) * 0.6, cy + 0.5 + (Math.random() - 0.5) * 0.6, { color: '#ffe19a', speed: 0.2, life: 0.35, size: 0.05, vx: DX[d] * 2.4, vy: DY[d] * 2.4 });
    } else if (kind === 'pit') {
      // 발끝에서 돌멩이가 구덩이로 굴러떨어진다
      for (let i = 0; i < 4; i++) this.spawn(hx, hy, { color: '#b7ab97', speed: 0.3, life: 0.45, size: 0.05, vx: DX[dir] * 1.1, vy: DY[dir] * 1.1 + 0.4 });
    } else if (kind === 'normal') {
      chips(4, '#c98d4b');
      dust(2);
    } else if (kind === 'rail') sparks(7, '#ffeeb0');
    else if (kind === 'ice') chips(6, '#e3f6ff', true);
    else if (kind === 'link') {
      state.b.forEach((b, i) => {
        if (def.kinds[i] !== 'link' || state.c[i] === SUNK) return;
        const [bx, by] = this.xy(b);
        for (let n = 0; n < 4; n++) this.spawn(bx + 0.5, by + 0.5, { color: n % 2 ? '#ffffff' : '#ffc2dd', speed: 1.5, life: 0.45, size: 0.06, star: true });
      });
    }
    return kind;
  }

  // 부딪힌 칸이 흔들리는 정도: [x, y, 회전]. 0.3초 동안 잦아든다
  private cellShake(cell: number, time: number, kind: string): [number, number, number] {
    const fx = this.cellFx.get(cell);
    if (!fx || fx.kind !== kind) return [0, 0, 0];
    const k = (time - fx.t0) / 0.3;
    if (k >= 1) return [0, 0, 0];
    const wob = Math.sin(k * Math.PI * 5) * (1 - k);
    const push = Math.sin(Math.min(1, k * 3) * Math.PI) * (1 - k);
    const s = this.cell;
    return [(DX[fx.dir] * push * 0.07 + DY[fx.dir] * wob * 0.015) * s, (DY[fx.dir] * push * 0.07 + DX[fx.dir] * wob * 0.015) * s, wob * 0.06];
  }

  // 힌트는 여우의 꼬리 끝 결정이 길을 비춰 주는 것이다. 켜지는 순간 결정에서 빛이 튄다.
  setHint(dirs: Dir[]): void {
    if (dirs.length && !this.hint.length) {
      this.hintT0 = now();
      const [x, y] = this.xy(this.state.p);
      const [gx, gy] = this.crystalAt();
      const tx = x + 0.5 + gx;
      const ty = y + 0.5 - gy;
      this.spawn(tx, ty, { color: '#ffe07a', speed: 0, life: 0.5, size: 0.3, tex: 'fx_ring', grow: 2.4 });
      for (let i = 0; i < 8; i++) this.spawn(tx, ty, { color: '#fff3b0', speed: 1.8, life: 0.5, size: 0.13, tex: 'fx_spark' });
    }
    this.hint = dirs;
    this.lastActT = now();
  }

  // 꼬리 끝 결정의 자리(칸 단위, 캐릭터 가운데에서 오른쪽·위로). 보는 쪽에 따라 다르다
  private crystalAt(): [number, number] {
    if (this.look === 0 && now() - this.lastActT <= SLEEP_AFTER) return [BACK_CRYSTAL_X, BACK_CRYSTAL_Y];
    return [this.look === 3 ? -CRYSTAL_X : CRYSTAL_X, CRYSTAL_Y];
  }

  private drawCrystalGlow(time: number, s: number): void {
    const { ctx } = this;
    const flash = Math.max(0, 1 - (time - this.hintT0) / 0.5);
    const pulse = 0.8 + Math.sin(time * 5) * 0.2;
    const r = s * (0.4 + flash * 0.35);
    const [gx, gy] = this.crystalAt();
    const y = -s * gy;
    const x = s * gx;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(255,246,200,${Math.min(1, pulse + flash)})`);
    g.addColorStop(0.4, `rgba(255,214,92,${Math.min(1, (pulse + flash) * 0.4)})`);
    g.addColorStop(1, 'rgba(255,214,92,0)');
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }

  // 클리어: 출구에 올라서면 바닥에서 고리가 퍼지고, 여우가 빛기둥을 타고 떠올라 별에 닿는 순간 별이 터진다
  playWin(): void {
    const time = now();
    this.winT0 = time;
    const [x, y] = this.xy(this.def.exit);
    const cx = x + 0.5;
    const cy = y + 0.5;
    this.rings.push({ x: cx, y: cy, t0: time, life: 0.6, color: '#fff1b8', r0: 0.25, r1: 1.1 });
    // 떠오르는 동안 빛 알갱이가 기둥을 따라 올라간다
    for (let i = 0; i < 16; i++) {
      this.pending.push({
        at: time + WIN_RISE * 0.6 + i * 0.035,
        run: () => this.spawn(cx + (Math.random() - 0.5) * 0.6, cy + 0.3, { color: i % 2 ? '#ffffff' : '#ffe07a', speed: 0.1, life: 0.6, size: 0.05 + Math.random() * 0.04, vy: -2.6, star: i % 3 === 0 }),
      });
    }
    this.pending.push({
      at: time + WIN_MERGE,
      run: () => {
        const t0 = now();
        const top = cy - STAR_HEIGHT - 0.55; // 별이 터지는 높이
        this.camShake = 0.07;
        this.spawn(cx, top, { color: '#ffffff', speed: 0, life: 0.9, size: 1.7, tex: 'fx_burst', grow: 1.6 });
        this.spawn(cx, top, { color: '#ffffff', speed: 0, life: 0.5, size: 0.5, tex: 'fx_ring', grow: 3.4 });
        // 바닥에는 충격이 고리 셋으로 퍼진다
        [0, 0.09, 0.2].forEach((d, i) => this.rings.push({ x: cx, y: cy, t0: t0 + d, life: 0.7, color: i === 1 ? this.theme.accent : '#ffe9a0', r0: 0.3, r1: 1.7 + i * 0.5 }));
        // 불꽃놀이처럼 위로 솟았다가 떨어진다
        for (let i = 0; i < 52; i++) {
          const a = (i / 52) * TAU;
          const sp = 1.6 + Math.random() * 3;
          this.spawn(cx, top, {
            color: i % 3 === 0 ? '#ffffff' : i % 3 === 1 ? this.theme.accent : '#ffe07a',
            speed: 0.4,
            life: 0.7 + Math.random() * 0.7,
            size: 0.05 + Math.random() * 0.07,
            star: i % 2 === 0,
            grav: 5,
            vx: Math.cos(a) * sp,
            vy: Math.sin(a) * sp * 0.6 - 1.6,
          });
        }
      },
    });
  }

  private spawn(
    x: number,
    y: number,
    o: { color: string; speed: number; life: number; size: number; vx?: number; vy?: number; star?: boolean; grav?: number; tex?: string; grow?: number },
  ): void {
    const a = Math.random() * TAU;
    const sp = o.speed * (0.3 + Math.random() * 0.7);
    this.particles.push({
      x,
      y,
      vx: (o.vx ?? 0) + Math.cos(a) * sp,
      vy: (o.vy ?? 0) + Math.sin(a) * sp,
      age: 0,
      life: o.life,
      size: o.size,
      color: o.color,
      grav: o.grav ?? 0,
      star: o.star,
      tex: o.tex,
      grow: o.grow,
      rot: Math.random() * TAU,
    });
  }

  private resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height || !this.def) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    this.cssW = rect.width;
    this.cssH = rect.height;
    this.canvas.width = Math.round(rect.width * dpr);
    this.canvas.height = Math.round(rect.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const slab = getSprite('board_' + this.world);
    if (slab) {
      const m = this.slabMetrics(slab, 1);
      this.cell = Math.floor(Math.min((rect.width * 0.98) / (this.def.w + m.side * 2), rect.height / (this.def.h + m.top + m.bottom + 0.45)));
      this.ox = (rect.width - this.cell * this.def.w) / 2;
      // 위쪽 턱과 아래쪽 단면을 합친 덩어리가 가운데 오게 한다
      this.oy = (rect.height - this.cell * (this.def.h + m.bottom - m.top + 0.3)) / 2;
      return;
    }
    this.cell = Math.floor(Math.min(rect.width / (this.def.w + 0.6), rect.height / (this.def.h + 0.7)));
    this.ox = (rect.width - this.cell * this.def.w) / 2;
    this.oy = (rect.height - this.cell * this.def.h) / 2;
  }

  private frame = (): void => {
    this.raf = requestAnimationFrame(this.frame);
    const time = now();
    const dt = Math.min(0.05, time - this.last);
    this.last = time;
    if (!this.cssW) {
      this.resize();
      if (!this.cssW) return;
    }
    this.update(dt, time);
    this.draw(time);
  };

  private update(dt: number, time: number): void {
    if (this.pending.length) {
      const due = this.pending.filter((p) => p.at <= time);
      this.pending = this.pending.filter((p) => p.at > time);
      due.forEach((p) => p.run());
    }
    this.camShake = Math.max(0, this.camShake - dt * 0.35);
    this.state.c.forEach((c, i) => {
      const tw = this.blocks[i];
      const arrived = time >= tw.t0 + tw.dur;
      const target = c === SUNK && arrived ? 1 : c === SUNK ? this.sink[i] : 0;
      this.sink[i] += Math.sign(target - this.sink[i]) * Math.min(Math.abs(target - this.sink[i]), dt * 6);
    });
    this.state.c.forEach((c, i) => {
      const target = c === 0 ? 1 : 0;
      this.lock[i] += Math.sign(target - this.lock[i]) * Math.min(Math.abs(target - this.lock[i]), dt * 4);
    });
    for (const p of this.particles) {
      p.age += dt;
      p.vy += p.grav * dt;
      p.vx *= 1 - dt * 2.2;
      p.vy *= 1 - dt * 2.2;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    this.particles = this.particles.filter((p) => p.age < p.life);
    this.rings = this.rings.filter((r) => time - r.t0 < r.life);
    // 별은 천천히 돌다가, 클리어하면 여우를 맞으며 빨리 돈다
    this.starAng += dt * (this.winT0 < 0 ? 1.7 : 3 + Math.min(1, (time - this.winT0) / WIN_MERGE) * 16);
    const life = TRAIL_LIFE[this.trail] ?? 0;
    while (this.marks.length > 1 && time - this.marks[0].born > life + 0.5) this.marks.shift();

    // 출구에서 올라오는 빛 알갱이
    if (this.winT0 < 0 && Math.random() < dt * 5) {
      const [x, y] = this.xy(this.def.exit);
      this.spawn(x + 0.5 + (Math.random() - 0.5) * 0.5, y + 0.6, {
        color: this.theme.accent,
        speed: 0.1,
        life: 0.9 + Math.random() * 0.6,
        size: 0.03 + Math.random() * 0.03,
        vy: -0.7,
      });
    }
  }

  private draw(time: number): void {
    const { ctx, def, theme, cell: s, ox, oy } = this;
    ctx.clearRect(0, 0, this.cssW, this.cssH);
    ctx.save();
    if (this.camShake > 0) {
      ctx.translate((Math.random() - 0.5) * 2 * this.camShake * s, (Math.random() - 0.5) * 2 * this.camShake * s);
    }

    // 판. 디오라마 그림이 있으면 두께가 있는 판 위에 그 던전의 바닥을 깐다
    const slab = getSprite('board_' + this.world);
    const floorImg = getSprite('floor_' + this.world) ?? getSprite('floor');
    if (slab) this.drawSlab(slab);
    else {
      const pad = s * 0.22;
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      rr(ctx, ox - pad, oy - pad + s * 0.1, def.w * s + pad * 2, def.h * s + pad * 2, s * 0.3);
      ctx.fill();
      // 크림색 틀 안에 모래색 바닥(화면 시안의 판)
      ctx.fillStyle = BOARD_FRAME;
      rr(ctx, ox - pad, oy - pad, def.w * s + pad * 2, def.h * s + pad * 2, s * 0.3);
      ctx.fill();
      ctx.fillStyle = BOARD_GROUT;
      rr(ctx, ox - pad * 0.3, oy - pad * 0.3, def.w * s + pad * 0.6, def.h * s + pad * 0.6, s * 0.14);
      ctx.fill();
    }

    if (slab && floorImg) {
      // 바닥을 빈틈없이 깔고 칸의 경계만 옅게 긋는다
      for (let y = 0; y < def.h; y++) for (let x = 0; x < def.w; x++) ctx.drawImage(floorImg, ox + x * s, oy + y * s, s + 0.5, s + 0.5);
      ctx.strokeStyle = 'rgba(70,45,25,0.16)';
      ctx.lineWidth = Math.max(1, s * 0.022);
      ctx.beginPath();
      for (let x = 1; x < def.w; x++) {
        ctx.moveTo(ox + x * s, oy);
        ctx.lineTo(ox + x * s, oy + def.h * s);
      }
      for (let y = 1; y < def.h; y++) {
        ctx.moveTo(ox, oy + y * s);
        ctx.lineTo(ox + def.w * s, oy + y * s);
      }
      ctx.stroke();
      // 둘레 턱이 바닥에 드리우는 옅은 그늘
      const shade = ctx.createLinearGradient(0, oy, 0, oy + s * 0.22);
      shade.addColorStop(0, 'rgba(60,35,20,0.22)');
      shade.addColorStop(1, 'rgba(60,35,20,0)');
      ctx.fillStyle = shade;
      ctx.fillRect(ox, oy, def.w * s, s * 0.22);
    }
    for (let y = 0; y < def.h; y++) {
      for (let x = 0; x < def.w; x++) {
        if (slab && floorImg) continue;
        if (floorImg) {
          ctx.save();
          rr(ctx, ox + x * s + s * 0.025, oy + y * s + s * 0.025, s * 0.95, s * 0.95, s * 0.09);
          ctx.clip();
          ctx.drawImage(floorImg, ox + x * s, oy + y * s, s, s);
          ctx.restore();
          continue;
        }
        if (def.solid[y * def.w + x] === SOLID_WALL) continue;
        {
          ctx.fillStyle = (x + y) % 2 ? theme.floorA : theme.floorB;
          rr(ctx, ox + x * s + 1.5, oy + y * s + 1.5, s - 3, s - 3, s * 0.14);
          ctx.fill();
        }
      }
    }

    this.drawTiles(time);
    this.drawSunk(time);
    this.drawExit(time);
    this.drawRings(time);
    drawTrail(ctx, this.trail, this.marks, time, ox, oy, s);

    const wallImg = getSprite('wall_' + this.world) ?? getSprite('wall');
    for (let y = 0; y < def.h; y++) {
      for (let x = 0; x < def.w; x++) {
        const kind = def.solid[y * def.w + x];
        const cx = ox + (x + 0.5) * s;
        const cy = oy + (y + 0.5) * s;
        if (kind === SOLID_WALL) {
          if (wallImg) {
            // 바닥에 닿는 그늘을 깔고, 부딪혔을 때는 밀린 쪽으로 살짝 흔들린다
            const [dx, dy, rot] = this.cellShake(y * def.w + x, time, 'wall');
            if (slab) {
              ctx.fillStyle = 'rgba(40,24,14,0.22)';
              rr(ctx, cx - s * 0.47, cy - s * 0.4, s * 0.94, s * 0.94, s * 0.16);
              ctx.fill();
            }
            if (dx || dy || rot) {
              ctx.save();
              ctx.translate(cx + dx, cy + dy);
              ctx.rotate(rot);
              ctx.drawImage(wallImg, -s * 0.49, -s * 0.49, s * 0.98, s * 0.98);
              ctx.restore();
            } else ctx.drawImage(wallImg, cx - s * 0.49, cy - s * 0.49, s * 0.98, s * 0.98);
          } else this.drawWall(cx, cy);
        } else if (kind === SOLID_FIXED) {
          let dx = 0;
          let dy = 0;
          if (this.shakeBlock < 0 && this.isShaking(time) && this.shakeCell() === y * def.w + x) [dx, dy] = this.shakeOffset(time);
          drawFixed(ctx, cx + dx, cy + dy, s);
        }
      }
    }

    this.blocks.forEach((tw, i) => {
      if (this.sink[i] > 0) return; // 가라앉은 블록은 바닥 층에서 그린다
      let [bx, by] = tweenPos(tw, time);
      if ((i === this.shakeBlock || (this.shakeLink && def.kinds[i] === 'link')) && this.isShaking(time)) {
        const [dx, dy] = this.shakeOffset(time);
        bx += dx / s;
        by += dy / s;
      }
      // 레벨 시작 때는 차례로 튀어나오고, 밀려서 멈출 때는 살짝 눌린다
      const pulse = Math.min(1, (time - this.pulseT0[i]) / 0.18);
      const scale = this.introScale(time, i + 1) * (1 + Math.sin(pulse * Math.PI) * 0.1);
      const cx = ox + (bx + 0.5) * s;
      const cy = oy + (by + 0.5) * s;
      if (scale <= 0) return;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(scale, scale);
      drawBlock(ctx, def.kinds[i], 0, 0, s, this.state.c[i], this.lock[i], time);
      ctx.restore();
    });

    this.drawHint(time);
    this.drawStar(time, false);
    this.drawPlayer(time);
    this.drawStar(time, true);

    for (const p of this.particles) {
      const k = 1 - p.age / p.life;
      ctx.globalAlpha = Math.min(1, k * 1.6);
      ctx.fillStyle = p.color;
      const x = ox + p.x * s;
      const y = oy + p.y * s;
      const tex = p.tex ? (p.tex === 'fx_dust' ? getSprite(p.tex) : getTinted(p.tex, p.color)) : undefined;
      if (tex) {
        // 빛 효과 그림은 검은 배경이라 더하기 합성으로 그린다
        const size = p.size * s * (1 + (p.grow ?? 0) * (1 - k));
        ctx.save();
        if (p.tex !== 'fx_dust') ctx.globalCompositeOperation = 'lighter';
        else ctx.globalAlpha = k * 0.8;
        ctx.translate(x, y);
        if (p.tex !== 'fx_ring') ctx.rotate(p.rot ?? 0);
        ctx.drawImage(tex, -size / 2, -size / 2, size, size);
        ctx.restore();
      } else if (p.tex === 'fx_ring' || p.tex === 'fx_burst') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = s * 0.05 * k;
        ctx.beginPath();
        ctx.arc(x, y, (p.size * s * (1 + (p.grow ?? 0) * (1 - k))) / 2, 0, TAU);
        ctx.stroke();
      } else if (p.star) {
        drawStarShape(ctx, x, y, p.size * s * (0.6 + k));
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(x, y, p.size * s * (0.4 + k * 0.6), 0, TAU);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // 던전 기믹 바닥: 구덩이, 일방통행, 빙판, 마법진
  private drawTiles(time: number): void {
    const { ctx, def, cell: s, ox, oy } = this;
    for (let i = 0; i < def.tile.length; i++) {
      const t = def.tile[i];
      if (!t) continue;
      const x = ox + (i % def.w) * s;
      const y = oy + ((i / def.w) | 0) * s;
      const cx = x + s / 2;
      const cy = y + s / 2;
      ctx.save();
      rr(ctx, x + 1, y + 1, s - 2, s - 2, s * 0.1);
      ctx.clip();
      if (t === TILE_SWITCH) {
        const img = getSprite('tile_switch');
        if (img) ctx.drawImage(img, x, y, s, s);
        else {
          ctx.fillStyle = '#b8892e';
          ctx.beginPath();
          ctx.arc(cx, cy, s * 0.3, 0, TAU);
          ctx.fill();
        }
        const pfx = this.cellFx.get(i);
        if (pfx && pfx.kind === 'press' && time - pfx.t0 < 0.3) {
          // 눌리거나 풀리는 순간 번쩍인다
          ctx.fillStyle = `rgba(255,244,200,${0.7 * (1 - (time - pfx.t0) / 0.3)})`;
          ctx.fillRect(x, y, s, s);
        }
        if (blockAt(this.state, i) >= 0) {
          // 눌린 스위치는 빛난다
          const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, s * 0.6);
          glow.addColorStop(0, 'rgba(255,220,120,0.75)');
          glow.addColorStop(1, 'rgba(255,220,120,0)');
          ctx.fillStyle = glow;
          ctx.fillRect(x, y, s, s);
        }
      } else if (t === TILE_DOOR) {
        // 닫힌 문은 그대로, 열린 문은 흐릿하게 남겨 자리를 알려준다
        const open = doorsOpen(def, this.state);
        const img = getSprite('tile_door');
        ctx.globalAlpha = open ? 0.2 : 1;
        // 부딪히거나 여닫힐 때 쇠창살이 좌우로 덜컹거린다
        const fx = this.cellFx.get(i);
        const rk = fx && fx.kind === 'door' ? (time - fx.t0) / 0.32 : 1;
        const rattle = rk < 1 ? Math.sin(rk * Math.PI * 9) * (1 - rk) * s * 0.045 : 0;
        if (img) ctx.drawImage(img, x + rattle, y, s, s);
        else {
          ctx.fillStyle = '#2a2d38';
          ctx.fillRect(x, y, s, s);
          ctx.fillStyle = '#8a8f9e';
          for (let k = 0; k < 4; k++) ctx.fillRect(x + s * (0.14 + k * 0.22), y + s * 0.08, s * 0.08, s * 0.84);
        }
        ctx.globalAlpha = 1;
        if (!open) {
          ctx.strokeStyle = `rgba(255,90,70,${0.55 + (rk < 1 ? (1 - rk) * 0.45 : 0)})`;
          ctx.lineWidth = s * (0.05 + (rk < 1 ? (1 - rk) * 0.04 : 0));
          rr(ctx, x + s * 0.06, y + s * 0.06, s * 0.88, s * 0.88, s * 0.1);
          ctx.stroke();
        }
      } else if (t === TILE_CRUMBLE && !this.state.k.includes(i)) {
        const img = getSprite('tile_crumble');
        if (img) ctx.drawImage(img, x, y, s, s);
        else {
          ctx.fillStyle = '#5a3a30';
          ctx.fillRect(x, y, s, s);
          ctx.strokeStyle = '#ff8a3d';
          ctx.lineWidth = s * 0.04;
          ctx.beginPath();
          ctx.moveTo(x + s * 0.15, y + s * 0.3);
          ctx.lineTo(x + s * 0.5, y + s * 0.5);
          ctx.lineTo(x + s * 0.4, y + s * 0.85);
          ctx.moveTo(x + s * 0.5, y + s * 0.5);
          ctx.lineTo(x + s * 0.88, y + s * 0.4);
          ctx.stroke();
        }
      } else if (t === TILE_PIT || t === TILE_CRUMBLE) {
        const img = getSprite('tile_pit');
        if (img) ctx.drawImage(img, x, y, s, s);
        else {
          ctx.fillStyle = '#07050c';
          rr(ctx, x + s * 0.1, y + s * 0.1, s * 0.8, s * 0.8, s * 0.2);
          ctx.fill();
          ctx.strokeStyle = 'rgba(255,255,255,0.14)';
          ctx.lineWidth = s * 0.04;
          ctx.stroke();
        }
      } else if (t === TILE_SLIP) {
        const img = getSprite('tile_ice');
        if (img) ctx.drawImage(img, x, y, s, s);
        else {
          ctx.fillStyle = 'rgba(170,225,255,0.6)';
          ctx.fillRect(x, y, s, s);
        }
        // 빙판 위를 지나가는 반짝임
        const sweep = ((time * 0.3 + (i % def.w) * 0.13 + ((i / def.w) | 0) * 0.07) % 1.6) - 0.3;
        const g = ctx.createLinearGradient(x + sweep * s - s * 0.2, y, x + sweep * s + s * 0.2, y + s);
        g.addColorStop(0, 'rgba(255,255,255,0)');
        g.addColorStop(0.5, 'rgba(255,255,255,0.35)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect(x, y, s, s);
      } else if (t === TILE_PORTAL) {
        const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, s * 0.55);
        glow.addColorStop(0, 'rgba(190,140,255,0.75)');
        glow.addColorStop(1, 'rgba(190,140,255,0)');
        ctx.fillStyle = glow;
        ctx.fillRect(x, y, s, s);
        const img = getSprite('tile_portal');
        ctx.translate(cx, cy);
        ctx.rotate(time * 1.1);
        if (img) ctx.drawImage(img, -s * 0.46, -s * 0.46, s * 0.92, s * 0.92);
        else {
          ctx.strokeStyle = '#e6d4ff';
          ctx.lineWidth = s * 0.06;
          ctx.lineCap = 'round';
          for (let k = 0; k < 3; k++) {
            ctx.beginPath();
            ctx.arc(0, 0, s * (0.14 + k * 0.1), k * 2.1, k * 2.1 + 3.6);
            ctx.stroke();
          }
        }
      } else {
        const dir = t - TILE_ONEWAY;
        const img = getSprite('tile_oneway');
        ctx.translate(cx, cy);
        ctx.rotate((dir * Math.PI) / 2);
        // 거꾸로 들어오려 하면 화살표가 번쩍이며 튕겨 낸다
        const ofx = this.cellFx.get(i);
        const ok = ofx && ofx.kind === 'oneway' ? (time - ofx.t0) / 0.3 : 1;
        if (ok < 1) {
          const k = 1 + Math.sin(ok * Math.PI) * 0.12;
          ctx.scale(k, k);
        }
        if (img) ctx.drawImage(img, -s / 2, -s / 2, s, s);
        if (ok < 1) {
          ctx.fillStyle = `rgba(255,246,205,${0.6 * (1 - ok)})`;
          ctx.fillRect(-s / 2, -s / 2, s, s);
        }
        // 화살표 방향으로 흐르는 빛
        const flow = (time * 1.4) % 1;
        ctx.fillStyle = `rgba(255,214,120,${img ? 0.5 * (1 - flow) : 0.9})`;
        for (let k = 0; k < (img ? 1 : 2); k++) {
          const off = img ? s * (0.25 - flow * 0.5) : s * (0.18 - k * 0.3);
          ctx.beginPath();
          ctx.moveTo(0, off - s * 0.16);
          ctx.lineTo(s * 0.24, off + s * 0.08);
          ctx.lineTo(s * 0.12, off + s * 0.08);
          ctx.lineTo(0, off - s * 0.04);
          ctx.lineTo(-s * 0.12, off + s * 0.08);
          ctx.lineTo(-s * 0.24, off + s * 0.08);
          ctx.closePath();
          ctx.fill();
        }
      }
      ctx.restore();
    }
  }

  // 구덩이를 메운 블록. 작고 어둡게 그려 바닥처럼 보이게 한다.
  private drawSunk(time: number): void {
    const { ctx, def, cell: s, ox, oy } = this;
    this.blocks.forEach((tw, i) => {
      const k = this.sink[i];
      if (k <= 0) return;
      const [bx, by] = tweenPos(tw, time);
      const cx = ox + (bx + 0.5) * s;
      const cy = oy + (by + 0.5) * s;
      const scale = 1 - 0.14 * k;
      ctx.save();
      ctx.translate(cx, cy + s * 0.05 * k);
      ctx.scale(scale, scale);
      drawBlock(ctx, def.kinds[i], 0, 0, s, -1, def.kinds[i] === 'count' ? 1 : 0, time);
      ctx.fillStyle = `rgba(8,5,14,${0.5 * k})`;
      rr(ctx, -s * 0.46, -s * 0.5, s * 0.92, s * 0.98, s * 0.16);
      ctx.fill();
      ctx.restore();
    });
  }

  // 레벨이 열릴 때 블록과 캐릭터가 차례로 튀어나오는 배율
  private introScale(time: number, order: number): number {
    const k = (time - this.introT0 - order * 0.045) / 0.32;
    if (k >= 1) return 1;
    if (k <= 0) return 0;
    const c = 1.70158;
    return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2);
  }

  // 같은 동작이 이어지면 처음부터 다시 틀지 않고 시간만 늘린다
  private playAnim(name: AnimName, seconds: number): void {
    const time = now();
    if (this.animName !== name || time > this.animUntil) this.animT0 = time;
    this.animName = name;
    this.animUntil = time + seconds;
  }

  private isShaking(time: number): boolean {
    return time - this.shakeT0 < 0.25;
  }

  private shakeCell(): number {
    const x = (this.state.p % this.def.w) + DX[this.shakeDir];
    const y = ((this.state.p / this.def.w) | 0) + DY[this.shakeDir];
    return y * this.def.w + x;
  }

  private shakeOffset(time: number): [number, number] {
    const k = (time - this.shakeT0) / 0.25;
    const amp = Math.sin(k * Math.PI * 4) * (1 - k) * this.cell * 0.07;
    return [DX[this.shakeDir] * amp, DY[this.shakeDir] * amp];
  }

  private drawWall(cx: number, cy: number): void {
    const { ctx, theme, cell: s } = this;
    const lip = s * 0.14;
    ctx.fillStyle = theme.wall;
    rr(ctx, cx - s / 2 + 1, cy - s / 2 + 1, s - 2, s - 2, s * 0.14);
    ctx.fill();
    ctx.fillStyle = theme.wallTop;
    rr(ctx, cx - s / 2 + 1, cy - s / 2 + 1 - lip * 0.4, s - 2, s - 2 - lip, s * 0.14);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    rr(ctx, cx - s / 2 + s * 0.12, cy - s / 2 + s * 0.08, s * 0.76, s * 0.18, s * 0.08);
    ctx.fill();
  }

  private drawExit(time: number): void {
    const { ctx, theme, cell: s } = this;
    const [x, y] = this.xy(this.def.exit);
    const cx = this.ox + (x + 0.5) * s;
    const cy = this.oy + (y + 0.5) * s;
    const pulse = 0.5 + Math.sin(time * 2.6) * 0.5;
    const img0 = getSprite('exit_pad') ?? getSprite('exit');
    if (img0) {
      // 받침: 둘레가 은은하게 빛나고, 바닥에 누운 고리가 번져 나간다. 별은 그 위에 떠 있다(drawStar)
      const g = ctx.createRadialGradient(cx, cy, s * 0.3, cx, cy, s * 0.78);
      g.addColorStop(0, `rgba(255,226,120,${0.32 + pulse * 0.2})`);
      g.addColorStop(1, 'rgba(255,226,120,0)');
      ctx.fillStyle = g;
      ctx.fillRect(cx - s * 0.8, cy - s * 0.8, s * 1.6, s * 1.6);
      ctx.drawImage(img0, cx - s * 0.48, cy - s * 0.48, s * 0.96, s * 0.96);
      for (let i = 0; i < 2; i++) {
        const k = (time * 0.55 + i * 0.5) % 1;
        ctx.strokeStyle = `rgba(255,236,150,${0.55 * (1 - k)})`;
        ctx.lineWidth = s * 0.035 * (1 - k * 0.5);
        ctx.beginPath();
        ctx.ellipse(cx, cy + s * 0.06, s * (0.2 + k * 0.42), s * (0.2 + k * 0.42) * 0.5, 0, 0, TAU);
        ctx.stroke();
      }
      return;
    }
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, s * (0.62 + pulse * 0.1));
    g.addColorStop(0, theme.accent);
    g.addColorStop(0.45, theme.accent + '88');
    g.addColorStop(1, theme.accent + '00');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, s * 0.75, 0, TAU);
    ctx.fill();

    const rays = getTinted('fx_burst', theme.accent);
    if (rays) {
      // 출구 뒤에서 천천히 도는 빛살
      const k = s * 1.9;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.45 + pulse * 0.25;
      ctx.translate(cx, cy);
      ctx.rotate(-time * 0.25);
      ctx.drawImage(rays, -k / 2, -k / 2, k, k);
      ctx.restore();
    }

    const img = getSprite('exit');
    if (img) {
      // 그림 출구는 천천히 돌면서 맥박처럼 커졌다 작아진다
      const k = s * (0.94 + pulse * 0.06);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(time * 0.35);
      ctx.drawImage(img, -k / 2, -k / 2, k, k);
      ctx.restore();
      return;
    }

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(time * 0.8);
    ctx.strokeStyle = '#ffffffcc';
    ctx.lineWidth = s * 0.05;
    ctx.setLineDash([s * 0.16, s * 0.12]);
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.32, 0, TAU);
    ctx.stroke();
    ctx.restore();
    ctx.setLineDash([]);

    ctx.fillStyle = '#fff';
    drawStarShape(ctx, cx, cy, s * (0.15 + pulse * 0.03));
    ctx.fill();
  }

  // 디오라마 판을 칸 크기 s로 그릴 때의 치수: 좌우 턱, 위쪽 턱, 아래쪽(턱과 앞 단면)의 두께. 그림의 가운데가 판의 칸들에 꼭 맞게 늘어난다
  private slabMetrics(img: HTMLImageElement, s: number): { side: number; top: number; bottom: number; src: { side: number; top: number; bottom: number } } {
    const m = SLABS[this.world - 1] ?? SLABS[0];
    const k = img.naturalWidth / 900;
    const src = { side: m.side * k, top: m.top * k, bottom: m.bottom * k };
    const f = (this.def.w * s) / (img.naturalWidth - src.side * 2);
    return { side: src.side * f, top: src.top * f, bottom: src.bottom * f * SLAB_FRONT, src };
  }

  // 위로 갈수록 좁아지게 그려진 판 그림을 반듯하게 편다: 윗면의 줄마다 좌우를 그 줄의 폭만큼 늘린다. 한 번 만들어 두고 쓴다
  private straighten(img: HTMLImageElement): HTMLCanvasElement {
    let out = straightened.get(img);
    if (out) return out;
    const m = SLABS[this.world - 1] ?? SLABS[0];
    const k = img.naturalWidth / 900;
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    const flat = h - m.bottom * k; // 이 아래(앞 단면)는 기울지 않았다
    out = document.createElement('canvas');
    out.width = w;
    out.height = h;
    const c = out.getContext('2d')!;
    for (let y = 0; y < h; y++) {
      const inset = y < flat ? m.slant * k * (1 - y / flat) : 0;
      c.drawImage(img, inset, y, w - inset * 2, 1, 0, y, w, 1);
    }
    straightened.set(img, out);
    return out;
  }

  // 두께가 있는 판. 모서리는 그대로 두고 가운데만 늘리는 9-슬라이스로 그려 판의 크기가 달라도 턱이 뭉개지지 않는다
  private drawSlab(img: HTMLImageElement): void {
    const { ctx, def, cell: s, ox, oy } = this;
    const { side, top, bottom, src } = this.slabMetrics(img, s);
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    const sx = [0, src.side, w - src.side, w];
    const sy = [0, src.top, h - src.bottom, h];
    const flat = this.straighten(img);
    const dx = [ox - side, ox, ox + def.w * s, ox + def.w * s + side].map(Math.round);
    const dy = [oy - top, oy, oy + def.h * s, oy + def.h * s + bottom].map(Math.round);
    // 떠 있는 판 아래의 그림자
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    g.addColorStop(0, 'rgba(20,10,30,0.34)');
    g.addColorStop(1, 'rgba(20,10,30,0)');
    ctx.save();
    ctx.translate(ox + (def.w * s) / 2, dy[3] + s * 0.2);
    ctx.scale(def.w * s * 0.62, s * 0.5);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, 1, 0, TAU);
    ctx.fill();
    ctx.restore();
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        ctx.drawImage(flat, sx[c], sy[r], sx[c + 1] - sx[c], sy[r + 1] - sy[r], dx[c], dy[r], dx[c + 1] - dx[c], dy[r + 1] - dy[r]);
      }
    }
  }

  // 바닥에 누워 퍼지는 고리. 위에서 비스듬히 본 것처럼 납작한 타원으로 그려 깊이를 준다
  private drawRings(time: number): void {
    const { ctx, cell: s, ox, oy } = this;
    for (const r of this.rings) {
      const k = (time - r.t0) / r.life;
      if (k < 0 || k >= 1) continue;
      const e = 1 - (1 - k) * (1 - k);
      const rad = s * (r.r0 + (r.r1 - r.r0) * e);
      ctx.globalAlpha = (1 - k) * 0.85;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = s * 0.07 * (1 - k * 0.6);
      ctx.beginPath();
      ctx.ellipse(ox + r.x * s, oy + r.y * s + s * 0.06, rad, rad * 0.5, 0, 0, TAU);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // 출구 위에 떠서 도는 별. 두께가 있는 원반처럼 세로축으로 돌고, 바닥에는 그림자가 지고, 빛기둥이 선다.
  // front가 false면 별 뒤쪽의 것(빛기둥, 그림자, 뒤로 도는 빛 알갱이), true면 별과 앞쪽의 것을 그린다.
  private drawStar(time: number, front: boolean): void {
    const img = getSprite('exit_star') ?? getSprite('ui_star');
    if (!getSprite('exit_pad') && !getSprite('exit')) return; // 그림이 없을 때의 출구는 drawExit가 다 그린다
    const { ctx, cell: s } = this;
    const [x, y] = this.xy(this.def.exit);
    const cx = this.ox + (x + 0.5) * s;
    const cy = this.oy + (y + 0.5) * s;
    const win = this.winT0 >= 0 ? time - this.winT0 : -1;
    const rise = win < 0 ? 0 : Math.min(1, win / WIN_MERGE); // 여우를 맞으러 올라간 정도
    const after = win < 0 ? -1 : win - WIN_MERGE; // 별이 터진 뒤의 시간
    const bob = Math.sin(time * 2.2) * 0.04;
    const height = (STAR_HEIGHT + bob + rise * rise * 0.55) * s;
    const pop = after >= 0 ? 1 + Math.sin(Math.min(1, after / 0.45) * Math.PI) * 0.9 : 1 + rise * 0.15;
    const c = Math.cos(this.starAng);
    const sn = Math.sin(this.starAng);
    const size = s * 0.6 * pop;

    if (!front) {
      // 그림자: 별이 높이 뜰수록 작고 옅다
      ctx.fillStyle = `rgba(30,20,10,${0.26 - rise * 0.14})`;
      ctx.beginPath();
      ctx.ellipse(cx, cy + s * 0.12, s * (0.06 + 0.17 * Math.abs(c)) * (1 - rise * 0.3), s * 0.07, 0, 0, TAU);
      ctx.fill();
      // 빛기둥: 위로 갈수록 넓어지며 옅어진다. 클리어하면 굵고 밝아진다
      const glow = win < 0 ? 0.22 + Math.sin(time * 2.6) * 0.05 : after < 0 ? 0.3 + rise * 0.45 : Math.max(0, 0.75 - after * 1.6);
      const top = cy - s * (1.5 + rise * 0.7);
      const half = s * (0.26 + rise * 0.14);
      const beam = ctx.createLinearGradient(0, cy, 0, top);
      beam.addColorStop(0, `rgba(255,238,160,${glow})`);
      beam.addColorStop(1, 'rgba(255,238,160,0)');
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = beam;
      ctx.beginPath();
      ctx.moveTo(cx - half, cy + s * 0.08);
      ctx.lineTo(cx + half, cy + s * 0.08);
      ctx.lineTo(cx + half * 1.5, top);
      ctx.lineTo(cx - half * 1.5, top);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // 별 둘레를 도는 빛 알갱이: 뒤로 갈 때는 별보다 먼저, 앞으로 올 때는 별 다음에 그려 감싸 도는 것처럼 보이게 한다
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 4; i++) {
      const a = time * 2.1 + (i * TAU) / 4;
      if (Math.sin(a) > 0 !== front) continue;
      const depth = 0.75 + Math.sin(a) * 0.25;
      ctx.fillStyle = `rgba(255,244,190,${0.55 + Math.sin(a) * 0.35})`;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * s * 0.4 * pop, cy - height + Math.sin(a) * s * 0.11 + Math.sin(time * 3 + i) * s * 0.05, s * 0.035 * depth, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
    if (!front) return;

    // 별: 가장자리를 여러 겹 쌓아 두께를 내고, 보는 쪽을 향한 면을 맨 위에 그린다
    const thick = size * 0.13;
    const face = Math.max(0.07, Math.abs(c));
    const off = Math.sign(c || 1) * sn * thick * 0.5;
    const edge = getTinted(getSprite('exit_star') ? 'exit_star' : 'ui_star', '#b77a2c');
    const one = (source: CanvasImageSource | undefined, ox2: number) => {
      ctx.save();
      ctx.translate(cx + ox2, cy - height);
      ctx.scale(face, 1);
      if (source) ctx.drawImage(source, -size / 2, -size / 2, size, size);
      else {
        ctx.fillStyle = '#ffd24d';
        drawStarShape(ctx, 0, 0, size * 0.5);
        ctx.fill();
      }
      ctx.restore();
    };
    for (let i = -3; i < 3; i++) one(edge ?? img, (off * i) / 3);
    one(img, off);
    // 정면을 지날 때의 반짝임과, 터질 때의 섬광
    const glint = Math.max(0, Math.abs(c) - 0.86) / 0.14;
    const flash = after >= 0 ? Math.max(0, 1 - after / 0.4) : 0;
    if (glint > 0 || flash > 0) {
      const r = size * (0.5 + flash * 1.4);
      const g = ctx.createRadialGradient(cx + off, cy - height, 0, cx + off, cy - height, r);
      g.addColorStop(0, `rgba(255,255,240,${Math.min(1, glint * 0.45 + flash)})`);
      g.addColorStop(1, 'rgba(255,255,240,0)');
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx + off, cy - height, r, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }

  private drawHint(time: number): void {
    if (!this.hint.length) return;
    const { ctx, cell: s } = this;
    let [x, y] = this.xy(this.state.p);
    this.hint.forEach((dir, i) => {
      const cx = this.ox + (x + 0.5 + DX[dir] * 0.5) * s;
      const cy = this.oy + (y + 0.5 + DY[dir] * 0.5) * s;
      const wave = 0.55 + Math.sin(time * 6 - i * 1.1) * 0.45;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate((dir * Math.PI) / 2);
      ctx.globalAlpha = 0.45 + wave * 0.55;
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = 'rgba(0,0,0,0.45)';
      ctx.lineWidth = s * 0.04;
      ctx.lineJoin = 'round';
      const k = s * (0.2 + wave * 0.03);
      ctx.beginPath();
      ctx.moveTo(0, -k);
      ctx.lineTo(k, k * 0.2);
      ctx.lineTo(k * 0.42, k * 0.2);
      ctx.lineTo(k * 0.42, k);
      ctx.lineTo(-k * 0.42, k);
      ctx.lineTo(-k * 0.42, k * 0.2);
      ctx.lineTo(-k, k * 0.2);
      ctx.closePath();
      ctx.stroke();
      ctx.fill();
      ctx.restore();
      x += DX[dir];
      y += DY[dir];
    });
    ctx.globalAlpha = 1;
  }

  private drawPlayer(time: number): void {
    const { ctx, cell: s } = this;
    let [px, py] = tweenPos(this.player, time);
    if (this.isShaking(time)) {
      const k = (time - this.shakeT0) / 0.25;
      const nudge = Math.sin(k * Math.PI) * 0.1;
      px += DX[this.shakeDir] * nudge;
      py += DY[this.shakeDir] * nudge;
    }
    const mk = Math.min(1, (time - this.moveT0) / MOVE_TIME);
    const stretch = Math.sin(mk * Math.PI) * 0.16;
    const squash = this.look % 2 === 1 ? 1 + stretch : 1 - stretch;
    const cx = this.ox + (px + 0.5) * s;
    const cy = this.oy + (py + 0.5) * s;

    if (this.winT0 >= 0 && getSheet(this.skin)) {
      // 클리어: 팔을 들고 뛰어오른 뒤 출구로 빨려 들어간다
      const t = time - this.winT0;
      const k = Math.min(1, Math.max(0, (t - WIN_RISE) / (WIN_MERGE - WIN_RISE)));
      if (k >= 1) return;
      const e = k * k;
      // 세로축으로 도는 것처럼 폭이 접혔다 펴지고, 올라갈수록 작아지며 빛에 녹는다
      const turn = 0.2 + 0.8 * Math.abs(Math.cos(e * Math.PI * 3));
      const lift = e * s * (STAR_HEIGHT + 0.5);
      const scale = 1 - e * 0.72;
      ctx.save();
      ctx.translate(cx, cy - lift);
      ctx.scale(scale * turn, scale);
      ctx.globalAlpha = 1 - e * 0.35;
      drawCharacter(ctx, this.skin, 0, 0, s, this.look, time, 1, { name: 'win', t });
      ctx.restore();
      ctx.globalAlpha = 1;
      if (e > 0) {
        const r = s * (0.25 + e * 0.5);
        const g = ctx.createRadialGradient(cx, cy - lift - s * 0.1, 0, cx, cy - lift - s * 0.1, r);
        g.addColorStop(0, `rgba(255,250,220,${e * 0.9})`);
        g.addColorStop(1, 'rgba(255,250,220,0)');
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx, cy - lift - s * 0.1, r, 0, TAU);
        ctx.fill();
        ctx.restore();
      }
      return;
    }
    if (this.winT0 >= 0) {
      const k = Math.min(1, (time - this.winT0) / 0.5);
      if (k >= 1) return;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(k * Math.PI * 2);
      ctx.scale(1 - k, 1 - k);
      ctx.globalAlpha = 1 - k * 0.6;
      drawCharacter(ctx, this.skin, 0, 0, s, this.look, time);
      ctx.restore();
      ctx.globalAlpha = 1;
      return;
    }
    const hop = Math.sin(mk * Math.PI) * s * 0.07;
    const warp = Math.min(1, (time - this.warpT0) / 0.22);
    const intro = this.introScale(time, 0) * (0.35 + 0.65 * (1 - Math.pow(1 - warp, 3)));
    if (intro <= 0) return;
    ctx.save();
    ctx.translate(cx, cy - hop);
    ctx.scale(intro, intro);
    const moving = time < this.animUntil;
    // 위로 간 뒤에는 돌아서지 않고 위를 본 채로 쉰다. 졸 때만 이쪽으로 돌아앉는다
    const rest: AnimName = time - this.lastActT > SLEEP_AFTER ? 'sleep' : this.look === 0 ? 'idleB' : 'idle';
    let pose = { name: moving ? this.animName : rest, t: moving ? time - this.animT0 : time, look: this.look };
    const back = BACK_ANIMS.has(pose.name);
    if (back !== this.backShown) {
      this.backShown = back;
      this.turnT0 = time;
      this.turnFrom = this.shown;
    }
    const turn = (time - this.turnT0) / TURN_TIME;
    if (turn < 0.5 && this.turnFrom) pose = this.turnFrom;
    else this.shown = pose;
    if (turn < 1) ctx.scale(Math.max(0.06, Math.abs(Math.cos(turn * Math.PI))), 1);
    drawCharacter(ctx, this.skin, 0, 0, s, pose.look, time, squash, pose);
    // 움직이는 동안에는 자세 그림이 바뀌어 꼬리 위치가 달라지므로 빛을 잠깐 끈다
    if (this.hint.length && !moving) this.drawCrystalGlow(time, s);
    ctx.restore();
  }
}
