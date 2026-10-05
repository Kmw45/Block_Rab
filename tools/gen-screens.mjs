// 화면 시안을 Codex CLI로 그린다. 게임에 넣는 그림이 아니라 화면 구성의 방향을 고르기 위한 그림이다.
// 사용: node tools/gen-screens.mjs [로그 폴더] [동시 실행 수] [이름 쉼표 목록]   결과: art/concepts/screens/<화면>_<a|b|c>.png
// 참조로 주인공 시안과 지금 화면(tools/shot-screens.mjs로 찍은 것)을 넘긴다. 있는 파일은 건너뛴다.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';

const OUT = 'art/concepts/screens';
const FOX = 'art/concepts/r2_fox.png';
const logDir = process.argv[2] ?? 'gen-logs';
const parallel = Number(process.argv[3] ?? 2);
const only = process.argv[4] ? new Set(process.argv[4].split(',')) : null;
mkdirSync(OUT, { recursive: true });
mkdirSync(logDir, { recursive: true });

const GAME =
  'A high-fidelity UI design mockup of one screen of a cozy mobile puzzle game called "Block Labyrinth", in which a baby fennec fox with a glowing golden crystal on its tail tip pushes blocks through an old stone labyrinth to bring its light back. ' +
  'The audience is adult women aged 25 to 45 who play calm casual puzzle games to relax. ' +
  'Two reference images are attached. The FIRST is the character design sheet: draw the fox exactly like it (big round head, oversized ears with pale pink insides, cream-and-honey fur, black dot eyes, fluffy tail with a glowing golden crystal flame at the tip) and use its art style for everything. ' +
  'The SECOND is a screenshot of how this screen looks in the game right now: keep the same information and controls it has, but redesign the layout, composition and decoration in the direction described below. Do not simply copy the screenshot. ';
const STYLE =
  'Art style: soft matte 2D illustration, clean rounded shapes, soft thick brown outlines, flat pastel colours with very gentle shading, warm cream and honey-gold accents on a dusky evening-toned backdrop (deep plum, teal and warm brown) so that the cream fox stands out. NOT glossy, NOT 3D rendered, NOT realistic. ' +
  'Format: one tall portrait phone screen, aspect ratio 9:16, the UI fills the whole image edge to edge. No phone frame, no device bezel, no hand, no drop shadow around the screen, no annotations, no multiple screens. ' +
  'Text rule: do NOT draw any Korean or other non-Latin letters. Use icons instead of words on buttons (play triangle, back arrow, gear, undo arrow, restart loop, light bulb, gem, coin, star, lock). Numbers are allowed and must be crisp. Where a caption or label would go, leave a clean empty label shape. ';

