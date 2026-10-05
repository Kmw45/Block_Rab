// art/source의 생성 원본을 게임용 크기로 줄여 public/assets/sprites에 넣고 manifest.json을 쓴다.
// 사용: node tools/build-sprites.mjs
import sharp from 'sharp';
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';

const SRC = 'art/source';
const OUT = 'public/assets/sprites';
mkdirSync(OUT, { recursive: true });

// [출력 크기, 그림이 차지하는 비율]. 바닥은 여백 없이 꽉 채운다.
// UI 키트: 여백을 잘라 내고 정해진 크기로 맞춘다. 게임에서 9-슬라이스로 늘려 쓴다.
const UI_BOX = {
  ui_btn_gold: [384, 128],
  ui_btn_stone: [384, 128],
  ui_btn_square: [160, 160],
  ui_panel: [512, 512],
  ui_frame: [512, 512],
  ui_ribbon: [512, 128],
  ui_stage_open: [192, 192],
  ui_stage_cleared: [192, 192],
  ui_stage_locked: [192, 192],
  ui_pill: [320, 112],
  ui_card: [256, 256],
};

function spec(key) {
  if (/^ui_stage_(open|cleared)_\d$/.test(key)) return { size: 192, box: [192, 192] };
  if (/^ui_banner_\d$/.test(key)) return { size: 720, height: 240, fill: 1, opaque: true };
  if (UI_BOX[key]) return { size: UI_BOX[key][0], box: UI_BOX[key] };
  // 화면 시안을 옮긴 그림들. trim은 여백만 잘라 내고 비율을 그대로 둔 채 그 폭으로 줄인다.
  if (key === 'ui_logo_sign') return { trim: 640 };
  if (key === 'ui_fox_peek') return { trim: 160 };
  if (key === 'ui_sprig') return { trim: 128 };
  if (key === 'story_book' || key === 'ui_select_bg') return { size: 720, height: 1280, fill: 1, opaque: true };
  if (/^ui_scene_\d$/.test(key) || key === 'ui_dress_room') return { size: 720, height: 576, fill: 1, opaque: true };
  if (key === 'tile_oneway' || key === 'exit') return { size: 256, fill: 0.98 };
  if (key === 'floor' || ['tile_pit', 'tile_ice', 'tile_switch', 'tile_door', 'tile_crumble'].includes(key)) return { size: 256, fill: 1, opaque: true };
  if (key === 'tile_portal') return { size: 256, fill: 0.96 };
  if (key === 'ui_bg') return { size: 540, height: 810, fill: 1, opaque: true };
  if (key.startsWith('story_')) return { size: 640, height: 640, fill: 1, opaque: true };
  if (key === 'ui_home_bg') return { size: 720, height: 1280, fill: 1, opaque: true };
  if (key === 'ui_title_art') return { size: 640, fill: 1, opaque: true };
  if (['fx_spark', 'fx_ring', 'fx_burst'].includes(key)) return { size: 256, fill: 1, opaque: true }; // 검은 배경, 더하기 합성용
  if (key === 'ui_hand') return { size: 192, fill: 0.94 };
  if (key.startsWith('emblem_')) return { size: 160, fill: 0.96 };
  if (key.startsWith('icon_') || key === 'fx_dust' || ['ui_star', 'ui_coin', 'ui_lock'].includes(key)) return { size: 128, fill: 0.94 };
  if (key === 'wall') return { size: 256, fill: 0.97 };
  if (key.startsWith('ui_')) return { size: 512, fill: 0.94 };
  if (key.startsWith('skin_')) return { size: 256, fill: 0.9 };
  return { size: 256, fill: 0.88 };
}

