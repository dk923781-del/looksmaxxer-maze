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
  const p = (x,y,w,h,c) => P(ctx,x,y,w,h,c);
  const bob = mode === 'walk' ? f : 0;
  const shade = '#b57658';
  // Broad shoulders, boots, metal neck chain; each palette is a distinct character.
  p(3,10,10,4,pal.shirt); p(2,11+bob,2,3,pal.skin); p(12,11-bob,2,3,pal.skin);
  p(4,14,3,2,'#171c19'); p(9,14-bob,3,2,'#171c19');
  p(4,10,8,1,pal.accent); p(7,10,2,3,'#c9d1c5');
  p(3,1,10,7,pal.skin); p(4,8,8,1,shade); p(5,9,6,1,pal.skin);
  // Angular jaw, temple shadows, overhanging fringe.
  p(3,5,1,3,shade); p(12,5,1,3,shade);
  p(3,0,10,3,pal.hair); p(2,2,2,3,pal.hair); p(12,2,2,3,pal.hair);
  p(5,2,3,1,pal.hair); p(9,2,3,2,pal.hair);
  if (dir === 'u') { p(3,1,10,7,pal.hair); p(5,7,6,1,shade); }
  else {
    const dx = dir === 'l' ? -1 : dir === 'r' ? 1 : 0;
    p(4+dx,4,3,1,'#20241f'); p(9+dx,4,3,1,'#20241f');
    p(5+dx,5,2,1,pal.accent); p(9+dx,5,2,1,pal.accent);
    p(7+dx,6,1,1,shade); p(6+dx,8,4,1,'#6b493a');
    if (stage >= 2) { p(4,4,8,2,'#101811'); p(5,4,2,1,pal.accent); p(9,4,2,1,pal.accent); }
  }
  // Each fighter has a readable signature even at maze scale.
  if (pal.identity === 'valera_broke') { p(2,0,12,2,'#657447'); p(1,2,7,1,'#869950'); }
  if (pal.identity === 'moggsu') { p(4,0,3,1,pal.accent); p(9,0,3,1,pal.accent); p(5,11,1,3,'#899781'); p(10,11,1,3,'#899781'); }
  if (pal.identity === 'zetaboss') { p(4,4,8,2,'#0b120b'); p(5,4,6,1,'#c5f65a'); p(3,10,10,2,'#33443b'); }
  if (pal.identity === 'hulioboss') { p(1,3,2,5,'#a6ebec'); p(13,3,2,5,'#a6ebec'); p(13,7,2,1,'#ff88ca'); }
  if (pal.identity === 'dildoboss') { p(4,0,8,2,'#f4dd94'); p(3,0,2,3,'#f4dd94'); p(11,0,2,3,'#f4dd94'); p(7,11,2,2,'#ffe58b'); }
  if (stage >= 3) { p(1,10,2,3,pal.accent); p(13,10,2,3,pal.accent); }
  if (stage >= 4) { p(3,0,10,1,'#f4dc83'); p(3,0,2,2,'#f4dc83'); p(7,0,2,2,'#f4dc83'); p(11,0,2,2,'#f4dc83'); }
  if (mode === 'win') { p(1,7,2,5,pal.skin); p(13,7,2,5,pal.skin); }
  if (mode === 'hurt') { ctx.globalCompositeOperation='source-atop'; p(0,0,16,16,'rgba(255,70,60,.6)'); ctx.globalCompositeOperation='source-over'; }
}

export function charPal(charId, skinId) {
  const base = { ...CHAR_BY_ID[charId].pal, identity: charId };
  const sk = SKIN_BY_ID[skinId];
  return sk && sk.shift ? { ...base, ...sk.shift } : base;
}

export const FW = 28;
export const FH = 30;
export const FRAME_NAMES = ['d0', 'd1', 'u0', 'u1', 'l0', 'l1', 'r0', 'r1', 'hurt', 'win'];
const SHEETS = {};
const PORTRAIT_ORDER = ['valera_broke','moggsu','zetaboss','hulioboss','dildoboss'];
let portraitAtlas = null;
const portraitCache = new Map();
export function loadPortraitAtlas(base) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => { portraitAtlas = img; for (const id of PORTRAIT_ORDER) SHEETS[id] = img; resolve(); };
    img.onerror = () => resolve();
    img.src = `${base}assets/characters/moggers-v2.png`;
  });
}
function drawPortrait(ctx, id, x,y,w,h) {
  const n = PORTRAIT_ORDER.indexOf(id), cw=portraitAtlas.width/3,ch=portraitAtlas.height/2;
  ctx.drawImage(portraitAtlas,n%3*cw,Math.floor(n/3)*ch,cw,ch,x,y,w,h);
}
export function portraitURL(id) {
  if (!portraitAtlas) return playerPreviewURL(id,'base',1,6);
  if (portraitCache.has(id)) return portraitCache.get(id);
  const c=document.createElement('canvas');c.width=c.height=512;
  drawPortrait(c.getContext('2d'),id,0,0,512,512);
  const url=c.toDataURL('image/webp',.9);portraitCache.set(id,url);return url;
}
export const hasSheet = (id) => !!SHEETS[id];

export function loadSheets(ids, base) {
  return Promise.all(
    ids.map(
      (id) =>
        new Promise((res) => {
          const im = new Image();
          im.onload = () => {
            SHEETS[id] = im;
            res();
          };
          im.onerror = () => res();
          im.src = `${base}assets/characters/${id}.png`;
        }),
    ),
  );
}

const hexToRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

