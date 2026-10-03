// 선택 사항인 그림 교체. public/assets/sprites/manifest.json에 { "키": "파일명" }이 있으면
// 코드로 그리는 도형 대신 그 그림을 쓴다. 키: block_normal, block_railH, block_ice,
// block_fixed, block_count, wall, floor, exit, skin_<id>, ui_chest_closed, ui_chest_open
const sprites = new Map<string, HTMLImageElement>();
const tinted = new Map<string, HTMLCanvasElement>();

export function getSprite(key: string): HTMLImageElement | undefined {
  return sprites.get(key);
}

// 월드 색을 곱해 입힌 그림. 회색으로 그린 바닥과 벽에 월드별 색을 준다.
export function getTinted(key: string, color: string): HTMLCanvasElement | undefined {
  const img = sprites.get(key);
  if (!img) return undefined;
  const id = key + color;
  let canvas = tinted.get(id);
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(img, 0, 0);
    tinted.set(id, canvas);
  }
  return canvas;
}

export async function loadSprites(): Promise<void> {
  const base = import.meta.env.BASE_URL + 'assets/sprites/';
  let manifest: Record<string, string>;
  try {
    const res = await fetch(base + 'manifest.json');
    if (!res.ok) return;
    manifest = await res.json();
  } catch {
    return;
  }
  await Promise.all(
    Object.entries(manifest).map(
      ([key, file]) =>
        new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = () => {
            sprites.set(key, img);
            resolve();
          };
          img.onerror = () => resolve();
          img.src = base + file;
        }),
    ),
  );
}
