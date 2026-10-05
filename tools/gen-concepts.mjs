// 주인공 캐릭터 시안을 Codex CLI로 그린다. 게임에 넣는 그림이 아니라 방향을 고르기 위한 설정화다.
// 사용: node tools/gen-concepts.mjs [로그 폴더] [동시 실행 수] [이름 쉼표 목록]   결과: art/concepts/<이름>.png
// 있는 파일은 건너뛴다.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';

const OUT = 'art/concepts';
const logDir = process.argv[2] ?? 'gen-logs';
const parallel = Number(process.argv[3] ?? 2);
const only = process.argv[4] ? new Set(process.argv[4].split(',')) : null;
mkdirSync(OUT, { recursive: true });
mkdirSync(logDir, { recursive: true });

// 1차(2026-10-04): 젤리 몸과 얼굴은 두고 상징 아이템으로 개성을 준 시안. D(spirit)가 채택됐다.
const REF1 = 'art/parts-old/v3/default_body.png';
const SHEET1 =
  'A character design sheet for the hero of a cute mobile dungeon puzzle game where the hero pushes blocks through a labyrinth. ' +
  'The hero is based on the attached character: a chubby, very round, glossy yellow jelly cube with two big sparkly eyes, pink blush, no mouth, and short stubby round arms and legs with no fingers or toes. Keep that body, material and face, and add the identity described below. ' +
  'Layout on a plain soft cream background: on the left a large full-body front view; in the middle a three-quarter view from slightly above, in a pose pushing a wooden crate; ' +
  'on the right a column of three small head-and-shoulder expression studies (cheerful, straining hard, startled); at the bottom right a small close-up of the signature item on its own. ' +
  'Same glossy hand-painted 3D casual mobile game style in every drawing, consistent proportions. Landscape 3:2. No text, no letters, no labels, no logo, no watermark.';

// 2차(2026-10-05): "캐릭터가 그래도 별로"라는 피드백. 주 타겟(캐주얼 퍼즐을 즐기는 25~44세 여성 중심)에 맞춰
// 광택 나는 3D 젤리를 버리고, 이모티콘·인형처럼 단순하고 폭신한 2D 캐릭터로 다시 잡는다.
// 이야기(깨진 심장의 빛 조각)는 그대로라 모든 시안이 금빛 결정을 지닌다.
const SHEET2 =
  'A character design sheet for the mascot hero of a cozy mobile block-pushing puzzle game set in an old stone labyrinth. ' +
  'The audience is adult women aged 25 to 45 who play calm casual puzzle games to relax and who love cute character goods, messenger emoticon characters and plush toys. ' +
  'So the character must be extremely simple, have one clear unique silhouette that is recognisable even as a tiny icon, look soft and huggable like a plush toy, and feel gentle, a little clumsy and endearing rather than cool. ' +
  'Art style: soft matte 2D illustration with clean rounded shapes, a soft thick brown outline, flat pastel colours with very gentle shading, warm cream and honey-gold accents, like a Korean messenger emoticon character or a Japanese mascot. NOT glossy, NOT 3D rendered, NOT shiny jelly, NOT realistic, no sparkly anime eyes. ' +
  'Layout on a plain warm cream background: on the left a large full-body front view; in the middle the character pushing a wooden crate with visible effort, seen from the side; ' +
  'on the right a column of four small expression studies (happy, straining, startled, sleepy); at the bottom middle the same character drawn very small three times in a row to show it stays readable at icon size; ' +
  'at the bottom right the character wearing one simple costume (a tiny purple wizard hat and short cape) to show that outfits fit on it. ' +
  'Identical proportions and colours in every drawing. Landscape 3:2. No text, no letters, no labels, no logo, no watermark.';