// one frame of a sheet, recoloured for the chosen skin (shirt/accent are exact marker colours)
export function sheetFrame(charId, skinId, stage, i) {
  if (portraitAtlas && SHEETS[charId] === portraitAtlas) {
    const c=document.createElement('canvas');c.width=FW;c.height=FH;
    const ctx=c.getContext('2d'),pal=charPal(charId,skinId);
    ctx.imageSmoothingEnabled=true;
    const bob=i<8?i%2:0;
    ctx.fillStyle=pal.shirt;ctx.fillRect(7,21,14,7);
    ctx.fillStyle=pal.accent;ctx.fillRect(7,21,14,2);
    ctx.fillStyle='#e4d4c5';ctx.fillRect(4,23-bob,3,4);ctx.fillRect(21,23+bob,3,4);
    ctx.fillStyle='#15151e';ctx.fillRect(8,27,4,3-bob);ctx.fillRect(16,27+bob,4,3-bob);
    ctx.save();ctx.beginPath();ctx.ellipse(14,12+bob,11,12,0,0,Math.PI*2);ctx.clip();
    if(i===4||i===5){ctx.translate(28,0);ctx.scale(-1,1);}
    drawPortrait(ctx,charId,2,bob,24,24);ctx.restore();
    if(stage>=2){ctx.strokeStyle=pal.accent;ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(14,12+bob,11.5,12.5,0,0,Math.PI*2);ctx.stroke();}
    if(stage>=3){ctx.fillStyle='#eee8ed';ctx.fillRect(10,23,8,1);ctx.fillRect(13,24,2,2);}
    if(stage>=4){ctx.fillStyle='#ffd982';ctx.fillRect(8,0,12,2);for(const x of [8,13,18])ctx.fillRect(x,0,2,4);}
    if(i===8){ctx.globalCompositeOperation='source-atop';ctx.fillStyle='#ff45664d';ctx.fillRect(0,0,FW,FH);}
    if(i===9){ctx.fillStyle=pal.skin;ctx.fillRect(2,16,3,8);ctx.fillRect(23,16,3,8);}
    return c;
  }
  const img = SHEETS[charId];
  const row = Math.min(stage, Math.floor(img.height / FH)) - 1;
  const c = document.createElement('canvas');
  c.width = FW;
  c.height = FH;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, i * FW, row * FH, FW, FH, 0, 0, FW, FH);
  const base = { ...CHAR_BY_ID[charId].pal, identity: charId };
  const pal = charPal(charId, skinId);
  const map = [];
  for (const k of ['shirt', 'accent']) if (base[k] !== pal[k]) map.push([hexToRgb(base[k]), hexToRgb(pal[k])]);
  if (map.length) {
    const d = ctx.getImageData(0, 0, FW, FH);
    for (let p = 0; p < d.data.length; p += 4) {
      for (const [from, to] of map) {
        if (d.data[p] === from[0] && d.data[p + 1] === from[1] && d.data[p + 2] === from[2]) {
          d.data[p] = to[0];
          d.data[p + 1] = to[1];
          d.data[p + 2] = to[2];
        }
      }
    }
    ctx.putImageData(d, 0, 0);
  }
  return c;
}

export function playerKey(charId, skinId, stage) {
  return `pl_${charId}_${skinId}_${stage}`;
}

export function ensurePlayerTex(scene, charId, skinId, stage) {
  const key = playerKey(charId, skinId, stage);
  if (scene.textures.exists(key + '_d0')) return key;
  const pal = charPal(charId, skinId);
  // face sprite sheets (tools/make_sprites.py): 28x30 frames, 10 per row, one row per stage
  if (SHEETS[charId]) {
    const names = FRAME_NAMES;
    names.forEach((n, i) => {
      const fc = sheetFrame(charId, skinId, stage, i);
      mk(scene, `${key}_${n}`, FW, FH, (ctx) => ctx.drawImage(fc, 0, 0));
    });
    return key;
  }
  for (const d of ['d', 'u', 'l', 'r'])
    for (const f of [0, 1]) mk(scene, `${key}_${d}${f}`, 16, 16, (ctx) => drawPlayer(ctx, d, f, pal, stage, 'walk'));
  mk(scene, `${key}_hurt`, 16, 16, (ctx) => drawPlayer(ctx, 'd', 0, pal, stage, 'hurt'));
  mk(scene, `${key}_win`, 16, 16, (ctx) => drawPlayer(ctx, 'd', 0, pal, stage, 'win'));
  return key;
}

// big preview (for menus), canvas -> data URL
export function playerPreviewURL(charId, skinId, stage, scale = 6) {
  let src;
  let w = 16;
  let h = 16;
  if (SHEETS[charId]) {
    src = sheetFrame(charId, skinId, stage, 0);
    w = FW;
    h = FH;
  } else {
    src = document.createElement('canvas');
    src.width = 16;
    src.height = 16;
    drawPlayer(src.getContext('2d'), 'd', 0, charPal(charId, skinId), stage, 'walk');
  }
  const o = document.createElement('canvas');
  o.width = w * scale;
  o.height = h * scale;
  const octx = o.getContext('2d');
  octx.imageSmoothingEnabled = false;
  octx.drawImage(src, 0, 0, o.width, o.height);
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
  for (const t of ENEMY_TYPES) {
    const bossId = {zeta:'zetaboss', hulio:'hulioboss', dildo:'dildoboss'}[t];
    for (const f of [0, 1]) {
      if (bossId && portraitAtlas) mk(scene, `en_${t}_${f}`, FW, FH, ctx => ctx.drawImage(sheetFrame(bossId, 'base', 3, f),0,0));
      else mk(scene, `en_${t}_${f}`, 16, 16, ctx => drawEnemy(ctx,t,f));
    }
  }
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
    P(ctx, 7, 7, 2, 2, '#d5e9b9');
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
