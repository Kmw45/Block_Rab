import { ITEMS } from '../src/data/items';
import { rollGacha } from '../src/game/store';
const runs = 20000;
const all: number[] = [];
const ownedAt: Record<number, number[]> = { 54: [], 67: [] };
for (let r = 0; r < runs; r++) {
  const owned = new Set<string>();
  let streak = 0, draws = 0;
  while (owned.size < ITEMS.length) {
    const x = rollGacha(owned, streak, Math.random);
    streak = x.dupStreak; draws++;
    if (x.isNew) owned.add(x.item.id);
    if (ownedAt[draws]) ownedAt[draws].push(owned.size);
  }
  all.push(draws);
}
all.sort((a, b) => a - b);
const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
console.log(`30종 전부: 평균 ${avg(all).toFixed(1)}회, 90% ${all[Math.floor(runs * 0.9)]}회, 최대 ${all[runs - 1]}회`);
for (const n of [54, 67]) console.log(`${n}회 뽑으면 평균 ${avg(ownedAt[n].length ? ownedAt[n] : [30]).toFixed(1)}종 (그 전에 다 모은 경우 제외)`);
