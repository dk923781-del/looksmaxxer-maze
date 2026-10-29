import { SAVE_KEY, SAVE_VERSION, MAX_BLACKPILL, MAX_ITEM, levelFromXp, clamp } from './config.js';
import { CHARACTERS, CHAR_BY_ID, SKINS, SKILL_BRANCHES, QUEST_POOL, ITEM_BY_ID } from './data.js';
import { cloudGet, cloudSet, setVibration } from './tg.js';

export function defaultSave() {
  return {
    v: SAVE_VERSION,
    coins: 0,
    sel: 'valera_broke',
    chars: {
      valera_broke: newChar(),
    },
    levels: {}, // '1-1': {s: stars, b: best score, h: hard cleared}
    bosses: {}, // zeta: true
    inv: { blackpill: 0, energy: 0, shield: 0 },
    settings: { music: 0.6, sfx: 0.8, voice: 0.8, bass: true, mute: false, vibration: true, controls: 'dpad' },
    quests: { date: '', list: [], stats: {} },
    stats: { clears: 0, eaten: 0, coins: 0, deaths: 0 },
    hard: false,
    seenEnding: false,
  };
}

function newChar() {
  return { xp: 0, skills: { speed: 0, defense: 0, economy: 0, ability: 0 }, skins: ['base'], skin: 'base' };
}

// Version migration: bring any older/partial save up to SAVE_VERSION.
export function migrate(raw) {
  const base = defaultSave();
  if (!raw || typeof raw !== 'object') return base;
  const d = { ...base, ...raw };
  d.settings = { ...base.settings, ...(raw.settings || {}) };
  d.inv = { ...base.inv, ...(raw.inv || {}) };
  d.stats = { ...base.stats, ...(raw.stats || {}) };
  d.quests = { ...base.quests, ...(raw.quests || {}) };
  d.levels = raw.levels || {};
  d.bosses = raw.bosses || {};
  d.chars = {};
  for (const id of Object.keys(raw.chars || {})) {
    if (!CHAR_BY_ID[id]) continue;
    const c = { ...newChar(), ...raw.chars[id] };
    c.skills = { ...newChar().skills, ...(c.skills || {}) };
    if (!c.skins || !c.skins.includes('base')) c.skins = ['base', ...(c.skins || [])];
    d.chars[id] = c;
  }
  if (!d.chars.valera_broke) d.chars.valera_broke = newChar();
  if (!d.chars[d.sel]) d.sel = 'valera_broke';
  // v1 -> v2 example step: v1 stored a flat `xp`; fold it into the starter character.
  if ((raw.v || 1) < 2 && typeof raw.xp === 'number') d.chars.valera_broke.xp = raw.xp;
  d.coins = Math.max(0, Math.floor(Number(d.coins) || 0));
  for (const k of Object.keys(d.inv)) d.inv[k] = clamp(Math.floor(Number(d.inv[k]) || 0), 0, ITEM_BY_ID[k] ? ITEM_BY_ID[k].max : 0);
  d.v = SAVE_VERSION;
  return d;
}

export const store = { data: defaultSave() };
let listeners = [];
export const onSave = (fn) => listeners.push(fn);

export async function loadSave() {
  let raw = null;
  const cloud = await cloudGet(SAVE_KEY);
  try {
    if (cloud) raw = JSON.parse(cloud);
  } catch (e) {
    raw = null;
  }
  if (!raw) {
    try {
      const l = localStorage.getItem(SAVE_KEY);
      if (l) raw = JSON.parse(l);
    } catch (e) {
      raw = null;
    }
  }
  store.data = migrate(raw);
  rollQuests();
  setVibration(store.data.settings.vibration);
  return store.data;
}

export function save() {
  const s = JSON.stringify(store.data);
  try {
    localStorage.setItem(SAVE_KEY, s);
  } catch (e) {
    /* storage can be blocked */
  }
  cloudSet(SAVE_KEY, s);
  for (const f of listeners) f(store.data);
}

export function resetSave() {
  store.data = defaultSave();
  rollQuests();
  save();
}

// ---------- helpers ----------
export const S = () => store.data;
export const curChar = () => S().chars[S().sel];
export const charInfo = (id) => levelFromXp(S().chars[id].xp);

