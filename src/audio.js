// All audio is synthesized with the Web Audio API: original phonk / slowed+reverb / bass-boosted / nightcore
// style tracks and meme-style voice lines. No audio files, no samples, no melodies from existing songs.
let ctx = null;
let master;
let duckG;
let musicG;
let sfxG;
let voiceG;
let revSend;
let bassShelf;
let sat;
let noiseBuf;
let analyser;
const vol = { music: 0.6, sfx: 0.8, voice: 0.8, mute: false, bass: true };

export function initAudio() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume();
    return;
  }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.ratio.value = 5;
  master = ctx.createGain();
  master.connect(comp);
  comp.connect(ctx.destination);
  analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  comp.connect(analyser);
  duckG = ctx.createGain();
  duckG.connect(master);
  musicG = ctx.createGain();
  bassShelf = ctx.createBiquadFilter();
  bassShelf.type = 'lowshelf';
  bassShelf.frequency.value = 110;
  musicG.connect(bassShelf);
  bassShelf.connect(duckG);
  // reverb (generated impulse response) for the slowed+reverb sound
  const conv = ctx.createConvolver();
  const len = Math.floor(ctx.sampleRate * 2.6);
  const ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = ir.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
  }
  conv.buffer = ir;
  revSend = ctx.createGain();
  revSend.gain.value = 0.3;
  bassShelf.connect(revSend);
  revSend.connect(conv);
  conv.connect(duckG);
  sat = ctx.createWaveShaper();
  const curve = new Float32Array(1024);
  for (let i = 0; i < 1024; i++) curve[i] = Math.tanh(((i / 1023) * 2 - 1) * 2.2);
  sat.curve = curve;
  sat.connect(musicG);
  sfxG = ctx.createGain();
  sfxG.connect(master);
  voiceG = ctx.createGain();
  voiceG.connect(master);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.6, ctx.sampleRate);
  const nd = noiseBuf.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  applyVolumes();
  if (wantTrack !== null) startMusic(wantTrack);
}

export function setVolumes(m, s, mute, extra = {}) {
  vol.music = m;
  vol.sfx = s;
  vol.mute = mute;
  if (extra.voice !== undefined) vol.voice = extra.voice;
  if (extra.bass !== undefined) vol.bass = extra.bass;
  applyVolumes();
}

function applyVolumes() {
  if (!ctx) return;
  master.gain.value = vol.mute ? 0 : 1;
  musicG.gain.value = vol.music * 0.16;
  sfxG.gain.value = vol.sfx * 0.5;
  voiceG.gain.value = vol.voice * 1.0;
  bassShelf.gain.value = vol.bass ? 9 : 0;
}

// RMS of what is currently going to the speakers (used by tests and for debugging)
export function levelNow() {
  if (!analyser) return 0;
  const d = new Float32Array(analyser.fftSize);
  analyser.getFloatTimeDomainData(d);
  let sum = 0;
  for (let i = 0; i < d.length; i++) sum += d[i] * d[i];
  return Math.sqrt(sum / d.length);
}

export const audioState = () => ({ ready: !!ctx, ...vol });
export const getVolumes = () => ({ ...vol });

// music ducks while a voice line plays
export function duck(sec) {
  if (!ctx) return;
  const t = ctx.currentTime;
  duckG.gain.cancelScheduledValues(t);
  duckG.gain.setTargetAtTime(0.35, t, 0.04);
  duckG.gain.setTargetAtTime(1, t + sec, 0.3);
}

