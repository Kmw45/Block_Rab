// Rev2D로 캐릭터를 관절 리깅해 동작 프레임을 뽑고 한 장의 시트로 묶는다.
// 사용: node tools/make-anim.mjs [스킨 id 쉼표 목록]   (기본: art/parts에 부위 그림이 다 있는 모든 스킨)
// 부위 그림(art/parts/<id>_body|arm|leg.png)은 tools/gen-parts.mjs로 만든다.
// Rev2D 저장소 위치는 REV2D_DIR 환경 변수로 바꿀 수 있다(기본 ../Rev2D).
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';

const REV2D = resolve(process.env.REV2D_DIR ?? '../Rev2D', 'bin/rev2d.js');
const PARTS = 'art/parts';
const OUT = 'public/assets/anim';
const SKIN_OUT = 'public/assets/sprites';
const WORK = resolve('art/rig');
const FRAME = 240; // 시트 한 칸의 크기(px)
const CANVAS = 400;
const GROUND = 352; // 발바닥 높이
const HIP_Y = 316; // 다리가 몸통에 붙는 높이
const CX = 200;
const BODY_BOX = [200, 196]; // 몸통(모자 포함)이 들어가는 최대 크기
const LEG = [42, 46];
const ARM_H = 60;

// 동작과 프레임 수, 초당 프레임. src/render/draw.ts의 ANIMS와 순서·개수가 같아야 한다.
const CLIPS = [
  ['idle', 24],
  ['walkS', 12],
  ['walkF', 12],
  ['pushS', 12],
  ['pushF', 12],
  ['win', 20],
];
const COLS = 10;

const transparent = { r: 0, g: 0, b: 0, alpha: 0 };

// 여백을 잘라 낸 그림과 그 크기
async function trimmed(file) {
  const { data, info } = await sharp(file).ensureAlpha().trim({ threshold: 20 }).png().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
}

// 몸통에서 팔이 붙을 자리: 몸 높이의 중간쯤에서 가장 바깥의 불투명 픽셀
async function sideEdges(buf, w, h) {
  const raw = await sharp(buf).ensureAlpha().raw().toBuffer();
  const opaque = (x, y) => raw[(y * w + x) * 4 + 3] > 128;
  const lefts = [];
  const rights = [];
  const mid = Math.floor(w / 2);
  for (let y = Math.floor(h * 0.5); y < Math.floor(h * 0.72); y++) {
    if (!opaque(mid, y)) continue;
    let l = mid;
    let r = mid;
    while (l > 0 && opaque(l - 1, y)) l--;
    while (r < w - 1 && opaque(r + 1, y)) r++;
    lefts.push(l);
    rights.push(r);
  }
  const median = (a) => a.sort((p, q) => p - q)[Math.floor(a.length / 2)];
  // 몸통은 좌우 대칭이므로, 한쪽에만 꼬리 같은 것이 붙어 있으면 더 좁은 쪽 폭에 맞춘다
  const half = Math.min(mid - median(lefts), median(rights) - mid);
  return [mid - half, mid + half];
}

async function prepare(id) {
  const body = await trimmed(`${PARTS}/${id}_body.png`);
  const scale = Math.min(BODY_BOX[0] / body.w, BODY_BOX[1] / body.h);
  const bw = Math.round(body.w * scale);
  const bh = Math.round(body.h * scale);
  const bodyBuf = await sharp(body.data).resize(bw, bh).png().toBuffer();
  const [el, er] = await sideEdges(bodyBuf, bw, bh);

  const arm = await trimmed(`${PARTS}/${id}_arm.png`);
  const aw = Math.max(26, Math.min(44, Math.round((arm.w * ARM_H) / arm.h)));
  const armBuf = await sharp(arm.data).resize(aw, ARM_H, { fit: 'fill' }).png().toBuffer();
  const leg = await trimmed(`${PARTS}/${id}_leg.png`);
  const legBuf = await sharp(leg.data).resize(LEG[0], LEG[1], { fit: 'fill' }).png().toBuffer();

  writeFileSync(resolve(WORK, 'body.png'), bodyBuf);
  writeFileSync(resolve(WORK, 'armL.png'), armBuf);
  writeFileSync(resolve(WORK, 'armR.png'), await sharp(armBuf).flop().png().toBuffer());
  writeFileSync(resolve(WORK, 'legL.png'), legBuf);
  writeFileSync(resolve(WORK, 'legR.png'), await sharp(legBuf).flop().png().toBuffer());

  const bodyX = CX - bw / 2;
  const bodyY = HIP_Y + 12 - bh; // 몸통 아래쪽이 다리 윗부분을 살짝 덮는다
  return { bw, bh, aw, bodyX, bodyY, shoulderL: bodyX + el + 7, shoulderR: bodyX + er - 7, shoulderY: bodyY + bh * 0.6 };
}

