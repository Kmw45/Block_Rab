// Codex 세션 기록을 종류별로 나눠 본다. 인자로 move <대상 폴더>를 주면 그림 생성용(codex exec) 기록만 옮긴다.
import { closeSync, mkdirSync, openSync, readSync, readdirSync, renameSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';

const ROOT = join(process.env.APPDATA, 'reddy-ide/codex-runtime-home/home/sessions');
const [mode, dest] = process.argv.slice(2);
const files = [];
(function walk(d) {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = join(d, e.name);
    if (e.isDirectory()) walk(p);
    else files.push(p);
  }
})(ROOT);

// 첫 줄(세션 정보)만 읽는다. 파일이 수백 MB일 수 있다.
function head(p) {
  const fd = openSync(p, 'r');
  const buf = Buffer.alloc(65536);
  const n = readSync(fd, buf, 0, buf.length, 0);
  closeSync(fd);
  const line = buf.subarray(0, n).toString('utf8').split('\n')[0];
  try {
    const o = JSON.parse(line);
    const m = o.payload ?? o;
    return { originator: m.originator ?? '?', source: typeof m.source === 'string' ? m.source : JSON.stringify(m.source ?? '?').slice(0, 30), cwd: m.cwd ?? '?' };
  } catch {
    // 첫 줄이 64KB보다 길면 필요한 값만 정규식으로 찾는다
    const g = (k) => line.match(new RegExp(`"${k}":"([^"]*)"`))?.[1] ?? '?';
    return { originator: g('originator'), source: g('source'), cwd: g('cwd') };
  }
}

const groups = new Map();
const now = Date.now();
const rows = files.map((p) => {
  const st = statSync(p);
  const h = head(p);
  const key = `${h.originator} | ${h.source} | ${h.cwd.replace(/\\\\/g, '\\')}`;
  const g = groups.get(key) ?? { n: 0, bytes: 0, newest: 0 };
  g.n++;
  g.bytes += st.size;
  g.newest = Math.max(g.newest, st.mtimeMs);
  groups.set(key, g);
  return { p, size: st.size, mtime: st.mtimeMs, ...h };
});
console.log(`전체 ${rows.length}개, ${(rows.reduce((a, r) => a + r.size, 0) / 1e6).toFixed(0)}MB`);
for (const [k, g] of [...groups.entries()].sort((a, b) => b[1].bytes - a[1].bytes))
  console.log(`${String(g.n).padStart(4)}개 ${(g.bytes / 1e6).toFixed(0).padStart(5)}MB  최근 ${((now - g.newest) / 3600000).toFixed(0).padStart(3)}시간 전  ${k}`);

if (mode === 'move') {
  // 그림 생성 스크립트가 codex exec로 만든 기록만 옮긴다. 한 시간 안에 바뀐 파일은 쓰는 중일 수 있어 남긴다.
  const pick = rows.filter((r) => /exec/i.test(r.originator + r.source) && now - r.mtime > 600000);
  let moved = 0;
  let bytes = 0;
  const failed = [];
  for (const r of pick) {
    const to = join(dest, relative(ROOT, r.p));
    mkdirSync(dirname(to), { recursive: true });
    try {
      renameSync(r.p, to);
      moved++;
      bytes += r.size;
    } catch (e) {
      failed.push(`${relative(ROOT, r.p)}: ${e.code}`);
    }
  }
  console.log(`옮김 ${moved}개 ${(bytes / 1e6).toFixed(0)}MB -> ${dest}`);
  if (failed.length) console.log(`실패 ${failed.length}개:\n` + failed.slice(0, 10).join('\n'));
}
