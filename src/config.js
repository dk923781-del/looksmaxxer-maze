export const TILE = 16;
export const COLS = 19;
export const ROWS = 23;
export const MW = COLS * TILE; // 304
export const MH = ROWS * TILE; // 368
export const BASE_SPEED = 5; // tiles per second
export const MAX_SPEED = 7.5;
export const SAVE_KEY = 'lmz_save_v1';
export const SAVE_VERSION = 2;
export const MAX_LIVES = 5;
export const MAX_BLACKPILL = 3;
export const MAX_ITEM = 5;
export const MAX_LEVEL = 100;

// directions: 0 up, 1 right, 2 down, 3 left
export const DIRS = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];
export const opp = (d) => (d + 2) & 3;

export function xpForLevel(L) {
  return Math.round(40 * Math.pow(L, 1.35));
}

export function levelFromXp(xp) {
  let L = 1;
  let rest = xp;
  while (L < MAX_LEVEL && rest >= xpForLevel(L)) {
    rest -= xpForLevel(L);
    L++;
  }
  return { level: L, into: L >= MAX_LEVEL ? 0 : rest, need: L >= MAX_LEVEL ? 0 : xpForLevel(L) };
}

export function stageForLevel(L) {
  return L >= 100 ? 4 : L >= 61 ? 3 : L >= 26 ? 2 : 1;
}

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
