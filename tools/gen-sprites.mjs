// Codex CLI의 이미지 생성으로 게임 그림을 만든다. 이미 있는 파일은 건너뛴다.
// 사용: node tools/gen-sprites.mjs [로그 폴더] [동시 실행 수] [키 필터(쉼표)]
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';

const DIR = 'art/source'; // 원본. tools/build-sprites.mjs가 게임용 크기로 줄인다
const REF = 'art/concepts/r2_fox.png'; // 화풍의 기준: 주인공 시안. 모든 그림을 이 그림과 같은 세계로 그린다
const logDir = process.argv[2] ?? 'gen-logs';
const parallel = Number(process.argv[3] ?? 2);
const only = process.argv[4] ? new Set(process.argv[4].split(',')) : null;
mkdirSync(logDir, { recursive: true });

const STYLE =
  'Style: soft matte 2D storybook game art that belongs in the same world as the attached character sheet: clean rounded shapes, a soft thick warm-brown outline, flat pastel colours with very gentle shading, cozy and cute. NOT glossy, NOT 3D rendered, no specular highlights, no photo texture. Viewed from directly above, with a slightly darker front face along the bottom so blocks look solid. ' +
  'Square 1:1 image. No text, letters, numbers, logo, watermark, frame, cast shadow on the ground, or cropping.';
const SPRITE = 'Transparent background. The object is centered and fills about 87% of the frame with an even margin on all sides.';
const BLOB =
  'A cute chunky rounded-square blob character for a puzzle game, standing, viewed from the front, with two big simple white eyes with dark pupils looking forward and no mouth. ' +
  'It has two short stubby little arms at its sides and two short stubby little legs with small rounded feet, clearly visible. ' +
  'Transparent background. The whole character including arms, legs and any hat is centered and fills about 84% of the frame, with nothing cut off.';
const UI = 'Soft matte 2D storybook game art in the same style as the attached character sheet (rounded shapes, a soft thick warm-brown outline, flat pastel colours, very gentle shading, not glossy, not 3D rendered). No text, letters, numbers, logo, watermark, or frame.';
const ICON = `Transparent background, centered, fills about 88% of the frame, fully visible with nothing cut off. Square 1:1. ${UI}`;

const KIT = 'Game UI kit element for a cozy storybook puzzle game: soft, rounded and matte, flat pastel colours with a thick warm-brown outline, like felt, paper and painted wood cut-outs. Not glossy, no shiny bevel, no metal reflections.';
const FLAT = `Flat straight-on front view, perfectly symmetrical, straight not tilted, no perspective. Transparent background, centered, fills about 92% of the frame, nothing cut off. ${UI}`;

// 던전마다의 디오라마 그림(사용자 선택, 시안 art/concepts/screens/tone_c.png): 두께가 있는 판, 통통한 벽, 바닥, 배경.
// [바닥, 벽, 판의 테두리와 아래 단면, 배경]
const DIORAMA = [
  ['warm light sand-beige flagstone with a very faint speckled texture', 'rounded grey-lavender cobblestones fitted together, with a small tuft of moss', 'a rounded cream sandstone rim with little grass tufts and tiny white flowers growing over its edge; the cross-section shows layers of brown earth, roots and embedded round stones', 'a soft dusk sky fading from lavender to peach with a low sun, a few small distant floating islands carrying broken stone ruins, pink clouds, and a green meadow with ruin stones along the bottom edge'],
  ['packed warm tan earth with a few tiny pebbles', 'a rough brown rock chunk braced with honey-coloured timber beams, with two small teal ore crystals', 'a rim of honey-coloured wooden planks with iron corner caps; the cross-section shows dark earth with teal ore crystals, timber supports and one small hanging lantern', 'a deep teal mine cavern at dusk with small floating rock islands carrying bits of rail track and mine carts, warm lantern lights, and dark rocks with teal crystals along the bottom edge'],
  ['muted slate-periwinkle stone dusted with a little snow at the corners', 'a blue-grey boulder with a thick soft cap of snow', 'a rounded rim of packed snow; the cross-section shows pale blue ice with icicles hanging from the underside', 'a deep blue winter night sky with a soft green-teal aurora, small floating icebergs, gentle snowfall, and snowdrifts with blue ice crystals along the bottom edge'],
  ['warm honey-brown wooden parquet planks', 'a neat stack of big old books in plum, teal and ochre with cream page edges, a ribbon bookmark hanging over the front', 'a rim of dark carved walnut wood with small brass corners; the cross-section shows a bookshelf packed with colourful old books and one small candle', 'a dusky plum library hall with tall shadowy bookshelves, a few floating open books and candles, soft violet magic sparkles, and stacks of books along the bottom edge'],
  ['muted olive-brass metal plating with four small rivets near the corners', 'a riveted brass-and-stone block with a small cog emblem on top', 'a rim of brass plating with rivets; the cross-section shows interlocking brass gears and copper pipes with a small pressure gauge', 'a bronze-olive dusk inside a clockwork fortress with huge soft gear silhouettes, small floating platforms with gears and pipes, warm lamp lights, and brass machinery along the bottom edge'],
  ['warm terracotta-brown volcanic stone, smooth, with NO cracks', 'rounded black obsidian boulders with an ash-grey top, with NO glowing cracks', 'a rim of dark basalt stone; the cross-section shows dark rock with soft orange lava glowing between the layers and two lava drips', 'a deep maroon volcanic cavern with soft glowing lava falls in the distance, small floating basalt rocks, drifting embers, and dark rocks with an orange glow along the bottom edge'],
  ['pale dusty-rose marble with very faint veins', 'a plain white marble pillar block with soft grey veins and one thin rose-gold band around it, with NO emblem, symbol or rings on top (the pink twin blocks of this dungeon carry the ring symbol, so walls must not)', 'a rim of white marble with rose-pink inlay; the cross-section shows carved marble arches with two little pink banners hanging down', 'a mauve-pink dusk sky with two identical small floating marble temples facing each other, pink clouds, and marble steps with rose bushes along the bottom edge'],
  ['dusky lavender stone inlaid with very thin faint gold lines', 'a cluster of rounded violet amethyst crystals on a dark stone base, softly glowing', 'a rim of dark violet stone with a thin gold trim; the cross-section shows glowing amethyst crystals growing downward', 'a deep indigo starry void with one large dim heart-shaped golden crystal far in the distance, floating crystal shards, and dark violet crystals along the bottom edge'],
];
const TONE_REF = ['art/concepts/screens/tone_c.png'];
const TONE = 'Two reference images are attached; the SECOND is a mockup of a puzzle board drawn as a little hand-made toy diorama. Match its look exactly: soft matte 2D, chunky rounded shapes with a soft thick warm-brown outline, pastel colours, very gentle shading, not glossy, not 3D rendered. No text, letters, numbers, logo or watermark.';
const DIORAMA_ASSETS = DIORAMA.flatMap(([floor, wall, board, bg], i) => [
  [`floor_${i + 1}`, `${TONE} Draw ONE empty floor tile for that kind of board, viewed from directly above: ${floor}. Calm and plain so that game pieces placed on it stay easy to see: no outline, no border, no seam at the edges, no objects. It fills the ENTIRE frame edge to edge, fully opaque, no margin, no rounded corners. Square 1:1.`, true, TONE_REF],
  [`wall_${i + 1}`, `${TONE} Draw ONE wall block for that kind of board, viewed from above like the wall blocks in the mockup: a chunky rounded-corner square block, ${wall}. It has a lighter top face and a clearly darker front face along its bottom quarter so it looks thick and solid, like a toy block. Transparent background, centered, fills about 96% of the frame, nothing cut off. Square 1:1.`, true, TONE_REF],
  [`board_${i + 1}`, `${TONE} Draw ONLY the empty slab that the board of the mockup sits on, with nothing on it, viewed from above exactly like in the mockup: a thick square slab with rounded corners. Its top is a large plain flat EMPTY square surface in one calm colour (no grid lines, no tiles, no objects, no characters), surrounded by a narrow raised border about 6 percent of the width: ${board}. The cross-section is the front side of the slab, visible only along the bottom, about one seventh of the total height, with an irregular rounded lower edge. Transparent background, centered, fills about 94% of the frame, nothing cut off.`, true, TONE_REF],
  [`bg_${i + 1}`, `${TONE} Draw ONLY a background for the screen in the mockup, with no board and no interface: ${bg}. The whole middle of the picture is calm, empty and low in contrast so that a game board and buttons can be placed over it; the details stay near the top and bottom edges. No characters, no buttons, no icons. Tall portrait 9:16, fully opaque, fills the whole frame.`, true, TONE_REF],
]);

