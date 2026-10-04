// 주인공 캐릭터 시안을 Codex CLI로 그린다. 게임에 넣는 그림이 아니라 방향을 고르기 위한 설정화다.
// 사용: node tools/gen-concepts.mjs [로그 폴더] [동시 실행 수]   결과: art/concepts/<이름>.png
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';

const OUT = 'art/concepts';
const REF = 'art/parts/default_body.png'; // 지금의 젤리 캐릭터. 재질과 눈을 이어 가기 위한 참조
const logDir = process.argv[2] ?? 'gen-logs';
const parallel = Number(process.argv[3] ?? 2);
mkdirSync(OUT, { recursive: true });
mkdirSync(logDir, { recursive: true });

const SHEET =
  'A character design sheet for the hero of a cute mobile dungeon puzzle game where the hero pushes blocks through a labyrinth. ' +
  'The hero is based on the attached character: a chubby, very round, glossy yellow jelly cube with two big sparkly eyes, pink blush, no mouth, and short stubby round arms and legs with no fingers or toes. Keep that body, material and face, and add the identity described below. ' +
  'Layout on a plain soft cream background: on the left a large full-body front view; in the middle a three-quarter view from slightly above, in a pose pushing a wooden crate; ' +
  'on the right a column of three small head-and-shoulder expression studies (cheerful, straining hard, startled); at the bottom right a small close-up of the signature item on its own. ' +
  'Same glossy hand-painted 3D casual mobile game style in every drawing, consistent proportions. Landscape 3:2. No text, no letters, no labels, no logo, no watermark.';

const CONCEPTS = {
  explorer:
    'Identity: a tiny treasure-hunting explorer who is brave but easily startled. Signature item: an oversized brass miner helmet with a glowing headlamp that sits low over the eyes, plus a too-big leather backpack with a rolled map and a small pickaxe strapped on, and a short red scarf.',
  knight:
    'Identity: an earnest little squire training to become a knight by pushing blocks. Signature item: a dented bucket-style steel helmet with a slit visor pushed up above the eyes and a small red plume, plus a short blue cape and a round wooden shield worn on the back.',
  minotaur:
    'Identity: a baby minotaur, the gentle child of the labyrinth who knows its halls and is strong for its size. Signature item: two small ivory horns on top of the jelly body, a tuft of brown fur between them, a small golden nose ring, a short tufted tail, and a red thread spool hanging from a belt.',
  spirit:
    'Identity: a curious guardian spirit of the labyrinth born from its magic. Signature item: a floating golden crystal hovering just above the head connected by a wisp of light, glowing rune-like swirl markings on the body (abstract shapes, not letters), and a soft inner glow in the jelly.',
};

function run(name, identity) {
  return new Promise((resolve) => {
    const file = `${OUT}/${name}.png`;
    if (existsSync(file)) return resolve({ name, status: 'skip' });
    const prompt =
      `Use $imagegen to generate exactly one image, then save it as ${file} in this workspace. ` +
      `Do not overwrite any existing file and do not create or edit any other file.\n\nImage: ${SHEET}\n${identity}\n\n` +
      `Do not draw the image with code, PIL, SVG or any procedural method. If the image generation tool is unavailable or fails, say so and stop without creating a file.`;
    const child = spawn('codex', ['exec', '--sandbox', 'workspace-write', '--skip-git-repo-check', '--json', '-i', REF, '-'], { shell: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', () => {});
    child.stdin.end(prompt);
    const timer = setTimeout(() => child.kill(), 8 * 60 * 1000);
    child.on('close', () => {
      clearTimeout(timer);
      writeFileSync(`${logDir}/concept_${name}.jsonl`, out);
      resolve({ name, status: existsSync(file) ? 'ok' : 'fail' });
    });
  });
}

const queue = Object.entries(CONCEPTS);
async function worker() {
  for (;;) {
    const job = queue.shift();
    if (!job) return;
    const r = await run(job[0], job[1]);
    console.log(`${r.status.padEnd(4)} ${r.name}`);
  }
}
await Promise.all(Array.from({ length: parallel }, worker));
