// Procedural pixel-art textures. Every sprite is drawn on a 16x16 canvas, no external art needed.
// Drop-in replacement: put assets/characters/<id>.png (frames 16x16, see README) and it is used instead.
import { CHAR_BY_ID, SKIN_BY_ID } from './data.js';

const mk = (scene, key, w, h, draw) => {
  if (scene.textures.exists(key)) return;
  const t = scene.textures.createCanvas(key, w, h);
  const ctx = t.getContext();
  ctx.imageSmoothingEnabled = false;
  draw(ctx);
  t.refresh();
};
const P = (ctx, x, y, w, h, c) => {
  ctx.fillStyle = c;
  ctx.fillRect(x, y, w, h);
};

// ---------------- player ----------------
function drawPlayer(ctx, dir, f, pal, stage, mode) {
  const dark = '#14121c';
  const walk = mode === 'walk';
  const bw = stage >= 3 ? 10 : 8;
  const bx = stage >= 3 ? 3 : 4;
  const lift = walk ? f : 0;
  // legs
  if (dir === 'l' || dir === 'r') {
    P(ctx, 5 + (lift ? 1 : 0), 13, 3, 3, dark);
    P(ctx, 8 - (lift ? 1 : 0), 13, 3, 3, '#2a2638');
  } else {
    P(ctx, 5, 13 - (lift ? 1 : 0), 2, 3 + (lift ? 0 : 0), dark);
    P(ctx, 9, 13 - (lift ? 0 : 1), 2, 3, dark);
  }
  // body
  P(ctx, bx, 8, bw, 5, pal.shirt);
  if (stage >= 3) P(ctx, bx, 8, bw, 1, pal.accent);
  if (stage >= 2) P(ctx, 7, 9, 2, 1, pal.accent); // chain
  // arms
  const armY = mode === 'win' ? 5 : 9 + (walk && f ? 1 : 0);
  const armH = mode === 'win' ? 4 : 3;
  P(ctx, bx - 1, armY, 1, armH, pal.skin);
  P(ctx, bx + bw, mode === 'win' ? 5 : 9 + (walk && !f ? 1 : 0), 1, armH, pal.skin);
  // head
  P(ctx, 4, 1, 8, 7, pal.skin);
  // hair
  if (dir === 'u') {
    P(ctx, 4, 0, 8, 7, pal.hair);
    P(ctx, 3, 1, 1, 4, pal.hair);
    P(ctx, 12, 1, 1, 4, pal.hair);
  } else {
    P(ctx, 4, 0, 8, 3, pal.hair);
    P(ctx, 3, 1, 1, 4, pal.hair);
    P(ctx, 12, 1, 1, 4, pal.hair);
    if (dir === 'l') P(ctx, 8, 2, 4, 5, pal.hair);
    if (dir === 'r') P(ctx, 4, 2, 4, 5, pal.hair);
    P(ctx, 5, 2, 6, 1, pal.hair);
  }
  // face
  if (dir === 'd') {
    P(ctx, 6, 4, 1, 1, pal.eye);
    P(ctx, 9, 4, 1, 1, pal.eye);
    P(ctx, 7, 6, 2, 1, '#a0604a');
  } else if (dir === 'l') {
    P(ctx, 5, 4, 1, 1, pal.eye);
    P(ctx, 4, 6, 2, 1, '#a0604a');
  } else if (dir === 'r') {
    P(ctx, 10, 4, 1, 1, pal.eye);
    P(ctx, 10, 6, 2, 1, '#a0604a');
  }
  if (stage >= 2 && dir !== 'u') {
    if (dir === 'd') P(ctx, 5, 4, 6, 1, '#05050a');
    else if (dir === 'l') P(ctx, 4, 4, 4, 1, '#05050a');
    else P(ctx, 8, 4, 4, 1, '#05050a');
  }
  if (stage >= 4) {
    P(ctx, 4, -1, 8, 1, '#ffd23f');
    for (const x of [4, 7, 10]) P(ctx, x, -2, 2, 1, '#ffd23f');
    P(ctx, 4, 0, 8, 1, '#ffd23f');
  }
  if (mode === 'hurt') {
    ctx.globalCompositeOperation = 'source-atop';
    P(ctx, 0, 0, 16, 16, 'rgba(255,60,60,0.65)');
    ctx.globalCompositeOperation = 'source-over';
  }
}

