// Codex CLI의 이미지 생성으로 게임 그림을 만든다. 이미 있는 파일은 건너뛴다.
// 사용: node tools/gen-sprites.mjs [로그 폴더] [동시 실행 수] [키 필터(쉼표)]
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';

const DIR = 'art/source'; // 원본. tools/build-sprites.mjs가 게임용 크기로 줄인다
const REF = `${DIR}/block_normal.png`;
const logDir = process.argv[2] ?? 'gen-logs';
const parallel = Number(process.argv[3] ?? 2);
const only = process.argv[4] ? new Set(process.argv[4].split(',')) : null;
mkdirSync(logDir, { recursive: true });

const STYLE =
  'Style: match the attached reference image exactly (hand-painted casual mobile puzzle game sprite, warm soft lighting from the top left, clean readable shapes, slightly raised 3D bevel, viewed from directly above). ' +
  'Square 1:1 image. No text, letters, numbers, logo, watermark, frame, cast shadow on the ground, or cropping.';
const SPRITE = 'Transparent background. The object is centered and fills about 87% of the frame with an even margin on all sides.';
const BLOB =
  'A cute chunky rounded-square blob character for a puzzle game, standing, viewed from the front, with two big simple white eyes with dark pupils looking forward and no mouth. ' +
  'It has two short stubby little arms at its sides and two short stubby little legs with small rounded feet, clearly visible. ' +
  'Transparent background. The whole character including arms, legs and any hat is centered and fills about 84% of the frame, with nothing cut off.';
const UI = 'Hand-painted casual mobile puzzle game art matching the attached reference image style. No text, letters, numbers, logo, watermark, or frame.';
const ICON = `Transparent background, centered, fills about 88% of the frame, fully visible with nothing cut off. Square 1:1. ${UI}`;

const KIT = 'Game UI kit element in the style of top casual mobile puzzle games: chunky, glossy, soft bevels, warm lighting, dungeon treasure theme.';
const FLAT = `Flat straight-on front view, perfectly symmetrical, straight not tilted, no perspective. Transparent background, centered, fills about 92% of the frame, nothing cut off. ${UI}`;

