// 화면 전체에 덮는 축하 효과(색종이, 빛 알갱이)
interface Bit {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  size: number;
  color: string;
  age: number;
  life: number;
  round: boolean;
}

let canvas: HTMLCanvasElement;
let ctx: CanvasRenderingContext2D;
let bits: Bit[] = [];
let raf = 0;
let last = 0;

function fit(): void {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

export function initFx(): void {
  canvas = document.getElementById('fx') as HTMLCanvasElement;
  ctx = canvas.getContext('2d')!;
  fit();
  addEventListener('resize', fit);
}

function frame(time: number): void {
  const dt = Math.min(0.05, (time - last) / 1000);
  last = time;
  ctx.clearRect(0, 0, innerWidth, innerHeight);
  for (const b of bits) {
    b.age += dt;
    b.vy += 900 * dt;
    b.vx *= 1 - dt * 1.4;
    b.vy *= 1 - dt * 1.4;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.rot += b.vr * dt;
    ctx.globalAlpha = Math.min(1, (1 - b.age / b.life) * 2);
    ctx.fillStyle = b.color;
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.rot);
    if (b.round) {
      ctx.beginPath();
      ctx.arc(0, 0, b.size / 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.scale(1, Math.cos(b.rot * 2.3));
      ctx.fillRect(-b.size / 2, -b.size / 3, b.size, b.size * 0.66);
    }
    ctx.restore();
  }
  ctx.globalAlpha = 1;
  bits = bits.filter((b) => b.age < b.life);
  raf = bits.length ? requestAnimationFrame(frame) : 0;
}

export function burst(x: number, y: number, colors: string[], count = 60, power = 620): void {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = power * (0.25 + Math.random() * 0.75);
    bits.push({
      x,
      y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp - power * 0.5,
      rot: Math.random() * 6,
      vr: (Math.random() - 0.5) * 12,
      size: 6 + Math.random() * 8,
      color: colors[i % colors.length],
      age: 0,
      life: 1.1 + Math.random() * 0.9,
      round: i % 4 === 0,
    });
  }
  if (!raf) {
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }
}