const manifest = {};
for (const file of readdirSync(SRC).filter((f) => f.endsWith('.png')).sort()) {
  const key = file.replace(/\.png$/, '');
  if (key.startsWith('skin_')) {
    // 스킨의 정지 그림은 tools/make-anim.mjs가 동작 리그의 기본 자세로 만든다. 여기서는 목록에만 올린다.
    manifest[key] = file;
    continue;
  }
  const { size, fill, opaque, height, box, trim } = spec(key);
  const src = sharp(`${SRC}/${file}`).ensureAlpha();
  const { data, info } = await src.raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  let image;
  if (key.startsWith('fx_') && opaque) {
    // 검은 배경의 빛 그림: 밝기를 투명도로 바꿔 배경을 없앤다
    for (let i = 0; i < data.length; i += 4) {
      const a = Math.max(data[i], data[i + 1], data[i + 2]);
      if (a > 0) {
        data[i] = Math.min(255, (data[i] * 255) / a);
        data[i + 1] = Math.min(255, (data[i + 1] * 255) / a);
        data[i + 2] = Math.min(255, (data[i + 2] * 255) / a);
      }
      data[i + 3] = a < 10 ? 0 : a;
    }
    image = sharp(data, { raw: info }).resize(size, size, { fit: 'cover' });
  } else if (opaque) {
    image = sharp(data, { raw: info }).resize(size, height ?? size, { fit: 'cover' }).removeAlpha();
  } else {
    // 배경 제거 뒤 남은 옅은 얼룩을 지우고, 그림이 실제로 있는 영역만 잘라 낸다
    const rows = new Uint32Array(h);
    const cols = new Uint32Array(w);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const a = y * w * 4 + x * 4 + 3;
        if (data[a] < 40) data[a] = 0;
        else if (data[a] > 128) {
          rows[y]++;
          cols[x]++;
        }
      }
    }
    const first = (arr, min) => arr.findIndex((n) => n >= min);
    const last = (arr, min) => arr.length - 1 - [...arr].reverse().findIndex((n) => n >= min);
    const left = first(cols, h * 0.02);
    const right = last(cols, h * 0.02);
    const top = first(rows, w * 0.02);
    const bottom = last(rows, w * 0.02);
    if (trim) {
      const out = await sharp(data, { raw: info })
        .extract({ left, top, width: right - left + 1, height: bottom - top + 1 })
        .resize({ width: trim })
        .png({ compressionLevel: 9, palette: true, quality: 92 })
        .toFile(`${OUT}/${file}`);
      manifest[key] = file;
      console.log(`${key.padEnd(18)} ${w}x${h} (그림 ${right - left + 1}x${bottom - top + 1}) -> ${out.width}x${out.height}  ${(out.size / 1024).toFixed(0)}KB`);
      continue;
    }
    if (box) {
      image = sharp(data, { raw: info })
        .extract({ left, top, width: right - left + 1, height: bottom - top + 1 })
        .resize(box[0], box[1], { fit: 'fill' });
      const out = await image.png({ compressionLevel: 9, palette: true, quality: 92 }).toFile(`${OUT}/${file}`);
      manifest[key] = file;
      console.log(`${key.padEnd(18)} ${w}x${h} (그림 ${right - left + 1}x${bottom - top + 1}) -> ${box[0]}x${box[1]}  ${(out.size / 1024).toFixed(0)}KB`);
      continue;
    }
    const inner = Math.round(size * fill);
    const body = await sharp(data, { raw: info })
      .extract({ left, top, width: right - left + 1, height: bottom - top + 1 })
      .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    const pad = Math.floor((size - inner) / 2);
    image = sharp(body).extend({
      top: pad,
      left: pad,
      bottom: size - inner - pad,
      right: size - inner - pad,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    });
  }
  // 큰 불투명 그림(배경, 타이틀)은 JPEG로 줄인다
  const big = opaque && size > 256;
  const name = big ? `${key}.jpg` : file;
  const out = big
    ? await image.jpeg({ quality: 82 }).toFile(`${OUT}/${name}`)
    : await image.png({ compressionLevel: 9, palette: !opaque && !key.startsWith('fx_'), quality: 90 }).toFile(`${OUT}/${name}`);
  manifest[key] = name;
  console.log(`${key.padEnd(18)} ${w}x${h} -> ${size}x${height ?? size}  ${(out.size / 1024).toFixed(0)}KB`);
}
writeFileSync(`${OUT}/manifest.json`, JSON.stringify(manifest, null, 2) + '\n');
console.log(`manifest.json에 ${Object.keys(manifest).length}개 등록`);
