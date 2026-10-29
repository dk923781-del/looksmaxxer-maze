// Static game data: worlds, levels, characters, shop, skills, quests.

export const WORLDS = [
  { id: 1, name: 'Neon Streets', neon: 0xb06cff, neon2: 0x5a2bd6, fill: 0x140a2e, sky: [0x0a0618, 0x2a0f4e], accent: 0xff4fd8, building: 0x1b1038, win: 0xffd36b, music: 0 },
  { id: 2, name: 'Underground Gym', neon: 0x4fc3ff, neon2: 0x1b6fb8, fill: 0x0a1626, sky: [0x050b14, 0x10263d], accent: 0xff7a3d, building: 0x0e1f33, win: 0x7cf0ff, music: 1 },
  { id: 3, name: 'Sigma District', neon: 0x9aa7ff, neon2: 0x3a3f9a, fill: 0x0b0b1c, sky: [0x03030a, 0x14122e], accent: 0xff3b3b, building: 0x101026, win: 0xff5b5b, music: 2 },
  { id: 4, name: 'Glitch Dimension', neon: 0x39ffb0, neon2: 0xff2fb4, fill: 0x04130f, sky: [0x020a08, 0x0b2a22], accent: 0xff2fb4, building: 0x071a15, win: 0x39ffb0, music: 3 },
  { id: 5, name: "Mogger's Tower", neon: 0xffd23f, neon2: 0xb8721d, fill: 0x1a1203, sky: [0x0a0602, 0x3a2208], accent: 0xff3b3b, building: 0x221704, win: 0xffd23f, music: 4 },
];

const E = { C: 'chaser', D: 'doomer', G: 'glitch', H: 'hunter' };
const LAYOUT = {
  1: [[E.C, E.D], [E.C, E.D], [E.C, E.C, E.D], [E.C, E.C, E.D, E.D], [E.D]],
  2: [[E.C, E.D], [E.C, E.D, E.G], [E.C, E.C, E.D, E.G], [E.C, E.D, E.G, E.G], [E.C, E.D]],
  3: [[E.C, E.D, E.H], [E.C, E.H, E.D, E.G], [E.H, E.H, E.C, E.D], [E.C, E.H, E.G, E.D], [E.C, E.H]],
  4: [[E.C, E.G, E.H], [E.G, E.G, E.C, E.D], [E.G, E.H, E.C, E.G], [E.G, E.G, E.H, E.C], [E.G, E.C]],
  5: [[E.C, E.D, E.G, E.H], [E.C, E.D, E.G, E.H], [E.C, E.G, E.H, E.H], [E.C, E.D, E.G, E.H], [E.C, E.G]],
};

export const BOSSES = {
  mini1: { id: 'mini1', name: 'ELITE HUNTER', hp: 3, speed: 0.88, ai: 'hunter', tex: 'mini', reward: 100 },
  mini2: { id: 'mini2', name: 'GYM TYRANT', hp: 3, speed: 0.9, ai: 'hunter', tex: 'mini', reward: 100 },
  zeta: { id: 'zeta', name: 'ZETABOSS', hp: 4, speed: 0.82, ai: 'chaser', tex: 'zeta', reward: 300, unlocks: 'zetaboss' },
  hulio: { id: 'hulio', name: 'HULIOBOSS', hp: 4, speed: 0.84, ai: 'hunter', tex: 'hulio', reward: 300, unlocks: 'hulioboss' },
  dildo: { id: 'dildo', name: 'DILDOBOSS', hp: 5, speed: 0.86, ai: 'hunter', tex: 'dildo', reward: 300, unlocks: 'dildoboss' },
};

export function levelDef(w, l) {
  const g = (w - 1) * 5 + (l - 1);
  let boss = null;
  if (l === 5) boss = { 1: 'mini1', 2: 'mini2', 3: 'zeta', 4: 'hulio', 5: 'dildo' }[w];
  const zones = w === 1 ? 0 : w === 2 ? (l <= 2 ? 1 : 2) : w === 5 ? 3 : 2;
  return {
    w,
    l,
    g,
    key: `${w}-${l}`,
    seed: 7000 + w * 997 + l * 131 + g * 7,
    enemies: LAYOUT[w][l - 1],
    speedF: 0.6 + 0.013 * g,
    frightSec: Math.max(3.5, 7 - 0.1 * g),
    zones: boss && w <= 2 ? 1 : zones,
    secret: w >= 2,
    pads: w === 2,
    glitch: w === 4 || w === 5,
    boss,
    extraLoops: w - 1,
  };
}

export const ALL_LEVELS = [];
for (let w = 1; w <= 5; w++) for (let l = 1; l <= 5; l++) ALL_LEVELS.push(levelDef(w, l));

