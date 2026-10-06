// Rev2D로 캐릭터를 관절 리깅해 동작 프레임을 뽑고 한 장의 시트로 묶는다.
// 사용: node tools/make-anim.mjs [스킨 id 쉼표 목록] [--hd]   (기본: art/parts에 부위 그림이 다 있는 모든 스킨)
// --hd: 게임용 시트 대신, 크게 보이는 화면(타이틀, 옷방)에서 쓰는 큰 시트(<id>_hd.webp, 한 칸 480px)만 만든다.
// 부위 그림(art/parts/<id>_body.png, tail.png, tailtip.png)은 tools/gen-parts.mjs로 만든다.
// 몸통은 시안의 앉은 자세를 그대로 옮긴 한 장이고(머리, 귀, 앞발, 뒷발 포함), 꼬리만 관절로 붙인다.
// 팔다리를 따로 붙이면 부품이 떨어져 보이므로, 몸의 움직임은 전부 격자 변형과 뛰기로 낸다.
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
const HIP_Y = 350; // 몸통이 눌리고 기우는 축(발바닥 바로 위)
const CX = 200;
const BODY_BOX = [236, 252]; // 몸통(머리, 귀, 모자 포함)이 들어가는 최대 크기
const TAIL_H = 118; // 꼬리 털의 길이
const TAIL_TILT = -34; // 꼬리가 바깥으로 기운 각도. 시안처럼 왼쪽 뒤에서 올라온다
const TIP_H = 66; // 꼬리 끝에 붙는 결정의 높이
const SKINS = JSON.parse(readFileSync(new URL('./skins.json', import.meta.url), 'utf8'));

// 동작과 프레임 수, 초당 프레임. src/render/draw.ts의 ANIMS와 순서·개수가 같아야 한다.
const CLIPS = [
  ['idle', 48],
  ['walkS', 12],
  ['walkD', 12],
  ['pushS', 14],
  ['pushD', 14],
  ['win', 30],
  ['bump', 12],
  ['sleep', 40],
  ['walkU', 12],
  ['pushU', 14],
  ['idleB', 48],
  ['bumpB', 12],
];
// 동작 자세 그림(<id>_run|push|jump.png)과 그것이 들어갈 최대 크기. 세 장이 다 있는 스킨만 자세를 바꾼다.
const POSES = { run: [310, 206], push: [280, 250], jump: [250, 266] };
// 위아래를 보는 그림: 위로 뛰는 뒷모습, 아래로 뛰는 앞모습, 위를 보고 앉은 뒷모습. 있는 것만 쓰고, 없으면 앞모습 동작으로 대신한다.
const DIR_POSES = { up: [250, 240], down: [250, 240], back: [290, 252] };
const FACES = ['closed', 'happy', 'strain', 'startle']; // 얼굴 덧그림의 종류
const COLS = 10;

const transparent = { r: 0, g: 0, b: 0, alpha: 0 };
// 큰 시트. 타이틀과 옷방에서는 캐릭터가 화면 폭만큼 크게 나와 240px 칸으로는 흐려 보인다("해상도가 떨어져 보인다"는 피드백).
// 리그의 치수는 그대로 두고 부위 그림만 TEX배로 넣어 480px 칸으로 뽑는다. 구성은 src/render/draw.ts의 HD_ANIMS와 같아야 한다.
const HD = process.argv.includes('--hd');
const TEX = HD ? 2 : 1;
const HD_FRAME = 480;
const HD_CLIPS = [
  ['idle', 48],
  ['win', 30],
  ['sleep', 40],
];

// 여백을 잘라 낸 그림과 그 크기
async function trimmed(file) {
  const { data, info } = await sharp(file).ensureAlpha().trim({ threshold: 20 }).png().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
}

