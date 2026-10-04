import { describe, expect, it } from 'vitest';
import { DIR_CHARS, Dir, initialState, parseLevel, step } from './board';
import { solve } from './solver';
import levels from '../data/levels.json';
import { ITEMS, RARITY_WEIGHT } from '../data/items';
import { PITY_STREAK, rollGacha, starsFor } from '../game/store';

const U: Dir = 0;
const R: Dir = 1;
const L: Dir = 3;

describe('블록 규칙', () => {
  it('일반 블록은 한 칸 밀리고, 두 개가 붙으면 밀리지 않는다', () => {
    const def = parseLevel(['PB..E']);
    const r = step(def, initialState(def), R);
    expect(r.ok).toBe(true);
    expect(r.state.b[0]).toBe(2);

    const stuck = parseLevel(['PBB.E']);
    const s = step(stuck, initialState(stuck), R);
    expect(s.ok).toBe(false);
    expect(s.bumpBlock).toBe(0);
  });

  it('벽과 고정 블록은 지나갈 수 없다', () => {
    const def = parseLevel(['#PX.E']);
    expect(step(def, initialState(def), L).ok).toBe(false);
    expect(step(def, initialState(def), R).ok).toBe(false);
    expect(step(def, initialState(def), U).ok).toBe(false);
  });

  it('레일 블록은 표시된 축으로만 밀린다', () => {
    const h = parseLevel(['PH..E']);
    expect(step(h, initialState(h), R).ok).toBe(true);
    const v = parseLevel(['PV..E']);
    expect(step(v, initialState(v), R).ok).toBe(false);
  });

  it('얼음 블록은 막힐 때까지 미끄러지고 출구 앞에서 멈춘다', () => {
    const def = parseLevel(['PI...#', '.....E']);
    expect(step(def, initialState(def), R).state.b[0]).toBe(4);
    const exit = parseLevel(['PI..E']);
    expect(step(exit, initialState(exit), R).state.b[0]).toBe(3);
  });

  it('횟수 블록은 숫자만큼만 밀리고 0이 되면 고정된다', () => {
    const def = parseLevel(['P2...E']);
    const a = step(def, initialState(def), R);
    expect(a.state.c[0]).toBe(1);
    expect(a.becameFixed).toBe(false);
    const b = step(def, a.state, R);
    expect(b.becameFixed).toBe(true);
    expect(step(def, b.state, R).ok).toBe(false);
  });

  it('출구에 들어가면 클리어', () => {
    const def = parseLevel(['PE']);
    expect(step(def, initialState(def), R).won).toBe(true);
  });
});

describe('던전 기믹', () => {
  it('구덩이는 그냥 지나갈 수 없고, 블록을 밀어 넣으면 메워져 지나갈 수 있다', () => {
    const def = parseLevel(['PBO.E']);
    const open = parseLevel(['PO..E']);
    expect(step(open, initialState(open), R).ok).toBe(false);
    const a = step(def, initialState(def), R);
    expect(a.sunk).toBe(true);
    const b = step(def, a.state, R);
    expect(b.ok).toBe(true);
    expect(b.state.p).toBe(2);
    expect(solve(def, initialState(def)).path.length).toBe(4);
  });

  it('일방통행 바닥은 화살표 방향으로만 들어갈 수 있다', () => {
    const def = parseLevel(['P>.<E']);
    const a = step(def, initialState(def), R);
    expect(a.ok).toBe(true);
    const b = step(def, a.state, R);
    expect(step(def, b.state, R).ok).toBe(false);
    expect(step(def, b.state, L).ok).toBe(false);
  });

  it('빙판에 올라서면 막힐 때까지 미끄러지고 블록도 미끄러진다', () => {
    const def = parseLevel(['P~~~.#', '.....E']);
    const a = step(def, initialState(def), R);
    expect(a.state.p).toBe(4);
    expect(a.slid).toBe(3);
    const push = parseLevel(['PB~~.E']);
    expect(step(push, initialState(push), R).state.b[0]).toBe(4);
  });

  it('마법진을 밟으면 짝이 되는 마법진으로 옮겨진다', () => {
    const def = parseLevel(['P@#@E']);
    const a = step(def, initialState(def), R);
    expect(a.teleported).toBe(true);
    expect(a.state.p).toBe(3);
    expect(solve(def, initialState(def)).path.length).toBe(2);
  });
});

