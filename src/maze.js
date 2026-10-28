import { COLS, ROWS, DIRS } from './config.js';
import { makeRng } from './rng.js';

export const idx = (x, y) => y * COLS + x;
export const inb = (x, y) => x >= 0 && y >= 0 && x < COLS && y < ROWS;
// grid: 0 floor, 1 wall, 2 fake wall (player passes, enemies do not)
export const isFloor = (g, x, y) => inb(x, y) && g[idx(x, y)] === 0;
export const isPlayerPass = (g, x, y) => inb(x, y) && g[idx(x, y)] !== 1;

const START = [9, 21];
const SPAWNS = [
  [9, 11],
  [7, 11],
  [11, 11],
  [9, 9],
];
const CORNERS = [
  [1, 1],
  [17, 1],
  [1, 21],
  [17, 21],
];

function openNeighbors(grid, x, y, pass = isFloor) {
  let n = 0;
  for (const [dx, dy] of DIRS) if (pass(grid, x + dx, y + dy)) n++;
  return n;
}

export function generateMaze(seed, opts = {}) {
  for (let attempt = 0; attempt < 40; attempt++) {
    const m = buildMaze(seed + attempt * 101, opts);
    if (!opts.secret || m.secrets.length) return m;
  }
  return buildMaze(seed, opts);
}