const CONCEPTS = {
  explorer: [REF1, SHEET1, 'Identity: a tiny treasure-hunting explorer who is brave but easily startled. Signature item: an oversized brass miner helmet with a glowing headlamp that sits low over the eyes, plus a too-big leather backpack with a rolled map and a small pickaxe strapped on, and a short red scarf.'],
  knight: [REF1, SHEET1, 'Identity: an earnest little squire training to become a knight by pushing blocks. Signature item: a dented bucket-style steel helmet with a slit visor pushed up above the eyes and a small red plume, plus a short blue cape and a round wooden shield worn on the back.'],
  minotaur: [REF1, SHEET1, 'Identity: a baby minotaur, the gentle child of the labyrinth who knows its halls and is strong for its size. Signature item: two small ivory horns on top of the jelly body, a tuft of brown fur between them, a small golden nose ring, a short tufted tail, and a red thread spool hanging from a belt.'],
  spirit: [REF1, SHEET1, 'Identity: a curious guardian spirit of the labyrinth born from its magic. Signature item: a floating golden crystal hovering just above the head connected by a wisp of light, glowing rune-like swirl markings on the body (abstract shapes, not letters), and a soft inner glow in the jelly.'],

  r2_mochi: [
    null,
    SHEET2,
    'Character: a tiny rice-cake spirit, a small squishy white-cream blob shaped like a soft mochi dumpling that sags a little at the bottom, with two small black dot eyes set close together, a tiny mouth, round peach cheeks, very short stubby arms and feet, ' +
      'and ONE small golden crystal growing from the top of its head like a little sprout or a single tuft of hair. That crystal sprout is its signature and glows softly. Personality: timid but determined, tries very hard at everything.',
  ],
  r2_fox: [
    null,
    SHEET2,
    'Character: a baby fennec fox spirit, small and chubby with a big round head, oversized soft triangular ears with pale pink insides, cream-and-honey fur, small black dot eyes, a tiny nose, short stubby legs, ' +
      'and a big fluffy tail whose tip glows like a warm golden crystal flame. The glowing tail tip is its signature and lights its way. Personality: curious and playful, ears droop when it fails.',
  ],
  r2_child: [
    null,
    SHEET2,
    'Character: a very small child-like lantern keeper wearing an oversized honey-yellow hooded cloak that hides the whole body down to tiny boots, with a round pale face deep in the hood, two small dot eyes, rosy cheeks, the hood ending in a long soft drooping point, ' +
      'and carrying a small lantern that holds a glowing golden crystal shard instead of a flame. The oversized hood and crystal lantern are its signature. Personality: quiet, brave and gentle, like a storybook character.',
  ],
  r2_calf: [
    null,
    SHEET2,
    'Character: a baby minotaur calf that looks like a plush toy, chubby and round with a big head, cream fur with one soft caramel patch over an eye, two tiny rounded horns, floppy ears, a pink muzzle, small dot eyes, a little tufted tail, standing upright on stubby legs, ' +
      'wearing a small bell collar whose bell is a golden crystal. The tiny horns and crystal bell are its signature. Personality: gentle and strong for its size, born in the labyrinth and proud to know its halls.',
  ],
};

function run(name) {
  return new Promise((resolve) => {
    const [ref, sheet, identity] = CONCEPTS[name];
    const file = `${OUT}/${name}.png`;
    if (existsSync(file)) return resolve({ name, status: 'skip' });
    const prompt =
      `Use $imagegen to generate exactly one image, then save it as ${file} in this workspace. ` +
      `Do not overwrite any existing file and do not create or edit any other file.\n\nImage: ${sheet}\n${identity}\n\n` +
      `Do not draw the image with code, PIL, SVG or any procedural method. If the image generation tool is unavailable or fails, say so and stop without creating a file.`;
    const args = ['exec', '--sandbox', 'workspace-write', '--skip-git-repo-check', '--json', ...(ref ? ['-i', ref] : []), '-'];
    const child = spawn('codex', args, { shell: true, stdio: ['pipe', 'pipe', 'pipe'] });
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

const queue = Object.keys(CONCEPTS).filter((n) => !only || only.has(n));
async function worker() {
  for (;;) {
    const name = queue.shift();
    if (!name) return;
    const r = await run(name);
    console.log(`${r.status.padEnd(4)} ${r.name}`);
  }
}
await Promise.all(Array.from({ length: parallel }, worker));