const ASSETS = [
  ['floor', `A square dungeon flagstone floor tile in neutral light grey, low contrast, subtle cracks and worn edges, flat even lighting. It fills the ENTIRE frame edge to edge with no margin, fully opaque, no transparency.`],
  ['wall', `A chunky raised stone-brick wall block in neutral light grey, solid and heavy. ${SPRITE} It fills about 96% of the frame.`],
  ['block_fixed', `A heavy immovable dark charcoal stone block, plain, with no markings or symbols. ${SPRITE}`],
  ['block_railH', `A teal-green metal block with one bold white double-headed arrow engraved on top, pointing exactly left and right (horizontal). ${SPRITE}`],
  ['block_ice', `A glossy translucent sky-blue ice cube block with frosty white highlights and a small snowflake facet on top. ${SPRITE}`],
  ['block_count', `A coral-red fired-clay block with a smooth, empty, slightly recessed square plate in the center (the plate is blank: no symbol, no number). ${SPRITE}`],
  ['exit', `A glowing magical exit seal on the floor: a circular golden-white ring of light with a bright five-pointed star in the center and soft light rays. No letters or runes. ${SPRITE}`],
  ['skin_default', `${BLOB} Character: plain warm yellow blob, friendly.`],
  ['skin_moss', `${BLOB} Character: a grey-green stone blob with patches of green moss.`],
  ['skin_mouse', `${BLOB} Character: a dusty grey-brown mouse blob with round pink ears and a thin tail.`],
  ['skin_torch', `${BLOB} Character: an orange torch-keeper blob with a small flame burning on its head.`],
  ['skin_web', `${BLOB} Character: a pale white ball of cobweb with thin web strands.`],
  ['skin_pot', `${BLOB} Character: a terracotta clay pot shape with a crack on its side.`],
  ['skin_bat', `${BLOB} Character: a dark purple bat blob with small bat wings and yellow eyes.`],
  ['skin_helmet', `${BLOB} Character: a peach blob wearing an ancient bronze helmet with a red crest.`],
  ['skin_lantern', `${BLOB} Character: a teal explorer blob holding a small glowing lantern.`],
  ['skin_skeleton', `${BLOB} Character: a bone-white skull soldier blob with dark hollow eye sockets and small teeth.`],
  ['skin_statue', `${BLOB} Character: a square grey carved stone statue with cracks.`],
  ['skin_hunter', `${BLOB} Character: a tan treasure-hunter blob wearing a brown fedora hat.`],
  ['skin_ghost', `${BLOB} Character: a pale blue-white ghost with a wavy bottom edge, slightly translucent.`],
  ['skin_minotaur', `${BLOB} Character: a brown minotaur blob with two ivory horns and a golden nose ring.`],
  ['skin_mage', `${BLOB} Character: a violet labyrinth mage blob wearing a tall pointed wizard hat with a gold star.`],
  ['skin_knight', `${BLOB} Character: a shining golden armored knight blob with a visor and a red plume.`],
  ['skin_king', `${BLOB} Character: a radiant golden king blob wearing a jeweled crown, glowing with sparkles, the most precious of all.`],
  ['skin_slime', `${BLOB} Character: a glossy green dungeon slime blob, slightly translucent and jiggly.`],
  ['skin_mushroom', `${BLOB} Character: a cave mushroom blob with a red cap with white spots on its head.`],
  ['skin_mummy', `${BLOB} Character: a mummy blob wrapped in pale linen bandages with one loose strip.`],
  ['skin_goblin', `${BLOB} Character: a green goblin blob with long pointed ears and a small leather vest.`],
  ['skin_dragon', `${BLOB} Character: a red baby dragon blob with small horns, tiny wings and a little tail.`],
  ['skin_phoenix', `${BLOB} Character: a legendary phoenix blob made of bright orange and gold flame feathers with a glowing crest, radiant.`],
  // 던전 기믹 타일
  ['tile_pit', `A square pit trap in a dungeon stone floor, viewed from directly above: a deep dark hole with a chipped stone rim around it. Fills the ENTIRE frame edge to edge, fully opaque, no margin. ${UI}`, true],
  ['tile_oneway', `A square dungeon stone floor tile, viewed from directly above, with one large bold glowing amber chevron arrow carved into it pointing straight UP. Fills the ENTIRE frame edge to edge, fully opaque, no margin. ${UI}`, true],
  ['tile_ice', `A square slippery frozen floor tile, viewed from directly above: glossy pale blue ice with subtle cracks and white shine streaks, flat. Fills the ENTIRE frame edge to edge, fully opaque, no margin. ${UI}`, true],
  ['tile_portal', `A glowing magic teleport circle seen from directly above: a swirling violet-blue vortex inside a bright ring of light. No letters or runes. ${ICON}`, true],
  ['ui_chest_closed', `A closed wooden treasure chest with golden bands and a golden lock, viewed from the front at a slight downward angle. ${SPRITE}`],
  ['ui_chest_open', `The same style wooden treasure chest with golden bands, lid wide open, bright warm white light glowing from inside, viewed from the front at a slight downward angle. ${SPRITE}`],
  // UI와 이펙트. raw는 공통 화풍 문구 대신 UI 문구를 붙인다.
  ['ui_bg', `A dark, moody background for a mobile puzzle game menu: an ancient labyrinth stone wall with large worn blocks, faint carved maze lines, soft vignette, darker toward the bottom. Neutral desaturated grey, low contrast, no focal object, nothing bright. Portrait orientation 2:3, fully opaque, fills the whole frame. ${UI}`, true],
  ['ui_title_art', `Key art for a mobile puzzle game: inside a torch-lit stone labyrinth, a cute chunky yellow rounded-square blob character with two big white eyes pushes a wooden crate toward a glowing golden star seal on the floor; an ice block and a teal arrow block sit nearby. Warm light, cozy and adventurous, three-quarter top-down view. Square 1:1, fully opaque, fills the whole frame, darker soft edges. ${UI}`, true],
  ['ui_star', `A single chunky glossy golden five-pointed star game icon with a darker gold rim and a soft highlight, front view. ${ICON}`, true],
  ['ui_coin', `A single glossy gold coin game icon with a simple embossed star in the middle, front view. ${ICON}`, true],
  ['ui_lock', `A single chunky golden padlock game icon, closed, front view. ${ICON}`, true],
  ['icon_undo', `A single chunky cream-white curved arrow game icon pointing back to the left (an undo arrow), thick rounded shape with a soft dark outline. ${ICON}`, true],
  ['icon_restart', `A single chunky cream-white circular arrow game icon (a restart / refresh symbol), thick rounded shape with a soft dark outline. ${ICON}`, true],
  ['icon_hint', `A single chunky glowing yellow light bulb game icon with a soft dark outline. ${ICON}`, true],
  ['ui_hand', `A single cartoon white-gloved pointing hand game icon, index finger pointing up and slightly left, soft dark outline (a tutorial pointer). ${ICON}`, true],
  ['emblem_1', `A round stone medallion game emblem showing an arched labyrinth doorway with warm torch light. ${ICON}`, true],
  ['emblem_2', `A round teal metal medallion game emblem showing a double-headed arrow on rails. ${ICON}`, true],
  ['emblem_3', `A round frosty blue ice medallion game emblem showing a snowflake. ${ICON}`, true],
  ['emblem_4', `A round coral-red clay medallion game emblem showing three engraved dots like a dice face. ${ICON}`, true],
  ['emblem_5', `A round purple crystal medallion game emblem showing a glowing maze spiral with a heart-shaped gem in the center. ${ICON}`, true],
  ['fx_dust', `A single soft puff of beige dust cloud, cartoon game effect sprite, fluffy rounded shapes. ${ICON}`, true],
  ['fx_spark', `A single bright four-pointed star sparkle glow, white core fading to warm gold, game VFX texture for additive blending. Pure black background (#000000), the glow fades smoothly to black before the edges, centered. Square 1:1. ${UI}`, true],
  ['fx_ring', `A single thin glowing shockwave ring, white-gold, soft outer glow, perfectly circular and centered, empty in the middle, game VFX texture for additive blending. Pure black background (#000000), fades to black before the edges. Square 1:1. ${UI}`, true],
  ['fx_burst', `A radial burst of soft light rays from the center, white core fading to warm gold, game VFX texture for additive blending. Pure black background (#000000), rays fade smoothly to black before the edges, centered. Square 1:1. ${UI}`, true],
  // UI 키트. 글자와 아이콘 없이 빈 판으로 만들고, 게임에서 9-슬라이스로 늘려 쓴다.
  ['ui_btn_gold', `${KIT} A blank wide rounded-rectangle game button: glossy amber-gold face with a bright top highlight, a darker gold rim and a thick darker bottom lip that makes it look raised and pressable. About 3 times wider than tall. Completely empty face. ${FLAT}`, true],
  ['ui_btn_stone', `${KIT} A blank wide rounded-rectangle game button carved from dark blue-grey stone with a thin gold trim line, a soft top highlight and a thick darker bottom lip that makes it look raised and pressable. About 3 times wider than tall. Completely empty face. ${FLAT}`, true],
  ['ui_btn_square', `${KIT} A blank square game button with rounded corners carved from dark blue-grey stone with a thin gold trim line, a soft top highlight and a thick darker bottom lip. Completely empty face. ${FLAT}`, true],
  ['ui_panel', `${KIT} A blank square popup panel for a game dialog: a dark navy-purple stone slab with a smooth empty center, framed by a chunky gold border with ornate rounded corner caps. Completely empty center. ${FLAT}`, true],
  ['ui_frame', `${KIT} A blank square content frame for a game menu section: a dark, slightly translucent-looking slate panel with a smooth empty center and a simple thin bronze border with small corner rivets. Subtle, low contrast, completely empty center. ${FLAT}`, true],
  ['ui_ribbon', `${KIT} A blank horizontal title ribbon banner for a game popup: a wide crimson-red cloth ribbon with folded swallow-tail ends and a thin gold edge, slightly curved. About 4 times wider than tall. Completely empty, no text. ${FLAT}`, true],
  ['ui_stage_open', `${KIT} A blank square level-select tile: a raised dark stone plaque with rounded corners and a glowing amber-gold frame, empty smooth center for a number. ${FLAT}`, true],
  ['ui_stage_cleared', `${KIT} A blank square level-select tile for a completed level: a raised polished gold plaque with rounded corners, bright and shiny, empty smooth center for a number. ${FLAT}`, true],
  ['ui_stage_locked', `${KIT} A blank square level-select tile for a locked level: a dull dark grey stone plaque with rounded corners and an iron frame, wrapped by iron chains across it, empty center. ${FLAT}`, true],
  ['ui_pill', `${KIT} A blank horizontal capsule-shaped counter frame for a game currency display: a dark inset capsule with a gold rim, empty inside. About 3 times wider than tall. ${FLAT}`, true],
  ['ui_card', `${KIT} A blank square inventory slot for a game collection screen: a dark recessed slot with rounded corners and a silver-grey metal rim, completely empty inside. ${FLAT}`, true],
  ['icon_back', `A single chunky cream-white arrow game icon pointing left (a back arrow), thick rounded shape with a soft dark outline. ${ICON}`, true],
  ['icon_settings', `A single chunky cream-white gear cog game icon (settings), thick rounded shape with a soft dark outline. ${ICON}`, true],
  ['icon_skip', `A single chunky cream-white double-triangle fast-forward game icon pointing right, thick rounded shapes with a soft dark outline. ${ICON}`, true],
  ['icon_gem', `A single chunky faceted magenta-purple gemstone game icon with a bright highlight and a soft dark outline. ${ICON}`, true],
];