// 몸통에서 팔이 붙을 자리: 어깨 높이 언저리에서 가장 바깥의 불투명 픽셀
async function sideEdges(buf, w, h) {
  const raw = await sharp(buf).ensureAlpha().raw().toBuffer();
  const opaque = (x, y) => raw[(y * w + x) * 4 + 3] > 128;
  const lefts = [];
  const rights = [];
  const mid = Math.floor(w / 2);
  for (let y = Math.floor(h * (ARM_AT - 0.04)); y < Math.floor(h * (ARM_AT + 0.1)); y++) {
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

// 몸통 그림에서 두 눈을 찾는다: 얼굴 높이의 가운데 띠에서 좌우로 마주 보는 가장 큰 어두운 덩어리 둘.
async function findEyes(buf, w, h) {
  const raw = await sharp(buf).ensureAlpha().raw().toBuffer();
  const dark = (x, y) => {
    const i = (y * w + x) * 4;
    return raw[i + 3] > 200 && Math.max(raw[i], raw[i + 1], raw[i + 2]) < 105;
  };
  const x0 = Math.floor(w * 0.24);
  const x1 = Math.ceil(w * 0.76);
  const y0 = Math.floor(h * 0.4);
  const y1 = Math.ceil(h * 0.7);
  const seen = new Uint8Array(w * h);
  const blobs = [];
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      if (seen[y * w + x] || !dark(x, y)) continue;
      const b = { n: 0, minX: x, maxX: x, minY: y, maxY: y };
      const stack = [[x, y]];
      seen[y * w + x] = 1;
      while (stack.length) {
        const [cx, cy] = stack.pop();
        b.n++;
        b.minX = Math.min(b.minX, cx);
        b.maxX = Math.max(b.maxX, cx);
        b.minY = Math.min(b.minY, cy);
        b.maxY = Math.max(b.maxY, cy);
        for (const [nx, ny] of [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]]) {
          if (nx < x0 || nx >= x1 || ny < y0 || ny >= y1 || seen[ny * w + nx] || !dark(nx, ny)) continue;
          seen[ny * w + nx] = 1;
          stack.push([nx, ny]);
        }
      }
      if (b.n >= 10) blobs.push({ ...b, cx: (b.minX + b.maxX) / 2, cy: (b.minY + b.maxY) / 2 });
    }
  }
  blobs.sort((a, b) => b.n - a.n);
  const top = blobs.slice(0, 6);
  let best = null;
  for (const a of top) {
    for (const b of top) {
      if (a.cx >= w / 2 || b.cx <= w / 2) continue;
      if (Math.abs(a.cy - b.cy) > h * 0.04 || Math.abs((a.cx + b.cx) / 2 - w / 2) > w * 0.07) continue;
      if (!best || a.n + b.n > best[0].n + best[1].n) best = [a, b];
    }
  }
  if (!best) return null;
  return best.map((b) => {
    const r = Math.max(b.maxX - b.minX, b.maxY - b.minY) / 2 + 0.5;
    // 눈 바로 위의 털 색으로 원래 눈을 덮는다
    const i = (Math.max(0, Math.round(b.cy - r * 2.1)) * w + Math.round(b.cx)) * 4;
    return { cx: b.cx, cy: b.cy, r, fur: `rgb(${raw[i]},${raw[i + 1]},${raw[i + 2]})` };
  });
}