// 던전 이야기 장면(사용자 선택 B "그림책 장면", 시안 art/concepts/progress.html): 던전마다 네 장.
// 1 도착(처음부터 보임), 2 길을 내다(4단계), 3 누군가를 만나다(8단계), 4 빛이 돌아오다(12단계). 글은 src/data/stories.ts.
// 던전마다 그곳에 사는 친구가 하나 있고 3장과 4장에 나온다. 두 장에서 같은 모습이 되도록 생김새를 똑같이 적는다.
const FRIENDS = [
  'the keeper of the ruins, a small round moss-covered sandstone golem with two dot eyes, about as tall as the fox',
  'a little chubby brown mole miner wearing a tiny dented brass helmet with a lamp on it and a red neckerchief, about as tall as the fox',
  'a small fluffy snow-white hare with round black eyes and a pale blue knitted scarf, about as tall as the fox',
  'an old round grey-brown owl librarian with tiny round gold glasses and a plum-coloured ribbon bookmark around its neck, a little taller than the fox',
  'a small wind-up tin soldier robot painted teal and brass, with a big golden wind-up key on its back and two round lamp eyes, about as tall as the fox',
  'a baby ember salamander, a chubby little coral-red lizard with a small flame at the tip of its tail and big dark eyes, about as big as the fox',
  'two identical little white lambs, twins, each with a rose-pink ribbon and a tiny golden bell, each about as tall as the fox',
  'all the friends the fox met on the way, small in the scene: a round moss-covered stone golem, a mole with a brass helmet lamp, a white hare with a blue scarf, an owl with gold glasses, a teal tin wind-up robot, a coral-red salamander with a flame tail, and two white lambs with pink ribbons',
];
const SCENES = [
  null, // 1번 던전은 시안에서 그린 그림(art/concepts/screens/prog_b1~4)을 그대로 쓴다
  [
    'the little fox stands at the dark mouth of an abandoned mine tunnel at night; rusty rails lead inside past timber beams, an empty mine cart sits tipped over, unlit lanterns hang from the beams, and dull grey crystals stick out of the rock. Its glowing tail is the only light',
    'the little fox pushes a wooden crate along the rails deep in the mine tunnel, straining with effort; arrow signs painted on planks all point one way; the crystals nearest to its glowing tail have begun to glow teal and one hanging lantern has flickered on',
    'the little fox finds FRIEND sitting sadly in the dark beside a pile of ore, holding its helmet whose lamp has gone out. The fox holds its glowing tail tip up to the lamp, which is just catching light. Teal crystals glow softly around them',
    'the mine is bright again: every lantern lit, teal and golden crystals glowing all along the tunnel, mine carts full of sparkling ore. FRIEND, its helmet lamp shining, waves goodbye happily as the little fox walks toward the tunnel exit, beyond which pale blue ice and snow can be seen',
  ],
  [
    'the little fox stands at the entrance of a dark frozen cavern, its breath a small cloud; huge dull icicles hang down, the floor is a sheet of dark ice, snow drifts lie at the sides. Its glowing tail is the only warm light and reflects in the ice',
    'the little fox slides across a frozen pond on its bottom with a surprised face, a block of ice sliding ahead of it; behind it a trail of ice has started to glitter pale blue where the tail light touched',
    'the little fox finds FRIEND curled up and shivering in a small hollow of snow under icicles. The fox wraps its warm glowing tail around it; the hare opens one eye. The ice around them glows soft gold and blue',
    'the cavern sparkles: ice crystals glow in blue and gold, a green aurora shines through a crack in the ceiling, soft snow falls. FRIEND stands on a snow mound pointing with one paw toward a tall carved wooden library door set in the ice at the far end, while the little fox looks at it',
  ],
  [
    'the little fox stands in the doorway of a vast dark library at night; tall shelves disappear into shadow, books lie fallen in heaps, candles are unlit and cobwebbed. A faint dull magic circle is drawn on the floor. Its glowing tail is the only light',
    'the little fox has just stepped onto a magic circle that glows violet and is popping out of a second glowing circle across the room, looking surprised, while open books float gently in the air around it and a few candles have lit themselves',
    'the little fox finds FRIEND fast asleep on top of a tall pile of books, glasses crooked. The fox stands on tiptoe on a lower book and the glow of its tail lights the owl, who opens one eye. Candles glow warmly around them',
    'the library is alive again: hundreds of candles lit, books flying back to their shelves, warm red and plum tones. FRIEND holds open a huge old book whose pages show a drawing of gears and a fortress, showing it to the little fox, who looks at it with interest',
  ],
  [
    'the little fox stands before the gate of a silent clockwork fortress at dusk; enormous brass gears stand still and dusty, pipes are cold, lamps are dark, an iron portcullis is shut. Its glowing tail is the only light and glints on the brass',
    'the little fox pushes a wooden crate onto a round brass floor switch; beside it a heavy iron portcullis is rising, and behind it one big gear has begun to turn with a few sparks. Two lamps have come on',
    'the little fox finds FRIEND standing frozen in a corner, wound down, covered in dust, lamp eyes dark. The fox reaches up and turns the wind-up key on its back with both front paws; the robot eyes are just starting to glow',
    'the fortress hums: every gear turning, steam puffing from pipes, all lamps warm and bright. FRIEND salutes proudly beside a great open gate, through which a red-orange volcanic glow can be seen, as the little fox trots toward it',
  ],
  [
    'the little fox stands at the edge of a dark volcanic cavern; the lava has cooled to dull black rock with only thin dim red lines, the stone path ahead is cracked and thin, ash drifts in the air. Its glowing tail is the only bright light',
    'the little fox leaps across a narrow path of cracked basalt slabs that crumble and fall away behind it into the dark, its ears flying; where it has passed, the lava below has begun to glow orange again',
    'the little fox finds FRIEND curled up on a cold rock, its tail flame gone out, looking small and sleepy. The fox touches its glowing tail tip to the salamander tail tip, where a tiny flame is just lighting. Warm orange light spreads around them',
    'the cavern glows warm and friendly: soft orange lava rivers, floating embers like fireflies, no danger. FRIEND, its tail flame bright, walks ahead lighting the way up a path toward white marble stairs high above, and the little fox follows',
  ],
  [
    'the little fox stands at the entrance of a silent temple of white marble at dusk; the hall is perfectly mirrored left and right, but its two tall statues have turned their backs to each other, the rose-pink banners hang faded and the lamps are dark. Its glowing tail is the only light',
    'the little fox pushes a rose-pink crystal block marked with two linked rings; on the opposite, mirrored side of the hall an identical pink block slides by itself in exactly the same direction. The fox looks back at it in surprise. A few lamps glow',
    'the little fox finds FRIEND, one lamb on the left side of the hall and one on the right, separated by a low marble wall, each calling to the other. The fox stands in the middle with its glowing tail raised, showing them the way around. Soft pink light',
    'the temple is whole again: the two statues face each other, banners bright rose-pink, lamps and soft light everywhere. FRIEND stand side by side, bells shining, in front of a huge door they have opened together, from which a deep violet starry light pours out, as the little fox looks up at it',
  ],
  [
    'the little fox stands at the edge of a vast dark chamber, the heart of the labyrinth: far away on a round stone dais floats a huge heart-shaped crystal, cracked and almost dark, with one piece missing; violet crystals jut from the walls, shards float in the air. Its glowing tail is the brightest light',
    'the little fox climbs toward the dais across floating stone steps, pushing a small glowing block ahead of it; far behind and below, tiny warm lights of many colours shine in the dark like distant lanterns. The cracked heart crystal looms above, a little brighter',
    'the little fox stands on the dais right below the huge cracked heart crystal and lifts its tail up to the missing piece; the golden crystal from its tail tip is floating upward out of its fur toward the gap, and the fox watches it go with wide eyes. Golden light pours from the cracks',
    'the heart crystal is whole and blazing golden, lighting the whole labyrinth with rays of warm light. On the dais the little fox is surrounded by FRIEND, all cheering. A small new golden spark still glows on the tip of the fox tail',
  ],
];
const PLACES = ['', 'mine tunnel', 'ice cavern', 'library', 'clockwork fortress', 'volcanic cavern', 'marble temple', 'chamber of the heart crystal'];
const SCENE_ASSETS = SCENES.flatMap((pages, i) =>
  !pages
    ? []
    : pages.map((text, k) => [
        `scene_${i + 1}_${k + 1}`,
        `A story picture for a cozy mobile puzzle game in which a baby fennec fox with a glowing golden crystal on its tail tip brings the light back to a dark labyrinth. Two reference images are attached. The FIRST is the character design sheet: draw the fox exactly like that, small in the scene. The SECOND shows this place, the ${PLACES[i]}, as it looks when all its light has returned: use it for the look of the place and for the painting style. Scene: ${text.replace(/FRIEND/g, FRIENDS[i])}. Soft matte 2D storybook illustration with rounded shapes and soft warm-brown outlines, warm and gentle, never scary. NOT glossy, NOT 3D rendered, NOT realistic. Landscape picture, 5:4, fully opaque, fills the whole frame. No text, no letters, no numbers, no logo, no watermark, no border, no interface elements.`,
        true,
        [`art/source/ui_scene_${i + 1}.png`],
      ]),
);