const num = (target, param, lo, hi, mid) => ({
  target,
  params: [param],
  keys: mid === undefined ? [{ at: [-1], value: lo }, { at: [1], value: hi }] : [{ at: [-1], value: lo }, { at: [0], value: mid }, { at: [1], value: hi }],
});
const num01 = (target, param, lo, hi) => ({ target, params: [param], keys: [{ at: [0], value: lo }, { at: [1], value: hi }] });

// 키 목록을 부드럽게 잇는 트랙. pairs: [시간, 값]
const track = (param, pairs) => ({
  target: 'param:' + param,
  keys: pairs.map(([t, v], i) => (i < pairs.length - 1 ? { t, v, ease: 'smooth' } : { t, v })),
});
// 한 주기 동안 사인 곡선처럼 오가는 트랙. phase는 0~1
function wave(param, duration, amp, phase = 0, center = 0, cycles = 1) {
  const steps = 8 * cycles;
  const pairs = [];
  for (let i = 0; i <= steps; i++) {
    const k = i / steps;
    pairs.push([Math.round(k * duration * 1000) / 1000, Math.round((center + Math.sin((k * cycles + phase) * Math.PI * 2) * amp) * 1000) / 1000]);
  }
  return track(param, pairs);
}

function buildRig(g) {
  const hipDX = 30;
  const p = (id, min, max, description) => ({ id, min, max, default: 0, description });
  return {
    format: 'rev2d',
    version: 1,
    meta: { name: 'blob', width: CANVAS, height: CANVAS, background: 'transparent', fps: 30, description: '블록 미궁 캐릭터: 몸통, 팔 둘, 다리 둘을 관절로 연결한 리그' },
    parameters: [
      p('Hop', 0, 1, '뛰어오른 높이'),
      p('BodyY', -1, 1, '몸통 위아래(+가 아래)'),
      p('BodyRot', -1, 1, '몸통 기울기'),
      p('Squash', -1, 1, '+ 눌림, - 늘어남'),
      p('ArmL', -1, 1, '왼팔 회전'),
      p('ArmR', -1, 1, '오른팔 회전'),
      p('LegL', -1, 1, '왼다리 회전'),
      p('LegR', -1, 1, '오른다리 회전'),
      p('LiftL', 0, 1, '왼발 들기'),
      p('LiftR', 0, 1, '오른발 들기'),
    ],
    textures: [
      { id: 'body', path: 'body.png', width: g.bw, height: g.bh },
      { id: 'armL', path: 'armL.png', width: g.aw, height: ARM_H },
      { id: 'armR', path: 'armR.png', width: g.aw, height: ARM_H },
      { id: 'legL', path: 'legL.png', width: LEG[0], height: LEG[1] },
      { id: 'legR', path: 'legR.png', width: LEG[0], height: LEG[1] },
    ],
    bones: [
      { id: 'root', x: CX, y: GROUND, length: 0, description: '바닥. Hop이 통째로 들어 올린다.' },
      { id: 'legL', parent: 'root', x: -hipDX, y: HIP_Y - GROUND, length: 0 },
      { id: 'legR', parent: 'root', x: hipDX, y: HIP_Y - GROUND, length: 0 },
      { id: 'body', parent: 'root', x: 0, y: HIP_Y - GROUND, length: 0, description: '몸통. 엉덩이를 축으로 기울고 눌린다.' },
      { id: 'armL', parent: 'body', x: g.shoulderL - CX, y: g.shoulderY - HIP_Y, length: 0 },
      { id: 'armR', parent: 'body', x: g.shoulderR - CX, y: g.shoulderY - HIP_Y, length: 0 },
    ],
    warps: [],
    parts: [
      { id: 'legL', parent: 'legL', shape: { type: 'image', texture: 'legL', x: CX - hipDX - LEG[0] / 2, y: HIP_Y - 8, w: LEG[0], h: LEG[1] }, z: 1 },
      { id: 'legR', parent: 'legR', shape: { type: 'image', texture: 'legR', x: CX + hipDX - LEG[0] / 2, y: HIP_Y - 8, w: LEG[0], h: LEG[1] }, z: 1 },
      { id: 'armL', parent: 'armL', shape: { type: 'image', texture: 'armL', x: g.shoulderL - g.aw * 0.7, y: g.shoulderY - 10, w: g.aw, h: ARM_H }, z: 2 },
      { id: 'armR', parent: 'armR', shape: { type: 'image', texture: 'armR', x: g.shoulderR - g.aw * 0.3, y: g.shoulderY - 10, w: g.aw, h: ARM_H }, z: 2 },
      { id: 'body', parent: 'body', shape: { type: 'image', texture: 'body', x: g.bodyX, y: g.bodyY, w: g.bw, h: g.bh }, z: 3 },
    ],
    bindings: [
      num01('bone:root.y', 'Hop', GROUND, GROUND - 62),
      num('bone:body.y', 'BodyY', HIP_Y - GROUND - 12, HIP_Y - GROUND + 12),
      num('bone:body.rotation', 'BodyRot', -22, 22),
      num('bone:body.scaleY', 'Squash', 1.16, 0.8, 1),
      num('bone:body.scaleX', 'Squash', 0.9, 1.14, 1),
      num('bone:armL.rotation', 'ArmL', -170, 170),
      num('bone:armR.rotation', 'ArmR', -170, 170),
      num('bone:legL.rotation', 'LegL', -50, 50),
      num('bone:legR.rotation', 'LegR', -50, 50),
      num01('bone:legL.y', 'LiftL', HIP_Y - GROUND, HIP_Y - GROUND - 20),
      num01('bone:legR.y', 'LiftR', HIP_Y - GROUND, HIP_Y - GROUND - 20),
      num01('bone:legL.scaleY', 'LiftL', 1, 0.72),
      num01('bone:legR.scaleY', 'LiftR', 1, 0.72),
    ],
    animations: [
      {
        id: 'idle',
        duration: 1.6,
        loop: true,
        description: '숨쉬기: 몸이 천천히 오르내리고 팔이 살짝 벌어진다',
        tracks: [wave('Squash', 1.6, 0.16, 0, 0.1), wave('BodyY', 1.6, 0.12), wave('ArmL', 1.6, 0.035, 0.1, 0.07), wave('ArmR', 1.6, 0.035, 0.6, -0.07), wave('BodyRot', 1.6, 0.04, 0.25)],
      },
      {
        id: 'walkS',
        duration: 0.5,
        loop: true,
        description: '옆으로 걷기(오른쪽 기준): 다리를 앞뒤로, 팔을 반대로 흔들고 몸이 한 걸음마다 한 번 튄다',
        tracks: [
          wave('LegL', 0.5, 0.62, 0),
          wave('LegR', 0.5, 0.62, 0.5),
          wave('LiftL', 0.5, 0.35, 0.25, 0.35),
          wave('LiftR', 0.5, 0.35, 0.75, 0.35),
          wave('ArmL', 0.5, 0.2, 0.5),
          wave('ArmR', 0.5, 0.2, 0),
          wave('BodyY', 0.5, 0.35, 0.1, 0, 2),
          wave('Squash', 0.5, 0.18, 0.35, 0, 2),
          track('BodyRot', [[0, 0.3], [0.5, 0.3]]),
        ],
      },
      {
        id: 'walkF',
        duration: 0.5,
        loop: true,
        description: '앞뒤로 걷기: 발을 번갈아 들고 몸이 좌우로 뒤뚱거린다',
        tracks: [
          wave('LiftL', 0.5, 0.5, 0, 0.5),
          wave('LiftR', 0.5, 0.5, 0.5, 0.5),
          wave('BodyRot', 0.5, 0.2, 0.25),
          wave('BodyY', 0.5, 0.3, 0.1, 0, 2),
          wave('Squash', 0.5, 0.14, 0.35, 0, 2),
          wave('ArmL', 0.5, 0.06, 0, 0.1),
          wave('ArmR', 0.5, 0.06, 0.5, -0.1),
        ],
      },
      {
        id: 'pushS',
        duration: 0.5,
        loop: true,
        description: '옆으로 밀기: 몸을 숙이고 두 팔을 앞으로 뻗은 채 다리로 버틴다',
        tracks: [
          wave('BodyRot', 0.5, 0.08, 0, 0.72),
          wave('Squash', 0.5, 0.12, 0, 0.3, 2),
          wave('ArmR', 0.5, 0.03, 0, -0.5),
          wave('ArmL', 0.5, 0.03, 0.5, -0.36),
          wave('LegL', 0.5, 0.4, 0, -0.25),
          wave('LegR', 0.5, 0.4, 0.5, -0.25),
          wave('LiftL', 0.5, 0.2, 0.25, 0.2),
          wave('LiftR', 0.5, 0.2, 0.75, 0.2),
        ],
      },
      {
        id: 'pushF',
        duration: 0.5,
        loop: true,
        description: '앞뒤로 밀기: 몸을 웅크리고 두 팔을 옆으로 벌려 민다',
        tracks: [
          wave('Squash', 0.5, 0.18, 0, 0.5, 2),
          wave('BodyY', 0.5, 0.2, 0, 0.3, 2),
          wave('ArmL', 0.5, 0.05, 0, 0.26),
          wave('ArmR', 0.5, 0.05, 0.5, -0.26),
          wave('LiftL', 0.5, 0.3, 0, 0.3),
          wave('LiftR', 0.5, 0.3, 0.5, 0.3),
        ],
      },
      {
        id: 'win',
        duration: 1.0,
        loop: false,
        description: '클리어: 웅크렸다가 두 팔을 번쩍 들고 뛰어오른 뒤 착지한다',
        tracks: [
          track('Squash', [[0, 0], [0.18, 0.9], [0.34, -0.9], [0.55, -0.35], [0.74, 0.7], [0.88, -0.15], [1, 0]]),
          track('Hop', [[0, 0], [0.18, 0], [0.46, 1], [0.72, 0], [1, 0]]),
          track('ArmL', [[0, 0.07], [0.18, -0.1], [0.36, 0.9], [0.66, 0.86], [0.84, 0.2], [1, 0.07]]),
          track('ArmR', [[0, -0.07], [0.18, 0.1], [0.36, -0.9], [0.66, -0.86], [0.84, -0.2], [1, -0.07]]),
          track('LegL', [[0, 0], [0.3, 0], [0.46, 0.45], [0.72, 0], [1, 0]]),
          track('LegR', [[0, 0], [0.3, 0], [0.46, -0.45], [0.72, 0], [1, 0]]),
        ],
      },
    ],
  };
}