// 표정 하나의 덧그림: 원래 눈을 털 색으로 덮고 새 눈을 그린다. 몸통 그림과 같은 크기의 투명 그림이다.
function faceSvg(w, h, eyes, kind) {
  const ink = '#3a2418';
  const out = [];
  eyes.forEach((e, i) => {
    const { cx, cy, r } = e;
    const sw = Math.max(2, r * 0.62);
    const line = `fill="none" stroke="${ink}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"`;
    out.push(`<ellipse cx="${cx}" cy="${cy}" rx="${r * 1.55}" ry="${r * 1.55}" fill="${e.fur}"/>`);
    if (kind === 'closed') out.push(`<path d="M${cx - r * 1.15} ${cy - r * 0.15} Q${cx} ${cy + r * 1.0} ${cx + r * 1.15} ${cy - r * 0.15}" ${line}/>`);
    if (kind === 'happy') out.push(`<path d="M${cx - r * 1.2} ${cy + r * 0.5} Q${cx} ${cy - r * 1.3} ${cx + r * 1.2} ${cy + r * 0.5}" ${line}/>`);
    if (kind === 'strain') {
      const d = i === 0 ? 1 : -1; // 왼쪽 눈은 >, 오른쪽 눈은 <
      out.push(`<path d="M${cx - d * r} ${cy - r * 0.95} L${cx + d * r * 0.8} ${cy} L${cx - d * r} ${cy + r * 0.95}" ${line}/>`);
    }
    if (kind === 'startle') {
      out.push(`<circle cx="${cx}" cy="${cy}" r="${r * 1.4}" fill="#fff" stroke="${ink}" stroke-width="${sw * 0.7}"/>`);
      out.push(`<circle cx="${cx}" cy="${cy}" r="${r * 0.6}" fill="${ink}"/>`);
    }
  });
  if (kind === 'strain') {
    // 힘쓸 때의 땀방울
    const e = eyes[1];
    const x = e.cx + e.r * 3.4;
    const y = e.cy - e.r * 2.4;
    const k = e.r * 1.1;
    out.push(`<path d="M${x} ${y - k * 1.3} Q${x + k} ${y + k * 0.3} ${x} ${y + k * 0.8} Q${x - k} ${y + k * 0.3} ${x} ${y - k * 1.3} Z" fill="#a9dcff" stroke="#5a9fd0" stroke-width="${Math.max(1.5, e.r * 0.3)}"/>`);
  }
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${out.join('')}</svg>`);
}

// 스킨은 팔다리와 꼬리 그림이 따로 없다. 주인공의 것을 쓰고, 털 색이 바뀌는 스킨(skins.json의 fur)만 그 색으로 물들인다.
async function limb(id, file) {
  const base = await trimmed(`${PARTS}/${file}.png`);
  const fur = SKINS[id]?.fur;
  return fur ? { ...base, data: await sharp(base.data).tint(fur).png().toBuffer() } : base;
}

async function prepare(id) {
  const body = await trimmed(`${PARTS}/${id}_body.png`);
  const scale = Math.min(BODY_BOX[0] / body.w, BODY_BOX[1] / body.h);
  const bw = Math.round(body.w * scale);
  const bh = Math.round(body.h * scale);
  const bodyBuf = await sharp(body.data).resize(bw, bh).png().toBuffer(); // 눈을 찾는 데 쓰는 1배 그림
  writeFileSync(resolve(WORK, 'body.png'), TEX === 1 ? bodyBuf : await sharp(body.data).resize(bw * TEX, bh * TEX).png().toBuffer());
  const eyes = await findEyes(bodyBuf, bw, bh);
  if (!eyes) console.warn(`${id}: 눈을 찾지 못해 표정 없이 만든다`);
  for (const kind of FACES) {
    const svg = eyes ? faceSvg(bw, bh, eyes, kind) : Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${bw}" height="${bh}"/>`);
    writeFileSync(resolve(WORK, `face_${kind}.png`), await sharp(svg, { density: 72 * TEX }).png().toBuffer());
  }

  const bodyX = CX - bw / 2;
  const bodyY = GROUND - bh; // 앉은 발이 바닥에 닿는다

  // 꼬리: 털 위에 결정을 얹어 한 장으로 만들고, 바깥으로 기울여 둔다. 결정은 어떤 스킨을 입어도 그대로 남는다.
  const fur = await limb(id, 'tail');
  const tailH = TAIL_H * TEX;
  const tipH = TIP_H * TEX;
  const fw = Math.round((fur.w * tailH) / fur.h);
  const tip = await trimmed(`${PARTS}/tailtip.png`);
  const tw = Math.round((tip.w * tipH) / tip.h);
  const over = Math.round(tipH * 0.5); // 결정이 털 끝 위로 솟는 높이
  const uw = Math.max(fw, tw);
  const uh = tailH + over;
  const upright = await sharp({ create: { width: uw, height: uh, channels: 4, background: transparent } })
    .composite([
      { input: await sharp(fur.data).resize(fw, tailH, { fit: 'fill' }).png().toBuffer(), left: Math.round((uw - fw) / 2), top: over },
      { input: await sharp(tip.data).resize(tw, tipH, { fit: 'fill' }).png().toBuffer(), left: Math.round((uw - tw) / 2), top: 0 },
    ])
    .png()
    .toBuffer();
  const tilted = await sharp(upright).rotate(TAIL_TILT, { background: transparent }).png().toBuffer({ resolveWithObject: true });
  writeFileSync(resolve(WORK, 'tail.png'), tilted.data);
  // 기울인 그림 안에서 꼬리가 몸에 붙는 점(원래 그림의 아래쪽 가운데)
  const rad = (TAIL_TILT * Math.PI) / 180;
  const tail = {
    w: Math.round(tilted.info.width / TEX),
    h: Math.round(tilted.info.height / TEX),
    baseX: (tilted.info.width / 2 - (uh / 2) * Math.sin(rad)) / TEX,
    baseY: (tilted.info.height / 2 + (uh / 2) * Math.cos(rad)) / TEX,
  };
  // 동작 자세: 움직이거나 밀 때 앉은 그림 대신 보여 줄 그림
  let poses = null;
  if (Object.keys(POSES).every((k) => existsSync(`${PARTS}/${id}_${k}.png`))) {
    poses = {};
    for (const [k, box] of Object.entries({ ...POSES, ...DIR_POSES })) {
      // 앉은 뒷모습이 없으면 위로 뛰는 뒷모습으로 대신한다(pot은 생성 도구가 앉은 뒷모습을 거듭 거부했다)
      const file = [k, ...(k === 'back' ? ['up'] : [])].map((n) => `${PARTS}/${id}_${n}.png`).find((p) => existsSync(p));
      if (!file) continue;
      const img = await trimmed(file);
      const sc = Math.min(box[0] / img.w, box[1] / img.h);
      const w = Math.round(img.w * sc);
      const h = Math.round(img.h * sc);
      writeFileSync(resolve(WORK, `pose_${k}.png`), await sharp(img.data).resize(w * TEX, h * TEX).png().toBuffer());
      poses[k] = { w, h };
    }
  }
  return { bw, bh, tail, bodyX, bodyY, poses };
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