// ---------------- characters ----------------
export const CHARACTERS = [
  {
    id: 'valera_broke',
    name: 'Valera Broke',
    tag: 'From broke to mogger',
    unlock: { type: 'start' },
    price: 0,
    ability: { id: 'hustle', name: 'Hustle', dur: 5, cd: 25, text: 'Coins x2 for 5s' },
    pal: { skin: '#e8b48a', hair: '#8a5a2b', shirt: '#2a2a35', accent: '#ffd36b', eye: '#2b1b12' },
    portrait: 'ref3.jpg',
  },
  {
    id: 'moggsu',
    name: 'Moggsu',
    tag: 'Jawline dealer',
    unlock: { type: 'shop' },
    price: 1200,
    ability: { id: 'chad_dash', name: 'Chad Dash', dur: 2, cd: 15, text: 'Speed +40% for 2s' },
    pal: { skin: '#f0c19c', hair: '#15121c', shirt: '#5a2bd6', accent: '#7cf0ff', eye: '#4a6a8a' },
    portrait: 'ref2.jpg',
  },
  {
    id: 'zetaboss',
    name: 'Zetaboss',
    tag: 'Sigma grindset',
    unlock: { type: 'boss', boss: 'zeta' },
    price: 1200,
    ability: { id: 'sigma_grind', name: 'Sigma Grind', dur: 3, cd: 30, text: 'Shield 3s. Passive: bonuses last +50%' },
    pal: { skin: '#e0a47c', hair: '#0e0e12', shirt: '#1f7a4d', accent: '#9aa7ff', eye: '#3a3a4a' },
    portrait: 'ref1.jpg',
  },
  {
    id: 'hulioboss',
    name: 'Hulioboss',
    tag: 'Phase through',
    unlock: { type: 'boss', boss: 'hulio' },
    price: 3000,
    ability: { id: 'phase', name: 'Phase', dur: 3, cd: 25, text: 'Invisible to enemies for 3s' },
    pal: { skin: '#e6b08c', hair: '#4a2c1a', shirt: '#101018', accent: '#39ffb0', eye: '#5a7088' },
    portrait: 'ref4.jpg',
  },
  {
    id: 'dildoboss',
    name: 'Dildoboss',
    tag: 'Final mog',
    unlock: { type: 'boss', boss: 'dildo' },
    price: 3000,
    ability: { id: 'mog_aura', name: 'Mog Aura', dur: 4, cd: 30, text: 'Enemies within 4 tiles slow 50% and flee' },
    pal: { skin: '#f2c8a6', hair: '#d8c05a', shirt: '#8a1fa8', accent: '#ffd23f', eye: '#2a2a2a' },
    portrait: null,
  },
];
export const CHAR_BY_ID = Object.fromEntries(CHARACTERS.map((c) => [c.id, c]));

export const SKINS = [
  { id: 'base', name: 'Classic', price: 0 },
  { id: 'neon', name: 'Neon Drip', price: 150, rarity: 'common', shift: { shirt: '#ff2fb4', accent: '#39ffb0' } },
  { id: 'void', name: 'Void Gold', price: 500, rarity: 'rare', shift: { shirt: '#0a0a12', accent: '#ffd23f', hair: '#f0f0ff' }, aura: 0xffd23f },
];
export const SKIN_BY_ID = Object.fromEntries(SKINS.map((s) => [s.id, s]));

export const STAGE_NAMES = ['', 'Rookie', 'Chadlet', 'Sigma', 'Ultimate Mogger'];

// ---------------- items ----------------
export const ITEMS = [
  { id: 'blackpill', name: 'Blackpill', price: 100, max: 3, text: 'Auto-saves you from a hit. SECOND CHANCE. Max 3.' },
  { id: 'energy', name: 'Energy Boost', price: 75, max: 5, text: 'Use in a level: speed +30% for 6s.' },
  { id: 'shield', name: 'Shield Token', price: 125, max: 5, text: 'Use in a level: blocks 1 hit.' },
];
export const ITEM_BY_ID = Object.fromEntries(ITEMS.map((i) => [i.id, i]));

export const BONUS_TYPES = {
  chad: { name: 'Chad Boost', dur: 6, color: '#ff9f1c', icon: 'B' },
  shield: { name: 'Pixel Shield', dur: 12, color: '#7cf0ff', icon: 'S' },
  ghost: { name: 'Ghost Mode', dur: 6, color: '#c9b6ff', icon: 'G' },
  magnet: { name: 'Coin Magnet', dur: 10, color: '#ffd23f', icon: 'M' },
  freeze: { name: 'Time Freeze', dur: 4, color: '#8ff', icon: 'T' },
};