function rev2d(args) {
  return execFileSync(process.execPath, [REV2D, ...args], { cwd: WORK, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

mkdirSync(WORK, { recursive: true });
mkdirSync(OUT, { recursive: true });
const only = process.argv[2]?.split(',');
const skins = readdirSync(PARTS)
  .filter((f) => f.endsWith('_body.png'))
  .map((f) => f.slice(0, -9))
  .filter((id) => existsSync(`${PARTS}/${id}_arm.png`) && existsSync(`${PARTS}/${id}_leg.png`))
  .filter((id) => !only || only.includes(id));

let first = true;
const scale = String(FRAME / CANVAS);
for (const id of skins) {
  const geometry = await prepare(id);
  writeFileSync(resolve(WORK, 'blob.r2d.json'), JSON.stringify(buildRig(geometry), null, 1));
  if (first) {
    console.log(rev2d(['validate', 'blob.r2d.json']).trim().split('\n').slice(-3).join(' | '));
    first = false;
  }
  const frames = [];
  for (const [clip, count] of CLIPS) {
    const dir = resolve(WORK, 'frames', clip);
    rev2d(['frames', 'blob.r2d.json', '-o', dir, '--anim', clip, '--frames', String(count), '--scale', scale, '--bg', 'transparent', '--no-physics']);
    const manifest = JSON.parse(readFileSync(resolve(dir, 'manifest.json'), 'utf8'));
    for (const f of manifest.files) frames.push(resolve(dir, f));
  }
  const rows = Math.ceil(frames.length / COLS);
  const sheet = await sharp({ create: { width: COLS * FRAME, height: rows * FRAME, channels: 4, background: transparent } })
    .composite(frames.map((input, i) => ({ input, left: (i % COLS) * FRAME, top: Math.floor(i / COLS) * FRAME })))
    .webp({ quality: 88, alphaQuality: 90, effort: 5 })
    .toFile(`${OUT}/${id}.webp`);

  // 보관함과 뽑기 화면의 정지 그림도 같은 리그의 기본 자세로 맞춘다
  const still = resolve(WORK, 'still.png');
  rev2d(['render', 'blob.r2d.json', '-o', still, '--scale', '1.6', '--bg', 'transparent', '--no-physics']);
  await sharp(still)
    .trim({ threshold: 10 })
    .resize(230, 230, { fit: 'contain', background: transparent })
    .extend({ top: 13, bottom: 13, left: 13, right: 13, background: transparent })
    .png({ compressionLevel: 9, palette: true, quality: 90 })
    .toFile(`${SKIN_OUT}/skin_${id}.png`);
  console.log(`${id.padEnd(10)} ${frames.length}프레임 -> ${COLS * FRAME}x${rows * FRAME}  ${(sheet.size / 1024).toFixed(0)}KB`);
}
rmSync(resolve(WORK, 'frames'), { recursive: true, force: true });
