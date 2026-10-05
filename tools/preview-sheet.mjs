// 동작 시트에서 고른 줄만 모아 본다. 사용: node tools/preview-sheet.mjs <출력 png> <스킨 id> <줄 번호 쉼표 목록(0부터)>
import sharp from 'sharp';

const [out, id, list] = process.argv.slice(2);
const rows = list.split(',').map(Number);
const comps = await Promise.all(
  rows.map(async (r, i) => ({
    input: await sharp(`public/assets/anim/${id}.webp`).extract({ left: 0, top: r * 240, width: 2400, height: 240 }).resize(1500).png().toBuffer(),
    left: 0,
    top: i * 150,
  })),
);
await sharp({ create: { width: 1500, height: rows.length * 150, channels: 4, background: '#3a3350' } }).composite(comps).png().toFile(out);
console.log(`${id}: ${rows.join(' ')}`);
