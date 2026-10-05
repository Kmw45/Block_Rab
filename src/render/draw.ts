// 블록, 캐릭터, 자국을 캔버스에 그린다. sprites에 같은 키의 그림이 있으면 그 그림을 쓴다.
import { BlockKind, DX, DY } from '../core/board';
import { getSheet, getSprite } from './sprites';

type Ctx = CanvasRenderingContext2D;
const TAU = Math.PI * 2;

export function rr(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

// 그림으로 된 블록. 바닥에 그림자를 깔고 살짝 띄워 그린다.
function sprite(ctx: Ctx, key: string, cx: number, cy: number, s: number, rot = 0, shadow = true): boolean {
  const img = getSprite(key);
  if (!img) return false;
  if (shadow) {
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    rr(ctx, cx - s * 0.4, cy - s * 0.34, s * 0.8, s * 0.82, s * 0.14);
    ctx.fill();
  }
  ctx.save();
  ctx.translate(cx, cy - s * 0.04);
  if (rot) ctx.rotate(rot);
  ctx.drawImage(img, -s / 2, -s / 2, s, s);
  ctx.restore();
  return true;
}

// 윗면과 아래 두께가 있는 블록 몸통
function slab(ctx: Ctx, cx: number, cy: number, s: number, top: string, topLight: string, side: string): void {
  const w = s * 0.86;
  const x = cx - w / 2;
  const y = cy - w / 2;
  const r = s * 0.16;
  const lip = s * 0.1;
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  rr(ctx, x + s * 0.02, y + lip + s * 0.04, w, w, r);
  ctx.fill();
  ctx.fillStyle = side;
  rr(ctx, x, y + lip * 0.5, w, w, r);
  ctx.fill();
  const g = ctx.createLinearGradient(0, y - lip * 0.5, 0, y + w - lip);
  g.addColorStop(0, topLight);
  g.addColorStop(1, top);
  ctx.fillStyle = g;
  rr(ctx, x, y - lip * 0.5, w, w - lip * 0.2, r);
  ctx.fill();
}

function arrowHead(ctx: Ctx, x: number, y: number, dir: number, size: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((dir * Math.PI) / 2);
  ctx.beginPath();
  ctx.moveTo(0, -size);
  ctx.lineTo(size * 0.9, size * 0.35);
  ctx.lineTo(-size * 0.9, size * 0.35);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export const FIXED_COLORS = { top: '#4a4658', light: '#5d5870', side: '#2a2735' };

function mix(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (shift: number) => {
    const va = (pa >> shift) & 255;
    const vb = (pb >> shift) & 255;
    return Math.round(va + (vb - va) * t);
  };
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

export function drawFixed(ctx: Ctx, cx: number, cy: number, s: number): void {
  if (sprite(ctx, 'block_fixed', cx, cy, s)) return;
  slab(ctx, cx, cy, s, FIXED_COLORS.top, FIXED_COLORS.light, FIXED_COLORS.side);
}

// lock: 횟수 블록이 고정 블록으로 변하는 정도(0~1)
export function drawBlock(ctx: Ctx, kind: BlockKind, cx: number, cy: number, s: number, count: number, lock: number, time: number): void {
  // 세로 레일은 가로 레일 그림을 돌려 쓴다
  if (kind === 'railV' && sprite(ctx, 'block_railH', cx, cy, s, Math.PI / 2)) return;
  if (kind !== 'count' && sprite(ctx, 'block_' + kind, cx, cy, s)) return;
  const top = cy - s * 0.05;
  if (kind === 'count' && getSprite('block_count') && getSprite('block_fixed')) {
    // 그림 위에 남은 횟수만 코드로 얹는다. 0이 되면 고정 블록 그림으로 바뀐다.
    sprite(ctx, 'block_fixed', cx, cy, s);
    ctx.globalAlpha = 1 - lock;
    sprite(ctx, 'block_count', cx, cy, s, 0, false);
    ctx.globalAlpha = 1;
    if (count > 0) {
      ctx.font = `800 ${s * 0.44}px "Baloo 2", "Nunito", system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      ctx.lineWidth = s * 0.07;
      ctx.strokeStyle = 'rgba(90,24,12,0.85)';
      ctx.strokeText(String(count), cx, top - s * 0.01);
      ctx.fillStyle = '#fff6f0';
      ctx.fillText(String(count), cx, top - s * 0.01);
      for (let i = 0; i < count; i++) {
        ctx.beginPath();
        ctx.arc(cx + (i - (count - 1) / 2) * s * 0.13, top + s * 0.29, s * 0.04, 0, TAU);
        ctx.stroke();
        ctx.fill();
      }
    }
    return;
  }
  if (kind === 'normal') {
    slab(ctx, cx, cy, s, '#d9a45f', '#f0c88a', '#93622b');
    ctx.strokeStyle = 'rgba(120,72,24,0.55)';
    ctx.lineWidth = s * 0.035;
    const h = s * 0.3;
    rr(ctx, cx - h, top - h, h * 2, h * 2, s * 0.06);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - h, top - h);
    ctx.lineTo(cx + h, top + h);
    ctx.moveTo(cx + h, top - h);
    ctx.lineTo(cx - h, top + h);
    ctx.stroke();
  } else if (kind === 'railH' || kind === 'railV') {
    slab(ctx, cx, cy, s, '#3fae8f', '#73dcc0', '#1c6a55');
    ctx.save();
    ctx.translate(cx, top);
    if (kind === 'railV') ctx.rotate(Math.PI / 2);
    ctx.fillStyle = 'rgba(8,48,38,0.35)';
    rr(ctx, -s * 0.36, -s * 0.11, s * 0.72, s * 0.22, s * 0.11);
    ctx.fill();
    ctx.fillStyle = '#f4fffb';
    ctx.fillRect(-s * 0.14, -s * 0.035, s * 0.28, s * 0.07);
    arrowHead(ctx, s * 0.24, 0, 1, s * 0.1);
    arrowHead(ctx, -s * 0.24, 0, 3, s * 0.1);
    ctx.restore();
  } else if (kind === 'ice') {
    slab(ctx, cx, cy, s, '#8fd6ff', '#e4f7ff', '#4a94cf');
    ctx.save();
    rr(ctx, cx - s * 0.43, top - s * 0.43, s * 0.86, s * 0.82, s * 0.16);
    ctx.clip();
    // 반짝임이 대각선으로 지나간다
    const sweep = ((time * 0.45) % 2.4) - 0.7;
    const gx = cx - s * 0.6 + sweep * s * 1.2;
    const g = ctx.createLinearGradient(gx - s * 0.2, top - s * 0.4, gx + s * 0.2, top + s * 0.4);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.75)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(cx - s * 0.5, top - s * 0.5, s, s);
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = s * 0.03;
    ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const a = (i * Math.PI) / 3;
      ctx.beginPath();
      ctx.moveTo(cx - Math.cos(a) * s * 0.17, top - Math.sin(a) * s * 0.17);
      ctx.lineTo(cx + Math.cos(a) * s * 0.17, top + Math.sin(a) * s * 0.17);
      ctx.stroke();
    }
  } else if (kind === 'link') {
    // 쌍둥이 블록: 맞물린 고리 두 개
    slab(ctx, cx, cy, s, '#e86aa6', '#ffb3d6', '#9c3a6b');
    ctx.strokeStyle = '#fff5fa';
    ctx.lineWidth = s * 0.06;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(cx + side * s * 0.09, top, s * 0.14, 0, TAU);
      ctx.stroke();
    }
  } else {
    // 횟수 블록. 0이 되면 고정 블록과 같은 색이 된다.
    slab(
      ctx,
      cx,
      cy,
      s,
      mix('#e2604f', FIXED_COLORS.top, lock),
      mix('#ff9a7d', FIXED_COLORS.light, lock),
      mix('#96301f', FIXED_COLORS.side, lock),
    );
    if (count > 0) {
      ctx.fillStyle = '#fff6f0';
      ctx.font = `800 ${s * 0.42}px "Baloo 2", "Nunito", system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(count), cx, top - s * 0.02);
      // 색에만 의존하지 않도록 남은 횟수를 점으로도 보여준다
      for (let i = 0; i < count; i++) {
        ctx.beginPath();
        ctx.arc(cx + (i - (count - 1) / 2) * s * 0.13, top + s * 0.27, s * 0.035, 0, TAU);
        ctx.fill();
      }
    }
  }
}

interface SkinDef {
  body: string;
  light: string;
  dark: string;
  eye?: string;
  shape?: 'round' | 'square' | 'ghost' | 'pot';
  glow?: string;
}

const SKINS: Record<string, SkinDef> = {
  default: { body: '#ffc94d', light: '#ffe59a', dark: '#d8922a' },
  moss: { body: '#8d9b82', light: '#b4c0a8', dark: '#5f6b58' },
  mouse: { body: '#b8a79a', light: '#d9cdc2', dark: '#8a7a6e' },
  torch: { body: '#d9773f', light: '#f3a56d', dark: '#9c4a20' },
  web: { body: '#e6e6ee', light: '#ffffff', dark: '#b3b3c4' },
  pot: { body: '#c47a45', light: '#e3a070', dark: '#8c4f25', shape: 'pot' },
  bat: { body: '#5d4c80', light: '#8572ad', dark: '#3a2e55', eye: '#ffe36e' },
  helmet: { body: '#f0c9a2', light: '#ffe6cc', dark: '#c59870' },
  lantern: { body: '#58ac9f', light: '#8fd6ca', dark: '#33776c' },
  skeleton: { body: '#f2efe4', light: '#ffffff', dark: '#c2bda9', eye: '#1c1a26' },
  statue: { body: '#9aa1ab', light: '#c3c9d1', dark: '#6b727d', shape: 'square' },
  hunter: { body: '#dba56b', light: '#f4cc9c', dark: '#a8733e' },
  ghost: { body: '#e6f0ff', light: '#ffffff', dark: '#a9bfe6', shape: 'ghost' },
  minotaur: { body: '#9a583a', light: '#c98562', dark: '#66331c' },
  mage: { body: '#6b5bd0', light: '#9d90f0', dark: '#40349a' },
  knight: { body: '#ffd24d', light: '#fff0a8', dark: '#c48f10', glow: 'rgba(255,210,77,0.35)' },
  slime: { body: '#6fcf5f', light: '#b4f0a4', dark: '#3d9a34' },
  mushroom: { body: '#f2e2c4', light: '#fff6e2', dark: '#c9b48c' },
  mummy: { body: '#e6dcc2', light: '#fbf5e4', dark: '#b3a682' },
  goblin: { body: '#7fb34f', light: '#aede7c', dark: '#4f7f2a' },
  dragon: { body: '#e0523f', light: '#ff8f73', dark: '#a12a1c' },
  phoenix: { body: '#ff9a2e', light: '#ffe08a', dark: '#d9520f', glow: 'rgba(255,150,46,0.6)' },
  king: { body: '#ffcf33', light: '#fff6b8', dark: '#d1890a', glow: 'rgba(255,207,51,0.6)' },
};

function bodyPath(ctx: Ctx, shape: SkinDef['shape'], r: number, time: number): void {
  ctx.beginPath();
  if (shape === 'square') {
    ctx.roundRect(-r, -r, r * 2, r * 2, r * 0.3);
  } else if (shape === 'pot') {
    ctx.moveTo(-r * 0.55, -r);
    ctx.lineTo(r * 0.55, -r);
    ctx.bezierCurveTo(r * 0.5, -r * 0.5, r * 1.15, -r * 0.3, r * 1.05, r * 0.3);
    ctx.bezierCurveTo(r, r * 0.9, r * 0.6, r, 0, r);
    ctx.bezierCurveTo(-r * 0.6, r, -r, r * 0.9, -r * 1.05, r * 0.3);
    ctx.bezierCurveTo(-r * 1.15, -r * 0.3, -r * 0.5, -r * 0.5, -r * 0.55, -r);
  } else if (shape === 'ghost') {
    ctx.moveTo(-r, r * 0.9);
    ctx.lineTo(-r, -r * 0.1);
    ctx.bezierCurveTo(-r, -r * 1.3, r, -r * 1.3, r, -r * 0.1);
    ctx.lineTo(r, r * 0.9);
    for (let i = 0; i < 4; i++) {
      const x0 = r - i * r * 0.5;
      const wave = Math.sin(time * 5 + i) * r * 0.06;
      ctx.quadraticCurveTo(x0 - r * 0.125, r * 0.55 + wave, x0 - r * 0.25, r * 0.9);
      ctx.quadraticCurveTo(x0 - r * 0.375, r * 1.15 + wave, x0 - r * 0.5, r * 0.9);
    }
  } else {
    ctx.roundRect(-r, -r, r * 2, r * 2, r * 0.72);
  }
  ctx.closePath();
}

function star(ctx: Ctx, x: number, y: number, r: number, rot = 0): void {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = rot - Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 ? r * 0.45 : r;
    ctx.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
  }
  ctx.closePath();
}

function flame(ctx: Ctx, x: number, y: number, h: number, time: number): void {
  const f = 1 + Math.sin(time * 14) * 0.08;
  ctx.fillStyle = '#ff8a2a';
  ctx.beginPath();
  ctx.moveTo(x, y - h * f);
  ctx.bezierCurveTo(x + h * 0.6, y - h * 0.4, x + h * 0.45, y, x, y);
  ctx.bezierCurveTo(x - h * 0.45, y, x - h * 0.6, y - h * 0.4, x, y - h * f);
  ctx.fill();
  ctx.fillStyle = '#ffe07a';
  ctx.beginPath();
  ctx.ellipse(x, y - h * 0.28, h * 0.18, h * 0.3 * f, 0, 0, TAU);
  ctx.fill();
}

// 몸 뒤에 그리는 장식
function accessoryBack(ctx: Ctx, id: string, r: number, time: number, d: SkinDef): void {
  if (id === 'bat') {
    const flap = Math.sin(time * 9) * 0.25;
    ctx.fillStyle = d.dark;
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.scale(side, 1);
      ctx.rotate(-flap);
      ctx.beginPath();
      ctx.moveTo(r * 0.6, -r * 0.2);
      ctx.lineTo(r * 1.75, -r * 0.85);
      ctx.quadraticCurveTo(r * 1.5, -r * 0.2, r * 1.7, r * 0.25);
      ctx.quadraticCurveTo(r * 1.3, r * 0.05, r * 1.15, r * 0.4);
      ctx.quadraticCurveTo(r * 0.95, r * 0.1, r * 0.6, r * 0.3);
      ctx.fill();
      ctx.restore();
    }
  } else if (id === 'mouse') {
    ctx.strokeStyle = '#d99a9a';
    ctx.lineWidth = r * 0.12;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(r * 0.8, r * 0.6);
    ctx.quadraticCurveTo(r * 1.6, r * 0.9 + Math.sin(time * 4) * r * 0.2, r * 1.5, r * 0.1);
    ctx.stroke();
    for (const side of [-1, 1]) {
      ctx.fillStyle = d.dark;
      ctx.beginPath();
      ctx.arc(side * r * 0.72, -r * 0.92, r * 0.42, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#e8b4b4';
      ctx.beginPath();
      ctx.arc(side * r * 0.72, -r * 0.92, r * 0.24, 0, TAU);
      ctx.fill();
    }
  } else if (id === 'minotaur') {
    ctx.fillStyle = '#f2e6cf';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(side * r * 0.55, -r * 0.8);
      ctx.quadraticCurveTo(side * r * 1.5, -r * 0.9, side * r * 1.25, -r * 1.75);
      ctx.quadraticCurveTo(side * r * 1.05, -r * 1.15, side * r * 0.25, -r * 0.95);
      ctx.fill();
    }
  } else if (id === 'torch') {
    flame(ctx, 0, -r * 0.85, r * 0.95, time);
  } else if (id === 'knight') {
    ctx.fillStyle = '#e0483b';
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.9);
    ctx.quadraticCurveTo(r * 0.9, -r * 2 + Math.sin(time * 5) * r * 0.08, r * 0.95, -r * 0.9);
    ctx.quadraticCurveTo(r * 0.45, -r * 1.25, 0, -r * 0.9);
    ctx.fill();
  }
}