// ---------------- primitives ----------------
function tone(f, dur, type = 'square', v = 0.5, delay = 0, f2 = null, dest = null) {
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(v, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g);
  g.connect(dest || sfxG);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(dur, v = 0.4, delay = 0, hp = 4000, dest = null, bp = 0) {
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = bp ? 'bandpass' : 'highpass';
  f.frequency.value = bp || hp;
  const g = ctx.createGain();
  g.gain.setValueAtTime(v, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f);
  f.connect(g);
  g.connect(dest || sfxG);
  s.start(t);
  s.stop(t + dur + 0.02);
}

// ---------------- SFX ----------------
let lastPellet = 0;
export const sfx = {
  pellet(chain = 0) {
    lastPellet ^= 1;
    const up = 1 + Math.min(chain, 24) * 0.012; // pitch ladder while the combo grows
    tone((lastPellet ? 520 : 440) * up, 0.05, 'square', 0.18);
  },
  coin() {
    tone(988, 0.07, 'square', 0.4);
    tone(1319, 0.14, 'square', 0.4, 0.06);
  },
  xp() {
    tone(660, 0.06, 'triangle', 0.3);
  },
  levelup() {
    [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.16, 'square', 0.4, i * 0.09));
  },
  ability() {
    tone(220, 0.35, 'sawtooth', 0.4, 0, 880);
    tone(330, 0.35, 'square', 0.25, 0.05, 1320);
  },
  spawn() {
    tone(300, 0.2, 'sawtooth', 0.25, 0, 90);
  },
  eat() {
    tone(200, 0.15, 'square', 0.4, 0, 900);
    tone(900, 0.1, 'square', 0.3, 0.14);
  },
  hurt() {
    tone(400, 0.4, 'sawtooth', 0.5, 0, 60);
    noise(0.3, 0.4, 0, 800);
    this.boom(0.5);
  },
  blackpill() {
    tone(110, 0.8, 'sawtooth', 0.5, 0, 55);
    tone(220, 0.8, 'triangle', 0.4, 0.1, 440);
    tone(660, 0.4, 'square', 0.3, 0.5, 990);
  },
  bonus() {
    [660, 880, 1100].forEach((f, i) => tone(f, 0.08, 'square', 0.35, i * 0.05));
  },
  win() {
    [523, 659, 784, 659, 784, 1047].forEach((f, i) => tone(f, 0.2, 'square', 0.4, i * 0.12));
    [262, 330, 392].forEach((f, i) => tone(f, 0.5, 'triangle', 0.4, i * 0.24));
  },
  lose() {
    [440, 370, 311, 262].forEach((f, i) => tone(f, 0.3, 'triangle', 0.5, i * 0.2));
  },
  // meme-style stings (all synthesized)
  boom(v = 0.8) {
    tone(110, 0.7, 'sine', v, 0, 38);
    noise(0.25, v * 0.4, 0, 200);
  },
  airhorn() {
    for (const f of [466, 587, 698]) {
      tone(f, 0.22, 'sawtooth', 0.22, 0);
      tone(f, 0.22, 'sawtooth', 0.22, 0.26);
      tone(f, 0.5, 'sawtooth', 0.22, 0.52);
    }
  },
  scratch() {
    noise(0.28, 0.5, 0, 900);
    tone(900, 0.28, 'sawtooth', 0.25, 0, 120);
  },
  boss() {
    this.boom(0.9);
    this.airhorn();
  },
  bosshit() {
    tone(150, 0.3, 'square', 0.5, 0, 700);
    noise(0.25, 0.5, 0, 1500);
    this.boom(0.9);
  },
  click() {
    tone(800, 0.04, 'square', 0.2);
  },
  buy() {
    tone(784, 0.07, 'square', 0.35);
    tone(1175, 0.12, 'square', 0.35, 0.07);
  },
  deny() {
    tone(150, 0.15, 'square', 0.35);
  },
};

// ---------------- voice lines ----------------
// Web Speech API (voice of the device) with pitch/rate tweaks for a TikTok-TTS feel.
// Fallback when no voice is available: "animalese" blips, one per letter.
export function speak(text, { pitch = 1, rate = 1, blip = 300 } = {}) {
  if (!ctx || vol.mute || vol.voice <= 0.01) return;
  duck(1.8);
  let done = false;
  try {
    const ss = window.speechSynthesis;
    if (ss && typeof SpeechSynthesisUtterance !== 'undefined') {
      const voices = ss.getVoices ? ss.getVoices() : [];
      const en = voices.find((v) => /^en[-_]US/i.test(v.lang)) || voices.find((v) => /^en/i.test(v.lang));
      if (en) {
        const u = new SpeechSynthesisUtterance(text);
        u.voice = en;
        u.lang = en.lang;
        u.pitch = Math.max(0, Math.min(2, pitch));
        u.rate = Math.max(0.5, Math.min(2, rate));
        u.volume = Math.min(1, vol.voice);
        ss.cancel();
        ss.speak(u);
        done = true;
      }
    }
  } catch (e) {
    done = false;
  }
  if (!done) {
    let t = 0.05;
    for (const ch of text.toLowerCase()) {
      if (ch < 'a' || ch > 'z') {
        t += 0.06;
        continue;
      }
      const f = blip * (1 + ((ch.charCodeAt(0) - 97) % 9) * 0.07) * pitch;
      tone(f, 0.07, 'square', 0.28, t, f * 0.92, voiceG);
      t += 0.075 / rate;
    }
  }
}

// ---------------- music ----------------
const SCALE = [0, 2, 3, 5, 7, 8, 10]; // natural minor
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const deg = (root, d) => root + SCALE[((d % 7) + 7) % 7] + 12 * Math.floor(d / 7);
const P = (s) => s.padEnd(32, '.').slice(0, 32);
const nv = (c) => parseInt(c, 36);