function buildMaze(seed, opts) {
  const rng = makeRng(seed);
  const grid = new Uint8Array(COLS * ROWS).fill(1);
  const set = (x, y, v) => {
    grid[idx(x, y)] = v;
    grid[idx(COLS - 1 - x, y)] = v;
  };
  for (let cy = 0; cy < 11; cy++) for (let cx = 0; cx < 9; cx++) grid[idx(2 * cx + 1, 2 * cy + 1)] = 0;

  // randomized DFS spanning tree on the left half (cells cx 0..4)
  const vis = new Uint8Array(5 * 11);
  const deg = new Uint8Array(5 * 11);
  const stack = [[rng.int(5), rng.int(11)]];
  vis[stack[0][1] * 5 + stack[0][0]] = 1;
  while (stack.length) {
    const [cx, cy] = stack[stack.length - 1];
    const opts4 = [];
    for (const [dx, dy] of DIRS) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx >= 0 && nx <= 4 && ny >= 0 && ny <= 10 && !vis[ny * 5 + nx]) opts4.push([nx, ny, dx, dy]);
    }
    if (!opts4.length) {
      stack.pop();
      continue;
    }
    const [nx, ny, dx, dy] = rng.pick(opts4);
    set(2 * cx + 1 + dx, 2 * cy + 1 + dy, 0);
    vis[ny * 5 + nx] = 1;
    deg[cy * 5 + cx]++;
    deg[ny * 5 + nx]++;
    stack.push([nx, ny]);
  }

  // secret room: a leaf cell behind a fake wall
  const blocked = new Set();
  const secrets = [];
  const secretCells = new Set();
  if (opts.secret) {
    const leaves = [];
    for (let cy = 0; cy < 11; cy++)
      for (let cx = 0; cx < 4; cx++) {
        if (deg[cy * 5 + cx] === 1 && cy <= 7 && !(cy >= 4 && cy <= 6) && cx + cy > 1) leaves.push([cx, cy]);
      }
    if (leaves.length) {
      const [cx, cy] = rng.pick(leaves);
      const sx = 2 * cx + 1;
      const sy = 2 * cy + 1;
      for (const [dx, dy] of DIRS) {
        const wx = sx + dx;
        const wy = sy + dy;
        blocked.add(idx(wx, wy));
        blocked.add(idx(COLS - 1 - wx, wy));
        if (grid[idx(wx, wy)] === 0) set(wx, wy, 2);
      }
      for (const x of [sx, COLS - 1 - sx]) {
        secretCells.add(idx(x, sy));
        const wall = [];
        for (const [dx, dy] of DIRS) if (grid[idx(x + dx, sy + dy)] === 2) wall.push(idx(x + dx, sy + dy));
        secrets.push({ room: idx(x, sy), wall: wall[0], coins: 15 + rng.int(16), bonus: rng() < 0.5 });
      }
    }
  }

  // remove dead ends (braid)
  for (let iter = 0; iter < 400; iter++) {
    let changed = false;
    for (let cy = 0; cy < 11; cy++)
      for (let cx = 0; cx < 9; cx++) {
        const x = 2 * cx + 1;
        const y = 2 * cy + 1;
        if (secretCells.has(idx(x, y))) continue;
        if (openNeighbors(grid, x, y) > 1) continue;
        const cands = [];
        for (const [dx, dy] of DIRS) {
          const wx = x + dx;
          const wy = y + dy;
          const bx = x + 2 * dx;
          const by = y + 2 * dy;
          if (wx < 1 || wy < 1 || wx > COLS - 2 || wy > ROWS - 2) continue;
          if (grid[idx(wx, wy)] !== 1 || blocked.has(idx(wx, wy))) continue;
          if (secretCells.has(idx(bx, by))) continue;
          cands.push([wx, wy]);
        }
        if (cands.length) {
          const [wx, wy] = rng.pick(cands);
          set(wx, wy, 0);
          changed = true;
        }
      }
    if (!changed) break;
  }

  // extra loops
  const closed = [];
  for (let y = 1; y < ROWS - 1; y++)
    for (let x = 1; x < COLS - 1; x++) {
      if (grid[idx(x, y)] !== 1) continue;
      if (((x & 1) === 0) === ((y & 1) === 0)) continue; // pillar
      if (blocked.has(idx(x, y))) continue;
      closed.push([x, y]);
    }
  rng.shuffle(closed);
  const extra = 12 + Math.min(10, opts.extraLoops || 0);
  for (let i = 0; i < extra && i < closed.length; i++) set(closed[i][0], closed[i][1], 0);

  const reserved = new Set([idx(...START), ...SPAWNS.map((s) => idx(...s))]);
  for (const s of secrets) reserved.add(s.room);
  const floors = [];
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (grid[idx(x, y)] === 0) floors.push(idx(x, y));

  const spheres = CORNERS.map((c) => idx(...c));
  const pel = new Uint8Array(COLS * ROWS);
  let pelletCount = 0;
  for (const i of floors) {
    if (reserved.has(i) || spheres.includes(i)) continue;
    pel[i] = 1;
    pelletCount++;
  }

  const free = floors.filter((i) => !reserved.has(i) && !spheres.includes(i));
  rng.shuffle(free);
  const nCoins = 8 + rng.int(8);
  const weights = [1, 1, 2, 2, 3, 3, 4, 5];
  const coins = free.slice(0, nCoins).map((i) => ({ idx: i, v: rng.pick(weights) }));
  const far = free.slice(nCoins).filter((i) => Math.abs((i % COLS) - START[0]) + Math.abs(((i / COLS) | 0) - START[1]) >= 8);
  const bonusSpots = far.slice(0, 3);

  const pads = [];
  if (opts.pads) {
    const corr = free.filter((i) => {
      const x = i % COLS;
      const y = (i / COLS) | 0;
      if (openNeighbors(grid, x, y) !== 2) return false;
      return (isFloor(grid, x - 1, y) && isFloor(grid, x + 1, y)) || (isFloor(grid, x, y - 1) && isFloor(grid, x, y + 1));
    });
    rng.shuffle(corr);
    for (const i of corr.slice(0, 6)) {
      const x = i % COLS;
      const y = (i / COLS) | 0;
      pads.push({ idx: i, axis: isFloor(grid, x - 1, y) ? 'h' : 'v' });
    }
  }

  return {
    grid,
    pel,
    pelletCount,
    spheres,
    coins,
    secrets,
    pads,
    bonusSpots,
    start: START,
    spawns: SPAWNS,
    corners: CORNERS,
    floors,
    protectedWalls: blocked,
    coinIdx: new Set(coins.map((c) => c.idx)),
  };
}

// BFS distance field from (tx,ty). pass(grid,x,y) decides walkability.
export function distField(grid, tx, ty, pass = isFloor) {
  const d = new Int16Array(COLS * ROWS).fill(-1);
  if (!inb(tx, ty)) return d;
  const q = [idx(tx, ty)];
  d[q[0]] = 0;
  for (let h = 0; h < q.length; h++) {
    const i = q[h];
    const x = i % COLS;
    const y = (i / COLS) | 0;
    for (const [dx, dy] of DIRS) {
      const nx = x + dx;
      const ny = y + dy;
      if (!pass(grid, nx, ny)) continue;
      const j = idx(nx, ny);
      if (d[j] >= 0) continue;
      d[j] = d[i] + 1;
      q.push(j);
    }
  }
  return d;
}