// 몸 위에 그리는 장식
function accessoryFront(ctx: Ctx, id: string, r: number, time: number, d: SkinDef): void {
  switch (id) {
    case 'moss':
      ctx.fillStyle = '#5fa052';
      for (const [x, y, k] of [[-0.55, -0.7, 0.34], [0.1, -0.88, 0.28], [0.62, -0.55, 0.24], [-0.75, 0.55, 0.2], [0.7, 0.62, 0.22]]) {
        ctx.beginPath();
        ctx.arc(x * r, y * r, k * r, 0, TAU);
        ctx.fill();
      }
      break;
    case 'web':
      ctx.strokeStyle = 'rgba(120,120,150,0.7)';
      ctx.lineWidth = r * 0.05;
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 4 + 0.3;
        ctx.beginPath();
        ctx.moveTo(-Math.cos(a) * r * 0.9, -Math.sin(a) * r * 0.9);
        ctx.lineTo(Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.9);
        ctx.stroke();
      }
      for (const k of [0.4, 0.7]) {
        ctx.beginPath();
        ctx.arc(0, 0, r * k, 0, TAU);
        ctx.stroke();
      }
      break;
    case 'pot':
      ctx.strokeStyle = '#4a2610';
      ctx.lineWidth = r * 0.07;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(r * 0.3, -r);
      ctx.lineTo(r * 0.1, -r * 0.6);
      ctx.lineTo(r * 0.42, -r * 0.42);
      ctx.lineTo(r * 0.28, -r * 0.1);
      ctx.stroke();
      ctx.fillStyle = d.dark;
      ctx.fillRect(-r * 0.62, -r * 1.02, r * 1.24, r * 0.16);
      break;
    case 'helmet':
      ctx.fillStyle = '#b8792e';
      ctx.beginPath();
      ctx.arc(0, -r * 0.25, r * 1.04, Math.PI, 0);
      ctx.lineTo(r * 1.04, -r * 0.05);
      ctx.lineTo(-r * 1.04, -r * 0.05);
      ctx.fill();
      ctx.fillStyle = '#e0a85a';
      ctx.fillRect(-r * 0.1, -r * 0.3, r * 0.2, r * 0.75);
      ctx.fillStyle = '#d8453a';
      ctx.beginPath();
      ctx.ellipse(0, -r * 1.3, r * 0.2, r * 0.42, 0, 0, TAU);
      ctx.fill();
      break;
    case 'lantern': {
      const lx = r * 0.95;
      const ly = r * 0.5 + Math.sin(time * 3) * r * 0.05;
      const g = ctx.createRadialGradient(lx, ly, 0, lx, ly, r * 0.9);
      g.addColorStop(0, 'rgba(255,220,120,0.75)');
      g.addColorStop(1, 'rgba(255,220,120,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(lx, ly, r * 0.9, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#3d2b1f';
      ctx.fillRect(lx - r * 0.2, ly - r * 0.3, r * 0.4, r * 0.08);
      ctx.fillStyle = '#ffe07a';
      rr(ctx, lx - r * 0.16, ly - r * 0.22, r * 0.32, r * 0.42, r * 0.06);
      ctx.fill();
      break;
    }
    case 'skeleton':
      ctx.fillStyle = '#1c1a26';
      for (let i = -2; i <= 2; i++) ctx.fillRect(i * r * 0.2 - r * 0.03, r * 0.42, r * 0.06, r * 0.26);
      ctx.fillRect(-r * 0.46, r * 0.5, r * 0.92, r * 0.06);
      break;
    case 'statue':
      ctx.strokeStyle = d.dark;
      ctx.lineWidth = r * 0.07;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(-r * 0.9, -r * 0.5);
      ctx.lineTo(-r * 0.5, -r * 0.62);
      ctx.lineTo(-r * 0.35, -r * 0.95);
      ctx.moveTo(r * 0.95, r * 0.3);
      ctx.lineTo(r * 0.55, r * 0.5);
      ctx.lineTo(r * 0.5, r * 0.95);
      ctx.stroke();
      break;
    case 'hunter':
      ctx.fillStyle = '#6b4424';
      ctx.beginPath();
      ctx.ellipse(0, -r * 0.72, r * 1.35, r * 0.24, 0, 0, TAU);
      ctx.fill();
      rr(ctx, -r * 0.68, -r * 1.42, r * 1.36, r * 0.75, r * 0.26);
      ctx.fill();
      ctx.fillStyle = '#e0b04a';
      ctx.fillRect(-r * 0.68, -r * 0.94, r * 1.36, r * 0.13);
      break;
    case 'minotaur':
      ctx.strokeStyle = '#ffd24d';
      ctx.lineWidth = r * 0.09;
      ctx.beginPath();
      ctx.arc(0, r * 0.58, r * 0.2, 0.2, Math.PI - 0.2);
      ctx.stroke();
      break;
    case 'mage':
      ctx.fillStyle = '#3a2f8c';
      ctx.beginPath();
      ctx.moveTo(-r * 1.2, -r * 0.62);
      ctx.quadraticCurveTo(0, -r * 0.95, r * 1.2, -r * 0.62);
      ctx.quadraticCurveTo(0, -r * 0.35, -r * 1.2, -r * 0.62);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-r * 0.7, -r * 0.7);
      ctx.quadraticCurveTo(r * 0.1, -r * 1.6, r * 0.5 + Math.sin(time * 2) * r * 0.06, -r * 2.1);
      ctx.quadraticCurveTo(r * 0.5, -r * 1.3, r * 0.7, -r * 0.7);
      ctx.fill();
      ctx.fillStyle = '#ffe07a';
      star(ctx, r * 0.06, -r * 1.12, r * 0.2, time);
      ctx.fill();
      break;
    case 'knight':
      ctx.fillStyle = '#8a5a00';
      rr(ctx, -r * 0.78, -r * 0.2, r * 1.56, r * 0.2, r * 0.08);
      ctx.fill();
      ctx.fillRect(-r * 0.06, -r * 0.2, r * 0.12, r * 0.75);
      break;
    case 'king': {
      ctx.fillStyle = '#ffb300';
      ctx.beginPath();
      ctx.moveTo(-r * 0.85, -r * 0.72);
      ctx.lineTo(-r * 0.95, -r * 1.55);
      ctx.lineTo(-r * 0.45, -r * 1.12);
      ctx.lineTo(0, -r * 1.75);
      ctx.lineTo(r * 0.45, -r * 1.12);
      ctx.lineTo(r * 0.95, -r * 1.55);
      ctx.lineTo(r * 0.85, -r * 0.72);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#e0483b';
      ctx.beginPath();
      ctx.arc(0, -r * 1.02, r * 0.14, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#fff';
      for (let i = 0; i < 3; i++) {
        const a = time * 1.6 + (i * TAU) / 3;
        ctx.globalAlpha = 0.5 + Math.sin(time * 6 + i * 2) * 0.5;
        star(ctx, Math.cos(a) * r * 1.5, Math.sin(a) * r * 1.2 - r * 0.2, r * 0.16, a);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      break;
    }
  }
}

// 동작 시트의 구성: [시작 프레임, 프레임 수, 초당 프레임, 반복]. tools/make-anim.mjs의 CLIPS와 같아야 한다.
const ANIMS = {
  idle: [0, 48, 30, true],
  walkS: [48, 12, 36, true], // 한 칸 이동에 한 걸음(반 주기)
  walkF: [60, 12, 36, true],
  pushS: [72, 14, 28, true],
  pushF: [86, 14, 28, true],
  win: [100, 30, 30, false],
  bump: [130, 12, 30, false], // 막혔을 때: 놀랐다가 귀가 처진다
  sleep: [142, 40, 20, true], // 오래 가만히 두면 존다
} as const;
export type AnimName = keyof typeof ANIMS;
const SHEET_COLS = 10;
const SHEET_FRAME = 240;
// 시트 한 칸은 400px 캔버스이고 발바닥이 위에서 352px에 있다. 캐릭터 키(약 232px)가 칸의 0.78배가 되게 그린다.
export const SHEET_SCALE = (0.94 * 400) / 232;
const SHEET_GROUND = 352 / 400;

// look: 바라보는 방향(0~3), squash: 이동 중 찌그러짐(1 = 없음), anim: 재생할 동작과 그 동작이 시작된 뒤의 시간
export function drawCharacter(
  ctx: Ctx,
  id: string,
  cx: number,
  cy: number,
  s: number,
  look: number,
  time: number,
  squash = 1,
  anim?: { name: AnimName; t: number },
): void {
  const sheet = anim ? getSheet(id) : undefined;
  if (sheet && anim) {
    const [start, count, fps, loop] = ANIMS[anim.name];
    const n = Math.floor(Math.max(0, anim.t) * fps);
    const frame = start + (loop ? n % count : Math.min(count - 1, n));
    const size = s * SHEET_SCALE;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(0, s * 0.335, s * 0.29, s * 0.08, 0, 0, TAU);
    ctx.fill();
    if (look === 3) ctx.scale(-1, 1);
    ctx.drawImage(
      sheet,
      (frame % SHEET_COLS) * SHEET_FRAME,
      Math.floor(frame / SHEET_COLS) * SHEET_FRAME,
      SHEET_FRAME,
      SHEET_FRAME,
      -size / 2,
      s * 0.36 - size * SHEET_GROUND,
      size,
      size,
    );
    ctx.restore();
    return;
  }
  const d = SKINS[id] ?? SKINS.default;
  const r = s * 0.31;
  const bob = Math.sin(time * 3.2) * s * 0.012;
  const img = getSprite('skin_' + id);
  if (img) {
    // 그림 스킨은 왼쪽을 볼 때 좌우로 뒤집고, 숨쉬듯 살짝 움직인다
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(0, r * 1.08, r * 0.95, r * 0.26, 0, 0, TAU);
    ctx.fill();
    const breathe = 1 + Math.sin(time * 3.2) * 0.02;
    ctx.translate(0, bob);
    ctx.scale(squash * (look === 3 ? -1 : 1), breathe / squash);
    ctx.drawImage(img, -s / 2, -s / 2 - s * 0.03, s, s);
    ctx.restore();
    return;
  }
  ctx.save();
  ctx.translate(cx, cy + bob);

  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(0, r * 1.02, r * 0.95, r * 0.26, 0, 0, TAU);
  ctx.fill();

  if (d.glow) {
    const g = ctx.createRadialGradient(0, 0, r * 0.5, 0, 0, r * 2.1);
    g.addColorStop(0, d.glow);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, r * 2.1, 0, TAU);
    ctx.fill();
  }

  ctx.scale(squash, 1 / squash);
  if (id === 'ghost') ctx.globalAlpha = 0.88;
  accessoryBack(ctx, id, r, time, d);

  const g = ctx.createLinearGradient(0, -r, 0, r);
  g.addColorStop(0, d.light);
  g.addColorStop(0.55, d.body);
  g.addColorStop(1, d.dark);
  ctx.fillStyle = g;
  bodyPath(ctx, d.shape, r, time);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.22)';
  ctx.lineWidth = s * 0.02;
  ctx.stroke();

  // 눈. 방향은 눈 위치로 표현한다.
  const ex = DX[look] * r * 0.26;
  const ey = DY[look] * r * 0.24 - r * 0.05;
  const blink = (time % 3.7) > 3.58 ? 0.15 : 1;
  for (const side of [-1, 1]) {
    const px = ex + side * r * 0.36;
    if (id === 'skeleton') {
      ctx.fillStyle = d.eye!;
      ctx.beginPath();
      ctx.ellipse(px, ey, r * 0.24, r * 0.28 * blink, 0, 0, TAU);
      ctx.fill();
      continue;
    }
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(px, ey, r * 0.2, r * 0.25 * blink, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = id === 'bat' ? '#3a2e55' : '#1c1a26';
    ctx.beginPath();
    ctx.ellipse(px + DX[look] * r * 0.07, ey + DY[look] * r * 0.07, r * 0.1, r * 0.13 * blink, 0, 0, TAU);
    ctx.fill();
  }

  accessoryFront(ctx, id, r, time, d);
  ctx.restore();
}