// bass/lead: one base-36 char per 16th step = scale degree, '.' = rest. drums: x = hit.
const TRACKS = [
  { // 0 - menu / world 1: SLOWED + REVERB
    name: 'slowed', bpm: 72, root: 45, rev: 0.6, bassLen: 0.95, leadOct: 24, leadWave: 'sine', padOct: 0,
    bass: P('0.......0.......3.......2.......'),
    lead: P('4...7...9...7...8...7...4...2...'),
    pad: [0, 5, 3, 4],
    k: P('x.......x.....x.x.......x.......'),
    s: P('........x...............x.......'),
    h: P('x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.'),
    c: P(''),
  },
  { // 1 - world 2: BASS BOOST PHONK
    name: 'bassboost', bpm: 130, root: 43, rev: 0.22, bassLen: 0.9, leadOct: 24, leadWave: 'triangle', padOct: 0,
    bass: P('0..0..0.3..3..5.0..0..0.2..2..3.'),
    lead: P('7...9...7.5.4...7...9...b.9.7...'),
    pad: [0, 3, 0, 4],
    k: P('x.....x.x.....x.x.....x.x.....x.'),
    s: P('....x.......x.......x.......x...'),
    h: P('x.x.x.x.xxx.x.x.x.x.x.x.xxx.x.xx'),
    c: P('x..x..x.x..x..x.x..x..x.x..x.x..'),
  },
  { // 2 - world 3: SIGMA dark phonk
    name: 'sigma', bpm: 140, root: 41, rev: 0.3, bassLen: 1.0, leadOct: 12, leadWave: 'sawtooth', padOct: 0,
    bass: P('0.......3.....2.0.......5.....4.'),
    lead: P('..4...7.....9...7.....5.....4...'),
    pad: [0, 0, 3, 5],
    k: P('x.....x...x...x.x.....x...x.x...'),
    s: P('........x...............x.......'),
    h: P('x.xxx.x.x.xxx.x.x.xxx.x.x.xxx.xx'),
    c: P('x.x...x.x.x...x.x.x...x.x.x.x...'),
  },
  { // 3 - world 4: SPED UP / nightcore
    name: 'spedup', bpm: 172, root: 52, rev: 0.2, bassLen: 0.8, leadOct: 24, leadWave: 'square', padOct: 12,
    bass: P('0...0...3...3...5...5...2...2...'),
    lead: P('79b97b979b97b9b7b9d9b9d9b979b97b'.slice(0, 32)),
    pad: [0, 3, 5, 4],
    k: P('x...x...x...x...x...x...x...x...'),
    s: P('....x.......x.......x.......x...'),
    h: P('xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'),
    c: P(''),
  },
  { // 4 - world 5: ULTIMATE
    name: 'ultimate', bpm: 150, root: 40, rev: 0.35, bassLen: 1.0, leadOct: 24, leadWave: 'sawtooth', padOct: 0,
    bass: P('0...0...5...5...3...3...4...4...'),
    lead: P('7.9.b...9.7.5...7.9.b.d.b.9.7...'),
    pad: [0, 5, 3, 4],
    k: P('x...x.x.x...x.x.x...x.x.x...x.xx'),
    s: P('....x.......x.......x.......x..x'),
    h: P('x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.xx'),
    c: P('x..x..x...x..x..x..x..x...x..x..'),
  },
  { // 5 - boss: aggressive phonk
    name: 'boss', bpm: 164, root: 38, rev: 0.18, bassLen: 0.85, leadOct: 12, leadWave: 'sawtooth', padOct: 0,
    bass: P('0.0.0.0.0.0.5.5.0.0.0.0.3.3.4.4.'),
    lead: P('7.7.8.7.9.7.8.7.b.b.9.9.8.7.5.4.'),
    pad: [0, 0, 5, 4],
    k: P('x..xx..xx..xx..xx..xx..xx..xx.x.'),
    s: P('....x.......x.......x.......x.x.'),
    h: P('xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'),
    c: P('x.xx.xx.x.xx.xx.x.xx.xx.x.xx.xxx'),
  },
];
export const TRACK_COUNT = TRACKS.length;

function note808(m, dur, t) {
  const f = mtof(m);
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'sine';
  const T0 = ctx.currentTime + t;
  o.frequency.setValueAtTime(f * 1.9, T0);
  o.frequency.exponentialRampToValueAtTime(f, T0 + 0.05);
  g.gain.setValueAtTime(0.0001, T0);
  g.gain.exponentialRampToValueAtTime(1.0, T0 + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, T0 + Math.max(0.15, dur));
  o.connect(g);
  g.connect(sat);
  o.start(T0);
  o.stop(T0 + Math.max(0.15, dur) + 0.05);
}

function bell(m, dur, t, type) {
  const f = mtof(m);
  tone(f, dur, type, 0.3, t, null, musicG);
  tone(f * 2.01, dur * 0.6, 'sine', 0.12, t, null, musicG);
}

