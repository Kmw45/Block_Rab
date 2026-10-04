// 스킨의 정지 그림을 한 장에 모으고, 첫 스킨의 동작 일부(숨쉬기와 클리어 점프)를 아래에 붙인다.
// 사용: node tools/preview-skins.mjs <출력 png> [스킨 id 쉼표 목록(기본: 전부)]
import sharp from 'sharp';
import { readdirSync } from 'node:fs';

const out = process.argv[2] ?? 'preview.png';
const dir = 'public/assets/sprites';
const ids = process.argv[3]?.split(',') ?? readdirSync(dir).filter((f) => /^skin_.+\.png$/.test(f)).map((f) => f.slice(5, -4));
const cols = Math.min(8, ids.length);
const cell = 190;
const rows = Math.ceil(ids.length / cols);
const comps = await Promise.all(
  ids.map(async (id, i) => ({
    input: await sharp(`${dir}/skin_${id}.png`).resize(cell - 10, cell - 10).png().toBuffer(),
    left: (i % cols) * cell + 5,
    top: Math.floor(i / cols) * cell + 5,
  })),
);
const width = Math.max(cols * cell, 1200);
const sheet = `public/assets/anim/${ids[0]}.webp`;
const strip = (top) => sharp(sheet).extract({ left: 0, top, width: 2400, height: 240 }).resize(1200).png().toBuffer();
comps.push({ input: await strip(0), left: 0, top: rows * cell });
comps.push({ input: await strip(1920), left: 0, top: rows * cell + 120 });
await sharp({ create: { width, height: rows * cell + 240, channels: 4, background: '#3a3350' } })
  .composite(comps)
  .png()
  .toFile(out);
console.log(ids.join(' '));
