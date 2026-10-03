// 튜토리얼 레벨이 풀리는지와 최소 해답을 출력한다. 사용: npx tsx tools/check-tutorial.ts
import { DIR_CHARS, initialState, parseLevel } from '../src/core/board';
import { solve } from '../src/core/solver';
import { TUTORIALS } from '../src/data/tutorial';

for (const t of TUTORIALS) {
  const def = parseLevel(t.rows);
  const r = solve(def, initialState(def), { exhaustive: true });
  const path = r.path.map((d) => DIR_CHARS[d]).join('');
  const ok = r.status === 'solved' && path.length === t.solution.length;
  console.log(`${t.id}: ${r.status} ${path} (${path.length}수, 밀기 ${r.pushes}, 상태 ${r.states})${ok ? '' : `  <- 저장된 해답 ${t.solution}과 길이가 다름`}`);
}
