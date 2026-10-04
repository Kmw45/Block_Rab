// Rev2D로 보물 상자의 동작 시트를 만든다(가만히 들썩이기, 뽑기 직전의 흔들림).
// 사용: node tools/make-chest.mjs    결과: public/assets/anim/chest.webp
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';

const REV2D = resolve(process.env.REV2D_DIR ?? '../Rev2D', 'bin/rev2d.js');
const WORK = resolve('art/rig-chest');
const CANVAS = 400;
const IMG = { x: 60, y: 90, size: 280 };
const FRAME = 256;
const COLS = 6;
const N = 4;
// src/ui/app.ts의 CHEST_ANIMS와 순서·개수가 같아야 한다
const CLIPS = [
  ['idle', 16],
  ['shake', 20],
];

function offsets(fn) {
  const out = [];
  for (let r = 0; r <= N; r++) {
    for (let c = 0; c <= N; c++) {
      const [dx, dy] = fn(c / N, r / N);
      out.push(Math.round(dx * 10) / 10, Math.round(dy * 10) / 10);
    }
  }
  return out;
}
const bind = (param, keys) => ({ target: 'warp:box.offsets', params: [param], keys });
const track = (param, pairs) => ({ target: 'param:' + param, keys: pairs.map(([t, v], i) => (i < pairs.length - 1 ? { t, v, ease: 'smooth' } : { t, v })) });

const rig = {
  format: 'rev2d',
  version: 1,
  meta: { name: 'chest', width: CANVAS, height: CANVAS, background: 'transparent', fps: 20, description: '보물 상자: 그림 한 장을 워프 격자로 들썩이고 흔든다' },
  parameters: [
    { id: 'Squash', min: -1, max: 1, default: 0, description: '+ 눌림, - 늘어남' },
    { id: 'Tilt', min: -1, max: 1, default: 0, description: '좌우로 기울기' },
    { id: 'Hop', min: 0, max: 1, default: 0, description: '뛰어오른 높이' },
    { id: 'Lid', min: 0, max: 1, default: 0, description: '뚜껑이 들썩이는 정도' },
  ],
  textures: [{ id: 'chest', path: 'chest.png', width: 512, height: 512 }],
  bones: [],
  warps: [{ id: 'box', rect: [IMG.x, IMG.y, IMG.size, IMG.size], cols: N, rows: N }],
  parts: [{ id: 'chest', parent: 'box', shape: { type: 'image', texture: 'chest', crop: [0, 0, 512, 512], x: IMG.x, y: IMG.y, w: IMG.size, h: IMG.size, cols: 12, rows: 12 }, z: 1 }],
  bindings: [
    bind('Squash', [
      { at: [-1], value: offsets((u, v) => [-(u - 0.5) * 26, -(1 - v) * 34]) },
      { at: [0], value: {} },
      { at: [1], value: offsets((u, v) => [(u - 0.5) * 34 * (0.5 + 0.5 * v), (1 - v) * 38]) },
    ]),
    bind('Tilt', [
      { at: [-1], value: offsets((u, v) => [-(1 - v) * 34, (u - 0.5) * 22 * (1 - v)]) },
      { at: [0], value: {} },
      { at: [1], value: offsets((u, v) => [(1 - v) * 34, -(u - 0.5) * 22 * (1 - v)]) },
    ]),
    bind('Hop', [
      { at: [0], value: {} },
      { at: [1], value: offsets(() => [0, -36]) },
    ]),
    // 뚜껑(위쪽 절반)만 살짝 들린다
    bind('Lid', [
      { at: [0], value: {} },
      { at: [1], value: offsets((u, v) => (v <= 0.5 ? [(u - 0.5) * 8, -16 * (1 - v * 2) - 4] : [0, 0])) },
    ]),
  ],
  animations: [
    {
      id: 'idle',
      duration: 1.6,
      loop: true,
      description: '가만히 있을 때: 숨쉬듯 들썩이다가 한 번 폴짝 뛴다',
      tracks: [
        track('Squash', [[0, 0], [0.4, 0.22], [0.8, 0], [1.0, 0.5], [1.15, -0.45], [1.35, 0.3], [1.6, 0]]),
        track('Hop', [[0, 0], [1.0, 0], [1.18, 1], [1.36, 0], [1.6, 0]]),
        track('Lid', [[0, 0], [1.1, 0], [1.22, 1], [1.4, 0], [1.6, 0]]),
      ],
    },
    {
      id: 'shake',
      duration: 1.0,
      loop: false,
      description: '뽑기 직전: 점점 세게 흔들리며 뚜껑이 들썩인다',
      tracks: [
        track('Tilt', [[0, 0], [0.08, 0.3], [0.2, -0.4], [0.32, 0.55], [0.44, -0.7], [0.56, 0.85], [0.68, -1], [0.8, 1], [0.9, -0.6], [1, 0]]),
        track('Squash', [[0, 0], [0.3, 0.2], [0.6, 0.35], [0.85, 0.7], [1, -0.6]]),
        track('Lid', [[0, 0], [0.3, 0.3], [0.5, 0.1], [0.7, 0.7], [0.85, 0.3], [1, 1]]),
      ],
    },
  ],
};

mkdirSync(WORK, { recursive: true });
mkdirSync('public/assets/anim', { recursive: true });
await sharp('public/assets/sprites/ui_chest_closed.png').resize(512, 512).png().toFile(resolve(WORK, 'chest.png'));
writeFileSync(resolve(WORK, 'chest.r2d.json'), JSON.stringify(rig, null, 1));
const rev2d = (args) => execFileSync(process.execPath, [REV2D, ...args], { cwd: WORK, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
console.log(rev2d(['validate', 'chest.r2d.json']).trim().split('\n').slice(-2).join(' | '));

const frames = [];
for (const [clip, count] of CLIPS) {
  const dir = resolve(WORK, 'frames', clip);
  rev2d(['frames', 'chest.r2d.json', '-o', dir, '--anim', clip, '--frames', String(count), '--scale', String(FRAME / CANVAS), '--bg', 'transparent', '--no-physics']);
  for (const f of JSON.parse(readFileSync(resolve(dir, 'manifest.json'), 'utf8')).files) frames.push(resolve(dir, f));
}
const rows = Math.ceil(frames.length / COLS);
const sheet = await sharp({ create: { width: COLS * FRAME, height: rows * FRAME, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite(frames.map((input, i) => ({ input, left: (i % COLS) * FRAME, top: Math.floor(i / COLS) * FRAME })))
  .webp({ quality: 88, alphaQuality: 90, effort: 5 })
  .toFile('public/assets/anim/chest.webp');
rmSync(resolve(WORK, 'frames'), { recursive: true, force: true });
console.log(`chest ${frames.length}프레임 -> ${COLS * FRAME}x${rows * FRAME}  ${(sheet.size / 1024).toFixed(0)}KB`);
