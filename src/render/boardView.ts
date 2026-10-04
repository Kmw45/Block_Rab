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
const MOVE_TIME = 0.16;
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
function lighten(hex: string, t: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (shift: number) => Math.round(((n >> shift) & 255) + (255 - ((n >> shift) & 255)) * t);
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

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
  private winT0 = -1;
  private introT0 = -9;
  private warpT0 = -9; // 순간이동으로 나타난 시각. 캐릭터만 다시 튀어나온다
  private camShake = 0; // 화면 흔들림 세기(칸 단위)
  private pulseT0: number[] = [];
  private sink: number[] = [];
  // 캐릭터 동작: 움직이거나 밀 때 잠깐 걷기·밀기를 재생하고, 끝나면 숨쉬기로 돌아간다
  private animName: AnimName = 'idle';
  private animT0 = 0;
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

  load(def: BoardDef, theme: WorldTheme, state: State): void {
    this.def = def;
    this.theme = theme;
    this.particles = [];
    this.hint = [];
    this.winT0 = -1;
    this.look = 2;
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
    this.moveT0 = time;
    // 빙판에서는 미끄러진 칸 수만큼 길게 움직이고, 마법진을 탔다면 도착한 뒤 순간이동한다
    const walkDur = MOVE_TIME + res.slid * SLIDE_TIME_PER_CELL;
    // 옆으로 갈 때와 위아래로 갈 때 다른 동작을 쓴다
    const side = dir === 1 || dir === 3;
    const clip: AnimName = res.pushed >= 0 ? (side ? 'pushS' : 'pushF') : side ? 'walkS' : 'walkF';
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

  bump(res: StepResult, dir: Dir): void {
    this.shakeBlock = res.bumpBlock;
    this.shakeT0 = now();
    this.shakeDir = dir;
    this.look = dir;
    this.playAnim(dir === 1 || dir === 3 ? 'pushS' : 'pushF', 0.3);
  }

  setHint(dirs: Dir[]): void {
    this.hint = dirs;
  }

  playWin(): void {
    const time = now();
    this.winT0 = time;
    const [x, y] = this.xy(this.def.exit);
    this.camShake = 0.06;
    this.spawn(x + 0.5, y + 0.5, { color: '#ffffff', speed: 0, life: 0.9, size: 1.6, tex: 'fx_burst', grow: 1.6 });
    this.spawn(x + 0.5, y + 0.5, { color: '#ffffff', speed: 0, life: 0.6, size: 0.5, tex: 'fx_ring', grow: 4 });
    for (let i = 0; i < 46; i++) {
      this.spawn(x + 0.5, y + 0.5, {
        color: i % 3 === 0 ? '#ffffff' : i % 3 === 1 ? this.theme.accent : '#ffe07a',
        speed: 1.5 + Math.random() * 3.5,
        life: 0.6 + Math.random() * 0.7,
        size: 0.05 + Math.random() * 0.07,
        star: i % 2 === 0,
        grav: 2.5,
      });
    }
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

    // 판 테두리
    const pad = s * 0.22;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    rr(ctx, ox - pad, oy - pad + s * 0.12, def.w * s + pad * 2, def.h * s + pad * 2, s * 0.3);
    ctx.fill();
    ctx.fillStyle = theme.wallTop;
    rr(ctx, ox - pad, oy - pad, def.w * s + pad * 2, def.h * s + pad * 2, s * 0.3);
    ctx.fill();
    ctx.fillStyle = theme.wall;
    rr(ctx, ox - pad * 0.45, oy - pad * 0.45, def.w * s + pad * 0.9, def.h * s + pad * 0.9, s * 0.18);
    ctx.fill();

    const floorImg = getTinted('floor', lighten(theme.floorA, 0.3));
    for (let y = 0; y < def.h; y++) {
      for (let x = 0; x < def.w; x++) {
        if (floorImg) {
          ctx.save();
          rr(ctx, ox + x * s + 1, oy + y * s + 1, s - 2, s - 2, s * 0.1);
          ctx.clip();
          ctx.drawImage(floorImg, ox + x * s, oy + y * s, s, s);
          if ((x + y) % 2) {
            ctx.fillStyle = 'rgba(0,0,0,0.12)';
            ctx.fillRect(ox + x * s, oy + y * s, s, s);
          }
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
    drawTrail(ctx, this.trail, this.marks, time, ox, oy, s);

    const wallImg = getTinted('wall', lighten(theme.wallTop, 0.55));
    for (let y = 0; y < def.h; y++) {
      for (let x = 0; x < def.w; x++) {
        const kind = def.solid[y * def.w + x];
        const cx = ox + (x + 0.5) * s;
        const cy = oy + (y + 0.5) * s;
        if (kind === SOLID_WALL) {
          if (wallImg) {
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            rr(ctx, cx - s * 0.46, cy - s * 0.4, s * 0.92, s * 0.92, s * 0.12);
            ctx.fill();
            ctx.drawImage(wallImg, cx - s / 2, cy - s / 2 - s * 0.05, s, s);
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
      if (i === this.shakeBlock && this.isShaking(time)) {
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
    this.drawPlayer(time);

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
        if (img) ctx.drawImage(img, x, y, s, s);
        else {
          ctx.fillStyle = '#2a2d38';
          ctx.fillRect(x, y, s, s);
          ctx.fillStyle = '#8a8f9e';
          for (let k = 0; k < 4; k++) ctx.fillRect(x + s * (0.14 + k * 0.22), y + s * 0.08, s * 0.08, s * 0.84);
        }
        ctx.globalAlpha = 1;
        if (!open) {
          ctx.strokeStyle = 'rgba(255,90,70,0.55)';
          ctx.lineWidth = s * 0.05;
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
        if (img) ctx.drawImage(img, -s / 2, -s / 2, s, s);
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
      const k = Math.min(1, Math.max(0, (t - 0.8) / 0.28));
      if (k >= 1) return;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(k * Math.PI * 2);
      ctx.scale(1 - k, 1 - k);
      ctx.globalAlpha = 1 - k * 0.6;
      drawCharacter(ctx, this.skin, 0, 0, s, this.look, time, 1, { name: 'win', t });
      ctx.restore();
      ctx.globalAlpha = 1;
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
    drawCharacter(ctx, this.skin, 0, 0, s, this.look, time, squash, { name: moving ? this.animName : 'idle', t: moving ? time - this.animT0 : time });
    ctx.restore();
  }
}