export function charStats(id) {
  const c = S().chars[id];
  const L = levelFromXp(c.xp).level;
  const sk = c.skills;
  return {
    level: L,
    speedMul: 1 + 0.03 * sk.speed,
    shieldBonus: 3 * (sk.defense >= 1) + 3 * (sk.defense >= 4),
    frightBonus: 1 * (sk.defense >= 2) + 1 * (sk.defense >= 5),
    invulnBonus: 1 * (sk.defense >= 3),
    coinMul: 1 + 0.1 * ((sk.economy >= 1) + (sk.economy >= 3) + (sk.economy >= 5)),
    magnetBonus: 0.5 * ((sk.economy >= 2) + (sk.economy >= 4)),
    cdMul: 1 - 0.08 * sk.ability,
    slots: L >= 41 ? 2 : 1,
    hardOk: L >= 61,
    auraPassive: L >= 81,
    scoreMul: L >= 91 ? 1.25 : 1,
  };
}

export function skillPointsLeft(id) {
  const c = S().chars[id];
  const spent = Object.values(c.skills).reduce((a, b) => a + b, 0);
  return levelFromXp(c.xp).level - 1 - spent;
}

export function isCharUnlocked(id) {
  const ch = CHAR_BY_ID[id];
  if (ch.unlock.type === 'start' || ch.unlock.type === 'shop') return true;
  return !!S().bosses[ch.unlock.boss];
}
export const isCharOwned = (id) => !!S().chars[id];

export function buyChar(id) {
  const ch = CHAR_BY_ID[id];
  const d = S();
  if (d.chars[id] || !isCharUnlocked(id) || d.coins < ch.price) return false;
  d.coins -= ch.price;
  d.chars[id] = newChar();
  save();
  return true;
}

export function buySkin(charId, skinId) {
  const d = S();
  const c = d.chars[charId];
  const sk = SKINS.find((s) => s.id === skinId);
  if (!c || !sk || c.skins.includes(skinId) || d.coins < sk.price) return false;
  d.coins -= sk.price;
  c.skins.push(skinId);
  save();
  return true;
}

export function buyItem(id) {
  const d = S();
  const it = ITEM_BY_ID[id];
  if (!it || d.inv[id] >= it.max || d.coins < it.price) return false;
  d.coins -= it.price;
  d.inv[id]++;
  save();
  return true;
}

export function addXp(id, amount) {
  const c = S().chars[id];
  const before = levelFromXp(c.xp).level;
  c.xp += Math.max(0, Math.floor(amount));
  const after = levelFromXp(c.xp).level;
  return { before, after };
}

export function spendSkill(charId, branch) {
  const c = S().chars[charId];
  if (!c || c.skills[branch] >= 5 || skillPointsLeft(charId) < 1) return false;
  c.skills[branch]++;
  save();
  return true;
}

export function respec(charId) {
  S().chars[charId].skills = { speed: 0, defense: 0, economy: 0, ability: 0 };
  save();
}

// ---------- quests ----------
const localDate = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export function rollQuests() {
  const q = S().quests;
  const today = localDate();
  if (q.date === today && q.list.length === 3) return;
  let h = 0;
  for (const ch of today) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const pool = [...QUEST_POOL];
  const list = [];
  while (list.length < 3) {
    h = (Math.imul(h, 1103515245) + 12345) >>> 0;
    const pick = pool.splice(h % pool.length, 1)[0];
    list.push({ id: pick.id, progress: 0, claimed: false });
  }
  S().quests = { date: today, list, stats: {} };
}

export function questDef(id) {
  return QUEST_POOL.find((q) => q.id === id);
}

export function bumpStat(stat, n = 1) {
  rollQuests();
  const q = S().quests;
  for (const it of q.list) {
    const def = questDef(it.id);
    if (def.stat === stat) it.progress = Math.min(def.target, it.progress + n);
  }
}

export function claimQuest(i) {
  const it = S().quests.list[i];
  if (!it || it.claimed) return false;
  const def = questDef(it.id);
  if (it.progress < def.target) return false;
  it.claimed = true;
  S().coins += def.reward;
  save();
  return true;
}

export { CHARACTERS, SKILL_BRANCHES };