const ASSETS = [
  ...DIORAMA_ASSETS,
  ...SCENE_ASSETS,
  // 출구 위에 떠서 도는 별. 두께가 있어 옆에서 보면 납작한 원반처럼 보인다
  // 별이 떠 있는 출구의 받침. 별은 따로 그리므로 받침에는 별을 그리지 않는다
  ['exit_pad', `${TONE} Draw ONE exit pad for that kind of board, viewed from above like the blocks in the mockup: a low chunky rounded-corner square stone pedestal in deep moss green with a slightly darker front face along its bottom edge, and on its top a round shallow dish with a ring of eight small pale-gold dots around an empty softly glowing pale-yellow centre. There is NO star on it. Transparent background, centered, fills about 96% of the frame, nothing cut off. Square 1:1.`, true, TONE_REF],
  ['exit_star', `${TONE} Draw ONE chunky golden five-pointed star, like a puffy toy star cut from thick felt: rounded points, a warm honey-gold face with a slightly lighter centre, and a soft thick warm-brown outline. Seen straight from the front, perfectly symmetrical, not tilted. Transparent background, centered, fills about 90% of the frame, nothing cut off. Square 1:1.`, true, TONE_REF],
  ['floor', `Two reference images are attached; the SECOND is a mockup of a puzzle board. Draw ONE empty floor tile exactly like the plain sand-coloured floor tiles of that board, viewed from directly above: a flat warm light sand-beige square with only a very faint speckled paper-like texture, no outline, no seam, no shading at the edges, no cracks, completely flat. It fills the ENTIRE frame edge to edge, fully opaque, no margin, no rounded corners. Square 1:1. ${UI}`, true, ['art/concepts/screens/play_b.png']],
  ['wall', `Two reference images are attached; the SECOND is a mockup of a puzzle board. Draw ONE stone wall block exactly like the grey cobblestone blocks of that board, viewed from directly above: a rounded-corner square made of four or five large rounded grey cobblestones fitted together, soft dark grey outline, flat matte, slightly darker along the bottom edge. Transparent background, centered, fills about 96% of the frame, nothing cut off. Square 1:1. ${UI}`, true, ['art/concepts/screens/play_b.png']],
  ['block_normal', `A square wooden crate for a top-down block-pushing puzzle, like the crate in the attached sheet: warm honey-brown planks with a simple X brace on top and small rounded corner caps. ${SPRITE}`],
  ['block_fixed', `A heavy immovable dark charcoal stone block, plain, with no markings or symbols. ${SPRITE}`],
  ['block_railH', `A teal-green metal block with one bold white double-headed arrow engraved on top, pointing exactly left and right (horizontal). ${SPRITE}`],
  ['block_ice', `A soft matte translucent sky-blue ice cube block with frosty white highlights and a small snowflake facet on top. ${SPRITE}`],
  ['block_count', `A coral-red fired-clay block with a smooth, empty, slightly recessed square plate in the center (the plate is blank: no symbol, no number). ${SPRITE}`],
  ['exit', `Two reference images are attached; the SECOND is a mockup of a puzzle board. Draw the exit tile exactly like the green star tile of that board, viewed from directly above: a flat deep moss-green rounded-corner square with one chunky golden five-pointed star in the centre and a few short pale-yellow sparkle dashes around the star. Transparent background outside the rounded square, centered, fills about 94% of the frame, nothing cut off. Square 1:1. ${UI}`, true, ['art/concepts/screens/play_b.png']],
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
  ['skin_slime', `${BLOB} Character: a soft matte green dungeon slime blob, slightly translucent and jiggly.`],
  ['skin_mushroom', `${BLOB} Character: a cave mushroom blob with a red cap with white spots on its head.`],
  ['skin_mummy', `${BLOB} Character: a mummy blob wrapped in pale linen bandages with one loose strip.`],
  ['skin_goblin', `${BLOB} Character: a green goblin blob with long pointed ears and a small leather vest.`],
  ['skin_dragon', `${BLOB} Character: a red baby dragon blob with small horns, tiny wings and a little tail.`],
  ['skin_phoenix', `${BLOB} Character: a legendary phoenix blob made of bright orange and gold flame feathers with a glowing crest, radiant.`],
  // 던전 기믹 타일
  ['tile_pit', `A square pit trap in a dungeon stone floor, viewed from directly above: a deep dark hole with a chipped stone rim around it. Fills the ENTIRE frame edge to edge, fully opaque, no margin. ${UI}`, true],
  ['tile_oneway', `Two reference images are attached; the SECOND is a mockup of a puzzle board. Draw ONE one-way floor tile exactly like the orange arrow tiles of that board, viewed from directly above: a flat warm orange rounded-corner square with a slightly darker orange rim and one bold soft-glowing pale yellow arrow in the centre pointing straight UP. Transparent background outside the rounded square, centered, fills about 94% of the frame, nothing cut off. Square 1:1. ${UI}`, true, ['art/concepts/screens/play_b.png']],
  ['tile_ice', `A square slippery frozen floor tile, viewed from directly above: soft matte pale blue ice with subtle cracks and white shine streaks, flat. Fills the ENTIRE frame edge to edge, fully opaque, no margin. ${UI}`, true],
  ['tile_portal', `A glowing magic teleport circle seen from directly above: a swirling violet-blue vortex inside a bright ring of light. No letters or runes. ${ICON}`, true],
  ['ui_chest_closed', `Two reference images are attached; the SECOND is a mockup of a dress-up screen with a small treasure chest at the bottom left. Draw ONLY that chest, exactly as it looks there: a rounded treasure chest covered in teal patterned fabric with golden bands and corners and a golden fox-head emblem as its clasp, closed, viewed from the front at a slight angle. No flowers, no cloth under it. Transparent background, centered, fills about 87% of the frame, nothing cut off. Square 1:1. ${UI}`, true, ['art/concepts/screens/cosmetics_a.png']],
  ['ui_chest_open', `Two reference images are attached; the SECOND is a mockup of a dress-up screen with a small treasure chest at the bottom left. Draw that same chest (teal patterned fabric, golden bands and corners, golden fox-head emblem clasp) but with its lid wide OPEN and bright warm white-gold light glowing from inside, viewed from the front at a slight angle. No flowers, no cloth under it. Transparent background, centered, fills about 87% of the frame, nothing cut off. Square 1:1. ${UI}`, true, ['art/concepts/screens/cosmetics_a.png']],
  // UI와 이펙트. raw는 공통 화풍 문구 대신 UI 문구를 붙인다.
  ['ui_bg', `A dark, moody background for a mobile puzzle game menu: an ancient labyrinth stone wall with large worn blocks, faint carved maze lines, soft vignette, darker toward the bottom. Neutral desaturated grey, low contrast, no focal object, nothing bright. Portrait orientation 2:3, fully opaque, fills the whole frame. ${UI}`, true],
  ['ui_title_art', `Key art for a cozy mobile puzzle game: inside an old stone labyrinth in warm evening light, the baby fennec fox from the attached character sheet pushes a wooden crate toward a softly glowing golden star seal on the floor, its fluffy tail tip glowing like a golden crystal flame. Square. ${UI}`, true],
  ['ui_star', `A single chunky soft matte golden five-pointed star game icon with a darker gold rim and a soft highlight, front view. ${ICON}`, true],
  ['ui_coin', `A single soft matte gold coin game icon with a simple embossed star in the middle, front view. ${ICON}`, true],
  ['ui_lock', `A single chunky golden padlock game icon, closed, front view. ${ICON}`, true],
  ['icon_undo', `A single chunky cream-white curved arrow game icon pointing back to the left (an undo arrow), thick rounded shape with a soft dark outline. ${ICON}`, true],
  ['icon_restart', `A single chunky cream-white circular arrow game icon (a restart / refresh symbol), thick rounded shape with a soft dark outline. ${ICON}`, true],
  ['icon_hint', `A single chunky glowing yellow light bulb game icon with a soft dark outline. ${ICON}`, true],
  ['ui_hand', `A single cartoon white-gloved pointing hand game icon, index finger pointing up and slightly left, soft dark outline (a tutorial pointer). ${ICON}`, true],
  ['emblem_1', `A round stone medallion game emblem showing an arched labyrinth doorway with warm torch light. ${ICON}`, true],
  ['emblem_2', `A round teal metal medallion game emblem showing a double-headed arrow on rails. ${ICON}`, true],
  ['emblem_3', `A round frosty blue ice medallion game emblem showing a snowflake. ${ICON}`, true],
  ['emblem_4', `A round coral-red clay medallion game emblem showing three engraved dots like a dice face. ${ICON}`, true],
  ['emblem_8', `A round purple crystal medallion game emblem showing a glowing maze spiral with a heart-shaped gem in the center. ${ICON}`, true],
  ['fx_dust', `A single soft puff of beige dust cloud, cartoon game effect sprite, fluffy rounded shapes. ${ICON}`, true],
  ['fx_spark', `A single bright four-pointed star sparkle glow, white core fading to warm gold, game VFX texture for additive blending. Pure black background (#000000), the glow fades smoothly to black before the edges, centered. Square 1:1. ${UI}`, true],
  ['fx_ring', `A single thin glowing shockwave ring, white-gold, soft outer glow, perfectly circular and centered, empty in the middle, game VFX texture for additive blending. Pure black background (#000000), fades to black before the edges. Square 1:1. ${UI}`, true],
  ['fx_burst', `A radial burst of soft light rays from the center, white core fading to warm gold, game VFX texture for additive blending. Pure black background (#000000), rays fade smoothly to black before the edges, centered. Square 1:1. ${UI}`, true],
  // UI 키트. 글자와 아이콘 없이 빈 판으로 만들고, 게임에서 9-슬라이스로 늘려 쓴다.
  ['ui_btn_gold', `${KIT} A blank wide rounded-rectangle game button: soft matte honey-yellow face, a warm brown outline and a thick darker bottom lip that makes it look raised and pressable. About 3 times wider than tall. Completely empty face. ${FLAT}`, true],
  ['ui_btn_stone', `${KIT} A blank wide rounded-rectangle game button made of dusty plum felt with a thin cream stitched trim line and a thick darker bottom lip that makes it look raised and pressable. About 3 times wider than tall. Completely empty face. ${FLAT}`, true],
  ['ui_btn_square', `${KIT} A blank square game button with rounded corners made of dusty plum felt with a thin cream stitched trim line and a thick darker bottom lip. Completely empty face. ${FLAT}`, true],
  ['ui_panel', `${KIT} A blank square popup panel for a game dialog: a deep cocoa-plum soft felt panel with a smooth empty center, framed by a thick cream border with a stitched line and rounded corners. Completely empty center. ${FLAT}`, true],
  ['ui_frame', `${KIT} A blank square content frame for a game menu section: a dark, slightly translucent-looking slate panel with a smooth empty center and a simple thin bronze border with small corner rivets. Subtle, low contrast, completely empty center. ${FLAT}`, true],
  ['ui_ribbon', `${KIT} A blank horizontal title ribbon banner for a game popup: a wide crimson-red cloth ribbon with folded swallow-tail ends and a thin gold edge, slightly curved. About 4 times wider than tall. Completely empty, no text. ${FLAT}`, true],
  ['ui_stage_open', `${KIT} A blank square level-select tile: a raised dark stone plaque with rounded corners and a glowing amber-gold frame, empty smooth center for a number. ${FLAT}`, true],
  ['ui_stage_cleared', `${KIT} A blank square level-select tile for a completed level: a raised polished gold plaque with rounded corners, bright and shiny, empty smooth center for a number. ${FLAT}`, true],
  ['ui_stage_locked', `${KIT} A blank square level-select tile for a locked level: a dull dark grey stone plaque with rounded corners and an iron frame, wrapped by iron chains across it, empty center. ${FLAT}`, true],
  ['ui_pill', `${KIT} A blank horizontal capsule-shaped counter frame for a game currency display: a dark inset capsule with a gold rim, empty inside. About 3 times wider than tall. ${FLAT}`, true],
  ['ui_card', `${KIT} A blank square inventory slot for a game collection screen: a dark recessed slot with rounded corners and a silver-grey metal rim, completely empty inside. ${FLAT}`, true],
  ['ui_stage_open_1', `${KIT} A blank square level-select tile made of weathered sandstone ruin block with moss and a few small vines, framed by a worn bronze rim. Raised, rounded corners, with an empty smooth darker center area for a number. ${FLAT}`, true],
  ['ui_stage_cleared_1', `${KIT} A blank square level-select tile for a COMPLETED level made of polished sandstone block with a glowing golden sun emblem border and fresh green vines, bright and triumphant. Raised, rounded corners, with an empty smooth center area for a number. ${FLAT}`, true],
  ['ui_banner_1', `A wide panoramic banner illustration for a game level-select header: crumbling ancient sandstone ruins overgrown with vines, broken pillars, warm sunset light. No characters, no text. Darker and calmer toward the left third so that a title can be placed there. About 3 times wider than tall, fully opaque, fills the whole frame edge to edge. ${UI}`, true],
  ['ui_stage_open_2', `${KIT} A blank square level-select tile made of mine-shaft wooden planks bound by a riveted iron frame, a little coal dust. Raised, rounded corners, with an empty smooth darker center area for a number. ${FLAT}`, true],
  ['ui_stage_cleared_2', `${KIT} A blank square level-select tile for a COMPLETED level made of wooden planks in a riveted iron frame overflowing at the edges with shining gold ore nuggets, bright and triumphant. Raised, rounded corners, with an empty smooth center area for a number. ${FLAT}`, true],
  ['ui_banner_2', `A wide panoramic banner illustration for a game level-select header: an abandoned mine tunnel with wooden support beams, minecart rails, hanging lanterns and teal crystals. No characters, no text. Darker and calmer toward the left third so that a title can be placed there. About 3 times wider than tall, fully opaque, fills the whole frame edge to edge. ${UI}`, true],
  ['ui_stage_open_3', `${KIT} A blank square level-select tile made of a block of frosty pale-blue ice with snow on its top edge and small icicles, framed by frozen stone. Raised, rounded corners, with an empty smooth darker center area for a number. ${FLAT}`, true],
  ['ui_stage_cleared_3', `${KIT} A blank square level-select tile for a COMPLETED level made of a block of clear ice glowing from inside with golden light, sparkling snowflakes on the rim, bright and triumphant. Raised, rounded corners, with an empty smooth center area for a number. ${FLAT}`, true],
  ['ui_banner_3', `A wide panoramic banner illustration for a game level-select header: a frozen ice cavern with blue icicles, snow drifts and glowing ice crystals. No characters, no text. Darker and calmer toward the left third so that a title can be placed there. About 3 times wider than tall, fully opaque, fills the whole frame edge to edge. ${UI}`, true],
  ['ui_stage_open_4', `${KIT} A blank square level-select tile made of an old arcane spell-book cover in dark red leather with brass corner caps. Raised, rounded corners, with an empty smooth darker center area for a number. ${FLAT}`, true],
  ['ui_stage_cleared_4', `${KIT} A blank square level-select tile for a COMPLETED level made of an arcane spell-book cover in rich red leather with brass corners and a glowing golden magic circle border, bright and triumphant. Raised, rounded corners, with an empty smooth center area for a number. ${FLAT}`, true],
  ['ui_banner_4', `A wide panoramic banner illustration for a game level-select header: a magical library with tall shelves of old books, floating candles and glowing arcane circles, warm red tones. No characters, no text. Darker and calmer toward the left third so that a title can be placed there. About 3 times wider than tall, fully opaque, fills the whole frame edge to edge. ${UI}`, true],
  ['ui_stage_open_8', `${KIT} A blank square level-select tile made of dark obsidian crystal slab with thin glowing magenta veins, framed by violet crystal shards. Raised, rounded corners, with an empty smooth darker center area for a number. ${FLAT}`, true],
  ['ui_stage_cleared_8', `${KIT} A blank square level-select tile for a COMPLETED level made of obsidian crystal slab blazing with golden-magenta light through its veins, radiant violet crystals around the rim, bright and triumphant. Raised, rounded corners, with an empty smooth center area for a number. ${FLAT}`, true],
  ['ui_banner_8', `A wide panoramic banner illustration for a game level-select header: the heart of a labyrinth: a vast dark chamber with huge violet crystals and a glowing magenta core. No characters, no text. Darker and calmer toward the left third so that a title can be placed there. About 3 times wider than tall, fully opaque, fills the whole frame edge to edge. ${UI}`, true],
  ['ui_stage_open_5', `${KIT} A blank square level-select tile made of riveted brass and copper plates with small gears set into the frame. Raised, rounded corners, with an empty smooth darker center area for a number. ${FLAT}`, true],
  ['ui_stage_cleared_5', `${KIT} A blank square level-select tile for a COMPLETED level made of polished brass plates with spinning golden gears around the rim and a warm glow, bright and triumphant. Raised, rounded corners, with an empty smooth center area for a number. ${FLAT}`, true],
  ['ui_banner_5', `A wide panoramic banner illustration for a game level-select header: a clockwork fortress interior with huge brass gears, copper pipes, steam and iron gates. No characters, no text. Darker and calmer toward the left third so that a title can be placed there. About 3 times wider than tall, fully opaque, fills the whole frame edge to edge. ${UI}`, true],
  ['emblem_5', `A round brass medallion showing interlocking gears and a small lever switch, a game emblem. ${ICON}`, true],
  ['ui_stage_open_6', `${KIT} A blank square level-select tile made of dark volcanic basalt rock with thin glowing orange lava cracks, framed by charred stone. Raised, rounded corners, with an empty smooth darker center area for a number. ${FLAT}`, true],
  ['ui_stage_cleared_6', `${KIT} A blank square level-select tile for a COMPLETED level made of black basalt blazing with bright golden-orange lava light through its cracks, embers around the rim, bright and triumphant. Raised, rounded corners, with an empty smooth center area for a number. ${FLAT}`, true],
  ['ui_banner_6', `A wide panoramic banner illustration for a game level-select header: a volcanic cavern with rivers of lava, cracked stone bridges and glowing embers. No characters, no text. Darker and calmer toward the left third so that a title can be placed there. About 3 times wider than tall, fully opaque, fills the whole frame edge to edge. ${UI}`, true],
  ['emblem_6', `A round dark basalt medallion showing a cracked floor tile with glowing lava in the cracks, a game emblem. ${ICON}`, true],
  ['ui_stage_open_7', `${KIT} A blank square level-select tile made of smooth white marble with rose-pink inlay, framed by two matching carved twin statues heads at the top corners. Raised, rounded corners, with an empty smooth darker center area for a number. ${FLAT}`, true],
  ['ui_stage_cleared_7', `${KIT} A blank square level-select tile for a COMPLETED level made of white marble with a glowing golden and rose-pink inlay of two linked rings, bright and triumphant. Raised, rounded corners, with an empty smooth center area for a number. ${FLAT}`, true],
  ['ui_banner_7', `A wide panoramic banner illustration for a game level-select header: a serene mirrored temple with twin statues facing each other, white marble pillars and rose-pink banners. No characters, no text. Darker and calmer toward the left third so that a title can be placed there. About 3 times wider than tall, fully opaque, fills the whole frame edge to edge. ${UI}`, true],
  ['emblem_7', `A round white marble medallion showing two identical linked rose-pink gems, a game emblem. ${ICON}`, true],
  ['tile_switch', `A square dungeon floor tile, viewed from directly above, with a round brass pressure plate button set into the stone in the center, with a faint glow around it. Fills the ENTIRE frame edge to edge, fully opaque, no margin. ${UI}`, true],
  ['tile_door', `A closed heavy iron portcullis gate blocking a dungeon doorway, viewed from directly above at a slight angle: thick dark iron bars with brass rivets set in a stone frame, clearly impassable. Fills the ENTIRE frame edge to edge, fully opaque, no margin. ${UI}`, true],
  ['tile_crumble', `A square fragile dungeon floor tile, viewed from directly above: cracked thin basalt stone with glowing orange lava light showing through many deep cracks, looking like it will break when stepped on. Fills the ENTIRE frame edge to edge, fully opaque, no margin. ${UI}`, true],
  ['block_link', `A rose-pink crystal block with a bold white symbol of two linked rings on top, glossy, with a thin gold frame. ${SPRITE}\n${STYLE}`, true],
  // 도입 이야기 그림
  ['story_1', `The heart of a great labyrinth, the same view as the picture inside the storybook page of the attached SECOND image: a huge radiant golden heart-shaped crystal floating above a round stone dais in a vast hall of arches, banners, bridges and waterfalls, small golden crystal lights on every post, warm golden light streaming down the central walkway. Peaceful and majestic. There are NO characters or creatures in the picture at all. Square 1:1, fully opaque, fills the whole frame. Painted like the picture inside the storybook page of the attached SECOND image: soft matte storybook illustration, warm and gentle, rich detail, lavender-grey stone and golden light. No text, no letters, no logo, no watermark, no border, no frame.`, true, ['art/concepts/screens/story_b.png']],
  ['story_2', `The same vast labyrinth hall of arches, banners and bridges as in the picture inside the storybook page of the attached SECOND image, but the huge golden heart-shaped crystal above the dais is cracking and breaking apart, many small shards of golden light flying outward in all directions, while the hall falls into cold dusky blue-violet shadow and the little crystal lights on the posts go out. Dramatic but not scary. There are NO characters or creatures in the picture at all. Square 1:1, fully opaque, fills the whole frame. Painted like the picture inside the storybook page of the attached SECOND image: soft matte storybook illustration, warm and gentle, rich detail, lavender-grey stone and golden light. No text, no letters, no logo, no watermark, no border, no frame.`, true, ['art/concepts/screens/story_b.png']],
  // 마지막 장의 여우는 주인공 시안과 같은 납작한 그림이어야 한다. 털을 한 올씩 그린 사실적인 그림이 나와 "캐릭터 톤과 다르다"는 피드백이 있었다.
  ['story_3', `A storybook picture of the baby fennec fox from the attached character sheet. Draw the fox EXACTLY like the big front drawing on the character sheet: the same simple rounded cartoon shapes, the same soft thick warm-brown outline, flat pastel cream-and-honey colours with only very gentle shading, two small black dot eyes, a tiny nose, round peach blush, big ears with flat pale pink insides. NOT realistic: no individual fur strands, no painterly fur texture, no realistic lighting, no glossy eyes. The fox has just woken up among old stone ruins and looks back in wonder at the tip of its fluffy tail, where a small warm golden crystal flame now glows (drawn as a flat faceted crystal shape with a soft flat pale-yellow glow, like on the character sheet). The fox is large and in the centre. The background is drawn in the SAME flat storybook style as the fox: simplified rounded lavender-grey stone blocks and an arch, a few simple ivy leaves and tiny white flowers, all with soft brown outlines and flat pastel colours, in dusky evening tones that are darker than the fox so that the cream fox and the golden glow stand out; a soft warm glow on the stones nearest the tail. Square 1:1, fully opaque, fills the whole frame. Soft matte 2D illustration, NOT glossy, NOT 3D, NOT a painting. No text, no letters, no logo, no watermark, no border, no frame.`, true],
  // 화면 시안(art/concepts/screens)을 그대로 옮기기 위한 그림. 네 번째 값은 함께 넘기는 참조 그림(시안)이다.
  ['ui_home_bg', `Two reference images are attached; the SECOND is a mockup of a game home screen. Reproduce the background scene of that mockup as faithfully as possible: the same ruined labyrinth courtyard at dusk, the same camera, the same stone pillars with blue-and-gold banners on the left, climbing vines with small white flowers, the glowing lantern on a ledge at the left, the stone arch on the right with the sunset behind it, the stone steps, the carved stone block, fireflies and two glowing butterflies, the stone paving, and the dark out-of-focus foliage in the bottom corners. But REMOVE everything that is not scenery: no fox, no hanging wooden logo sign (and no ropes or lantern hanging from it), no buttons, no counters, no icons, no letters. Where the sign was, continue the pillars, vines and dusk sky; where the fox sat, leave empty softly lit paving. Absolutely no characters. Portrait 9:16, fully opaque, fills the whole frame. ${UI}`, true, ['art/concepts/screens/title_a.png']],
  ['ui_logo_sign', `Two reference images are attached; the SECOND is a mockup of a game home screen. Draw ONLY the hanging wooden signboard from that mockup, exactly as it looks there: the same irregular warm-brown wooden plank sign with a small diamond ornament at the top centre, the two ropes going straight up from its top corners, green ivy with small white flowers wrapped around its upper edge and sides, and the small glowing lantern hanging at its right end. The face of the sign is completely BLANK smooth wood: no letters at all. Front view. Transparent background, centered, nothing cut off. ${UI}`, true, ['art/concepts/screens/title_a.png']],
  ['story_book', `Two reference images are attached; the SECOND is a mockup of a story screen that looks like an open storybook lying on a dark wooden table. Reproduce it as faithfully as possible as an EMPTY template: keep the dark wooden table, the glowing crystal lantern and book stack at the top left, the leaves, the golden crystals, the cream paper page with its worn edges, thin decorative border line, corner vine ornaments and the little star ornament at the top, the book cover edge at the bottom and the red ribbon bookmark at the bottom left, in the same positions. But REMOVE the illustration inside the page (leave plain blank cream paper there), the two grey caption lines, the three page dots, the arrow button at the bottom and the button at the top right. No characters, no letters. Portrait 9:16, fully opaque, fills the whole frame. ${UI}`, true, ['art/concepts/screens/story_b.png']],
  ['ui_select_bg', `Two reference images are attached; the SECOND is a mockup of a stage-select screen. Reproduce ONLY its background: a dark dusky teal-navy cave wall, two glowing lanterns hanging on ropes with ivy at the upper left and upper right edges, and at the bottom dark rocks, foliage and a few golden and violet crystals. The whole middle is calm, empty and dark so that cards can be placed on it. REMOVE the cards, the buttons, the counters, the dots and all icons. No characters, no letters. Portrait 9:16, fully opaque, fills the whole frame. ${UI}`, true, ['art/concepts/screens/select_b.png']],
  ['ui_fox_peek', `Two reference images are attached; the SECOND is a mockup of a stage-select screen in which a tiny fox head peeks over the top edge of the highlighted tile numbered 5. Draw ONLY that peeking fox, larger: the baby fennec fox's head seen from the front with big ears, dot eyes and blush, and its two small front paws resting on an invisible edge below its chin. Nothing below the paws. Transparent background, centered, nothing cut off. ${UI}`, true, ['art/concepts/screens/select_b.png']],
  ['ui_sprig', `A small decorative corner sprig for a game popup: a little cluster of four or five rounded green leaves with one small white five-petal flower with a yellow centre, growing from the bottom-left towards the upper-right. Transparent background, centered, nothing cut off. Square 1:1. ${UI}`, true],
  ['icon_hat', `A single cute purple wizard hat game icon with a slightly bent tip, a darker band and one small golden star on it, with a soft dark outline. ${ICON}`, true],
  ['ui_dress_room', `Two reference images are attached; the SECOND is a mockup of a dress-up screen whose upper half is a cosy dressing room. Reproduce ONLY that room scene as faithfully as possible, as a wide picture: the tall gold-framed standing mirror at the left (showing only a soft reflection of the room, no creature in it), the cushioned bench with a teal blanket and the small glowing lantern at the far left, potted plants, small framed pictures on the dusky wall, the round cream-and-teal rug in the centre of the wooden floor which is EMPTY, the brass clothes rack at the right with a starry wizard robe, a knight helmet, a mushroom cap and a ghost sheet on hangers, a wooden trunk and a dark red curtain at the right edge. The bottom edge of the picture fades into plain dark plum-brown. Absolutely no characters or creatures, no buttons, no icons, no letters. Landscape 5:4, fully opaque, fills the whole frame. ${UI}`, true, ['art/concepts/screens/cosmetics_a.png']],
  ['ui_scene_1', `A dungeon scene: crumbling ancient sandstone ruins overgrown with vines and white flowers, broken pillars and arches, a small waterfall, warm sunset light. Wide scene illustration for the top of a dungeon card in a game stage-select screen, in exactly the painting style of the mine scene in the attached SECOND image. In the lower left there is a low flat-topped crate, rock or step that is EMPTY (a character will be placed on it later). Absolutely no characters or creatures, no text, no letters. The upper middle is a little calmer and darker so a name plate can sit there. Landscape 5:4, fully opaque, fills the whole frame. ${UI}`, true, ['art/concepts/screens/select_b.png']],
  ['ui_scene_2', `A dungeon scene: the abandoned mine tunnel of the attached SECOND image, reproduced as faithfully as possible: timber support beams, hanging lanterns, a mine cart full of gold ore on curving rails, barrels, a shovel, glowing golden crystals among the rocks, a wooden crate in the lower left. Wide scene illustration for the top of a dungeon card in a game stage-select screen, in exactly the painting style of the mine scene in the attached SECOND image. In the lower left there is a low flat-topped crate, rock or step that is EMPTY (a character will be placed on it later). Absolutely no characters or creatures, no text, no letters. The upper middle is a little calmer and darker so a name plate can sit there. Landscape 5:4, fully opaque, fills the whole frame. ${UI}`, true, ['art/concepts/screens/select_b.png']],
  ['ui_scene_3', `A dungeon scene: a frozen ice cavern with pale blue icicles, snow drifts, glowing ice crystals and a frozen pond, cool blue light with a few warm lanterns. Wide scene illustration for the top of a dungeon card in a game stage-select screen, in exactly the painting style of the mine scene in the attached SECOND image. In the lower left there is a low flat-topped crate, rock or step that is EMPTY (a character will be placed on it later). Absolutely no characters or creatures, no text, no letters. The upper middle is a little calmer and darker so a name plate can sit there. Landscape 5:4, fully opaque, fills the whole frame. ${UI}`, true, ['art/concepts/screens/select_b.png']],
  ['ui_scene_4', `A dungeon scene: a magical library with tall shelves of old books, a ladder, floating candles and softly glowing arcane circles on the floor, warm red and plum tones. Wide scene illustration for the top of a dungeon card in a game stage-select screen, in exactly the painting style of the mine scene in the attached SECOND image. In the lower left there is a low flat-topped crate, rock or step that is EMPTY (a character will be placed on it later). Absolutely no characters or creatures, no text, no letters. The upper middle is a little calmer and darker so a name plate can sit there. Landscape 5:4, fully opaque, fills the whole frame. ${UI}`, true, ['art/concepts/screens/select_b.png']],
  ['ui_scene_5', `A dungeon scene: the inside of a clockwork fortress with huge brass gears, copper pipes, a lever, iron gates and warm lamp light. Wide scene illustration for the top of a dungeon card in a game stage-select screen, in exactly the painting style of the mine scene in the attached SECOND image. In the lower left there is a low flat-topped crate, rock or step that is EMPTY (a character will be placed on it later). Absolutely no characters or creatures, no text, no letters. The upper middle is a little calmer and darker so a name plate can sit there. Landscape 5:4, fully opaque, fills the whole frame. ${UI}`, true, ['art/concepts/screens/select_b.png']],
  ['ui_scene_6', `A dungeon scene: a volcanic cavern with a glowing river of lava, cracked basalt stone bridges, embers in the air and dark rock. Wide scene illustration for the top of a dungeon card in a game stage-select screen, in exactly the painting style of the mine scene in the attached SECOND image. In the lower left there is a low flat-topped crate, rock or step that is EMPTY (a character will be placed on it later). Absolutely no characters or creatures, no text, no letters. The upper middle is a little calmer and darker so a name plate can sit there. Landscape 5:4, fully opaque, fills the whole frame. ${UI}`, true, ['art/concepts/screens/select_b.png']],
  ['ui_scene_7', `A dungeon scene: a serene mirrored temple with two identical stone statues facing each other, white marble pillars, rose-pink banners and soft light. Wide scene illustration for the top of a dungeon card in a game stage-select screen, in exactly the painting style of the mine scene in the attached SECOND image. In the lower left there is a low flat-topped crate, rock or step that is EMPTY (a character will be placed on it later). Absolutely no characters or creatures, no text, no letters. The upper middle is a little calmer and darker so a name plate can sit there. Landscape 5:4, fully opaque, fills the whole frame. ${UI}`, true, ['art/concepts/screens/select_b.png']],
  ['ui_scene_8', `A dungeon scene: the heart of the labyrinth: a vast dark chamber with huge violet crystals and a dim cracked heart-shaped crystal on a dais in the distance. Wide scene illustration for the top of a dungeon card in a game stage-select screen, in exactly the painting style of the mine scene in the attached SECOND image. In the lower left there is a low flat-topped crate, rock or step that is EMPTY (a character will be placed on it later). Absolutely no characters or creatures, no text, no letters. The upper middle is a little calmer and darker so a name plate can sit there. Landscape 5:4, fully opaque, fills the whole frame. ${UI}`, true, ['art/concepts/screens/select_b.png']],
  ['icon_back', `A single chunky cream-white arrow game icon pointing left (a back arrow), thick rounded shape with a soft dark outline. ${ICON}`, true],
  ['icon_settings', `A single chunky cream-white gear cog game icon (settings), thick rounded shape with a soft dark outline. ${ICON}`, true],
  ['icon_skip', `A single chunky cream-white double-triangle fast-forward game icon pointing right, thick rounded shapes with a soft dark outline. ${ICON}`, true],
  ['icon_gem', `A single chunky faceted magenta-purple gemstone game icon with a bright highlight and a soft dark outline. ${ICON}`, true],
];

