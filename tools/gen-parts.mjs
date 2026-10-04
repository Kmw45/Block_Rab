// 캐릭터 스킨을 관절 애니메이션용 부위 그림(몸통, 팔, 다리)으로 나눠 Codex CLI로 생성한다.
// 사용: node tools/gen-parts.mjs [로그 폴더] [동시 실행 수] [스킨 id 쉼표 목록]
// 원본 스킨 그림(art/source/skin_<id>.png)을 참조로 넘겨 같은 디자인을 유지한다. 이미 있는 파일은 건너뛴다.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';

const SRC = 'art/source';
const OUT = 'art/parts';
const logDir = process.argv[2] ?? 'gen-logs';
const parallel = Number(process.argv[3] ?? 3);
const only = process.argv[4] ? new Set(process.argv[4].split(',')) : null;
mkdirSync(logDir, { recursive: true });
mkdirSync(OUT, { recursive: true });

const COMMON =
  'Same hand-painted casual mobile game style, same colors, materials and lighting as the attached character. ' +
  'Transparent background. No text, no logo, no watermark, no shadow on the ground, nothing cut off.';

const PARTS = {
  body:
    'Redraw the attached character EXACTLY as it is (same design, same face and eyes, same colors, same hat or other things on its head and body, front view), ' +
    'but with BOTH ARMS and BOTH LEGS completely removed, together with anything it was holding in its hands. Only the body remains, ' +
    'with a clean smooth rounded bottom edge where the legs were and clean smooth sides where the arms were. ' +
    'Centered, fills about 85% of the frame. ' +
    COMMON,
  arm:
    // "떼어낸 팔"이라는 표현은 이미지 생성기의 안전 필터에 걸리는 일이 있어 부품 그림으로 설명한다
    'A game sprite part for a cartoon mascot rig: ONE short stubby rounded paw-like limb piece that the game will attach to the side of the attached mascot as its little arm. ' +
    'Draw only this one soft rounded piece, hanging straight down, perfectly vertical, slightly narrower at the top and with a rounded mitten-like end at the bottom, ' +
    'in the same color and material as the mascot\'s arms. Nothing else in the picture. ' +
    'Centered, the arm fills about 80% of the frame height. ' +
    COMMON,
  leg:
    'Draw ONE single detached leg of the attached character and nothing else: a short stubby leg standing straight, perfectly vertical, ' +
    'the hip end at the top and a small rounded foot at the bottom, seen from the front, same color and material as the character\'s legs. No body, no second leg. ' +
    'Centered, the leg fills about 80% of the frame height. ' +
    COMMON,
};

// 기본 캐릭터는 타이틀 그림의 젤리 캐릭터와 같아 보여야 하므로, 타이틀 그림을 참조로 삼아 따로 그린다
const JELLY =
  'Exactly the same glossy, slightly translucent yellow jelly material as the yellow character in the attached key art: soft inner glow, ' +
  'bright specular highlights, warm orange shading at the bottom, rendered as a soft 3D object. ' +
  'Transparent background. No text, no logo, no watermark, no shadow on the ground, no floor, nothing cut off.';
const ROUND = "Completely smooth and round: NO fingers, NO toes, NO notches, NO clefts, NO creases, NO separate hand or foot shape. ";
const OVERRIDES = {
  default: {
    ref: `${SRC}/ui_title_art.png`,
    parts: {
      body:
        'Draw ONLY the yellow jelly cube character from the attached key art, isolated on its own and turned to face the viewer: ' +
        'an extra chubby, very round and soft jelly cube, almost like a plump marshmallow or a squishy ball with only a hint of cube shape: every corner and edge heavily rounded, ' +
        'slightly wider at the bottom, with real 3D volume, seen from slightly above so that its rounded TOP and its FRONT are both visible. ' +
        'Extra cute baby-like face on the front: two very big round sparkly eyes (white with large dark brown pupils and two white highlights each) set low and wide apart, ' +
        'soft pink blush on both cheeks, no mouth. Symmetric, upright, adorable. ' +
        'NO arms and NO legs in this picture (they are separate parts): clean smooth sides and a clean rounded bottom. ' +
        'Centered, fills about 85% of the frame. ' +
        JELLY,
      arm:
        'A game sprite part for a cartoon mascot rig: ONE small stubby rounded jelly nub that the game will attach to the side of the yellow jelly character ' +
        'from the attached key art as its little arm. Draw only this one piece: a simple smooth jelly capsule like a jelly bean, hanging straight down, perfectly vertical, ' +
        'slightly narrower at the top and evenly rounded like a ball at the bottom. ' +
        ROUND +
        'Nothing else in the picture. Centered, fills about 80% of the frame height. ' +
        JELLY,
      leg:
        'A game sprite part for a cartoon mascot rig: ONE short stubby jelly leg for the yellow jelly character from the attached key art. ' +
        'Draw only this one piece: a simple smooth jelly capsule like a short jelly bean, standing straight, perfectly vertical, ending in an evenly rounded ball at the bottom. ' +
        ROUND +
        'Nothing else in the picture. Centered, fills about 80% of the frame height. ' +
        JELLY,
    },
  },
};

function run(id, part) {
  return new Promise((resolve) => {
    const file = `${OUT}/${id}_${part}.png`;
    if (existsSync(file)) return resolve({ name: `${id}_${part}`, status: 'skip' });
    const override = OVERRIDES[id];
    const prompt =
      `Use $imagegen to generate exactly one image, then save it as ${file} in this workspace. ` +
      `Do not overwrite any existing file and do not create or edit any other file.\n\nImage: ${override ? override.parts[part] : PARTS[part]}\nSquare 1:1.\n\n` +
      `Do not draw the image with code, PIL, SVG or any procedural method. If the image generation tool is unavailable or fails, say so and stop without creating a file.`;
    const child = spawn('codex', ['exec', '--sandbox', 'workspace-write', '--skip-git-repo-check', '--json', '-i', override?.ref ?? `${SRC}/skin_${id}.png`, '-'], {
      shell: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', () => {});
    child.stdin.end(prompt);
    const timer = setTimeout(() => child.kill(), 8 * 60 * 1000);
    child.on('close', () => {
      clearTimeout(timer);
      writeFileSync(`${logDir}/${id}_${part}.jsonl`, out);
      resolve({ name: `${id}_${part}`, status: existsSync(file) ? 'ok' : 'fail' });
    });
  });
}

const skins = readdirSync(SRC)
  .filter((f) => /^skin_.+\.png$/.test(f))
  .map((f) => f.slice(5, -4))
  .filter((id) => !only || only.has(id));
const queue = skins.flatMap((id) => Object.keys(PARTS).map((part) => [id, part]));
const results = [];
async function worker() {
  for (;;) {
    const job = queue.shift();
    if (!job) return;
    const r = await run(job[0], job[1]);
    results.push(r);
    console.log(`${r.status.padEnd(4)} ${r.name}`);
  }
}
await Promise.all(Array.from({ length: parallel }, worker));
const failed = results.filter((r) => r.status === 'fail');
console.log(`완료: 성공 ${results.filter((r) => r.status === 'ok').length}, 건너뜀 ${results.filter((r) => r.status === 'skip').length}, 실패 ${failed.length}`);
if (failed.length) console.log('실패: ' + failed.map((r) => r.name).join(', '));
