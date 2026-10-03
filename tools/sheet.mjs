// 게임용 그림을 한 장에 모아 눈으로 점검한다. 사용: node tools/sheet.mjs out.png
import sharp from 'sharp';
import { readdirSync } from 'node:fs';

const dir = 'public/assets/sprites';
const files = readdirSync(dir).filter((f) => f.endsWith('.png')).sort();
const cols = 7;
const cell = 200;
const rows = Math.ceil(files.length / cols);
const comps = await Promise.all(
  files.map(async (f, i) => ({
    input: await sharp(`${dir}/${f}`)
      .resize(cell - 16, cell - 16, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer(),
    left: (i % cols) * cell + 8,
    top: Math.floor(i / cols) * cell + 8,
  })),
);
await sharp({ create: { width: cols * cell, height: rows * cell, channels: 4, background: '#3a3350' } })
  .composite(comps)
  .png()
  .toFile(process.argv[2] ?? 'sheet.png');
console.log(files.join(' '));
