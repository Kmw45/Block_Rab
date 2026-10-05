// 시안 페이지를 공유용 폴더로 만든다: 그림은 JPEG로 줄이고 페이지의 그림 주소를 맞춘다.
// 사용: node tools/concept-site.mjs <결과 폴더>   결과: index.html(캐릭터 시안), screens.html(화면 시안)과 그림들
// 올리기(프로젝트 폴더 밖에서): npx wrangler pages deploy <결과 폴더> --project-name block-labyrinth --branch concepts
import sharp from 'sharp';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const out = process.argv[2];
if (!out) throw new Error('결과 폴더를 인자로 준다');
const SRC = 'art/concepts';

// 페이지가 가리키는 PNG를 모두 JPEG로 줄여 옮기고, 주소를 .jpg로 바꾼 페이지를 돌려준다
async function page(file, width) {
  let html = readFileSync(`${SRC}/${file}`, 'utf8');
  const pngs = new Set([...html.matchAll(/(?:src|href)="([^"]+)\.png"/g)].map((m) => m[1]));
  for (const p of pngs) {
    if (!existsSync(`${SRC}/${p}.png`)) throw new Error(`${file}: 그림이 없음 ${p}.png`);
    mkdirSync(dirname(`${out}/${p}.jpg`), { recursive: true });
    await sharp(`${SRC}/${p}.png`).resize(width).jpeg({ quality: 86 }).toFile(`${out}/${p}.jpg`);
  }
  html = html.replace(/((?:src|href)="[^"]+)\.png"/g, '$1.jpg"');
  console.log(`${file}: 그림 ${pngs.size}장`);
  return html;
}

mkdirSync(out, { recursive: true });
const link = '<p class="lead">화면 시안은 <a href="screens.html">여기</a>에 있습니다.</p>';
writeFileSync(`${out}/index.html`, (await page('target.html', 1500)).replace('</h1>', '</h1>\n      ' + link));
writeFileSync(`${out}/screens.html`, (await page('screens.html', 900)).replace('href="target.html"', 'href="./"'));