export function charPal(charId, skinId) {
  const base = CHAR_BY_ID[charId].pal;
  const sk = SKIN_BY_ID[skinId];
  return sk && sk.shift ? { ...base, ...sk.shift } : base;
}

export function playerKey(charId, skinId, stage) {
  return `pl_${charId}_${skinId}_${stage}`;
}

export function ensurePlayerTex(scene, charId, skinId, stage) {
  const key = playerKey(charId, skinId, stage);
  if (scene.textures.exists(key + '_d0')) return key;
  const pal = charPal(charId, skinId);
  // custom sprite sheet: public/assets/characters/<id>.png, 16x16 frames, one row per stage (160x64):
  // d0 d1 u0 u1 l0 l1 r0 r1 hurt win
  const sheetKey = 'sheet_' + charId;
  if (scene.textures.exists(sheetKey)) {
    const img = scene.textures.get(sheetKey).getSourceImage();
    const row = Math.min(stage, Math.floor(img.height / 16)) - 1;
    if (row >= 0 && img.width >= 160) {
      const names = ['d0', 'd1', 'u0', 'u1', 'l0', 'l1', 'r0', 'r1', 'hurt', 'win'];
      names.forEach((n, i) =>
        mk(scene, `${key}_${n}`, 16, 16, (ctx) => ctx.drawImage(img, i * 16, row * 16, 16, 16, 0, 0, 16, 16)),
      );
      return key;
    }
  }
  for (const d of ['d', 'u', 'l', 'r'])
    for (const f of [0, 1]) mk(scene, `${key}_${d}${f}`, 16, 16, (ctx) => drawPlayer(ctx, d, f, pal, stage, 'walk'));
  mk(scene, `${key}_hurt`, 16, 16, (ctx) => drawPlayer(ctx, 'd', 0, pal, stage, 'hurt'));
  mk(scene, `${key}_win`, 16, 16, (ctx) => drawPlayer(ctx, 'd', 0, pal, stage, 'win'));
  return key;
}

// big preview (for menus), canvas -> data URL
export function playerPreviewURL(charId, skinId, stage, scale = 6) {
  const c = document.createElement('canvas');
  c.width = 16;
  c.height = 16;
  const ctx = c.getContext('2d');
  drawPlayer(ctx, 'd', 0, charPal(charId, skinId), stage, 'walk');
  const o = document.createElement('canvas');
  o.width = 16 * scale;
  o.height = 16 * scale;
  const octx = o.getContext('2d');
  octx.imageSmoothingEnabled = false;
  octx.drawImage(c, 0, 0, o.width, o.height);
  return o.toDataURL();
}

// ---------------- enemies ----------------
const SKIRT = [
  [3, 4, 7, 8, 11, 12],
  [5, 6, 9, 10, 3, 12],
];

function ghostBody(ctx, f, body, shade) {
  P(ctx, 5, 1, 6, 1, body);
  P(ctx, 4, 2, 8, 1, body);
  P(ctx, 3, 3, 10, 9, body);
  P(ctx, 3, 3, 10, 1, shade);
  for (const x of SKIRT[f]) P(ctx, x, 12, 1, 3, body);
  for (const x of SKIRT[f]) P(ctx, x, 12, 1, 1, body);
  P(ctx, 3, 12, 10, 1, body);
  const xs = f ? [4, 5, 8, 9, 12] : [3, 4, 7, 8, 11, 12];
  for (const x of xs) P(ctx, x, 13, 1, 2, body);
}