export function allReachable(grid, fromX, fromY, targets, pass = isPlayerPass, blockedSet = null) {
  const seen = new Uint8Array(COLS * ROWS);
  const q = [idx(fromX, fromY)];
  seen[q[0]] = 1;
  for (let h = 0; h < q.length; h++) {
    const i = q[h];
    const x = i % COLS;
    const y = (i / COLS) | 0;
    for (const [dx, dy] of DIRS) {
      const nx = x + dx;
      const ny = y + dy;
      if (!pass(grid, nx, ny)) continue;
      const j = idx(nx, ny);
      if (seen[j] || (blockedSet && blockedSet.has(j))) continue;
      seen[j] = 1;
      q.push(j);
    }
  }
  for (const t of targets) if (!seen[t]) return false;
  return true;
}

// Toggle a few wall connectors while keeping the floor graph connected and dead-end free.
// occupied: Set of tile indexes that must not change. near: optional [x,y] to prefer.
export function glitchWalls(maze, rng, count, occupied, near) {
  const { grid } = maze;
  const changed = [];
  const cands = [];
  for (let y = 1; y < ROWS - 1; y++)
    for (let x = 1; x < COLS - 1; x++) {
      const v = grid[idx(x, y)];
      if (v === 2 || ((x & 1) === 0) === ((y & 1) === 0)) continue;
      const i = idx(x, y);
      if (occupied.has(i) || maze.protectedWalls.has(i)) continue;
      if (v === 0 && (maze.pel[i] || maze.coinIdx.has(i))) continue; // never bury a pickup
      cands.push([x, y, v]);
    }
  if (near) cands.sort((a, b) => Math.abs(a[0] - near[0]) + Math.abs(a[1] - near[1]) - (Math.abs(b[0] - near[0]) + Math.abs(b[1] - near[1])) + (rng() - 0.5) * 8);
  else rng.shuffle(cands);
  const secretRooms = new Set(maze.secrets.map((s) => s.room));
  const countFloors = () => {
    let n = 0;
    for (let k = 0; k < grid.length; k++) if (grid[k] === 0 && !secretRooms.has(k)) n++;
    return n;
  };
  let doneOpen = 0;
  let doneClose = 0;
  for (const [x, y, v] of cands) {
    if (changed.length >= count) break;
    const i = idx(x, y);
    if (v === 1) {
      if (doneOpen > doneClose + 1) continue;
      // never open a connector next to a secret room
      grid[i] = 0;
      changed.push({ idx: i, to: 0 });
      doneOpen++;
    } else {
      if (doneClose > doneOpen) continue;
      grid[i] = 1;
      // check dead ends and connectivity
      let ok = true;
      for (const [dx, dy] of DIRS) {
        const ax = x + dx;
        const ay = y + dy;
        if (isFloor(grid, ax, ay) && (ax & 1) && (ay & 1) && !secretRooms.has(idx(ax, ay)) && openNeighbors(grid, ax, ay) < 2) ok = false;
      }
      if (ok) {
        const reach = allReachableCount(grid);
        if (reach < countFloors()) ok = false;
      }
      if (!ok) {
        grid[i] = 0;
        continue;
      }
      changed.push({ idx: i, to: 1 });
      doneClose++;
    }
  }
  return changed;
}

function allReachableCount(grid) {
  const seen = new Uint8Array(COLS * ROWS);
  const q = [idx(9, 21)];
  seen[q[0]] = 1;
  for (let h = 0; h < q.length; h++) {
    const i = q[h];
    const x = i % COLS;
    const y = (i / COLS) | 0;
    for (const [dx, dy] of DIRS) {
      const nx = x + dx;
      const ny = y + dy;
      if (!isFloor(grid, nx, ny)) continue;
      const j = idx(nx, ny);
      if (seen[j]) continue;
      seen[j] = 1;
      q.push(j);
    }
  }
  return q.length;
}
