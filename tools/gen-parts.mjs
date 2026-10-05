// 주인공(빛꼬리 여우)과 치장 스킨을 관절 애니메이션용 부위 그림으로 Codex CLI에서 생성한다.
// 사용: node tools/gen-parts.mjs [로그 폴더] [동시 실행 수] [작업 이름 쉼표 목록]
// 작업 이름: default_body, tail, tailtip, <id>_body, <id>_run, <id>_push, <id>_jump (id는 default 또는 스킨 id)
// - 주인공의 몸통은 시안의 정면 그림(art/concepts/fox-front.png)을 그대로 옮긴 앉은 자세 한 장이고, 꼬리만 따로다.
// - 스킨은 몸통만 그린다. 주인공의 몸통을 참조로 넘겨 "같은 여우가 그 옷을 입은" 그림이 되게 한다.
//   꼬리는 주인공의 것을 쓰고(털 색이 바뀌는 스킨만 물들임), 꼬리 끝의 결정은 모든 스킨에 남는다.
// - 동작 자세(run, push, jump)는 스킨마다 한 장씩 따로 그린다.
// 이미 있는 파일은 건너뛴다. 스킨의 모습은 tools/skins.json에 있다.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const OUT = 'art/parts';
const CONCEPT = 'art/concepts/r2_fox.png';
const FRONT = 'art/concepts/fox-front.png'; // 시안에서 큰 정면 그림만 잘라 낸 것
const HERO = `${OUT}/default_body.png`;
const logDir = process.argv[2] ?? 'gen-logs';
const parallel = Number(process.argv[3] ?? 2);
const only = process.argv[4] ? new Set(process.argv[4].split(',')) : null;
const SKINS = JSON.parse(readFileSync(new URL('./skins.json', import.meta.url), 'utf8'));
mkdirSync(logDir, { recursive: true });
mkdirSync(OUT, { recursive: true });

const COMMON =
  'Art style: soft matte 2D illustration exactly like the attached picture: clean rounded shapes, a soft thick warm-brown outline, flat pastel colours with very gentle shading. NOT glossy, NOT 3D, no specular highlights. ' +
  'Transparent background. No text, no logo, no watermark, no shadow on the ground, no floor, nothing cut off. Square 1:1.';
const FOX =
  'a chubby baby fennec fox with a big round head, two oversized soft triangular ears with pale pink insides, cream-and-honey fur, two small black dot eyes, a tiny dark nose, a tiny smile, round peach blush on the cheeks, and a small chubby torso with a tuft of cream chest fur';

const SAME_FUR = 'Use EXACTLY the same pale cream-honey fur colours and the same soft brown outline as the attached fox: not darker, not more orange, not brown. ';

