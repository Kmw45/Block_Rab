// 쓰이지 않는 문구·스타일·그림과 중복 정의를 집계한다. 사용: node tools/audit.mjs
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const walk = (dir) => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? walk(join(dir, f)) : [join(dir, f)]));
const files = walk('src').filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'));
const code = files.filter((f) => !f.endsWith('i18n.ts')).map((f) => readFileSync(f, 'utf8')).join('\n');
const count = (text, re) => (text.match(re) ?? []).length;

const i18n = readFileSync('src/game/i18n.ts', 'utf8');
const keys = [...i18n.matchAll(/^ {2}([a-zA-Z0-9]+): \[/gm)].map((m) => m[1]);
console.log('쓰이지 않는 문구 키:', keys.filter((k) => !new RegExp(`['"\`]${k}['"\`]`).test(code)).join(', ') || '없음');

const css = readFileSync('src/styles.css', 'utf8');
console.log(`styles.css ${css.split('\n').length}줄, app.ts ${readFileSync('src/ui/app.ts', 'utf8').split('\n').length}줄`);
const classes = [...new Set([...css.matchAll(/\.([a-z][a-z0-9-]*)/g)].map((m) => m[1]))];
console.log('코드에 없는 CSS 클래스:', classes.filter((c) => !new RegExp(`\\b${c}\\b`).test(code)).join(', ') || '없음');
const selectors = [...css.matchAll(/^([.#:a-zA-Z][^{}\n]*) \{$/gm)].map((m) => m[1].trim());
const dup = Object.entries(selectors.reduce((a, s) => ((a[s] = (a[s] ?? 0) + 1), a), {})).filter(([, n]) => n > 1);
console.log(`두 번 이상 정의된 선택자 ${dup.length}개:`, dup.map(([s, n]) => `${s} x${n}`).join(' | '));

const manifest = Object.keys(JSON.parse(readFileSync('public/assets/sprites/manifest.json', 'utf8')));
const size = readdirSync('public/assets/sprites').reduce((n, f) => n + statSync(join('public/assets/sprites', f)).size, 0);
console.log(`시작할 때 불러오는 그림 ${manifest.length}개, ${(size / 1048576).toFixed(1)}MB`);
const unusedArt = manifest.filter((k) => {
  if (/^skin_/.test(k)) return false;
  const stem = k.replace(/_\d$/, '_').replace(/^ui_(btn|stage)_[a-z]+$/, 'ui_');
  return !code.includes(k) && !code.includes(stem) && !code.includes(k.replace(/^ui_/, '').replace('_', '-'));
});
console.log('코드에서 참조하지 않는 그림:', unusedArt.join(', ') || '없음');
console.log(`호출 수: vibrate ${count(code, /vibrate\(/g)}, camShake 설정 ${count(code, /camShake = /g)}, burst ${count(code, /burst\(/g)}, requestAnimationFrame ${count(code, /requestAnimationFrame\(/g)}, setTimeout ${count(code, /setTimeout\(/g)}`);