const SCREENS = {
  title: {
    what: 'Screen: the HOME / TITLE screen. It needs: the game logo, the fox, one large primary play button that also shows the stage to continue as the number "2-5", two secondary buttons (stage list, dress-up), a coin counter "1,480", a star counter "43", a settings gear. The logo is the only text allowed: the words "BLOCK LABYRINTH" in chunky rounded hand-lettered cream letters with a brown outline.',
    a: 'Direction A, "a resting place": a calm storybook scene fills the whole screen. The fox sits by a small pile of stones in a ruined labyrinth courtyard at dusk, its glowing tail the main light source, fireflies and soft light rays, vines and old banners. The logo is carved on a wooden signboard hanging from the top with vines. The big honey-yellow play button sits low within thumb reach, the two secondary buttons are small round icon buttons beside it. Counters are small pills at the top.',
    b: 'Direction B, "the road to the heart": a tall vertical composition seen from below. A winding stone path climbs from the bottom of the screen up through eight small distinct dungeon gates (ruins, mine, ice cave, library, gear fortress, lava cave, twin temple, crystal heart) towards a dim cracked heart-shaped crystal far at the top. The first gate is lit warm gold, the others are dark and desaturated. The fox stands small at the bottom on the path looking up, tail glowing. Logo in the upper third over the dark sky, play button at the bottom, two small secondary buttons under it.',
    c: 'Direction C, "character poster": very simple and graphic like a messenger emoticon poster. A flat dusky plum background with a few large soft rounded shapes and a simple arch. The fox is drawn very large, filling the middle of the screen, leaning forward pushing a wooden crate with effort, tail glowing. Big friendly logo at the top. At the bottom a floating rounded bottom bar with three items: stage list icon, a large raised round play button in the centre, dress-up icon. Very little decoration, lots of calm empty space.',
  },
  story: {
    what: 'Screen: one page of the INTRO STORY (page 1 of 3). The picture shows a huge glowing golden heart-shaped crystal in the deepest hall of the labyrinth lighting every corridor. It needs: the story picture, a place for two lines of caption (leave it as an empty caption area with two soft placeholder lines), three page dots with the first one lit, a "next" button with an arrow icon, a small skip button with a double-arrow icon in the top corner.',
    a: 'Direction A, "full-bleed picture": the illustration fills the entire screen from top to bottom. The lower third fades into a dark soft gradient holding a cream parchment caption band, the page dots and a round arrow button at the bottom right.',
    b: 'Direction B, "picture book": the screen looks like an open storybook page lying on a dark wooden table. The page is warm cream paper with slightly worn edges; the illustration sits in the upper two thirds with a hand-drawn rounded border and little vine corner ornaments, the caption area below it on the paper, a ribbon bookmark, the page dots as small ink dots, and a paper-tab "next" button at the bottom edge of the page.',
    c: 'Direction C, "three panels": the whole three-page story is laid out on one screen as three stacked comic panels with rounded corners and thick brown borders: (1) the glowing heart crystal lighting the labyrinth, (2) the heart cracking and the halls going dark while one shard of light falls, (3) the shard landing on the tail tip of the surprised baby fox. The first panel is bright and in focus, the other two are dimmed as if not yet revealed. A caption band under the first panel, a round arrow button at the bottom.',
  },
  select: {
    what: 'Screen: the STAGE SELECT screen. The game has 8 dungeons with 12 stages each. Dungeon 1 "ruins" is finished (all 12 stages cleared, most with 3 stars, lit and bright), dungeon 2 "abandoned mine" is in progress (stages 1 to 4 cleared, stage 5 is the current one, 6 to 12 open but not cleared), dungeons 3 to 8 are locked and dark. It needs: a back button, the coin counter "1,480", a dress-up button with a gem icon, a settings gear, the total star counter "43", stage numbers 1 to 12, up to three small stars under each cleared stage.',
    a: 'Direction A, "winding map": a vertical saga-style map that scrolls. A stone path winds up the screen through an illustrated landscape; each stage is a round stepping-stone node with its number and tiny stars. The lower part is the bright warm ruins zone with all nodes gold, above it the teal mine zone where the fox stands on node 5 with a soft glow ring, and at the very top the next zone fading into darkness with lock icons. A small dungeon emblem badge marks where each zone begins. Top bar floats over the map.',
    b: 'Direction B, "dungeon cards": one dungeon at a time as a large swipeable card. The top half of the card is a wide illustrated scene of the abandoned mine with its emblem and a star counter "11/36"; the lower half is a neat 4 by 3 grid of rounded stage tiles numbered 1 to 12 (1 to 4 cleared in gold with stars, 5 highlighted as current with the tiny fox head on it, the rest plain). The edges of the previous bright ruins card and the next dark locked card peek in from the left and right. Eight page dots under the card, the first lit gold, the second active.',
    c: 'Direction C, "descending tower": a cross-section of the labyrinth as a vertical stack of eight floors going down into the earth, like a dollhouse cut open. Each floor is a wide strip with its own colour and mood and a row of 12 small arched doorways for the stages. The top floor (ruins) is fully lit and warm, the second floor (mine) is half lit with the fox standing at doorway 5, the floors below are dark silhouettes with a lock. A dim heart crystal sits at the very bottom. Floor number badges 1 to 8 on the left edge.',
  },
  play: {
    what: 'Screen: the PLAY screen, the puzzle itself. A 6 by 6 top-down grid board must be the clear focus and fully readable: stone wall blocks, three wooden crates, three teal metal blocks marked with a double-headed arrow, floor tiles with glowing orange one-way arrows, a glowing green-gold star exit tile, and the fox on one tile. Keep the grid square, crisp and uncluttered. It needs: a back button, the stage number "2-5", the move counter "4", three stars with the limit "16", a skip button with a double-arrow icon, and three bottom buttons: undo, restart, and a yellow hint button with a light bulb and a small red "AD" badge.',
    a: 'Direction A, "inside the dungeon": the board sits in an illustrated mine-tunnel environment. Timber beams, lanterns, rails and rock frame the board on all sides like a stage set seen from above, and the board frame is made of wooden planks. The top HUD is a hanging wooden plank holding the stage number, moves and stars. The three bottom buttons are large round stone buttons on a rock ledge.',
    b: 'Direction B, "clean and calm": minimal. A flat soft dusky teal background with a very faint pattern. The board is as large as the screen width allows with a thin rounded cream frame. The HUD is two small pills at the top. Under the board, a slim progress bar shows the moves used with three star markers along it. The three bottom actions are simple round icon-only buttons with generous spacing. No scenery at all.',
    c: 'Direction C, "one-hand with a companion": the board is placed in the lower two thirds for thumb reach. The upper third is a cosy header panel: on the left a round portrait bubble of the fox reacting (straining face with a sweat drop), next to it a stage banner with "2-5", the move counter and three stars. The three action buttons are arranged in a gentle arc at the bottom right corner, the hint button the largest.',
  },
  clear: {
    what: 'Screen: the STAGE CLEAR result. It needs: a celebratory headline (the single word "CLEAR!" is the only text allowed), the happy fox, three earned stars, moves used "16" and best possible "16", gold earned "+90" with a coin, a secondary button to double the reward by watching an ad (red "AD" badge and "x2"), a large primary next-stage button with an arrow icon, and three small buttons: replay, stage list, home. Soft confetti.',
    a: 'Direction A, "the light returns": no card or panel. The whole screen is one celebration scene: the mine tunnel behind flooding with warm golden light, the fox mid-jump in the centre with a huge smile, ears up and tail blazing, three big stars in an arc above it, a red ribbon headline at the top. The numbers sit in a small translucent strip under the fox and the buttons are at the bottom.',
    b: 'Direction B, "bottom sheet": the solved puzzle board stays visible and softly dimmed in the upper half of the screen with the fox on the exit tile. A rounded cream-and-plum sheet slides up from the bottom covering the lower 55 percent: the three stars overlap its top edge, then a compact row with moves and gold, the ad-double button, the big yellow next button, and three small icon buttons in a row.',
    c: 'Direction C, "postcard": the result is a cream postcard or scrapbook page slightly tilted on a dark plum background. A polaroid-style picture of the smiling fox is taped at the top, the three stars are ink stamps, the gold reward is a small glass jar of coins with "+90", moves are written on a ticket stub "16 / 16". Washi-tape and paper textures, hand-made feel. The buttons sit below the card.',
  },
  cosmetics: {
    what: 'Screen: the DRESS-UP and treasure-draw screen. The player spends coins to open a treasure chest and collect 22 outfits for the fox (examples: wizard hat and cape, knight helmet, mushroom cap, ghost sheet, dragon hoodie, crown) and 8 footprint trails. Only the default fox is owned; the rest are shown as dark silhouettes. It needs: a back button, the coin counter "1,480", the treasure chest, a draw-once button with a coin and "130", a draw-ten button with "x10" and "1300", a free draw button with a red "AD" badge, two tabs (outfits with a hanger icon, trails with a paw-print icon), and the collection of items with the equipped one marked by a check.',
    a: 'Direction A, "dressing room": the upper 45 percent is a cosy little dressing room with a round rug, a mirror and a clothes rack, where the fox stands large and centred as a live preview. Under it a horizontally scrolling row of round outfit thumbnails, the selected one bigger with a check mark, the locked ones as silhouettes. The treasure chest sits small at the bottom with the two draw buttons beside it.',
    b: 'Direction B, "treasure room": the chest is the star. The upper half is a treasure vault scene with the big wooden-and-gold chest on a stone pedestal glowing through its seam, coins and gems around, the fox peeking excitedly from the side. Two large draw buttons right under it and the smaller AD free-draw button. The collection is a compact shelf strip at the bottom with a count badge "1/30".',
    c: 'Direction C, "sticker album": the screen is an open sticker album on cream paper. Tab bookmarks stick out of the top edge. The page is a 4-column grid of rounded sticker slots: the default fox sticker is in colour with a little check ribbon, the others are dotted outlines with a faint silhouette. A progress ribbon "1/30" at the top of the page. A wide draw bar is pinned to the bottom with a small chest icon, "130" and "x10 1300".',
  },
};