function drawEnemy(ctx, type, f) {
  const spec = {
    chaser: ['#8aa0c8', '#aabbe0'],
    doomer: ['#4a5878', '#2a3248'],
    glitch: ['#ff2fb4', '#ff77d4'],
    hunter: ['#ff8a1c', '#ffb25a'],
    mini: ['#c01c1c', '#ff4a4a'],
    zeta: ['#1fae6a', '#39ffb0'],
    hulio: ['#2fe0ff', '#9ff4ff'],
    dildo: ['#8a1fa8', '#c050e0'],
  }[type];
  ghostBody(ctx, f, spec[0], spec[1]);
  const white = '#ffffff';
  if (type === 'chaser') {
    P(ctx, 5, 5, 2, 3, white);
    P(ctx, 9, 5, 2, 3, white);
    P(ctx, 7, 10, 2, 2, '#c0392b'); // tie
  } else if (type === 'doomer') {
    P(ctx, 5, 6, 2, 1, white);
    P(ctx, 9, 6, 2, 1, white);
    P(ctx, 5, 5, 2, 1, '#14182a');
    P(ctx, 9, 5, 2, 1, '#14182a');
    P(ctx, 5, 8, 1, 2, '#7cf0ff');
    P(ctx, 6, 10, 4, 1, '#14182a');
  } else if (type === 'glitch') {
    P(ctx, 5, 5, 2, 3, white);
    P(ctx, 9, 5, 2, 3, white);
    P(ctx, 6, 6, 1, 2, '#39ffff');
    P(ctx, 10, 6, 1, 2, '#39ffff');
    const sh = f ? 2 : -2;
    const img = ctx.getImageData(0, 7, 16, 3);
    ctx.clearRect(0, 7, 16, 3);
    ctx.putImageData(img, sh, 7);
    P(ctx, 2, 4, 3, 1, '#39ffff');
    P(ctx, 11, 10, 3, 1, '#39ffff');
  } else if (type === 'hunter' || type === 'mini') {
    P(ctx, 4, 5, 8, 3, '#0a0a10');
    P(ctx, 5, 6, 2, 1, '#ff3b3b');
    P(ctx, 9, 6, 2, 1, '#ff3b3b');
    if (type === 'mini') for (const x of [4, 7, 10]) P(ctx, x, 0, 2, 1, '#ffd23f');
  } else if (type === 'zeta') {
    P(ctx, 4, 5, 8, 2, '#05050a');
    P(ctx, 5, 8, 6, 1, '#05050a');
    for (const x of [4, 7, 10]) P(ctx, x, 0, 2, 1, '#ffd23f');
    P(ctx, 4, 1, 8, 1, '#ffd23f');
  } else if (type === 'hulio') {
    P(ctx, 4, 5, 8, 2, '#05050a');
    P(ctx, 5, 5, 2, 1, '#39ffb0');
    P(ctx, 9, 5, 2, 1, '#ff2fb4');
    const img = ctx.getImageData(0, 8, 16, 2);
    ctx.clearRect(0, 8, 16, 2);
    ctx.putImageData(img, f ? 2 : -2, 8);
    for (const x of [4, 7, 10]) P(ctx, x, 0, 2, 1, '#ffd23f');
  } else if (type === 'dildo') {
    P(ctx, 5, 5, 2, 2, '#ff3b3b');
    P(ctx, 9, 5, 2, 2, '#ff3b3b');
    P(ctx, 5, 9, 6, 1, '#ffd23f');
    for (const x of [3, 6, 9, 11]) P(ctx, x, -1, 2, 2, '#ffd23f');
    P(ctx, 3, 1, 10, 1, '#ffd23f');
  }
}

function drawFright(ctx, f, flash) {
  const body = flash ? '#f4f4ff' : '#2a3cff';
  const face = flash ? '#ff3b3b' : '#ffe9a8';
  ghostBody(ctx, f, body, body);
  P(ctx, 5, 5, 2, 2, face);
  P(ctx, 9, 5, 2, 2, face);
  for (const [x, y] of [
    [4, 10],
    [5, 9],
    [6, 10],
    [7, 9],
    [8, 10],
    [9, 9],
    [10, 10],
    [11, 9],
  ])
    P(ctx, x, y, 1, 1, face);
}

export const ENEMY_TYPES = ['chaser', 'doomer', 'glitch', 'hunter', 'mini', 'zeta', 'hulio', 'dildo'];