// 격자 전체를 줄과 칸에 따라 미는 바인딩. fn(row, col)은 매개변수가 +1일 때의 [dx, dy]이고 -1일 때는 반대다.
function soft(param, g, fn) {
  const at = (k) => {
    const out = [];
    for (let row = 0; row <= 4; row++) for (let col = 0; col <= 4; col++) out.push(...fn(row, col).map((v) => Math.round(v * k * 100) / 100));
    return out;
  };
  return { target: 'warp:earWarp.offsets', params: [param], keys: [{ at: [-1], value: at(-1) }, { at: [0], value: at(0) }, { at: [1], value: at(1) }] };
}

function buildRig(g) {
  // 꼬리가 몸에 붙는 자리: 엉덩이 왼쪽 뒤
  const tailX = CX - g.bw * 0.2;
  const tailY = GROUND - 26;
  const p = (id, min, max, description) => ({ id, min, max, default: 0, description });
  return {
    format: 'rev2d',
    version: 1,
    meta: { name: 'blob', width: CANVAS, height: CANVAS, background: 'transparent', fps: 30, description: '블록 미궁 캐릭터: 앉은 몸통 한 장을 격자로 움직이고 꼬리를 관절로 붙인 리그' },
    parameters: [
      p('Hop', 0, 1, '뛰어오른 높이'),
      p('BodyY', -1, 1, '몸통 위아래(+가 아래)'),
      p('BodyRot', -1, 1, '몸통 기울기'),
      p('Squash', -1, 1, '+ 눌림, - 늘어남'),
      p('Float', -1, 1, '꼬리 흔들기'),
      p('Ear', -1, 1, '귀: - 처짐, + 쫑긋'),
      p('Puff', -1, 1, '숨: + 머리와 가슴이 솟음, - 가라앉음'),
      p('Sway', -1, 1, '휘어 기울기: 발은 그대로 두고 위로 갈수록 옆으로 밀린다'),
      p('Jelly', -1, 1, '출렁임: 머리와 몸 가운데가 서로 반대로 밀린다'),
      p('Blink', 0, 1, '눈 감기(깜빡임, 졸음)'),
      p('Happy', 0, 1, '웃는 눈'),
      p('Strain', 0, 1, '힘쓰는 눈과 땀방울'),
      p('Startle', 0, 1, '놀란 눈'),
      p('Hide', 0, 1, '앉은 그림과 꼬리를 숨긴다(동작 자세를 보여 줄 때)'),
      p('PoseRun', 0, 1, '달려 나가는 자세'),
      p('PosePush', 0, 1, '앞발로 미는 자세'),
      p('PoseJump', 0, 1, '뛰어오른 자세'),
      p('PoseUp', 0, 1, '위로 뛰어가는 뒷모습'),
      p('PoseDown', 0, 1, '아래로 뛰어오는 앞모습'),
      p('PoseBack', 0, 1, '위를 보고 앉은 뒷모습'),
      p('Lunge', -1, 1, '몸을 앞뒤로 내밀기'),
    ],
    textures: [
      { id: 'body', path: 'body.png', width: g.bw, height: g.bh },
      { id: 'tail', path: 'tail.png', width: g.tail.w, height: g.tail.h },
      ...FACES.map((k) => ({ id: 'face_' + k, path: `face_${k}.png`, width: g.bw, height: g.bh })),
      ...Object.entries(g.poses ?? {}).map(([k, v]) => ({ id: 'pose_' + k, path: `pose_${k}.png`, width: v.w, height: v.h })),
    ],
    bones: [
      { id: 'root', x: CX, y: GROUND, length: 0, description: '바닥. Hop이 통째로 들어 올린다.' },
      { id: 'body', parent: 'root', x: 0, y: HIP_Y - GROUND, length: 0, description: '몸통. 엉덩이를 축으로 기울고 눌린다.' },
      { id: 'tail', parent: 'root', x: tailX - CX, y: tailY - GROUND, length: 0, description: '꼬리. 엉덩이를 축으로 흔들린다.' },
    ],
    // 몸통 그림을 덮는 격자. 위쪽 모서리의 점들을 움직여 귀를 처지게 하거나 세운다. 몸통 뼈대를 따라간다.
    warps: [{ id: 'earWarp', parent: 'body', rect: [g.bodyX, g.bodyY, g.bw, g.bh], cols: 4, rows: 4 }],
    parts: [
      { id: 'body', parent: 'earWarp', shape: { type: 'image', texture: 'body', x: g.bodyX, y: g.bodyY, w: g.bw, h: g.bh, cols: 10, rows: 10 }, z: 3 },
      // 표정: 평소에는 투명하고, 매개변수가 올라가면 원래 눈 위에 겹쳐 보인다
      ...FACES.map((k) => ({ id: 'face_' + k, parent: 'earWarp', opacity: 0, shape: { type: 'image', texture: 'face_' + k, x: g.bodyX, y: g.bodyY, w: g.bw, h: g.bh, cols: 4, rows: 4 }, z: 4 })),
      // 동작 자세: 평소에는 투명하다. 발이 바닥에 닿게 놓고 몸통 뼈대를 따라 눌리고 기운다
      ...Object.entries(g.poses ?? {}).map(([k, v]) => ({ id: 'pose_' + k, parent: 'body', opacity: 0, shape: { type: 'image', texture: 'pose_' + k, x: CX - v.w / 2, y: GROUND - v.h, w: v.w, h: v.h }, z: 5 })),
      { id: 'tail', parent: 'tail', shape: { type: 'image', texture: 'tail', x: tailX - g.tail.baseX, y: tailY - g.tail.baseY, w: g.tail.w, h: g.tail.h }, z: 0 },
    ],
    bindings: [
      num01('bone:root.y', 'Hop', GROUND, GROUND - 40),
      num('bone:body.y', 'BodyY', HIP_Y - GROUND - 12, HIP_Y - GROUND + 12),
      num('bone:body.rotation', 'BodyRot', -22, 22),
      num('bone:body.scaleY', 'Squash', 1.16, 0.8, 1),
      num('bone:body.scaleX', 'Squash', 0.9, 1.14, 1),
      num('bone:tail.rotation', 'Float', -13, 13),
      // 귀: 격자의 위쪽 모서리 점(0, 1, 5는 왼쪽 귀, 4, 3, 9는 오른쪽 귀)을 옮긴다
      {
        target: 'warp:earWarp.offsets',
        params: ['Ear'],
        keys: [
          { at: [-1], value: { 0: [-g.bw * 0.1, g.bh * 0.2], 1: [-g.bw * 0.05, g.bh * 0.09], 5: [-g.bw * 0.05, g.bh * 0.05], 4: [g.bw * 0.1, g.bh * 0.2], 3: [g.bw * 0.05, g.bh * 0.09], 9: [g.bw * 0.05, g.bh * 0.05] } },
          { at: [0], value: { 0: [0, 0] } },
          { at: [1], value: { 0: [g.bw * 0.035, -g.bh * 0.055], 1: [g.bw * 0.015, -g.bh * 0.03], 4: [-g.bw * 0.035, -g.bh * 0.055], 3: [-g.bw * 0.015, -g.bh * 0.03] } },
        ],
      },
      // 몸: 그림 전체의 비율을 바꾸는 대신 격자의 줄마다 다르게 밀어 말랑하게 움직인다
      // 숨: 머리는 모양 그대로 통째로 오르내리고 가슴이 그 절반쯤 따라간다. 옆으로는 부풀리지 않는다
      // (볼과 배를 옆으로 부풀렸더니 화면 쪽으로 튀어나오는 것처럼 보여 더 이상하다는 피드백이 있었다).
      soft('Puff', g, (row) => [0, -[0.024, 0.024, 0.024, 0.011, 0][row] * g.bh]),
      soft('Sway', g, (row) => [[0.075, 0.058, 0.036, 0.013, 0][row] * g.bw, 0]),
      soft('Jelly', g, (row) => [[0.032, 0.012, -0.03, -0.013, 0][row] * g.bw, [0, 0, 0.012, 0.006, 0][row] * g.bh]),
      num01('part:face_closed.opacity', 'Blink', 0, 1),
      num01('part:face_happy.opacity', 'Happy', 0, 1),
      num01('part:face_strain.opacity', 'Strain', 0, 1),
      num01('part:face_startle.opacity', 'Startle', 0, 1),
      num01('part:body.opacity', 'Hide', 1, 0),
      num01('part:tail.opacity', 'Hide', 1, 0),
      ...Object.keys(g.poses ?? {}).map((k) => num01(`part:pose_${k}.opacity`, 'Pose' + k[0].toUpperCase() + k.slice(1), 0, 1)),
      num('bone:body.x', 'Lunge', -16, 16),
    ],
    animations: clips(!!g.poses, g.poses ?? {}),
  };
}