function run(key, body, raw, refs = []) {
  return new Promise((resolve) => {
    const file = `${DIR}/${key}.png`;
    if (existsSync(file)) return resolve({ key, status: 'skip' });
    const prompt =
      `Use $imagegen to generate exactly one image, then save it as ${file} in this workspace. ` +
      `Do not overwrite any existing file and do not create or edit any other file.\n\nImage: ${body}\n${raw ? '' : STYLE}\n\n` +
      `Do not draw the image with code, PIL, SVG or any procedural method. If the image generation tool is unavailable or fails, say so and stop without creating a file.`;
    const child = spawn('codex', ['exec', '--sandbox', 'workspace-write', '--skip-git-repo-check', '--json', '-i', REF, ...refs.flatMap((r) => ['-i', r]), '-'], {
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
    const r = await run(job[0], job[1], job[2], job[3]);
    results.push(r);
    console.log(`${r.status.padEnd(4)} ${r.key}${r.status === 'skip' ? '' : `  imageEvent=${r.imageEvent}  [${r.types}]`}`);
  }
}
await Promise.all(Array.from({ length: parallel }, worker));
const failed = results.filter((r) => r.status === 'fail');
console.log(`완료: 성공 ${results.filter((r) => r.status === 'ok').length}, 건너뜀 ${results.filter((r) => r.status === 'skip').length}, 실패 ${failed.length}`);
if (failed.length) console.log('실패: ' + failed.map((r) => r.key).join(', '));