function run(key, body, raw) {
  return new Promise((resolve) => {
    const file = `${DIR}/${key}.png`;
    if (existsSync(file)) return resolve({ key, status: 'skip' });
    const prompt =
      `Use $imagegen to generate exactly one image, then save it as ${file} in this workspace. ` +
      `Do not overwrite any existing file and do not create or edit any other file.\n\nImage: ${body}\n${raw ? '' : STYLE}\n\n` +
      `Do not draw the image with code, PIL, SVG or any procedural method. If the image generation tool is unavailable or fails, say so and stop without creating a file.`;
    const child = spawn('codex', ['exec', '--sandbox', 'workspace-write', '--skip-git-repo-check', '--json', '-i', REF, '-'], {
      shell: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', () => {});
    child.stdin.end(prompt);
    const timer = setTimeout(() => child.kill(), 8 * 60 * 1000);
    child.on('close', (code) => {
      clearTimeout(timer);
      writeFileSync(`${logDir}/${key}.jsonl`, out);
      // 이벤트 기록에 이미지 생성 항목이 있었는지 본다
      const types = new Set();
      for (const line of out.split('\n')) {
        try {
          const ev = JSON.parse(line);
          types.add(ev.item?.type ?? ev.type);
        } catch {
          // JSON이 아닌 줄은 무시
        }
      }
      const imageEvent = [...types].some((t) => /image/i.test(String(t)));
      resolve({ key, status: existsSync(file) ? 'ok' : 'fail', code, imageEvent, types: [...types].join(',') });
    });
  });
}

const queue = ASSETS.filter(([key]) => !only || only.has(key));
const results = [];
async function worker() {
  for (;;) {
    const job = queue.shift();
    if (!job) return;
    const r = await run(job[0], job[1], job[2]);
    results.push(r);
    console.log(`${r.status.padEnd(4)} ${r.key}${r.status === 'skip' ? '' : `  imageEvent=${r.imageEvent}  [${r.types}]`}`);
  }
}
await Promise.all(Array.from({ length: parallel }, worker));
const failed = results.filter((r) => r.status === 'fail');
console.log(`완료: 성공 ${results.filter((r) => r.status === 'ok').length}, 건너뜀 ${results.filter((r) => r.status === 'skip').length}, 실패 ${failed.length}`);
if (failed.length) console.log('실패: ' + failed.map((r) => r.key).join(', '));