describe('새 던전의 기믹', () => {
  it('문은 블록이 스위치에 올라가 있을 때만 지나갈 수 있다', () => {
    const closed = parseLevel(['P.D.E', '.Bs..']);
    const a = step(closed, initialState(closed), R);
    expect(step(closed, a.state, R).ok).toBe(false);
    const open = parseLevel(['PBs.#', '..D.E']);
    const pushed = step(open, initialState(open), R);
    expect(pushed.state.b[0]).toBe(2);
    expect(solve(open, initialState(open)).status).toBe('solved');
  });

  it('무너지는 바닥은 캐릭터가 떠나면 구덩이가 되어 다시 밟을 수 없다', () => {
    const def = parseLevel(['Pc..E']);
    const a = step(def, initialState(def), R);
    expect(a.crumbled).toBe(-1);
    const b = step(def, a.state, R);
    expect(b.crumbled).toBe(1);
    expect(step(def, b.state, L).ok).toBe(false);
  });

  it('쌍둥이 블록은 하나를 밀면 함께 움직이고, 하나라도 막히면 움직이지 않는다', () => {
    const def = parseLevel(['PL..E', '.L...']);
    const a = step(def, initialState(def), R);
    expect(a.state.b).toEqual([2, 7]);
    const blocked = parseLevel(['PL..E', '.L#..']);
    expect(step(blocked, initialState(blocked), R).ok).toBe(false);
  });
});

describe('출시 레벨 96개', () => {
  it('월드당 12개씩 있다', () => {
    expect(levels.length).toBe(96);
    for (let w = 1; w <= 8; w++) expect(levels.filter((l) => l.world === w).length).toBe(12);
  });

  it('저장된 해답이 실제로 풀리고 최소 이동 수와 같다', () => {
    for (const lv of levels) {
      const def = parseLevel(lv.rows);
      let s = initialState(def);
      let won = false;
      for (const ch of lv.solution) {
        const r = step(def, s, DIR_CHARS.indexOf(ch) as Dir);
        expect(r.ok, `${lv.id} 해답 이동 실패`).toBe(true);
        s = r.state;
        won = r.won;
      }
      expect(won, `${lv.id} 해답이 출구에 닿지 않음`).toBe(true);
      const res = solve(def, initialState(def));
      expect(res.status).toBe('solved');
      expect(res.path.length, `${lv.id} 최소 이동 수`).toBe(lv.minMoves);
      expect(def.kinds.length).toBeLessThanOrEqual(6);
    }
  });
});

describe('별과 뽑기', () => {
  it('별 기준', () => {
    expect(starsFor(10, 10)).toBe(3);
    expect(starsFor(15, 10)).toBe(2);
    expect(starsFor(16, 10)).toBe(1);
  });

  it('아이템 30종의 확률 합은 100%', () => {
    expect(ITEMS.length).toBe(30);
    expect(ITEMS.reduce((n, i) => n + RARITY_WEIGHT[i.rarity], 0)).toBeCloseTo(100);
  });

  it('새 아이템 하나를 얻는 데 최대 4회이고 끝까지 모을 수 있다', () => {
    let seed = 7;
    const rnd = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    for (let run = 0; run < 300; run++) {
      const owned = new Set<string>();
      let streak = 0;
      let sinceNew = 0;
      let draws = 0;
      while (owned.size < ITEMS.length) {
        const r = rollGacha(owned, streak, rnd);
        streak = r.dupStreak;
        draws++;
        sinceNew++;
        if (r.isNew) {
          owned.add(r.item.id);
          sinceNew = 0;
        }
        expect(sinceNew).toBeLessThanOrEqual(PITY_STREAK);
      }
      expect(draws).toBeLessThanOrEqual(117);
    }
  });
});
