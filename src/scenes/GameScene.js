import Phaser from 'phaser';
import { TILE, COLS, ROWS, MW, MH, BASE_SPEED, MAX_SPEED, DIRS, opp, clamp, levelFromXp, stageForLevel, MAX_LIVES, MAX_BLACKPILL } from '../config.js';
import { generateMaze, idx, isFloor, isPlayerPass, distField, glitchWalls, inb } from '../maze.js';
import { makeRng } from '../rng.js';
import { WORLDS, levelDef, BOSSES, CHAR_BY_ID, SKIN_BY_ID, BONUS_TYPES } from '../data.js';
import * as SV from '../save.js';
import { ensurePlayerTex, buildBaseTextures } from '../textures.js';
import { sfx, startMusic, stopMusic } from '../audio.js';
import { haptic } from '../tg.js';
import { bus } from '../bus.js';

const FONT = '"Press Start 2P", monospace';
const MODE_SEQ = [7, 20, 7, 20, 5, 20, 5, 9999]; // scatter, chase, scatter, ...
const T = (x) => x * TILE;

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('game');
    this.S = null;
    this.parts = [];
    this.flash = [];
    this.autoTick = true;
    this.running = false;
  }

  create() {
    buildBaseTextures(this);
    this.bg = this.add.graphics();
    this.mz = this.add.container(0, 0);
    this.panel = this.add.graphics();
    this.wallG = this.add.graphics();
    this.fakeG = this.add.graphics();
    this.flashG = this.add.graphics();
    this.lPads = this.add.container(0, 0);
    this.lItems = this.add.container(0, 0);
    this.lActors = this.add.container(0, 0);
    this.zoneG = this.add.graphics();
    this.pg = this.add.graphics();
    this.fx = this.add.container(0, 0);
    this.mz.add([this.panel, this.wallG, this.fakeG, this.flashG, this.lPads, this.lItems, this.lActors, this.zoneG, this.pg, this.fx]);
    this.world = WORLDS[0];
    this.layout();
    this.scale.on('resize', () => this.layout());
    this._kd = (e) => this.onKey(e);
    window.addEventListener('keydown', this._kd);
    bus.on('input:dir', (d) => this.setWant(d));
    bus.on('input:ability', () => this.useAbility());
    bus.on('input:item', (id) => this.useItem(id));
    bus.on('input:pause', () => this.pause());
    this.running = true;
  }

  layout() {
    const w = this.scale.width;
    const h = this.scale.height;
    this.ox = Math.floor((w - MW) / 2);
    this.oy = Math.floor((h - MH) / 2);
    this.mz.setPosition(this.ox, this.oy);
    this.drawBackdrop();
  }

  // ---------------- backdrop ----------------
  drawBackdrop(worldIdx) {
    if (worldIdx !== undefined) this.world = WORLDS[worldIdx];
    const wd = this.world;
    const w = this.scale.width;
    const h = this.scale.height;
    const g = this.bg;
    g.clear();
    const c1 = Phaser.Display.Color.IntegerToColor(wd.sky[0]);
    const c2 = Phaser.Display.Color.IntegerToColor(wd.sky[1]);
    const bands = 24;
    for (let i = 0; i < bands; i++) {
      const c = Phaser.Display.Color.Interpolate.ColorWithColor(c1, c2, bands - 1, i);
      g.fillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b), 1);
      g.fillRect(0, Math.floor((h * i) / bands), w, Math.ceil(h / bands) + 1);
    }
    const rng = makeRng(wd.id * 31 + 7);
    for (let i = 0; i < 40; i++) {
      g.fillStyle(0xffffff, 0.3 + rng() * 0.5);
      g.fillRect(Math.floor(rng() * w), Math.floor(rng() * h * 0.5), 1, 1);
    }
    // skyline
    let x = 0;
    const base = h;
    while (x < w) {
      const bw = 14 + rng.int(26);
      const bh = 40 + rng.int(Math.floor(h * 0.45));
      g.fillStyle(wd.building, 1);
      g.fillRect(x, base - bh, bw, bh);
      g.fillStyle(wd.neon, 0.35);
      g.fillRect(x, base - bh, bw, 1);
      for (let wy = base - bh + 4; wy < base - 4; wy += 6)
        for (let wx = x + 3; wx < x + bw - 3; wx += 5) {
          if (rng() < 0.35) {
            g.fillStyle(rng() < 0.15 ? wd.accent : wd.win, 0.55);
            g.fillRect(wx, wy, 2, 3);
          }
        }
      if (rng() < 0.25) {
        g.fillStyle(wd.accent, 0.8);
        g.fillRect(x + 2, base - bh - 6, Math.min(bw - 4, 14), 4);
      }
      x += bw + rng.int(3);
    }
    // synthwave floor lines
    g.lineStyle(1, wd.neon, 0.12);
    for (let y = h - 30; y < h; y += 6) g.lineBetween(0, y, w, y);
    // dim overlay so maze reads clearly
    g.fillStyle(0x000000, 0.35);
    g.fillRect(0, 0, w, h);
  }

  // ---------------- level setup ----------------
  clearLevel() {
    for (const l of [this.lPads, this.lItems, this.lActors, this.fx]) l.removeAll(true);
    this.parts = [];
    this.flash = [];
    this.panel.clear();
    this.zoneG.clear();
    this.pg.clear();
    this.wallG.clear();
    this.fakeG.clear();
    this.flashG.clear();
  }

  startLevel(opts) {
    const { w, l } = opts;
    this.opts = opts;
    this.clearLevel();
    const def = levelDef(w, l);
    this.def = def;
    this.hard = !!opts.hard;
    this.world = WORLDS[w - 1];
    this.drawBackdrop();
    const maze = generateMaze(def.seed, def);
    this.maze = maze;
    maze.pel = maze.pel.slice();
    const d = SV.S();
    const cid = d.sel;
    const cdef = CHAR_BY_ID[cid];
    const csv = d.chars[cid];
    const st = SV.charStats(cid);
    const stage = stageForLevel(st.level);
    this.ch = { id: cid, def: cdef, save: csv, st, stage, tex: ensurePlayerTex(this, cid, csv.skin, stage) };
    const skin = SKIN_BY_ID[csv.skin];

    const bossDef = def.boss ? BOSSES[def.boss] : null;
    const S = (this.S = {
      state: 'ready',
      readyT: 1.8,
      time: 0,
      animT: 0,
      score: 0,
      mult: 1,
      chain: 0,
      lastPick: -9,
      lives: 3,
      nextLife: 10000,
      coinsGot: 0,
      coinsPicked: 0,
      xpGot: 0,
      pelletsLeft: maze.pelletCount,
      pelletsEaten: 0,
      eaten: 0,
      deaths: 0,
      frightT: 0,
      frightMax: 0,
      eatChain: 0,
      bonuses: [],
      shield: false,
      abilCd: 0,
      abilT: 0,
      abilShield: 0,
      invuln: 0,
      modeIdx: 0,
      modeT: MODE_SEQ[0],
      scatter: true,
      glitchT: 15,
      glitchPending: null,
      bossDef,
      bossHp: bossDef ? bossDef.hp : 0,
      phase: 1,
      secrets: 0,
      pickups: 0,
      dieT: 0,
      hudT: 0,
      sphereRespawn: [],
      bonusRespawn: [],
      libLevel: levelFromXp(csv.xp).level,
      won: false,
      popped: false,
    });
    this.P = { x: maze.start[0], y: maze.start[1], dir: -1, want: -1, wantT: 0, face: 'd', walkT: 0, spr: null, aura: null };
    this.drawStatic();
    this.buildItems();
    this.buildActors(skin);
    this.buildZones();
    this.modeSeqFields = {};
    stopMusic();
    startMusic(bossDef && bossDef.hp >= 4 ? 5 : this.world.music);
    this.banner(`W${w}-${l}  ${this.world.name.toUpperCase()}`, '#ffffff', 1.6);
    if (bossDef) {
      sfx.boss();
      this.time.delayedCall(900, () => this.banner(`BOSS: ${bossDef.name}`, '#ff4a4a', 1.4));
    }
    this.emitHud(true);
    bus.emit('level:start', { def, hard: this.hard });
  }

  drawStatic() {
    const maze = this.maze;
    this.panel.clear();
    this.panel.fillStyle(0x05030c, 0.88);
    this.panel.fillRect(-4, -4, MW + 8, MH + 8);
    this.drawWalls();
    // speed pads
    for (const p of maze.pads) {
      const x = p.idx % COLS;
      const y = (p.idx / COLS) | 0;
      const im = this.add.image(T(x) + 8, T(y) + 8, `pad_${p.axis}`);
      this.lPads.add(im);
      this.tweens.add({ targets: im, alpha: 0.45, duration: 450, yoyo: true, repeat: -1 });
    }
  }

  drawWalls() {
    const g = this.wallG;
    const { grid } = this.maze;
    const wd = this.world;
    g.clear();
    for (let y = 0; y < ROWS; y++)
      for (let x = 0; x < COLS; x++) {
        if (grid[idx(x, y)] !== 1) continue;
        this.wallTile(g, x, y, wd, 1);
      }
  }

  wallTile(g, x, y, wd, a) {
    const { grid } = this.maze;
    const px = T(x);
    const py = T(y);
    g.fillStyle(wd.fill, a);
    g.fillRect(px, py, TILE, TILE);
    const open = (nx, ny) => inb(nx, ny) && grid[idx(nx, ny)] !== 1;
    const edge = (cond, rx, ry, rw, rh, rx2, ry2) => {
      if (!cond) return;
      g.fillStyle(wd.neon, a);
      g.fillRect(rx, ry, rw, rh);
      g.fillStyle(wd.neon2, a);
      g.fillRect(rx2, ry2, rw === 1 ? 1 : rw, rh === 1 ? 1 : rh);
    };
    edge(open(x, y - 1), px, py, TILE, 1, px, py + 1);
    edge(open(x, y + 1), px, py + TILE - 1, TILE, 1, px, py + TILE - 2);
    edge(open(x - 1, y), px, py, 1, TILE, px + 1, py);
    edge(open(x + 1, y), px + TILE - 1, py, 1, TILE, px + TILE - 2, py);
  }

  buildItems() {
    const maze = this.maze;
    const S = this.S;
    this.pelSpr = new Map();
    this.coinSpr = new Map();
    this.sphSpr = new Map();
    this.bonSpr = new Map();
    maze.pel.forEach((v, i) => {
      if (!v) return;
      const im = this.add.image(T(i % COLS) + 8, T((i / COLS) | 0) + 8, 'pellet');
      this.lItems.add(im);
      this.pelSpr.set(i, im);
    });
    for (const c of maze.coins) {
      const im = this.add.image(T(c.idx % COLS) + 8, T((c.idx / COLS) | 0) + 8, 'coin_0');
      im.v = c.v;
      this.lItems.add(im);
      this.coinSpr.set(c.idx, im);
    }
    for (const i of maze.spheres) this.addSphere(i);
    const rng = makeRng(this.def.seed + 99);
    const pool = ['chad', 'shield', 'magnet', 'freeze'];
    if (this.def.zones > 0 || this.def.w >= 2) pool.push('ghost');
    this.bonusRng = rng;
    this.bonusPool = pool;
    maze.bonusSpots.forEach((i) => this.addBonus(i, rng.pick(pool)));
  }

  addSphere(i) {
    const im = this.add.image(T(i % COLS) + 8, T((i / COLS) | 0) + 8, 'sphere_0');
    this.lItems.add(im);
    this.sphSpr.set(i, im);
  }

  addBonus(i, type) {
    const im = this.add.image(T(i % COLS) + 8, T((i / COLS) | 0) + 8, `bonus_${type}`);
    im.type = type;
    this.lItems.add(im);
    this.tweens.add({ targets: im, y: im.y - 2, duration: 500, yoyo: true, repeat: -1 });
    this.bonSpr.set(i, im);
  }

  buildActors(skin) {
    const S = this.S;
    const maze = this.maze;
    const P = this.P;
    // aura (stage 4 or rare skin)
    if (this.ch.stage >= 4 || (skin && skin.aura)) {
      const a = this.add.graphics();
      this.lActors.add(a);
      P.aura = a;
      P.auraCol = skin && skin.aura ? skin.aura : 0xffd23f;
    }
    P.spr = this.add.image(0, 0, this.ch.tex + '_d0');
    this.lActors.add(P.spr);
    this.placeSprite(P.spr, P.x, P.y);
    // enemies
    this.enemies = [];
    const list = [...this.def.enemies];
    const bossDef = S.bossDef;
    if (bossDef) list.unshift('BOSS');
    list.forEach((type, i) => {
      const e = this.makeEnemy(type === 'BOSS' ? bossDef.tex : type, i, type === 'BOSS' ? bossDef : null);
      this.enemies.push(e);
    });
  }

  makeEnemy(type, i, bossDef, temp) {
    const maze = this.maze;
    const sp = maze.spawns[i % 4];
    const e = {
      type,
      boss: bossDef,
      x: sp[0],
      y: sp[1],
      dir: -1,
      state: 'wait',
      releaseT: temp ? 0.3 : 0.8 + i * 2.2,
      spawn: sp,
      corner: maze.corners[i % 4],
      tgt: null,
      tgtT: 0,
      tpT: 6 + Math.random() * 4,
      wp: null,
      waitT: 0,
      immune: 0,
      temp: !!temp,
      life: temp ? 14 : 0,
      summonT: 8,
      gT: 10,
      anim: 0,
    };
    e.spr = this.add.image(0, 0, `en_${type}_0`);
    if (bossDef) e.spr.setScale(bossDef.hp >= 4 ? 1.35 : 1.2);
    this.lActors.add(e.spr);
    this.placeSprite(e.spr, e.x, e.y);
    return e;
  }

  buildZones() {
    this.zones = [];
    const S = this.S;
    const n = this.def.zones;
    if (!n) return;
    const dist = distField(this.maze.grid, this.maze.start[0], this.maze.start[1]);
    const rng = makeRng(this.def.seed + 5);
    const far = this.maze.floors.filter((i) => dist[i] >= 9 && (i % COLS) & 1 && ((i / COLS) | 0) & 1);
    rng.shuffle(far);
    for (let k = 0; k < n && k < far.length; k++) {
      const i = far[k];
      this.zones.push({ tiles: [[i % COLS, (i / COLS) | 0]], len: 2, maxLen: 4, t: 0, growT: 18, dormant: this.def.boss === 'dildo' });
    }
  }

  placeSprite(spr, x, y) {
    spr.setPosition(Math.round(T(x) + 8), Math.round(T(y) + 8));
  }

  // ---------------- input ----------------
  onKey(e) {
    const k = e.key;
    const map = { ArrowUp: 0, w: 0, W: 0, ArrowRight: 1, d: 1, D: 1, ArrowDown: 2, s: 2, S: 2, ArrowLeft: 3, a: 3, A: 3 };
    if (k in map) {
      if (this.S && this.S.state !== 'idle') e.preventDefault();
      this.setWant(map[k]);
    } else if (k === ' ' || k === 'e' || k === 'E') {
      if (this.S && (this.S.state === 'play' || this.S.state === 'ready')) {
        e.preventDefault();
        this.useAbility();
      }
    } else if (k === 'Escape' || k === 'p' || k === 'P') {
      bus.emit('key:escape');
    }
  }

  setWant(d) {
    if (!this.P) return;
    this.P.want = d;
    this.P.wantT = 1.5;
  }

  pause() {
    if (!this.S) return;
    if (this.S.state === 'play' || this.S.state === 'ready' || this.S.state === 'dying') {
      this.S.prevState = this.S.state;
      this.S.state = 'paused';
      bus.emit('paused', true);
    }
  }

  resume() {
    if (this.S && this.S.state === 'paused') {
      this.S.state = this.S.prevState || 'play';
      bus.emit('paused', false);
    }
  }

  quit() {
    if (this.S) this.S.state = 'idle';
    stopMusic();
    this.clearLevel();
    this.maze = null;
    this.enemies = [];
    this.zones = [];
    this.P = null;
    this.S = null;
  }

  // ---------------- bonuses & abilities ----------------
  bonusDur(type) {
    const st = this.ch.st;
    let d = BONUS_TYPES[type].dur;
    if (this.ch.def.ability.id === 'sigma_grind') d *= 1.5;
    if (type === 'shield') d += st.shieldBonus;
    return d;
  }

  addBonusEffect(type) {
    const S = this.S;
    const dur = this.bonusDur(type);
    const ex = S.bonuses.find((b) => b.type === type);
    if (ex) {
      ex.t = ex.max = dur;
    } else {
      if (S.bonuses.length >= this.ch.st.slots) {
        const old = S.bonuses.shift();
        if (old.type === 'shield') S.shield = false;
      }
      S.bonuses.push({ type, t: dur, max: dur });
    }
    if (type === 'shield') S.shield = true;
    SV.bumpStat('bonuses');
    sfx.bonus();
    haptic('collect');
  }

  hasBonus(t) {
    return this.S.bonuses.some((b) => b.type === t);
  }

  useItem(id) {
    const S = this.S;
    if (!S || S.state !== 'play') return;
    const inv = SV.S().inv;
    if ((inv[id] || 0) < 1) return;
    inv[id]--;
    SV.save();
    this.addBonusEffect(id === 'energy' ? 'chad' : 'shield');
    this.popup(this.P.x * TILE + 8, this.P.y * TILE - 2, id === 'energy' ? 'BOOST' : 'SHIELD', '#7cf0ff');
    this.emitHud(true);
  }

  useAbility() {
    const S = this.S;
    if (!S || S.state !== 'play' || S.abilCd > 0 || S.abilT > 0) return;
    const ab = this.ch.def.ability;
    S.abilId = ab.id;
    S.abilT = ab.dur;
    S.abilMax = ab.dur;
    S.abilCd = ab.cd * this.ch.st.cdMul + ab.dur;
    S.abilCdMax = S.abilCd;
    if (ab.id === 'sigma_grind') S.abilShield = 3 + this.ch.st.shieldBonus;
    SV.bumpStat('ability');
    sfx.ability();
    haptic('heavy');
    this.burst(this.P.x * TILE + 8, this.P.y * TILE + 8, 0xff4fd8, 18, 40);
    this.popup(this.P.x * TILE + 8, this.P.y * TILE - 4, ab.name.toUpperCase(), '#ff9ff3');
  }

  // ---------------- effects ----------------
  burst(x, y, color, n = 10, speed = 30) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.3 + Math.random());
      this.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.5 + Math.random() * 0.4, max: 0.9, c: color, s: Math.random() < 0.3 ? 2 : 1 });
    }
  }

  popup(x, y, str, color = '#ffffff', size = 8) {
    const t = this.add.text(Math.round(x), Math.round(y), str, { fontFamily: FONT, fontSize: size + 'px', color, stroke: '#000000', strokeThickness: 2 }).setOrigin(0.5);
    this.fx.add(t);
    this.tweens.add({ targets: t, y: y - 14, alpha: 0, duration: 1000, onComplete: () => t.destroy() });
  }

  banner(str, color = '#fff', dur = 1.4) {
    const t = this.add.text(MW / 2, MH / 2 - 20, str, { fontFamily: FONT, fontSize: '10px', color, stroke: '#000', strokeThickness: 3, align: 'center', wordWrap: { width: MW - 20 } }).setOrigin(0.5);
    this.fx.add(t);
    this.tweens.add({ targets: t, alpha: 0, delay: dur * 700, duration: dur * 300, onComplete: () => t.destroy() });
  }

  // ---------------- main loop ----------------
  update(time, delta) {
    const dt = Math.min(delta / 1000, 0.05);
    if (!this.S) {
      this.drawParts(dt);
      return;
    }
    if (this.autoTick) this.step(dt);
    else this.drawParts(0);
  }

  step(dt) {
    const S = this.S;
    if (!S) return;
    S.animT += dt;
    if (S.state === 'ready') {
      S.readyT -= dt;
      if (S.readyT <= 0) {
        S.state = 'play';
        sfx.spawn();
      }
      this.render(dt);
      return;
    }
    if (S.state === 'play') this.tick(dt);
    else if (S.state === 'dying') this.tickDying(dt);
    else if (S.state === 'won' || S.state === 'lost') {
      S.endT -= dt;
      if (S.endT <= 0 && !S.ended) {
        S.ended = true;
        bus.emit(S.state === 'won' ? 'level:won' : 'level:lost', this.result);
      }
    }
    this.render(dt);
  }

  tick(dt) {
    const S = this.S;
    const P = this.P;
    const maze = this.maze;
    S.time += dt;
    // combo decay
    if (S.chain > 0 && S.time - S.lastPick > 1.2) {
      S.chain = 0;
      S.mult = 1;
    }
    if (S.invuln > 0) S.invuln -= dt;
    if (S.abilCd > 0) S.abilCd -= dt;
    if (S.abilT > 0) {
      S.abilT -= dt;
      if (S.abilT <= 0) S.abilT = 0;
    }
    if (S.abilShield > 0) S.abilShield -= dt;
    for (const b of S.bonuses) b.t -= dt;
    const expired = S.bonuses.filter((b) => b.t <= 0);
    if (expired.length) {
      S.bonuses = S.bonuses.filter((b) => b.t > 0);
      if (expired.some((b) => b.type === 'shield')) S.shield = false;
    }
    if (P.wantT > 0) {
      P.wantT -= dt;
      if (P.wantT <= 0) P.want = -1;
    }
    // scatter / chase timer
    S.modeT -= dt;
    if (S.modeT <= 0 && S.modeIdx < MODE_SEQ.length - 1) {
      S.modeIdx++;
      S.modeT = MODE_SEQ[S.modeIdx];
      S.scatter = S.modeIdx % 2 === 0;
    }
    // fright
    if (S.frightT > 0) {
      S.frightT -= dt;
      if (S.frightT <= 0) {
        S.frightT = 0;
        for (const e of this.enemies) if (e.state === 'fright') e.state = 'normal';
      }
    }
    this.movePlayer(dt);
    this.pickups(dt);
    this.updateEnemies(dt);
    this.updateZones(dt);
    this.updateGlitch(dt);
    this.updateRespawns(dt);
    this.collisions();
    if (S.state === 'play' && !S.bossDef && S.pelletsLeft <= 0) this.finish(true);
    S.hudT -= dt;
    if (S.hudT <= 0) {
      S.hudT = 0.1;
      this.emitHud();
    }
  }

  // ---------------- movement ----------------
  playerSpeed() {
    const S = this.S;
    let m = this.ch.st.speedMul;
    if (this.hasBonus('chad')) m *= 1.3;
    if (S.abilT > 0 && S.abilId === 'chad_dash') m *= 1.4;
    const P = this.P;
    const tx = Math.round(P.x);
    const ty = Math.round(P.y);
    if (this.maze.pads.length && Math.abs(P.x - tx) < 0.5 && Math.abs(P.y - ty) < 0.5) {
      const pad = this.maze.pads.find((p) => p.idx === idx(tx, ty));
      if (pad && ((pad.axis === 'h' && (P.dir === 1 || P.dir === 3)) || (pad.axis === 'v' && (P.dir === 0 || P.dir === 2)))) m *= 1.6;
    }
    return Math.min(MAX_SPEED, BASE_SPEED * m);
  }

  canGoPlayer(x, y, d) {
    const [dx, dy] = DIRS[d];
    return isPlayerPass(this.maze.grid, x + dx, y + dy);
  }

  movePlayer(dt) {
    const P = this.P;
    // reverse mid-tile
    if (P.want >= 0 && P.dir >= 0 && P.want === opp(P.dir)) {
      P.dir = P.want;
      P.want = -1;
    }
    const decide = (p) => {
      if (p.want >= 0 && this.canGoPlayer(p.x, p.y, p.want)) {
        const d = p.want;
        p.want = -1;
        return d;
      }
      if (p.dir >= 0 && this.canGoPlayer(p.x, p.y, p.dir)) return p.dir;
      return -1;
    };
    const before = P.x + P.y;
    this.moveActor(P, this.playerSpeed() * dt, decide);
    if (P.dir >= 0) {
      P.walkT += dt;
      P.face = ['u', 'r', 'd', 'l'][P.dir];
    }
  }

  moveActor(a, dist, decide) {
    let guard = 0;
    while (dist > 1e-5 && guard++ < 8) {
      const cx = Math.round(a.x);
      const cy = Math.round(a.y);
      const atC = Math.abs(a.x - cx) < 1e-4 && Math.abs(a.y - cy) < 1e-4;
      if (atC) {
        a.x = cx;
        a.y = cy;
        const nd = decide(a);
        if (nd < 0) {
          a.dir = -1;
          return;
        }
        a.dir = nd;
      }
      if (a.dir < 0) return;
      const [dx, dy] = DIRS[a.dir];
      const pos = dx ? a.x : a.y;
      const sgn = dx || dy;
      const tgt = atC ? pos + sgn : sgn > 0 ? Math.ceil(pos - 1e-6) : Math.floor(pos + 1e-6);
      const dd = Math.abs(tgt - pos);
      if (dist >= dd - 1e-6) {
        if (dx) a.x = tgt;
        else a.y = tgt;
        dist -= dd;
      } else {
        if (dx) a.x += sgn * dist;
        else a.y += sgn * dist;
        dist = 0;
      }
    }
  }

  // ---------------- pickups ----------------
  chainPick() {
    const S = this.S;
    S.chain = S.time - S.lastPick <= 1.2 ? S.chain + 1 : 1;
    S.lastPick = S.time;
    S.mult = Math.min(5, 1 + Math.floor(S.chain / 10));
  }

  addScore(n) {
    const S = this.S;
    S.score += Math.round(n * this.ch.st.scoreMul);
    while (S.score >= S.nextLife) {
      S.nextLife += 10000;
      if (S.lives < MAX_LIVES) {
        S.lives++;
        this.popup(this.P.x * TILE + 8, this.P.y * TILE - 6, '1UP', '#ff6b9d');
        sfx.levelup();
      }
    }
  }

  addXp(n) {
    const S = this.S;
    S.xpGot += n;
    const c = this.ch.save;
    const lvl = levelFromXp(c.xp + S.xpGot).level;
    if (lvl > S.libLevel) {
      S.libLevel = lvl;
      sfx.levelup();
      haptic('levelup');
      this.burst(this.P.x * TILE + 8, this.P.y * TILE + 8, 0xffd23f, 26, 55);
      this.popup(this.P.x * TILE + 8, this.P.y * TILE - 8, 'LEVEL UP!', '#ffd23f');
    }
  }

  pickups(dt) {
    const S = this.S;
    const P = this.P;
    const maze = this.maze;
    const tx = Math.round(P.x);
    const ty = Math.round(P.y);
    const i = idx(tx, ty);
    const near = Math.abs(P.x - tx) < 0.45 && Math.abs(P.y - ty) < 0.45;
    if (near) {
      if (maze.pel[i]) {
        maze.pel[i] = 0;
        S.pelletsLeft--;
        S.pelletsEaten++;
        this.pelSpr.get(i).destroy();
        this.pelSpr.delete(i);
        this.chainPick();
        this.addScore(10 * S.mult);
        this.addXp(1);
        SV.bumpStat('pellets');
        sfx.pellet();
      }
      if (this.coinSpr.has(i)) this.collectCoin(i);
      if (this.sphSpr.has(i)) {
        const sp = this.sphSpr.get(i);
        sp.destroy();
        this.sphSpr.delete(i);
        this.chainPick();
        this.addScore(50);
        if (S.bossDef) S.sphereRespawn.push({ t: 10, i });
        this.startFright();
        sfx.ability();
        haptic('collect');
        this.burst(P.x * TILE + 8, P.y * TILE + 8, 0x39ffff, 14, 35);
      }
      if (this.bonSpr.has(i)) {
        const b = this.bonSpr.get(i);
        this.bonSpr.delete(i);
        const type = b.type;
        b.destroy();
        S.bonusRespawn.push({ t: 28 });
        this.addBonusEffect(type);
        this.popup(P.x * TILE + 8, P.y * TILE - 4, BONUS_TYPES[type].name.toUpperCase(), BONUS_TYPES[type].color);
        this.burst(P.x * TILE + 8, P.y * TILE + 8, 0xffffff, 10, 30);
      }
      const sec = maze.secrets.find((s) => s.room === i && !s.found);
      if (sec) {
        sec.found = true;
        S.secrets++;
        S.coinsGot += sec.coins;
        SV.bumpStat('coins', sec.coins);
        this.popup(P.x * TILE + 8, P.y * TILE - 6, `SECRET +${sec.coins}`, '#ffd23f');
        this.burst(P.x * TILE + 8, P.y * TILE + 8, 0xffd23f, 30, 50);
        sfx.coin();
        sfx.levelup();
        haptic('levelup');
        if (sec.bonus) this.addBonusEffect(this.bonusRng.pick(this.bonusPool));
        this.addScore(500);
      }
    }
    // coin magnet
    if (this.hasBonus('magnet')) {
      const r = 3 + this.ch.st.magnetBonus;
      for (const [ci, spr] of this.coinSpr) {
        const cx = ci % COLS;
        const cy = (ci / COLS) | 0;
        const d = Math.hypot(cx - P.x, cy - P.y);
        if (d <= r) {
          spr.mag = true;
        }
        if (spr.mag) {
          const mx = P.x * TILE + 8;
          const my = P.y * TILE + 8;
          const dx = mx - spr.x;
          const dy = my - spr.y;
          const l = Math.hypot(dx, dy) || 1;
          const sp = Math.min(l, 130 * dt);
          spr.x += (dx / l) * sp;
          spr.y += (dy / l) * sp;
          if (l < 6) this.collectCoin(ci);
        }
      }
    }
  }

  collectCoin(i) {
    const S = this.S;
    const spr = this.coinSpr.get(i);
    if (!spr) return;
    let v = spr.v;
    let mul = this.ch.st.coinMul;
    if (S.abilT > 0 && S.abilId === 'hustle') mul *= 2;
    if (this.hard) mul *= 1.5;
    const got = Math.max(1, Math.round(v * mul));
    S.coinsGot += got;
    S.coinsPicked++;
    S.coinsGotBase = (S.coinsGotBase || 0) + 1;
    SV.bumpStat('coins', got);
    spr.destroy();
    this.coinSpr.delete(i);
    this.maze.coinIdx.delete(i);
    this.chainPick();
    this.addScore(50 * S.mult);
    this.addXp(2);
    sfx.coin();
    haptic('collect');
    this.popup(spr.x, spr.y - 6, `+${got}`, '#ffd23f');
    this.burst(spr.x, spr.y, 0xffd23f, 8, 28);
  }

  startFright() {
    const S = this.S;
    const dur = Math.max(2.5, this.def.frightSec + this.ch.st.frightBonus - (this.hard ? 1.5 : 0));
    S.frightT = S.frightMax = dur;
    S.eatChain = 0;
    for (const e of this.enemies) {
      if (e.state === 'normal') {
        e.state = 'fright';
        if (e.dir >= 0) e.dir = opp(e.dir);
      }
    }
  }

  updateRespawns(dt) {
    const S = this.S;
    for (const r of S.sphereRespawn) r.t -= dt;
    for (const r of S.sphereRespawn.filter((r) => r.t <= 0)) this.addSphere(r.i);
    S.sphereRespawn = S.sphereRespawn.filter((r) => r.t > 0);
    for (const r of S.bonusRespawn) r.t -= dt;
    const due = S.bonusRespawn.filter((r) => r.t <= 0);
    S.bonusRespawn = S.bonusRespawn.filter((r) => r.t > 0);
    for (const r of due) {
      const P = this.P;
      const spots = this.maze.floors.filter((i) => Math.abs((i % COLS) - P.x) + Math.abs(((i / COLS) | 0) - P.y) > 7 && !this.bonSpr.has(i) && (i % COLS) & 1 && ((i / COLS) | 0) & 1);
      if (spots.length) this.addBonus(this.bonusRng.pick(spots), this.bonusRng.pick(this.bonusPool));
    }
  }

  // ---------------- enemies ----------------
  enemySpeed(e) {
    const S = this.S;
    const def = this.def;
    let f;
    if (e.boss) {
      f = e.boss.speed;
      if (e.boss.id === 'dildo') f += 0.03 * (S.phase - 1);
    } else if (e.type === 'doomer') f = 0.45 + 0.005 * def.g;
    else if (e.type === 'hunter') f = Math.min(0.88, def.speedF + 0.18);
    else if (e.type === 'glitch') f = def.speedF + 0.04;
    else f = def.speedF;
    if (this.hard) f += 0.06;
    f = Math.min(0.95, f);
    let m = 1;
    if (e.state === 'fright') m *= 0.55;
    if (e.state === 'eyes') return BASE_SPEED * 1.8;
    if (this.hasBonus('freeze')) m *= 0.3;
    const P = this.P;
    const d = Math.hypot(e.x - P.x, e.y - P.y);
    if (S.abilT > 0 && S.abilId === 'mog_aura' && d < 4) m *= 0.5;
    if (this.ch.st.auraPassive && d < 2) m *= 0.85;
    return BASE_SPEED * f * m;
  }

  nearestFloor(x, y) {
    let best = null;
    let bd = 1e9;
    for (const i of this.maze.floors) {
      const d = Math.abs((i % COLS) - x) + Math.abs(((i / COLS) | 0) - y);
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    return [best % COLS, (best / COLS) | 0];
  }

  randomFloor() {
    const f = this.maze.floors;
    const i = f[Math.floor(Math.random() * f.length)];
    return [i % COLS, (i / COLS) | 0];
  }

  chooseDir(e, tgt, away = false) {
    const grid = this.maze.grid;
    const opts = [];
    for (let d = 0; d < 4; d++) {
      const [dx, dy] = DIRS[d];
      if (isFloor(grid, e.x + dx, e.y + dy)) opts.push(d);
    }
    if (!opts.length) return -1;
    let ch = opts.filter((d) => e.dir < 0 || d !== opp(e.dir));
    if (!ch.length) ch = opts;
    if (!tgt) return ch[Math.floor(Math.random() * ch.length)];
    const field = distField(grid, tgt[0], tgt[1]);
    let best = [];
    let bv = away ? -1 : 1e9;
    for (const d of ch) {
      const [dx, dy] = DIRS[d];
      const v = field[idx(e.x + dx, e.y + dy)];
      if (v < 0) continue;
      if (away ? v > bv : v < bv) {
        bv = v;
        best = [d];
      } else if (v === bv) best.push(d);
    }
    if (!best.length) return ch[Math.floor(Math.random() * ch.length)];
    return best[Math.floor(Math.random() * best.length)];
  }

  enemyTarget(e) {
    const S = this.S;
    const P = this.P;
    const phased = S.abilT > 0 && S.abilId === 'phase';
    const ai = e.boss ? e.boss.ai : e.type === 'mini' ? 'hunter' : e.type;
    const ptile = [Math.round(P.x), Math.round(P.y)];
    if (S.abilT > 0 && S.abilId === 'mog_aura' && Math.hypot(e.x - P.x, e.y - P.y) < 4) return { t: ptile, away: true };
    if (phased) return { t: this.wander(e) };
    if (S.scatter && !e.boss && ai !== 'glitch') return { t: e.corner };
    if (ai === 'chaser') return { t: ptile };
    if (ai === 'hunter') {
      const d = P.dir >= 0 ? P.dir : 0;
      const [dx, dy] = DIRS[d];
      return { t: this.nearestFloor(clamp(ptile[0] + 4 * dx, 1, COLS - 2), clamp(ptile[1] + 4 * dy, 1, ROWS - 2)) };
    }
    if (ai === 'glitch') {
      if (!e.tgt || e.tgtT <= 0 || (Math.round(e.x) === e.tgt[0] && Math.round(e.y) === e.tgt[1])) {
        e.tgtT = 3 + Math.random() * 3;
        e.tgt = Math.random() < 0.45 ? ptile : this.randomFloor();
      }
      return { t: e.tgt };
    }
    if (ai === 'doomer') {
      const field = distField(this.maze.grid, ptile[0], ptile[1]);
      const dd = field[idx(Math.round(e.x), Math.round(e.y))];
      if (dd >= 0 && dd <= 4) return { t: ptile };
      return { t: this.wander(e) };
    }
    return { t: ptile };
  }

  wander(e) {
    if (!e.wp || (Math.round(e.x) === e.wp[0] && Math.round(e.y) === e.wp[1])) {
      // doomers like to stand in narrow corridors
      const grid = this.maze.grid;
      const narrow = this.maze.floors.filter((i) => {
        const x = i % COLS;
        const y = (i / COLS) | 0;
        let n = 0;
        for (const [dx, dy] of DIRS) if (isFloor(grid, x + dx, y + dy)) n++;
        return n === 2;
      });
      const i = narrow[Math.floor(Math.random() * narrow.length)] ?? this.maze.floors[0];
      if (e.wp && e.type === 'doomer') e.waitT = 1.5;
      e.wp = [i % COLS, (i / COLS) | 0];
    }
    return e.wp;
  }

  updateEnemies(dt) {
    const S = this.S;
    const P = this.P;
    for (const e of this.enemies) {
      e.anim += dt;
      e.tgtT -= dt;
      if (e.immune > 0) e.immune -= dt;
      if (e.temp) {
        e.life -= dt;
        if (e.life <= 0) e.dead = true;
      }
      if (e.state === 'wait') {
        e.releaseT -= dt;
        if (e.releaseT <= 0) {
          e.state = S.frightT > 0 && !e.boss ? 'fright' : 'normal';
          sfx.spawn();
        }
        continue;
      }
      if (e.boss) this.bossLogic(e, dt);
      if (e.waitT > 0 && e.state === 'normal') {
        e.waitT -= dt;
        continue;
      }
      if (e.type === 'glitch' && e.state === 'normal') {
        e.tpT -= dt;
        if (e.tpT <= 0) this.glitchTeleport(e);
      }
      const decide = (a) => {
        if (a.state === 'eyes') {
          if (Math.round(a.x) === a.spawn[0] && Math.round(a.y) === a.spawn[1]) {
            a.state = S.frightT > 0 && !a.boss ? 'fright' : 'normal';
            if (a.boss) a.immune = Math.max(a.immune, 1.5);
            return this.chooseDir(a, null);
          }
          return this.chooseDir(a, a.spawn);
        }
        if (a.state === 'fright') return this.chooseDir(a, null);
        const r = this.enemyTarget(a);
        return this.chooseDir(a, r.t, r.away);
      };
      this.moveActor(e, this.enemySpeed(e) * dt, decide);
    }
    if (this.enemies.some((e) => e.dead)) {
      for (const e of this.enemies.filter((x) => x.dead)) e.spr.destroy();
      this.enemies = this.enemies.filter((e) => !e.dead);
    }
  }

  glitchTeleport(e) {
    e.tpT = 8 + Math.random() * 4;
    const P = this.P;
    const field = distField(this.maze.grid, Math.round(e.x), Math.round(e.y));
    const cand = this.maze.floors.filter((i) => field[i] >= 3 && field[i] <= 5 && Math.hypot((i % COLS) - P.x, ((i / COLS) | 0) - P.y) > 3);
    if (!cand.length) return;
    this.burst(e.spr.x, e.spr.y, 0xff2fb4, 10, 40);
    this.burst(e.spr.x, e.spr.y, 0x39ffff, 8, 30);
    const i = cand[Math.floor(Math.random() * cand.length)];
    e.x = i % COLS;
    e.y = (i / COLS) | 0;
    e.dir = -1;
    this.burst(T(e.x) + 8, T(e.y) + 8, 0xff2fb4, 10, 40);
  }

  bossLogic(e, dt) {
    const S = this.S;
    const id = e.boss.id;
    if (S.state !== 'play') return;
    if (id === 'dildo') {
      const ph = S.bossHp >= 4 ? 1 : S.bossHp >= 2 ? 2 : 3;
      if (ph !== S.phase) {
        S.phase = ph;
        this.banner(`PHASE ${ph}`, '#ff4a4a', 1.2);
        sfx.boss();
        for (const z of this.zones) z.dormant = ph < 2;
      }
    }
    if (e.state !== 'normal' && e.state !== 'fright') return;
    const summoner = id === 'zeta' || (id === 'dildo' && S.phase >= 1);
    const glitcher = id === 'hulio' || (id === 'dildo' && S.phase >= 2);
    if (summoner) {
      e.summonT -= dt;
      if (e.summonT <= 0) {
        e.summonT = id === 'dildo' ? 14 : 11;
        const temps = this.enemies.filter((x) => x.temp).length;
        if (temps < 3) {
          for (let k = 0; k < 2; k++) {
            const m = this.makeEnemy('doomer', k + 1, null, true);
            m.x = e.x;
            m.y = e.y;
            m.spawn = e.spawn;
            this.enemies.push(m);
          }
          this.popup(e.spr.x, e.spr.y - 12, 'SUMMON', '#39ffb0');
          sfx.spawn();
        }
      }
    }
    if (glitcher) {
      e.tpT -= dt;
      if (e.tpT <= 0) {
        e.tpT = S.phase >= 3 ? 5 : 8;
        const P = this.P;
        const cand = this.maze.floors.filter((i) => Math.hypot((i % COLS) - P.x, ((i / COLS) | 0) - P.y) > 6);
        if (cand.length) {
          this.burst(e.spr.x, e.spr.y, 0x39ffb0, 14, 45);
          const i = cand[Math.floor(Math.random() * cand.length)];
          e.x = i % COLS;
          e.y = (i / COLS) | 0;
          e.dir = -1;
          this.burst(T(e.x) + 8, T(e.y) + 8, 0xff2fb4, 14, 45);
        }
      }
      e.gT -= dt;
      if (e.gT <= 0) {
        e.gT = 11;
        this.scheduleGlitch([Math.round(this.P.x), Math.round(this.P.y)]);
      }
    }
  }

  // ---------------- zones ----------------
  zoneBlocked(extra) {
    const set = new Set();
    for (const z of this.zones) {
      if (z.dormant) continue;
      for (const [x, y] of z.tiles) set.add(idx(x, y));
    }
    if (extra) set.add(extra);
    return set;
  }

  zoneSafe(newTile) {
    // Zone may never cut off the only way to any remaining pellet.
    const maze = this.maze;
    const blocked = this.zoneBlocked(idx(newTile[0], newTile[1]));
    const P = this.P;
    const sx = Math.round(P.x);
    const sy = Math.round(P.y);
    const seen = new Uint8Array(COLS * ROWS);
    const q = [idx(sx, sy)];
    seen[q[0]] = 1;
    for (let h = 0; h < q.length; h++) {
      const i = q[h];
      const x = i % COLS;
      const y = (i / COLS) | 0;
      for (const [dx, dy] of DIRS) {
        const nx = x + dx;
        const ny = y + dy;
        if (!isPlayerPass(maze.grid, nx, ny)) continue;
        const j = idx(nx, ny);
        if (seen[j] || blocked.has(j)) continue;
        seen[j] = 1;
        q.push(j);
      }
    }
    for (let i = 0; i < maze.pel.length; i++) if (maze.pel[i] && !seen[i] && !blocked.has(i)) return false;
    for (const [ci] of this.coinSpr) if (!seen[ci] && !blocked.has(ci)) return false;
    return true;
  }

  updateZones(dt) {
    const S = this.S;
    const P = this.P;
    for (const z of this.zones) {
      if (z.dormant) continue;
      z.growT -= dt;
      if (z.growT <= 0 && z.len < z.maxLen) {
        z.len++;
        z.growT = 18;
      }
      z.t -= dt;
      if (z.t > 0) continue;
      z.t = 0.38;
      const head = z.tiles[0];
      const prev = z.tiles[1];
      const cands = [];
      for (const [dx, dy] of DIRS) {
        const nx = head[0] + dx;
        const ny = head[1] + dy;
        if (!isFloor(this.maze.grid, nx, ny)) continue;
        if (prev && prev[0] === nx && prev[1] === ny) continue;
        if (z.tiles.some((t) => t[0] === nx && t[1] === ny)) continue;
        // keep away from the spawn point for a little while
        if (S.time < 8 && Math.abs(nx - this.maze.start[0]) + Math.abs(ny - this.maze.start[1]) < 6) continue;
        cands.push([nx, ny]);
      }
      Phaser.Utils.Array.Shuffle(cands);
      let moved = false;
      for (const c of cands) {
        if (this.zoneSafe(c)) {
          z.tiles.unshift(c);
          moved = true;
          break;
        }
      }
      if (!moved && prev && this.zoneSafe(prev)) {
        z.tiles.reverse();
        moved = true;
      }
      while (z.tiles.length > z.len) z.tiles.pop();
    }
    // contact
    if (S.invuln > 0) return;
    for (const z of this.zones) {
      if (z.dormant) continue;
      for (const [x, y] of z.tiles) {
        if (Math.abs(x - P.x) < 0.62 && Math.abs(y - P.y) < 0.62) {
          if (this.hasBonus('ghost')) continue;
          this.hurt('zone');
          return;
        }
      }
    }
  }

  // ---------------- glitch walls ----------------
  occupiedSet() {
    const set = new Set();
    const add = (x, y) => {
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) if (inb(Math.round(x) + dx, Math.round(y) + dy)) set.add(idx(Math.round(x) + dx, Math.round(y) + dy));
    };
    add(this.P.x, this.P.y);
    for (const e of this.enemies) add(e.x, e.y);
    for (const z of this.zones) for (const [x, y] of z.tiles) set.add(idx(x, y));
    return set;
  }

  scheduleGlitch(near) {
    const S = this.S;
    if (S.glitchPending) return;
    const copy = { ...this.maze, grid: this.maze.grid.slice() };
    const changes = glitchWalls(copy, this.rngG || (this.rngG = makeRng(this.def.seed + 777)), 3, this.occupiedSet(), near);
    if (!changes.length) return;
    S.glitchPending = { t: 1.0, changes };
    for (const c of changes) this.flash.push({ idx: c.idx, t: 1.0 });
    sfx.spawn();
  }

  updateGlitch(dt) {
    const S = this.S;
    if (this.def.glitch && !this.def.boss) {
      S.glitchT -= dt;
      if (S.glitchT <= 0) {
        S.glitchT = 15;
        this.scheduleGlitch(null);
      }
    } else if (this.def.boss === 'hulio' || this.def.boss === 'dildo') {
      // boss handles its own glitch schedule
    }
    const p = S.glitchPending;
    if (p) {
      p.t -= dt;
      if (p.t <= 0) {
        const occ = this.occupiedSet();
        let ch = false;
        for (const c of p.changes) {
          if (occ.has(c.idx)) continue;
          if (c.to === 1 && (this.maze.pel[c.idx] || this.maze.coinIdx.has(c.idx))) continue;
          this.maze.grid[c.idx] = c.to;
          ch = true;
        }
        S.glitchPending = null;
        if (ch) {
          this.drawWalls();
          this.burst(this.scale.width / 2 - this.ox, MH / 2, 0xff2fb4, 12, 80);
        }
      }
    }
  }

  // ---------------- collisions ----------------
  collisions() {
    const S = this.S;
    const P = this.P;
    if (S.state !== 'play') return;
    const phased = S.abilT > 0 && S.abilId === 'phase';
    for (const e of this.enemies) {
      if (e.state === 'wait' || e.state === 'eyes') continue;
      const d = Math.hypot(e.x - P.x, e.y - P.y);
      if (d > 0.62) continue;
      if (e.state === 'fright') {
        if (e.boss) {
          if (e.immune <= 0) this.hitBoss(e);
        } else this.eatEnemy(e);
        if (S.state !== 'play') return;
      } else if (e.state === 'normal') {
        if (phased) continue;
        if (e.boss && e.immune > 0 && S.invuln > 0) continue;
        this.hurt('enemy', e);
        if (S.state !== 'play') return;
      }
    }
  }

  eatEnemy(e) {
    const S = this.S;
    const pts = 200 * Math.pow(2, Math.min(3, S.eatChain));
    S.eatChain++;
    S.eaten++;
    this.addScore(pts);
    this.addXp(15);
    S.coinsGot += 2;
    SV.bumpStat('eaten');
    SV.bumpStat('coins', 2);
    e.state = e.temp ? 'eyes' : 'eyes';
    if (e.temp) e.dead = true;
    sfx.eat();
    haptic('heavy');
    this.chainPick();
    this.burst(e.spr.x, e.spr.y, 0x6a7bff, 16, 45);
    this.popup(e.spr.x, e.spr.y - 6, String(pts), '#9ff');
  }

  hitBoss(e) {
    const S = this.S;
    S.bossHp--;
    e.immune = 2.5;
    e.state = 'eyes';
    this.addScore(500);
    this.addXp(60);
    sfx.bosshit();
    haptic('heavy');
    this.burst(e.spr.x, e.spr.y, 0xffffff, 24, 60);
    this.popup(e.spr.x, e.spr.y - 10, 'HIT!', '#ff4a4a');
    if (S.bossHp <= 0) {
      for (const x of this.enemies) if (x.temp) x.dead = true;
      this.finish(true);
    }
  }

  hurt(src, e) {
    const S = this.S;
    const P = this.P;
    if (S.invuln > 0 || S.state !== 'play') return;
    if (S.abilShield > 0 || S.shield) {
      if (S.abilShield > 0) S.abilShield = 0;
      else {
        S.shield = false;
        S.bonuses = S.bonuses.filter((b) => b.type !== 'shield');
      }
      S.invuln = 1;
      this.popup(P.x * TILE + 8, P.y * TILE - 4, 'BLOCKED', '#7cf0ff');
      this.burst(P.x * TILE + 8, P.y * TILE + 8, 0x7cf0ff, 16, 50);
      sfx.bonus();
      haptic('damage');
      return;
    }
    const inv = SV.S().inv;
    if (inv.blackpill > 0) {
      inv.blackpill--;
      SV.save();
      S.invuln = 2 + this.ch.st.invulnBonus;
      S.blackpillUsed = (S.blackpillUsed || 0) + 1;
      sfx.blackpill();
      haptic('damage');
      this.popup(P.x * TILE + 8, P.y * TILE - 10, 'SECOND CHANCE', '#c07bff', 8);
      this.burst(P.x * TILE + 8, P.y * TILE + 8, 0x1a0030, 30, 60);
      this.burst(P.x * TILE + 8, P.y * TILE + 8, 0xb04bff, 30, 70);
      if (e && !e.boss) {
        e.state = 'eyes';
      }
      bus.emit('blackpill');
      return;
    }
    S.deaths++;
    S.lives--;
    SV.S().stats.deaths++;
    S.state = 'dying';
    S.dieT = 1.2;
    P.spr.setTexture(this.ch.tex + '_hurt');
    sfx.hurt();
    haptic('damage');
    this.burst(P.x * TILE + 8, P.y * TILE + 8, 0xff3b3b, 26, 70);
    this.emitHud(true);
  }

  tickDying(dt) {
    const S = this.S;
    S.dieT -= dt;
    if (S.dieT > 0) return;
    if (S.lives <= 0) {
      this.finish(false);
      return;
    }
    // respawn at the checkpoint (level start), enemies back to their start positions
    const maze = this.maze;
    Object.assign(this.P, { x: maze.start[0], y: maze.start[1], dir: -1, want: -1 });
    this.enemies.forEach((e, i) => {
      if (e.temp) e.dead = true;
      e.x = e.spawn[0];
      e.y = e.spawn[1];
      e.dir = -1;
      e.state = 'wait';
      e.releaseT = 0.8 + i * 1.6;
      e.wp = null;
    });
    S.frightT = 0;
    S.invuln = 2 + this.ch.st.invulnBonus;
    S.state = 'play';
    S.chain = 0;
    S.mult = 1;
  }

  // ---------------- finish ----------------
  finish(win) {
    const S = this.S;
    if (S.state === 'won' || S.state === 'lost') return;
    const def = this.def;
    const d = SV.S();
    const cid = this.ch.id;
    const first = !(d.levels[def.key] && d.levels[def.key].c);
    const maze = this.maze;
    const par = def.boss ? 160 : Math.round(maze.pelletCount * 0.55 + 30);
    const stars = [S.deaths === 0, S.time <= par, S.coinsPicked >= maze.coins.length].map(Boolean);
    const hardMul = this.hard ? 1.5 : 1;
    let coins = S.coinsGot;
    let xp = S.xpGot;
    let bossBonus = 0;
    let unlockedChar = null;
    if (win) {
      coins += Math.round((20 + 5 * def.w) * hardMul);
      const star = stars.filter(Boolean).length;
      xp += Math.round((1500 + 270 * def.g) * (first ? 1 : 0.6) * (1 + 0.1 * star) * hardMul);
      if (S.bossDef) {
        const bk = S.bossDef.id;
        if (S.bossDef.unlocks && !d.bosses[bk]) {
          d.bosses[bk] = true;
          unlockedChar = S.bossDef.unlocks;
        }
        if (first) {
          bossBonus = S.bossDef.reward;
          coins += bossBonus;
        }
      }
      this.addScore(1000);
    }
    const lv = SV.addXp(cid, xp);
    d.coins += coins;
    d.stats.coins += coins;
    if (win) {
      const rec = d.levels[def.key] || { s: 0, b: 0, c: 0 };
      rec.c = 1;
      rec.s = Math.max(rec.s, stars.filter(Boolean).length);
      rec.b = Math.max(rec.b, S.score);
      if (this.hard) rec.h = 1;
      d.levels[def.key] = rec;
      d.stats.clears++;
      SV.bumpStat('clears');
      if (S.deaths === 0) SV.bumpStat('clean');
      if (S.bossDef && def.boss === 'dildo') d.seenEnding = d.seenEnding || false;
    }
    d.stats.eaten += S.eaten;
    SV.save();
    this.result = {
      win,
      def,
      hard: this.hard,
      stars,
      score: S.score,
      coins,
      coinsPicked: S.coinsGot,
      xp,
      lvBefore: lv.before,
      lvAfter: lv.after,
      first,
      deaths: S.deaths,
      time: S.time,
      par,
      boss: S.bossDef ? S.bossDef.name : null,
      bossBonus,
      unlockedChar,
      secrets: S.secrets,
      pellets: S.pelletsEaten,
      charId: cid,
    };
    S.state = win ? 'won' : 'lost';
    S.endT = win ? 1.6 : 0.6;
    if (win) {
      sfx.win();
      haptic('levelup');
      this.P.spr.setTexture(this.ch.tex + '_win');
      for (let k = 0; k < 4; k++) this.time.delayedCall(k * 220, () => this.P && this.burst(this.P.x * TILE + 8, this.P.y * TILE + 8, [0xffd23f, 0xff4fd8, 0x39ffff, 0xffffff][k], 24, 70));
      if (S.bossDef) for (const e of this.enemies) this.burst(e.spr.x, e.spr.y, 0xffffff, 30, 70);
      this.banner(S.bossDef ? 'BOSS DEFEATED' : 'LEVEL CLEAR', '#ffd23f', 1.4);
    } else {
      sfx.lose();
    }
    stopMusic();
    this.emitHud(true);
  }

  // ---------------- render ----------------
  render(dt) {
    const S = this.S;
    const P = this.P;
    if (!P) return;
    // player sprite
    if (S.state !== 'dying' && S.state !== 'won') {
      const f = Math.floor(P.walkT * 8) % 2;
      P.spr.setTexture(`${this.ch.tex}_${P.face}${P.dir >= 0 ? f : 0}`);
    }
    this.placeSprite(P.spr, P.x, P.y);
    const blink = S.invuln > 0 && Math.floor(S.animT * 14) % 2 === 0;
    P.spr.setAlpha(S.abilT > 0 && S.abilId === 'phase' ? 0.4 : blink ? 0.35 : 1);
    if (P.aura) {
      const a = P.aura;
      a.clear();
      const r = 11 + Math.sin(S.animT * 4) * 1.5;
      a.lineStyle(1, P.auraCol, 0.8);
      a.strokeCircle(Math.round(P.spr.x), Math.round(P.spr.y), Math.round(r));
      a.lineStyle(1, P.auraCol, 0.35);
      a.strokeCircle(Math.round(P.spr.x), Math.round(P.spr.y), Math.round(r + 3));
    }
    // special status rings
    const ring = this.pg;
    // enemies
    const flashing = S.frightT > 0 && S.frightT < 1.6 && Math.floor(S.animT * 6) % 2 === 0;
    const f = Math.floor(S.animT * 6) % 2;
    for (const e of this.enemies) {
      this.placeSprite(e.spr, e.x, e.y);
      let key;
      if (e.state === 'eyes') key = 'en_eyes';
      else if (e.state === 'fright') key = `${flashing ? 'en_frw' : 'en_fr'}_${f}`;
      else key = `en_${e.type}_${f}`;
      e.spr.setTexture(key);
      let a = 1;
      if (e.state === 'wait') a = 0.5;
      if (e.immune > 0 && e.boss) a = Math.floor(S.animT * 12) % 2 ? 0.4 : 1;
      if (e.temp && e.life < 2) a = Math.floor(S.animT * 10) % 2 ? 0.3 : 1;
      e.spr.setAlpha(a);
    }
    // coins & spheres animation
    const cf = Math.floor(S.animT * 6) % 4;
    const ct = ['coin_0', 'coin_1', 'coin_2', 'coin_1'][cf];
    for (const c of this.coinSpr.values()) c.setTexture(ct);
    const sf = Math.floor(S.animT * 4) % 2;
    for (const s of this.sphSpr.values()) s.setTexture(`sphere_${sf}`);
    this.drawZones(S);
    this.drawFlash(dt);
    this.drawFake(S);
    this.drawParts(dt);
  }

  drawZones(S) {
    const g = this.zoneG;
    g.clear();
    if (!this.zones) return;
    for (const z of this.zones) {
      if (z.dormant) continue;
      z.tiles.forEach(([x, y], k) => {
        const a = 0.35 + 0.15 * Math.sin(S.animT * 8 + k);
        g.fillStyle(0xff1a2a, a);
        g.fillRect(T(x) + 1, T(y) + 1, TILE - 2, TILE - 2);
        g.fillStyle(0xff6a6a, a + 0.25);
        const o = Math.floor(S.animT * 20 + k * 3) % 12;
        g.fillRect(T(x) + 2 + (o % 6), T(y) + 2 + ((o * 5) % 9), 3, 1);
        g.fillRect(T(x) + 3 + ((o * 3) % 8), T(y) + 4 + ((o * 7) % 8), 2, 1);
      });
    }
  }

  drawFlash(dt) {
    const g = this.flashG;
    g.clear();
    for (const f of this.flash) {
      f.t -= dt;
      if (Math.floor(f.t * 14) % 2) {
        g.fillStyle(0xff2fb4, 0.6);
        g.fillRect(T(f.idx % COLS), T(((f.idx / COLS) | 0)), TILE, TILE);
      }
    }
    this.flash = this.flash.filter((f) => f.t > 0);
  }

  drawFake(S) {
    const g = this.fakeG;
    g.clear();
    if (!this.maze) return;
    const wd = this.world;
    for (const s of this.maze.secrets) {
      if (s.found) {
        continue;
      }
      const x = s.wall % COLS;
      const y = (s.wall / COLS) | 0;
      const a = 0.78 + 0.22 * Math.sin(S.animT * 5 + x);
      this.wallTile(g, x, y, wd, Math.max(0.45, Math.min(1, a)));
    }
  }

  drawParts(dt) {
    const g = this.pg;
    g.clear();
    for (const p of this.parts) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.97;
      p.vy *= 0.97;
      g.fillStyle(p.c, Math.max(0, p.life / p.max));
      g.fillRect(Math.round(p.x), Math.round(p.y), p.s, p.s);
    }
    this.parts = this.parts.filter((p) => p.life > 0);
  }

  // ---------------- HUD ----------------
  emitHud(force) {
    const S = this.S;
    if (!S) return;
    const d = SV.S();
    const c = this.ch.save;
    const li = levelFromXp(c.xp + S.xpGot);
    const total = this.maze.pelletCount;
    const abil = this.ch.def.ability;
    bus.emit('hud', {
      w: this.def.w,
      l: this.def.l,
      hard: this.hard,
      world: this.world.name,
      charName: this.ch.def.name,
      level: li.level,
      xpPct: li.need ? li.into / li.need : 1,
      coins: S.coinsGot,
      bank: d.coins,
      lives: S.lives,
      bp: d.inv.blackpill,
      score: S.score,
      mult: S.mult,
      pct: Math.round(((total - S.pelletsLeft) / total) * 100),
      bonuses: S.bonuses.map((b) => ({ type: b.type, t: b.t, max: b.max })),
      ability: { name: abil.name, cd: Math.max(0, S.abilCd), cdMax: S.abilCdMax || abil.cd, active: S.abilT > 0 ? S.abilT : 0 },
      boss: S.bossDef ? { name: S.bossDef.name, hp: S.bossHp, max: S.bossDef.hp, phase: S.phase } : null,
      items: { energy: d.inv.energy, shield: d.inv.shield },
      frightT: S.frightT,
      state: S.state,
    });
  }
}