const hold = (param, duration, v) => track(param, [[0, v], [duration, v]]);

// 동작. 걷는 다리가 없으므로 이동은 폴짝 뛰는 것으로 낸다(한 칸에 한 번).
// 겹쳐 쓰는 것: 숨(Puff), 휘어 기울기(Sway), 출렁임(Jelly), 눌림(Squash), 뛰기(Hop), 귀(Ear), 꼬리(Float), 표정.
function clips(posed, has) {
  // 동작 자세를 보여 주는 동안: 앉은 그림을 숨기고 그 자세를 켠다
  const pose = (name, d) => [hold('Hide', d, 1), hold(name, d, 1)];
  // 뛰기 한 번: 바닥에서 눌렸다가 늘어나며 뜨고, 귀는 반 박자 늦게 따라온다
  const hop = (d, lean) => [
    track('Hop', [[0, 0], [d * 0.5, 0.5], [d, 0]]),
    track('Squash', [[0, 0.45], [d * 0.22, -0.35], [d * 0.75, -0.15], [d, 0.45]]),
    track('Ear', [[0, 0.2], [d * 0.3, -0.7], [d * 0.7, 0.5], [d, 0.2]]),
    track('Jelly', [[0, 0], [d * 0.3, -0.4], [d * 0.8, 0.4], [d, 0]]),
    hold('Sway', d, lean),
  ];
  // 위아래로 한 칸: 두 발로 낮게 뛰며 몸이 좌우로 흔들린다
  const scamper = [track('Hop', [[0, 0], [0.15, 0.3], [0.3, 0], [0.5, 0]]), track('BodyRot', [[0, -0.2], [0.15, 0.2], [0.3, -0.2], [0.5, -0.2]]), track('Squash', [[0, 0.2], [0.1, -0.2], [0.3, 0.2], [0.5, 0.2]])];
  const jumpWalk = posed ? [...pose('PoseJump', 0.5), track('Hop', [[0, 0], [0.25, 0.6], [0.5, 0]]), track('Squash', [[0, 0.4], [0.14, -0.4], [0.4, -0.1], [0.5, 0.4]])] : hop(0.5, 0);
  const crouchPush = [hold('Strain', 0.5, 1), wave('Ear', 0.5, 0.08, 0, -0.6, 2), wave('Squash', 0.5, 0.08, 0, 0.3, 2), wave('Puff', 0.5, 0.3, 0, -0.6, 2), wave('Jelly', 0.5, 0.3, 0.25, 0, 2)];
  const idleTracks = [
    wave('Puff', 1.6, 0.7, 0),
    wave('Sway', 1.6, 0.2, 0.3),
    wave('Jelly', 1.6, 0.05, 0.55),
    track('Blink', [[0, 0], [0.7, 0], [0.76, 1], [0.86, 1], [0.92, 0], [1.6, 0]]),
    track('Ear', [[0, 0], [1.05, 0], [1.15, 0.6], [1.28, -0.15], [1.4, 0], [1.6, 0]]),
  ];
  const bumpTracks = [
    hold('Startle', 0.4, 1),
    track('Ear', [[0, 0], [0.08, 1], [0.25, -0.6], [0.4, -0.9]]),
    track('Squash', [[0, 0], [0.08, 0.3], [0.2, -0.1], [0.4, 0]]),
    track('Puff', [[0, 0], [0.07, -0.9], [0.18, 0.6], [0.3, -0.2], [0.4, 0]]),
    track('Jelly', [[0, 0], [0.06, -1], [0.16, 0.8], [0.28, -0.4], [0.4, 0]]),
    track('Sway', [[0, 0], [0.1, -0.5], [0.4, 0]]),
  ];
  return [
    {
      id: 'idle',
      duration: 1.6,
      loop: true,
      description: '숨쉬기: 머리와 가슴이 살짝 오르내리고, 머리가 천천히 좌우로 흔들리고, 가끔 눈을 깜빡이고 귀를 쫑긋한다',
      tracks: [...idleTracks],
    },
    {
      id: 'walkS',
      duration: 0.5,
      loop: true,
      description: '옆으로 한 칸: 달려 나가는 자세로 낮게 뛴다. 뜰 때 머리를 들고 내려올 때 숙인다',
      tracks: posed
        ? [...pose('PoseRun', 0.5), track('Hop', [[0, 0], [0.25, 0.5], [0.5, 0]]), track('BodyRot', [[0, -0.3], [0.25, 0], [0.5, 0.32]]), track('Squash', [[0, 0.35], [0.14, -0.35], [0.4, -0.1], [0.5, 0.35]])]
        : hop(0.5, 0.45),
    },
    {
      id: 'walkD',
      duration: 0.5,
      loop: true,
      description: '아래로 한 칸: 이쪽을 보고 두 발로 뛰어온다(그림이 없으면 앞발을 들고 뛰어오른 자세)',
      tracks: has.down ? [...pose('PoseDown', 0.5), ...scamper] : [...jumpWalk],
    },
    {
      id: 'pushS',
      duration: 0.5,
      loop: true,
      description: '옆으로 밀기: 몸을 깊이 기울이고 힘줄 때마다 출렁인다',
      tracks: posed
        ? [...pose('PosePush', 0.5), wave('Lunge', 0.5, 0.55, 0, 0.3, 2), wave('Squash', 0.5, 0.12, 0.25, 0.08, 2), wave('BodyRot', 0.5, 0.06, 0, 0.1, 2)]
        : [hold('Sway', 0.5, 0.95), hold('BodyRot', 0.5, 0.3), hold('Strain', 0.5, 1), wave('Ear', 0.5, 0.08, 0, -0.6, 2), wave('Jelly', 0.5, 0.4, 0.25, 0.2, 2), wave('Squash', 0.5, 0.08, 0, 0.15, 2), wave('Puff', 0.5, 0.3, 0, -0.5, 2)],
    },
    {
      id: 'pushD',
      duration: 0.5,
      loop: true,
      description: '아래로 밀기: 몸을 웅크리고 힘줄 때마다 출렁인다',
      tracks: [...crouchPush],
    },
    {
      id: 'win',
      duration: 1.0,
      loop: false,
      description: '클리어: 웅크렸다가 뛰어오르고, 착지하면 출렁이며 가라앉는다',
      tracks: [
        track('Squash', [[0, 0], [0.18, 0.55], [0.34, -0.5], [0.55, -0.15], [0.74, 0.5], [0.88, -0.1], [1, 0]]),
        track('Hop', [[0, 0], [0.18, 0], [0.46, 1], [0.72, 0], [1, 0]]),
        track('Puff', [[0, 0], [0.18, -1], [0.36, 1], [0.6, 0.5], [0.76, -0.9], [0.88, 0.5], [0.95, -0.15], [1, 0]]),
        track('Jelly', [[0, 0], [0.72, 0], [0.79, 1], [0.87, -0.7], [0.94, 0.3], [1, 0]]),
        track('Happy', [[0, 0], [0.15, 0], [0.2, 1], [1, 1]]),
        // 공중에 떠 있는 동안에는 뛰어오른 자세를 보여 준다
        ...(posed ? [track('Hide', [[0, 0], [0.19, 0], [0.21, 1], [0.7, 1], [0.73, 0], [1, 0]]), track('PoseJump', [[0, 0], [0.19, 0], [0.21, 1], [0.7, 1], [0.73, 0], [1, 0]])] : []),
        track('Ear', [[0, 0], [0.18, -0.5], [0.36, 1], [0.6, 0.8], [0.76, -0.6], [0.9, 0.2], [1, 0]]),
      ],
    },
    {
      id: 'bump',
      duration: 0.4,
      loop: false,
      description: '막혔을 때: 깜짝 놀라 귀가 섰다가 축 처진다',
      tracks: [...bumpTracks],
    },
    {
      id: 'sleep',
      duration: 2,
      loop: true,
      description: '오래 가만히 두면: 눈을 감고 귀를 늘어뜨린 채 천천히 숨쉰다',
      tracks: [hold('Blink', 2, 1), hold('Ear', 2, -0.8), wave('Puff', 2, 0.75, 0, -0.2), hold('Sway', 2, 0.35), wave('Jelly', 2, 0.1, 0.5)],
    },
    // 위를 보는 동작들. 뒷모습 그림이 없는 스킨은 앞모습 동작을 그대로 쓴다
    {
      id: 'walkU',
      duration: 0.5,
      loop: true,
      description: '위로 한 칸: 등을 보이고 두 발로 뛰어간다',
      tracks: has.up ? [...pose('PoseUp', 0.5), ...scamper] : [...jumpWalk],
    },
    {
      id: 'pushU',
      duration: 0.5,
      loop: true,
      description: '위로 밀기: 등을 보인 채 웅크려 민다',
      tracks: has.back ? [...pose('PoseBack', 0.5), wave('Squash', 0.5, 0.08, 0, 0.3, 2), wave('BodyRot', 0.5, 0.05, 0.25, 0, 2)] : [...crouchPush],
    },
    {
      id: 'idleB',
      duration: 1.6,
      loop: true,
      description: '위를 본 채 숨쉬기: 위로 간 뒤에는 돌아서지 않고 등을 보이고 앉아 있는다',
      tracks: has.back ? [...pose('PoseBack', 1.6), wave('Squash', 1.6, 0.07), wave('BodyRot', 1.6, 0.05, 0.3)] : [...idleTracks],
    },
    {
      id: 'bumpB',
      duration: 0.4,
      loop: false,
      description: '위쪽이 막혔을 때: 등을 보인 채 움찔한다',
      tracks: has.back ? [...pose('PoseBack', 0.4), track('Squash', [[0, 0], [0.08, 0.4], [0.2, -0.15], [0.4, 0]]), track('BodyRot', [[0, 0], [0.06, -0.25], [0.16, 0.2], [0.28, -0.1], [0.4, 0]])] : [...bumpTracks],
    },
  ];
}

