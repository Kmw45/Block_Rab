// 그림 여러 장을 한 줄로 모아 본다. 사용: node tools/preview-parts.mjs <출력 png> <폴더> <이름 쉼표 목록> [칸 크기] [열 수]
import sharp from 'sharp';

const [out, dir, list, size = '300', colsArg] = process.argv.slice(2);
const names = list.split(',');
const cell = Number(size);
const cols = Number(colsArg ?? names.length);
const rows = Math.ceil(names.length / cols);
const comps = await Promise.all(
  names.map(async (n, i) => ({
    input: await sharp(`${dir}/${n}.png`).resize(cell - 8, cell - 8, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer(),
    left: (i % cols) * cell + 4,
    top: Math.floor(i / cols) * cell + 4,
  })),
);
await sharp({ create: { width: cols * cell, height: rows * cell, channels: 4, background: '#5a4a55' } }).composite(comps).png().toFile(out);
console.log(names.join(' '));