function pad(root, d0, t, dur) {
  const base = deg(root, d0);
  for (const off of [0, 3, 7]) {
    for (const det of [-7, 7]) {
      if (!ctx) return;
      const T0 = ctx.currentTime + t;
      const o = ctx.createOscillator();
      const lp = ctx.createBiquadFilter();
      const g = ctx.createGain();
      o.type = 'sawtooth';
      o.frequency.value = mtof(base + off);
      o.detune.value = det;
      lp.type = 'lowpass';
      lp.frequency.value = 900;
      g.gain.setValueAtTime(0.0001, T0);
      g.gain.linearRampToValueAtTime(0.05, T0 + dur * 0.35);
      g.gain.linearRampToValueAtTime(0.0001, T0 + dur);
      o.connect(lp);
      lp.connect(g);
      g.connect(musicG);
      o.start(T0);
      o.stop(T0 + dur + 0.05);
    }
  }
}

let wantTrack = null;
let timer = null;
let step = 0;
let nextT = 0;
let cur = null;

// ---- optional real music files (public/assets/music/manifest.json: { "tracks": { "0": "menu.mp3", ... } })
let fileMap = {};
let musicBase = '';
const bufCache = new Map();
let fileSrc = null;
let fileG;

export async function configureMusicFiles(base) {
  try {
    const r = await fetch(`${base}assets/music/manifest.json`);
    if (r.ok) {
      fileMap = (await r.json()).tracks || {};
      musicBase = `${base}assets/music/`;
    }
  } catch (e) {
    fileMap = {};
  }
}

async function loadFile(i) {
  if (bufCache.has(i)) return bufCache.get(i);
  const r = await fetch(musicBase + fileMap[i]);
  const buf = await ctx.decodeAudioData(await r.arrayBuffer());
  bufCache.set(i, buf);
  return buf;
}

function stopFile() {
  if (fileSrc) {
    try {
      fileSrc.stop();
    } catch (e) {
      /* already stopped */
    }
    fileSrc = null;
  }
}

export const playingFile = () => !!fileSrc;

export function startMusic(i) {
  wantTrack = i;
  if (!ctx) return;
  stopTimer();
  stopFile();
  if (fileMap[i]) {
    // synth plays until the file is decoded, then the file takes over
    loadFile(i)
      .then((buf) => {
        if (wantTrack !== i || !ctx) return;
        stopTimer();
        stopFile();
        if (!fileG) {
          fileG = ctx.createGain();
          fileG.gain.value = 2.6;
          fileG.connect(musicG);
        }
        fileSrc = ctx.createBufferSource();
        fileSrc.buffer = buf;
        fileSrc.loop = true;
        fileSrc.connect(fileG);
        fileSrc.start();
        revSend.gain.setTargetAtTime(0.1, ctx.currentTime, 0.1);
      })
      .catch(() => {});
  }
  cur = TRACKS[i];
  step = 0;
  nextT = ctx.currentTime + 0.1;
  revSend.gain.setTargetAtTime(cur.rev, ctx.currentTime, 0.1);
  timer = setInterval(schedule, 40);
}

function stopTimer() {
  if (timer) clearInterval(timer);
  timer = null;
}

export function stopMusic() {
  wantTrack = null;
  stopTimer();
  stopFile();
}

export const currentTrack = () => wantTrack;

function schedule() {
  if (!ctx || !cur) return;
  const sd = 60 / cur.bpm / 4;
  while (nextT < ctx.currentTime + 0.2) {
    const i = step % 32;
    const t = Math.max(0, nextT - ctx.currentTime);
    const b = cur.bass[i];
    if (b !== '.') {
      let n = 1;
      while (n < 8 && cur.bass[(i + n) % 32] === '.') n++;
      note808(deg(cur.root - 24, nv(b)), sd * n * cur.bassLen, t);
    }
    const l = cur.lead[i];
    if (l !== '.') bell(deg(cur.root + cur.leadOct, nv(l)), sd * 3.2, t, cur.leadWave);
    if (cur.k[i] === 'x') tone(160, 0.14, 'sine', 1.0, t, 42, musicG);
    if (cur.s[i] === 'x') {
      noise(0.14, 0.55, t, 0, musicG, 1700);
      noise(0.05, 0.45, t + 0.018, 0, musicG, 1900);
    }
    if (cur.h[i] === 'x') noise(0.035, i % 4 === 0 ? 0.3 : 0.17, t, 8000, musicG);
    if (cur.c[i] === 'x') {
      tone(587, 0.2, 'square', 0.1, t, null, musicG);
      tone(845, 0.2, 'square', 0.1, t, null, musicG);
    }
    if (i % 16 === 0) pad(cur.root + cur.padOct, cur.pad[(i >> 4) + (step >= 32 ? 2 : 0) & 3] ?? 0, t, sd * 16);
    nextT += sd;
    step++;
  }
}