// ---------------- items & icons ----------------
const LETTERS = {
  B: ['1110', '1001', '1110', '1001', '1001', '1110'],
  S: ['0111', '1000', '0110', '0001', '0001', '1110'],
  G: ['0110', '1000', '1011', '1001', '1001', '0110'],
  M: ['10001', '11011', '10101', '10001', '10001', '10001'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100'],
};

function drawBonus(ctx, letter, color) {
  P(ctx, 4, 2, 8, 12, color);
  P(ctx, 3, 3, 10, 10, color);
  P(ctx, 5, 3, 6, 10, '#0a0612');
  P(ctx, 4, 4, 8, 8, '#0a0612');
  const rows = LETTERS[letter];
  const w = rows[0].length;
  const ox = 8 - Math.floor(w / 2);
  rows.forEach((r, y) => {
    for (let x = 0; x < w; x++) if (r[x] === '1') P(ctx, ox + x, 5 + y - 0, 1, 1, color);
  });
}

export function buildBaseTextures(scene) {
  for (const t of ENEMY_TYPES)
    for (const f of [0, 1]) mk(scene, `en_${t}_${f}`, 16, 16, (ctx) => drawEnemy(ctx, t, f));
  for (const f of [0, 1]) {
    mk(scene, `en_fr_${f}`, 16, 16, (ctx) => drawFright(ctx, f, false));
    mk(scene, `en_frw_${f}`, 16, 16, (ctx) => drawFright(ctx, f, true));
  }
  mk(scene, 'en_eyes', 16, 16, (ctx) => {
    P(ctx, 4, 5, 3, 3, '#fff');
    P(ctx, 9, 5, 3, 3, '#fff');
    P(ctx, 5, 6, 1, 2, '#2a3cff');
    P(ctx, 10, 6, 1, 2, '#2a3cff');
  });
  mk(scene, 'pellet', 16, 16, (ctx) => {
    P(ctx, 7, 7, 2, 2, '#ffe9c4');
  });
  for (const f of [0, 1, 2]) {
    mk(scene, `coin_${f}`, 16, 16, (ctx) => {
      const w = [8, 5, 2][f];
      const x = 8 - w / 2;
      P(ctx, x, 3, w, 10, '#ffb800');
      P(ctx, x + 1, 2, Math.max(0, w - 2), 12, '#ffd23f');
      if (w > 4) P(ctx, x + 2, 5, 1, 4, '#fff3b0');
      if (w > 6) P(ctx, 7, 6, 2, 4, '#c47f00');
    });
  }
  for (const f of [0, 1]) {
    mk(scene, `sphere_${f}`, 16, 16, (ctx) => {
      const r = f ? 6 : 5;
      ctx.fillStyle = '#39ffff';
      ctx.beginPath();
      ctx.arc(8, 8, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0b2d6e';
      ctx.beginPath();
      ctx.arc(8, 8, r - 2, 0, Math.PI * 2);
      ctx.fill();
      P(ctx, 6, 6, 2, 2, '#ffffff');
    });
  }
  mk(scene, 'bonus_chad', 16, 16, (c) => drawBonus(c, 'B', '#ff9f1c'));
  mk(scene, 'bonus_shield', 16, 16, (c) => drawBonus(c, 'S', '#7cf0ff'));
  mk(scene, 'bonus_ghost', 16, 16, (c) => drawBonus(c, 'G', '#c9b6ff'));
  mk(scene, 'bonus_magnet', 16, 16, (c) => drawBonus(c, 'M', '#ffd23f'));
  mk(scene, 'bonus_freeze', 16, 16, (c) => drawBonus(c, 'T', '#8ff'));
  for (const axis of ['h', 'v']) {
    mk(scene, `pad_${axis}`, 16, 16, (ctx) => {
      P(ctx, 1, 1, 14, 14, 'rgba(255,200,60,0.18)');
      ctx.fillStyle = '#ffc83c';
      for (const o of [3, 8]) {
        if (axis === 'h') {
          for (let i = 0; i < 4; i++) P(ctx, o + i, 4 + i, 1, 1, '#ffc83c'), P(ctx, o + i, 11 - i, 1, 1, '#ffc83c');
        } else {
          for (let i = 0; i < 4; i++) P(ctx, 4 + i, o + i, 1, 1, '#ffc83c'), P(ctx, 11 - i, o + i, 1, 1, '#ffc83c');
        }
      }
    });
  }
  mk(scene, 'px', 2, 2, (ctx) => P(ctx, 0, 0, 2, 2, '#fff'));
  mk(scene, 'wallflick', 16, 16, (ctx) => {
    P(ctx, 0, 0, 16, 16, '#ff2fb4');
  });
}
