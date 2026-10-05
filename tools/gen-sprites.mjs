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

const ASSETS = [
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
  ['story_3', `In dark crumbling stone ruins overgrown with ivy, one tiny shard of golden light has landed on the tail of the baby fennec fox from the attached character sheet (big ears with pink insides, cream-and-honey fur, dot eyes, peach blush). The fox has just woken up and looks back in wonder at the tip of its fluffy tail, which now glows like a warm golden crystal flame and lights the mossy stones around it. The fox is large and in the centre. Square 1:1, fully opaque, fills the whole frame. Painted like the picture inside the storybook page of the attached SECOND image: soft matte storybook illustration, warm and gentle, rich detail, lavender-grey stone and golden light. No text, no letters, no logo, no watermark, no border, no frame.`, true, ['art/concepts/screens/story_b.png']],
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