function run(name) {
  return new Promise((resolve) => {
    const [screen, variant] = name.split('_');
    const file = `${OUT}/${name}.png`;
    if (existsSync(file)) return resolve({ name, status: 'skip' });
    const s = SCREENS[screen];
    const prompt =
      `Use $imagegen to generate exactly one image, then save it as ${file} in this workspace. ` +
      `Do not overwrite any existing file and do not create or edit any other file.\n\nImage: ${GAME}\n${s.what}\n${s[variant]}\n${STYLE}\n\n` +
      `Do not draw the image with code, PIL, SVG or any procedural method. If the image generation tool is unavailable or fails, say so and stop without creating a file.`;
    const args = ['exec', '--sandbox', 'workspace-write', '--skip-git-repo-check', '--json', '-i', FOX, '-i', `${OUT}/current/${screen}.png`, '-'];
    const child = spawn('codex', args, { shell: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', () => {});
    child.stdin.end(prompt);
    const timer = setTimeout(() => child.kill(), 10 * 60 * 1000);
    child.on('close', () => {
      clearTimeout(timer);
      writeFileSync(`${logDir}/screen_${name}.jsonl`, out);
      resolve({ name, status: existsSync(file) ? 'ok' : 'fail' });
    });
  });
}

const queue = Object.keys(SCREENS)
  .flatMap((s) => ['a', 'b', 'c'].map((v) => `${s}_${v}`))
  .filter((n) => !only || only.has(n));
async function worker() {
  for (;;) {
    const name = queue.shift();
    if (!name) return;
    const r = await run(name);
    console.log(`${r.status.padEnd(4)} ${r.name}`);
  }
}
await Promise.all(Array.from({ length: parallel }, worker));