// ---------------- skills ----------------
export const SKILL_BRANCHES = [
  { id: 'speed', name: 'Speed', color: '#ff9f1c', nodes: ['+3% speed', '+3% speed', '+3% speed', '+3% speed', '+3% speed'] },
  { id: 'defense', name: 'Defense', color: '#7cf0ff', nodes: ['Shields last +3s', 'Enemies vulnerable +1s', 'Respawn invuln +1s', 'Shields last +3s', 'Vulnerable +1s'] },
  { id: 'economy', name: 'Economy', color: '#ffd23f', nodes: ['Coins +10%', 'Magnet radius +0.5', 'Coins +10%', 'Magnet radius +0.5', 'Coins +10%'] },
  { id: 'ability', name: 'Ability', color: '#ff4fd8', nodes: ['Cooldown -8%', 'Cooldown -8%', 'Cooldown -8%', 'Cooldown -8%', 'Cooldown -8%'] },
];

export const LEGENDARY = [
  { lvl: 26, text: 'New look unlocked' },
  { lvl: 41, text: 'Second bonus slot' },
  { lvl: 61, text: 'Hard mode unlocked' },
  { lvl: 81, text: 'Legendary: enemies near you are 15% slower' },
  { lvl: 91, text: 'Legendary: score x1.25' },
  { lvl: 100, text: 'Title: Ultimate Mogger' },
];

// ---------------- quests ----------------
export const QUEST_POOL = [
  { id: 'coins200', text: 'Collect 200 Mog Coins', stat: 'coins', target: 200, reward: 50 },
  { id: 'coins80', text: 'Collect 80 Mog Coins', stat: 'coins', target: 80, reward: 30 },
  { id: 'eat5', text: 'Eat 5 enemies', stat: 'eaten', target: 5, reward: 40 },
  { id: 'eat12', text: 'Eat 12 enemies', stat: 'eaten', target: 12, reward: 70 },
  { id: 'clean1', text: 'Clear a level without dying', stat: 'clean', target: 1, reward: 60 },
  { id: 'clear3', text: 'Clear 3 levels', stat: 'clears', target: 3, reward: 80 },
  { id: 'pel500', text: 'Eat 500 pellets', stat: 'pellets', target: 500, reward: 50 },
  { id: 'bonus4', text: 'Pick up 4 bonuses', stat: 'bonuses', target: 4, reward: 40 },
  { id: 'abil3', text: 'Use your ability 3 times', stat: 'ability', target: 3, reward: 30 },
];

// ---------------- boss voice lines (original meme-style phrases) ----------------
export const VOICE = {
  mini1: { pitch: 0.7, rate: 1.0, blip: 260, lines: { intro: 'Target locked.', hit: 'Ouch. My aura.', dead: 'Respect.', kill: 'Skill issue.' } },
  mini2: { pitch: 0.5, rate: 0.9, blip: 200, lines: { intro: 'Leg day is every day.', hit: 'That was my protein.', dead: 'I need a spotter.', kill: 'Light weight, baby.' } },
  zeta: { pitch: 0.35, rate: 0.8, blip: 160, lines: { intro: 'Sigma grindset. You are not him.', hit: 'Bro. That hurt my aura.', dead: 'My aura. Is gone.', kill: 'Mogged. Skill issue.' } },
  hulio: { pitch: 1.7, rate: 1.3, blip: 520, lines: { intro: 'Look into my eyes, mogger.', hit: 'Error. Aura leaking.', phase2: 'Glitch mode.', dead: 'System failure. Respect.', kill: 'Cope.' } },
  dildo: { pitch: 0.1, rate: 0.7, blip: 110, lines: { intro: 'Welcome to the tower. Prepare to be mogged.', hit: 'Impossible.', phase2: 'Now I am serious.', phase3: 'Final form. Aura maximum.', dead: 'You are the ultimate mogger.', kill: 'Ratio.' } },
};

// ---------------- music credits (licensed files, Pixabay Content License) ----------------
export const MUSIC_CREDITS = [
  { slot: 'Menu, World 1', title: 'Phonk - Phonk Aura', artist: 'MondaMusic', url: 'https://pixabay.com/music/phonk-phonk-phonk-aura-542549/' },
  { slot: 'World 2', title: 'Brazilian Phonk', artist: 'Sub_Clair', url: 'https://pixabay.com/music/phonk-brazilian-phonk-571897/' },
  { slot: 'World 3', title: 'Phonk Aura Drift Night Ride', artist: 'alex-morgan', url: 'https://pixabay.com/music/phonk-phonk-aura-drift-night-ride-587401/' },
  { slot: 'World 4', title: 'Brazilian Phonk Instrumental Aura Funk', artist: 'echoes_of_lumen', url: 'https://pixabay.com/music/phonk-brazilian-phonk-instrumental-aura-funk-588665/' },
  { slot: 'World 5', title: 'Brazilian Phonk Bounce Heat', artist: 'alex-morgan', url: 'https://pixabay.com/music/phonk-brazilian-phonk-bounce-heat-573874/' },
  { slot: 'Bosses', title: 'Brazilian Phonk Music', artist: 'AbsoluteSound', url: 'https://pixabay.com/music/phonk-brazilian-phonk-music-529762/' },
];
