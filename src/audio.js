// All audio is synthesized with the Web Audio API: original chiptune / synthwave, no audio files.
let ctx = null;
let master;
let musicG;
let sfxG;
let noiseBuf;
const vol = { music: 0.6, sfx: 0.8, mute: false };

export function initAudio() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume();
    return;
  }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  musicG = ctx.createGain();
  sfxG = ctx.createGain();
  musicG.connect(master);
  sfxG.connect(master);
  master.connect(ctx.destination);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  applyVolumes();
  if (wantTrack !== null) startMusic(wantTrack);
}

export function setVolumes(m, s, mute) {
  vol.music = m;
  vol.sfx = s;
  vol.mute = mute;
  applyVolumes();
}

function applyVolumes() {
  if (!ctx) return;
  master.gain.value = vol.mute ? 0 : 1;
  musicG.gain.value = vol.music * 0.22;
  sfxG.gain.value = vol.sfx * 0.5;
}

export const audioState = () => ({ ready: !!ctx, ...vol });

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

function noise(dur, v = 0.4, delay = 0, hp = 4000, dest = null) {
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = 'highpass';
  f.frequency.value = hp;
  const g = ctx.createGain();
  g.gain.setValueAtTime(v, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f);
  f.connect(g);
  g.connect(dest || sfxG);
  s.start(t);
  s.stop(t + dur + 0.02);
}

let lastPellet = 0;
export const sfx = {
  pellet() {
    lastPellet ^= 1;
    tone(lastPellet ? 520 : 440, 0.05, 'square', 0.18);
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
  boss() {
    tone(80, 0.9, 'sawtooth', 0.6, 0, 40);
    tone(120, 0.9, 'square', 0.3, 0, 60);
    noise(0.6, 0.3, 0, 300);
  },
  bosshit() {
    tone(150, 0.3, 'square', 0.5, 0, 700);
    noise(0.25, 0.5, 0, 1500);
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

// ---------------- music ----------------
const SCALE = [0, 2, 3, 5, 7, 8, 10];
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const deg = (root, d) => root + SCALE[d % 7] + 12 * Math.floor(d / 7);

const TRACKS = [
  { bpm: 108, root: 45, bass: '0.0.0.0.5.5.3.3.', lead: '4.7.9.7.4.7.8.7.', drums: 'k.h.s.h.k.hks.h.', wave: 'square' },
  { bpm: 116, root: 43, bass: '0..0..05..5..3.3', lead: '7.9.11.9.7.5.4.5.', drums: 'k.hhs.h.k.hhs.hh', wave: 'sawtooth' },
  { bpm: 100, root: 41, bass: '0...0...3...5...', lead: '..4...7...9.7...', drums: 'k...s...k..ks...', wave: 'triangle' },
  { bpm: 128, root: 48, bass: '0.0.2.2.0.0.4.4.', lead: '7.4.9.4.8.4.7.4.', drums: 'khhhshhhkhhhshkh', wave: 'square' },
  { bpm: 120, root: 40, bass: '0.0.0.5.0.0.3.4.', lead: '9.11.12.11.9.7.9.', drums: 'k.hks.hkk.hks.hk', wave: 'sawtooth' },
  { bpm: 148, root: 38, bass: '0.0.0.0.0.0.5.5.', lead: '7.7.8.7.9.7.8.7.', drums: 'kkhkskhkkkhkskhs', wave: 'sawtooth' },
];

let wantTrack = null;
let timer = null;
let step = 0;
let nextT = 0;
let cur = null;

export function startMusic(i) {
  wantTrack = i;
  if (!ctx) return;
  stopTimer();
  cur = TRACKS[i];
  step = 0;
  nextT = ctx.currentTime + 0.1;
  timer = setInterval(schedule, 40);
}

function stopTimer() {
  if (timer) clearInterval(timer);
  timer = null;
}

export function stopMusic() {
  wantTrack = null;
  stopTimer();
}

export const currentTrack = () => wantTrack;

function schedule() {
  if (!ctx || !cur) return;
  const sd = 60 / cur.bpm / 4;
  while (nextT < ctx.currentTime + 0.15) {
    const i = step % 16;
    const delay = Math.max(0, nextT - ctx.currentTime);
    const b = cur.bass[i];
    if (b !== '.' && b !== undefined) tone(mtof(deg(cur.root, +b)), sd * 1.8, 'triangle', 0.9, delay, null, musicG);
    const lead = cur.lead;
    // lead patterns may contain two-digit notes; parse by walking tokens
    const l = leadTokens(lead)[i];
    if (l !== null && l !== undefined && (step >> 4) % 2 === 0)
      tone(mtof(deg(cur.root + 24, l)), sd * 1.5, cur.wave, 0.35, delay, null, musicG);
    else if (l !== null && l !== undefined) tone(mtof(deg(cur.root + 12, l)), sd * 1.2, 'square', 0.22, delay, null, musicG);
    const d = cur.drums[i];
    if (d === 'k') tone(150, 0.12, 'sine', 1.0, delay, 40, musicG);
    else if (d === 's') noise(0.1, 0.5, delay, 1800, musicG);
    else if (d === 'h') noise(0.03, 0.25, delay, 7000, musicG);
    nextT += sd;
    step++;
  }
}

const tokCache = new Map();
function leadTokens(s) {
  if (tokCache.has(s)) return tokCache.get(s);
  const out = [];
  let k = 0;
  while (k < s.length && out.length < 16) {
    if (s[k] === '.') {
      out.push(null);
      k++;
    } else {
      let n = s[k];
      if (/\d/.test(s[k + 1] || '') && +(s[k] + s[k + 1]) <= 14) {
        n += s[k + 1];
        k++;
      }
      out.push(+n);
      k++;
    }
  }
  while (out.length < 16) out.push(null);
  tokCache.set(s, out);
  return out;
}
