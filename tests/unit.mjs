import assert from 'node:assert/strict';
import { generateMaze, allReachable, glitchWalls, isFloor, idx } from '../src/maze.js';
import { ALL_LEVELS } from '../src/data.js';
import { makeRng } from '../src/rng.js';
import { levelFromXp, xpForLevel } from '../src/config.js';
import { migrate } from '../src/save.js';

let pelletsTotal = 0;
for (const d of ALL_LEVELS) {
  const m = generateMaze(d.seed, d);
  const m2 = generateMaze(d.seed, d);
  assert.deepEqual(m.grid, m2.grid, 'deterministic ' + d.key);
  const targets = [];
  m.pel.forEach((v, i) => v && targets.push(i));
  targets.push(...m.coins.map((c) => c.idx), ...m.spheres, ...m.bonusSpots);
  assert.ok(allReachable(m.grid, 9, 21, targets, isFloor), 'reachable ' + d.key);
  for (const s of m.secrets) assert.ok(allReachable(m.grid, 9, 21, [s.room]), 'secret reachable ' + d.key);
  assert.equal(m.secrets.length > 0, d.secret, 'secret flag ' + d.key);
  assert.ok(m.pelletCount > 120 && m.pelletCount < 260, `pellets ${m.pelletCount} ${d.key}`);
  assert.ok(m.coins.length >= 8 && m.coins.length <= 15);
  assert.equal(m.spheres.length, 4);
  // no dead ends
  for (const i of m.floors) {
    const x = i % 19, y = (i / 19) | 0;
    if (m.secrets.some((s) => s.room === i)) continue;
    let n = 0;
    for (const [dx, dy] of [[0,-1],[1,0],[0,1],[-1,0]]) if (isFloor(m.grid, x + dx, y + dy)) n++;
    assert.ok(n >= 2, `dead end at ${x},${y} ${d.key}`);
  }
  // mirror symmetry
  for (let y = 0; y < 23; y++) for (let x = 0; x < 19; x++) assert.equal(m.grid[idx(x, y)], m.grid[idx(18 - x, y)]);
  if (d.pads) assert.ok(m.pads.length > 0);
  // glitch walls keep it connected
  const rng = makeRng(5);
  const occ = new Set();
  for (let k = 0; k < 30; k++) {
    glitchWalls(m, rng, 3, occ, null);
    const t = [];
    m.pel.forEach((v, i) => v && t.push(i));
    assert.ok(allReachable(m.grid, 9, 21, t, isFloor), 'glitch connectivity ' + d.key);
  }
  pelletsTotal += m.pelletCount;
}
console.log('levels ok, avg pellets', Math.round(pelletsTotal / 25));
assert.equal(xpForLevel(1), 40);
assert.equal(levelFromXp(0).level, 1);
assert.equal(levelFromXp(40).level, 2);
let sum = 0; for (let l = 1; l < 26; l++) sum += xpForLevel(l);
assert.equal(levelFromXp(sum).level, 26);
console.log('xp to 26:', sum);
const mig = migrate({ v: 1, coins: 50, xp: 100 });
assert.equal(mig.v, 2); assert.equal(mig.coins, 50); assert.equal(mig.chars.valera_broke.xp, 100);
console.log('unit tests passed');