export interface TrailMark {
  x: number; // 칸 좌표
  y: number;
  dir: number;
  born: number;
}

export const TRAIL_LIFE: Record<string, number> = {
  steps: 4,
  chalk: 6,
  drops: 3.5,
  dust: 1.6,
  thread: 60,
  embers: 2.2,
  wisp: 2.6,
  stars: 3.2,
};

function seeded(n: number): number {
  const x = Math.sin(n * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

// ox, oy: 격자 원점, s: 칸 크기
export function drawTrail(ctx: Ctx, id: string, marks: TrailMark[], now: number, ox: number, oy: number, s: number): void {
  const life = TRAIL_LIFE[id];
  if (!life || !marks.length) return;
  const px = (m: TrailMark) => ox + (m.x + 0.5) * s;
  const py = (m: TrailMark) => oy + (m.y + 0.5) * s;

  if (id === 'thread' || id === 'chalk') {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let i = 1; i < marks.length; i++) {
      const a = marks[i - 1];
      const b = marks[i];
      const alpha = Math.max(0, 1 - (now - b.born) / life);
      if (alpha <= 0) continue;
      ctx.globalAlpha = id === 'thread' ? Math.min(1, alpha * 4) : alpha * 0.8;
      ctx.strokeStyle = id === 'thread' ? '#e0483b' : '#f3f0e6';
      ctx.lineWidth = id === 'thread' ? s * 0.06 : s * 0.05;
      if (id === 'chalk') ctx.setLineDash([s * 0.12, s * 0.08]);
      ctx.beginPath();
      ctx.moveTo(px(a), py(a));
      ctx.lineTo(px(b), py(b));
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    return;
  }

  for (let i = 0; i < marks.length; i++) {
    const m = marks[i];
    const age = (now - m.born) / life;
    if (age >= 1) continue;
    const x = px(m);
    const y = py(m);
    const fade = 1 - age;
    if (id === 'steps') {
      ctx.fillStyle = `rgba(20,16,30,${0.4 * fade})`;
      const perp = m.dir % 2 === 0 ? [1, 0] : [0, 1];
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(
          x + perp[0] * side * s * 0.1 + DX[m.dir] * side * s * 0.05,
          y + perp[1] * side * s * 0.1 + DY[m.dir] * side * s * 0.05,
          m.dir % 2 === 0 ? s * 0.05 : s * 0.08,
          m.dir % 2 === 0 ? s * 0.08 : s * 0.05,
          0,
          0,
          TAU,
        );
        ctx.fill();
      }
    } else if (id === 'drops') {
      ctx.fillStyle = `rgba(120,200,255,${0.65 * fade})`;
      for (let k = 0; k < 3; k++) {
        ctx.beginPath();
        ctx.arc(x + (seeded(i * 3 + k) - 0.5) * s * 0.45, y + (seeded(i * 7 + k) - 0.5) * s * 0.45, s * (0.03 + seeded(i + k) * 0.04), 0, TAU);
        ctx.fill();
      }
    } else if (id === 'dust') {
      ctx.fillStyle = `rgba(222,190,140,${0.45 * fade})`;
      for (let k = 0; k < 4; k++) {
        ctx.beginPath();
        ctx.arc(
          x + (seeded(i * 5 + k) - 0.5) * s * (0.3 + age * 0.5),
          y + (seeded(i * 11 + k) - 0.5) * s * 0.3 - age * s * 0.15,
          s * (0.06 + age * 0.08),
          0,
          TAU,
        );
        ctx.fill();
      }
    } else if (id === 'embers' || id === 'wisp') {
      const color = id === 'embers' ? '255,150,60' : '120,255,210';
      for (let k = 0; k < 3; k++) {
        const fx = x + (seeded(i * 5 + k) - 0.5) * s * 0.4 + Math.sin(now * 3 + i + k) * s * 0.05;
        const fy = y + (seeded(i * 9 + k) - 0.5) * s * 0.3 - age * s * (id === 'embers' ? 0.5 : 0.25);
        const rad = s * (id === 'embers' ? 0.05 : 0.11) * fade;
        const g = ctx.createRadialGradient(fx, fy, 0, fx, fy, rad * 2.4);
        g.addColorStop(0, `rgba(${color},${0.9 * fade})`);
        g.addColorStop(1, `rgba(${color},0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(fx, fy, rad * 2.4, 0, TAU);
        ctx.fill();
      }
    } else if (id === 'stars') {
      for (let k = 0; k < 3; k++) {
        const twinkle = 0.5 + Math.sin(now * 7 + i * 2 + k * 3) * 0.5;
        ctx.fillStyle = `rgba(255,240,170,${fade * (0.4 + twinkle * 0.6)})`;
        star(ctx, x + (seeded(i * 5 + k) - 0.5) * s * 0.55, y + (seeded(i * 9 + k) - 0.5) * s * 0.55, s * (0.05 + seeded(i + k * 2) * 0.06), now + k);
        ctx.fill();
      }
    }
  }
}

export function drawStarShape(ctx: Ctx, x: number, y: number, r: number): void {
  star(ctx, x, y, r);
}