const JOBS = {
  // 몸통은 시안의 큰 정면 그림(앞발을 모으고 앉은 자세)을 그대로 옮긴 한 장이다. 꼬리만 따로 둔다.
  // 팔다리를 따로 붙인 서 있는 자세는 시안과 달라 보이고 부품이 떨어져 보인다는 피드백이 있었다.
  default_body: [
    FRONT,
    `Redraw the fox in the attached picture as faithfully as you can: the SAME drawing, the same sitting pose seen from the front, the same proportions, the same face and the same soft pencil-like brown outline and fur texture: ${FOX}, sitting upright with its two front legs standing close together in front of its chest and its two hind feet peeking out at the left and right of its bottom. ` +
      'Only two changes: leave out the tail completely (NO tail, NO crystal, NO glow, because the tail is a separate part) and leave out the shadow on the ground. Perfectly symmetric. Centered, fills about 88% of the frame. ',
  ],
  // 꼬리는 몸통 그림을 참조로 넘겨 털 색을 맞춘다(시안을 참조로 하면 더 진한 주황으로 나왔다)
  tail: [
    HERO,
    `A sprite part for a jointed rig of the fox in the attached picture (the attached picture shows its head and torso): its big fluffy tail on its own. ${SAME_FUR}` +
      'Draw only the tail, standing straight up, perfectly vertical: narrow at the bottom where it joins the body, wide and fluffy in the middle, ending in a soft rounded cream point at the top, with a simple smooth fluffy outline (only a few soft tufts, not many spiky strands). ' +
      'Plain fur only: NO crystal, NO flame and NO glow on it (that is a separate part). Nothing else in the picture. Centered, fills about 85% of the frame height. ',
  ],
  tailtip: [
    CONCEPT,
    'A sprite part for a jointed rig of the fox in the attached character sheet: the glowing tip of its tail on its own. ' +
      'Draw only a small warm golden crystal shaped like a little flame or a faceted teardrop, pointing up, with a soft pale-yellow outer glow shape drawn as flat colour. Nothing else in the picture. Centered, fills about 75% of the frame height. ',
  ],
};
// 동작 자세: 움직이거나 밀 때 앉은 그림 대신 잠깐 보여 주는 한 장짜리 그림(꼬리까지 한 장에 그린다).
// 앉은 그림만 움직였더니 무엇을 하는지 느낌이 약하다는 피드백이 있었다.
const POSES = {
  run:
    'seen from the side, facing RIGHT, bounding forward in the middle of a leap: its body stretched out low, both front paws reaching forward, hind legs kicking back, ears swept back by the speed, ' +
    'its fluffy tail streaming behind it with the warm golden crystal flame glowing at the tip, and a bright determined happy face',
  push:
    'seen from the side, facing RIGHT, pushing something heavy exactly like the pushing drawing in the middle of the character sheet: standing on its hind legs and leaning forward hard, ' +
    'both front paws pressed flat forward against an invisible box, eyes squeezed shut with effort, one small sweat drop, ears pushed back, its fluffy tail behind it with the warm golden crystal flame at the tip. Do NOT draw the crate or any box',
  jump:
    'seen from the front, jumping straight up in mid-air with joy: both front paws thrown up high, hind legs dangling below, ears perked up, a big happy smile with closed curved eyes, ' +
    'its fluffy tail visible at its left side with the warm golden crystal flame at the tip',
};
const POSE_END = ' The whole fox including its tail is one single drawing. No ground, no shadow, no motion lines, no sparkles, nothing else in the picture. Centered, fills about 88% of the frame. ';
for (const [pose, text] of Object.entries(POSES)) {
  JOBS[`default_${pose}`] = [CONCEPT, `Draw the fox from the attached character sheet in a new pose, in exactly the same drawing style, colours, proportions and soft brown outline: ${FOX}, ${text}.${POSE_END}`];
}
for (const [id, skin] of Object.entries(SKINS)) {
  if (id === 'default') continue;
  for (const pose of Object.keys(POSES)) {
    JOBS[`${id}_${pose}`] = [
      `${OUT}/default_${pose}.png`,
      `The attached picture is the hero fox in an action pose. Draw the SAME fox in exactly the same pose, size, proportions, outline and fur texture, ${skin.form}. ` +
        `It must still be clearly the same character and the same pose (${POSES[pose].split(':')[0]}). Both big ears stay visible and the face stays uncovered.${POSE_END}`,
    ];
  }
}
for (const [id, skin] of Object.entries(SKINS)) {
  if (id === 'default') continue;
  JOBS[`${id}_body`] = [
    HERO,
    `The attached picture is the hero fox, sitting and seen from the front. Draw the SAME fox, in exactly the same sitting pose, size, proportions, outline and fur texture, ${skin.form}. ` +
      `It must still be clearly the same character: ${FOX}, with its two front legs together in front and its hind feet peeking out at both sides. Both big ears stay fully visible (a hat sits between or behind the ears, never hiding them) and the face stays uncovered. ` +
      'Perfectly symmetric. NO tail in this picture (the tail is a separate part). Centered, fills about 88% of the frame. ',
  ];
}

function run(name) {
  return new Promise((resolve) => {
    const [ref, body] = JOBS[name];
    const file = `${OUT}/${name}.png`;
    if (existsSync(file)) return resolve({ name, status: 'skip' });
    const prompt =
      `Use $imagegen to generate exactly one image, then save it as ${file} in this workspace. ` +
      `Do not overwrite any existing file and do not create or edit any other file.\n\nImage: ${body}${COMMON}\n\n` +
      `Do not draw the image with code, PIL, SVG or any procedural method. If the image generation tool is unavailable or fails, say so and stop without creating a file.`;
    const child = spawn('codex', ['exec', '--sandbox', 'workspace-write', '--skip-git-repo-check', '--json', '-i', ref, '-'], { shell: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', () => {});
    child.stdin.end(prompt);
    const timer = setTimeout(() => child.kill(), 8 * 60 * 1000);
    child.on('close', () => {
      clearTimeout(timer);
      writeFileSync(`${logDir}/${name}.jsonl`, out);
      resolve({ name, status: existsSync(file) ? 'ok' : 'fail' });
    });
  });
}

const queue = Object.keys(JOBS).filter((n) => !only || only.has(n));
const results = [];
async function worker() {
  for (;;) {
    const name = queue.shift();
    if (!name) return;
    const r = await run(name);
    results.push(r);
    console.log(`${r.status.padEnd(4)} ${r.name}`);
  }
}
await Promise.all(Array.from({ length: parallel }, worker));
const failed = results.filter((r) => r.status === 'fail');
console.log(`완료: 성공 ${results.filter((r) => r.status === 'ok').length}, 건너뜀 ${results.filter((r) => r.status === 'skip').length}, 실패 ${failed.length}`);
if (failed.length) console.log('실패: ' + failed.map((r) => r.name).join(', '));