function rev2d(args) {
  return execFileSync(process.execPath, [REV2D, ...args], { cwd: WORK, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

mkdirSync(WORK, { recursive: true });
mkdirSync(OUT, { recursive: true });
const only = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2].split(',') : undefined;
const skins = readdirSync(PARTS)
  .filter((f) => f.endsWith('_body.png'))
  .map((f) => f.slice(0, -9))
  .filter((id) => !only || only.includes(id));

let first = true;
const scale = String(FRAME / CANVAS);
for (const id of skins) {
  const geometry = await prepare(id);
  const rig = buildRig(geometry);
  // 꼬리는 모든 동작에서 몸과 어긋난 박자로 흔들린다. 걷거나 밀 때는 더 빨리 흔든다.
  for (const a of rig.animations) a.tracks.push(wave('Float', a.duration, a.id === 'sleep' ? 0.25 : 0.85, 0.15, 0, a.id === 'idle' || a.id === 'idleB' || a.id === 'sleep' ? 1 : 2));
  writeFileSync(resolve(WORK, 'blob.r2d.json'), JSON.stringify(rig, null, 1));
  if (first) {
    console.log(rev2d(['validate', 'blob.r2d.json']).trim().split('\n').slice(-3).join(' | '));
    first = false;
  }
  if (HD) {
    const hd = [];
    for (const [clip, count] of HD_CLIPS) {
      const dir = resolve(WORK, 'frames', clip);
      rev2d(['frames', 'blob.r2d.json', '-o', dir, '--anim', clip, '--frames', String(count), '--scale', String(HD_FRAME / CANVAS), '--bg', 'transparent', '--no-physics']);
      for (const file of JSON.parse(readFileSync(resolve(dir, 'manifest.json'), 'utf8')).files) hd.push(resolve(dir, file));
    }
    const hdRows = Math.ceil(hd.length / COLS);
    const out = await sharp({ create: { width: COLS * HD_FRAME, height: hdRows * HD_FRAME, channels: 4, background: transparent } })
      .composite(hd.map((input, i) => ({ input, left: (i % COLS) * HD_FRAME, top: Math.floor(i / COLS) * HD_FRAME })))
      .webp({ quality: 80, alphaQuality: 88, effort: 5 })
      .toFile(`${OUT}/${id}_hd.webp`);
    console.log(`${id.padEnd(10)} 큰 시트 ${hd.length}프레임 -> ${COLS * HD_FRAME}x${hdRows * HD_FRAME}  ${(out.size / 1024).toFixed(0)}KB`);
    continue;
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
  const stillPng = await sharp(still)
    .trim({ threshold: 10 })
    .resize(230, 230, { fit: 'contain', background: transparent })
    .extend({ top: 13, bottom: 13, left: 13, right: 13, background: transparent })
    .png({ compressionLevel: 9, palette: true, quality: 90 })
    .toBuffer();
  // 이 PC는 파일을 쓰는 순간 잠금 오류가 가끔 나므로 다시 시도한다
  for (let i = 0; ; i++) {
    try {
      writeFileSync(`${SKIN_OUT}/skin_${id}.png`, stillPng);
      break;
    } catch (e) {
      if (i >= 8) throw e;
      await new Promise((r) => setTimeout(r, 400));
    }
  }
  console.log(`${id.padEnd(10)} ${frames.length}프레임 -> ${COLS * FRAME}x${rows * FRAME}  ${(sheet.size / 1024).toFixed(0)}KB`);
}
rmSync(resolve(WORK, 'frames'), { recursive: true, force: true });
