// 주인공(미궁의 정령)과 치장 스킨을 관절 애니메이션용 부위 그림으로 Codex CLI에서 생성한다.
// 사용: node tools/gen-parts.mjs [로그 폴더] [동시 실행 수] [작업 이름 쉼표 목록]
// 작업 이름: default_body, default_arm, default_leg, crystal, <스킨 id>_body
// - 주인공의 몸통·팔·다리·결정은 도입 이야기 그림에서 잘라 낸 모습(art/concepts/spirit-round.png)을 참조로 그린다.
// - 스킨은 몸통만 그린다. 주인공의 몸통을 참조로 넘겨 "정령이 그 모습을 빌려 입은" 그림이 되게 한다.
//   팔다리는 주인공의 것을 스킨 색으로 물들여 쓰고(tools/make-anim.mjs), 머리 위 결정은 모든 스킨에 남는다.
// 이미 있는 파일은 건너뛴다. 스킨의 색과 모습은 tools/skins.json에 있다.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const OUT = 'art/parts';
const CONCEPT = 'art/concepts/spirit-round.png'; // 도입 이야기 3번째 그림에서 잘라 낸 주인공
const HERO = `${OUT}/default_body.png`;
const logDir = process.argv[2] ?? 'gen-logs';
const parallel = Number(process.argv[3] ?? 3);
const only = process.argv[4] ? new Set(process.argv[4].split(',')) : null;
const SKINS = JSON.parse(readFileSync(new URL('./skins.json', import.meta.url), 'utf8'));
mkdirSync(logDir, { recursive: true });
mkdirSync(OUT, { recursive: true });

const COMMON = 'Glossy hand-painted 3D casual mobile game style. Transparent background. No text, no logo, no watermark, no shadow on the ground, no floor, nothing cut off. Square 1:1.';
const ROUND = 'Completely smooth and round: NO fingers, NO toes, NO notches, NO clefts, NO creases, NO separate hand or foot shape. ';
const SPIRIT =
  'a round, plump, soft glossy jelly ball like a big water droplet (a sphere that is very slightly squashed, NOT a cube, NOT a box, no flat sides and no corners at all), slightly translucent with a soft inner glow, ' +
  'seen straight from the front, with two very big round sparkly eyes (large dark brown pupils with a star-shaped white highlight) placed CLOSE TOGETHER in the middle of the face, with only a small gap between them, ' +
  'a round soft pink blush right under each eye, a tiny dot mouth, and two or three faint pale glowing swirl markings near the edge of its body (abstract curls, not letters, never over the face)';

const JOBS = {
  default_body: [
    CONCEPT,
    `Draw ONLY the body of the round jelly spirit from the attached picture, isolated on its own, with the same proportions, face and cuteness: ${SPIRIT}, in warm golden-yellow. ` +
      'Symmetric, upright. NO arms, NO feet and NO floating crystal in this picture (they are separate parts): a clean smooth round outline all the way around. No background, no stones, no glow around it. Centered, fills about 85% of the frame. ',
  ],
  default_arm: [
    CONCEPT,
    'A game sprite part for a cartoon mascot rig: the ONE little arm of the round golden jelly spirit from the attached picture, which the game will attach to its side. ' +
      'Draw only this one piece: a simple smooth glossy golden-yellow jelly ball, an egg shape only slightly taller than it is wide, perfectly vertical. ' +
      ROUND +
      'Nothing else in the picture, no glow around it. Centered, fills about 80% of the frame height. ',
  ],
  default_leg: [
    CONCEPT,
    'A game sprite part for a cartoon mascot rig: the ONE little foot of the round golden jelly spirit from the attached picture. ' +
      'Draw only this one piece: a simple smooth glossy golden-yellow jelly bead, a short rounded oval about as wide as it is tall, with an evenly rounded bottom. ' +
      ROUND +
      'Nothing else in the picture, no glow around it. Centered, fills about 80% of the frame height. ',
  ],
  crystal: [
    CONCEPT,
    'Draw ONLY the floating crystal from the attached design sheet, isolated on its own: one small elongated diamond-shaped golden crystal shard with bright faceted highlights, upright. ' +
      'No glow halo, no light wisp, no sparkles around it, nothing else in the picture. Centered, fills about 80% of the frame height. ',
  ],
};
for (const [id, skin] of Object.entries(SKINS)) {
  if (id === 'default') continue;
  JOBS[`${id}_body`] = [
    HERO,
    `The attached picture is the labyrinth spirit. Draw ONLY the body of that same spirit after it has taken the form of ${skin.form}. ` +
      `It must still be recognisably the same spirit: ${SPIRIT}. Keep the same round ball body, the same close-set eyes and blush, and keep the glowing swirl markings visible on the jelly. ` +
      'Symmetric, upright. NO arms, NO feet and NO floating crystal in this picture (they are separate parts): a clean round outline at the sides and bottom. Centered, fills about 85% of the frame. ',
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
