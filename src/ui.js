import { RADIO_TRACKS, radioAvailable, selectRadio, radioSelection, closeRadioPanel } from './radio.js';
import { bus } from './bus.js';
import * as SV from './save.js';
import { levelFromXp, stageForLevel, xpForLevel } from './config.js';
import { MUSIC_CREDITS, WORLDS, levelDef, CHARACTERS, CHAR_BY_ID, SKINS, SKIN_BY_ID, ITEMS, SKILL_BRANCHES, LEGENDARY, STAGE_NAMES, QUEST_POOL, BONUS_TYPES, BOSSES } from './data.js';
import { playerPreviewURL, portraitURL } from './textures.js';
import { sfx, initAudio, setVolumes, startMusic, stopMusic, setCustomTrack, clearCustomTrack, customTrackName, setPlaybackMode, playbackMode, levelNow } from './audio.js';
import { setBack, setVibration, haptic } from './tg.js';

const $ = (s) => document.querySelector(s);
const BASE = import.meta.env.BASE_URL;
const fmt = (n) => Math.floor(n).toLocaleString('en-US');
const S = SV.S;

const ui = { scene: null, stack: [], cur: null, world: 1, shopTab: 'chars', inLevel: false, paused: false, modalOpen: false };

export function initUI(scene) {
  ui.scene = scene;
  document.addEventListener('click', onClick);
  document.addEventListener('pointerdown', () => initAudio(), { once: false });
  bus.on('hud', updateHud);
  bus.on('radio:opened', () => { if (ui.inLevel && !ui.paused) ui.scene.pause(); });
  bus.on('level:won', (r) => showResult(r));
  bus.on('level:lost', (r) => showLost(r));
  bus.on('paused', (p) => {
    ui.paused = p;
    if (p) showPause();
    else closeModal();
  });
  bus.on('key:escape', onEscape);
  bus.on('blackpill', () => {
    const f = $('#flash');
    if (f) {
      f.hidden = false;
      setTimeout(() => (f.hidden = true), 700);
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && ui.inLevel && !ui.paused) ui.scene.pause();
  });
  bindControls();
  applySettings();
  showMain(true);
}

// ---------------- helpers ----------------
function applySettings() {
  const st = S().settings;
  setVolumes(st.music, st.sfx, st.mute, { voice: st.voice, bass: st.bass });
  setVibration(st.vibration);
  document.body.dataset.controls = st.controls;
  updateControlsVisibility();
}

export function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => (t.hidden = true), 2000);
}

function setScreen(html, { back = false, title = '', coins = true } = {}) {
  const el = $('#screen');
  el.hidden = false;
  el.innerHTML =
    (title || back
      ? `<div class="top">${back ? '<button class="btn small" data-act="back" aria-label="Back">&lt;</button>' : ''}<h2>${title}</h2>${coins ? `<span class="chip gold"><i class="coin"></i><span id="bank">${fmt(S().coins)}</span></span>` : ''}</div>`
      : '') + `<div class="body">${html}</div>`;
  setBack(back ? goBack : ui.inLevel ? () => bus.emit('input:pause') : null);
}

function hideScreen() {
  $('#screen').hidden = true;
}

function go(fn, ...args) {
  if (ui.cur) ui.stack.push(ui.cur);
  ui.cur = [fn, args];
  fn(...args);
}

function goBack() {
  const prev = ui.stack.pop();
  if (prev) {
    ui.cur = prev;
    prev[0](...prev[1]);
  } else showMain(true);
}

function rerender() {
  if (ui.cur) ui.cur[0](...ui.cur[1]);
}

function stars3(arr) {
  return arr.map((s) => (s ? '★' : '<span class="no">★</span>')).join('');
}

function onEscape() {
  if (ui.modalOpen && ui.inLevel && ui.paused) {
    ui.scene.resume();
  } else if (ui.inLevel) {
    ui.scene.pause();
  } else if (ui.stack.length || (ui.cur && ui.cur[0] !== showMain)) goBack();
}

// ---------------- click delegation ----------------
const actions = {
  back: () => goBack(),
  play: () => go(showPlay),
  chars: () => go(showChars),
  upgrades: () => go(showUpgrades),
  shop: () => go(showShop),
  quests: () => go(showQuests),
  settings: () => go(showSettings),
  world: (d) => {
    ui.world = +d.w;
    rerender();
  },
  hard: () => {
    const st = SV.charStats(S().sel);
    if (!st.hardOk) return toast('HARD MODE unlocks at character level 61');
    S().hard = !S().hard;
    SV.save();
    rerender();
  },
  lv: (d) => startLevel(+d.w, +d.l),
  pick: (d) => {
    S().sel = d.id;
    SV.save();
    rerender();
  },
  buychar: (d) => {
    if (SV.buyChar(d.id)) {
      sfx.buy();
      haptic('levelup');
      toast(`${CHAR_BY_ID[d.id].name} unlocked!`);
    } else sfx.deny();
    rerender();
  },
  buyskin: (d) => {
    if (SV.buySkin(d.id, d.skin)) {
      sfx.buy();
      toast('Skin purchased');
    } else sfx.deny();
    rerender();
  },
  equip: (d) => {
    S().chars[d.id].skin = d.skin;
    SV.save();
    rerender();
  },
  buyitem: (d) => {
    if (SV.buyItem(d.id)) {
      sfx.buy();
      toast(`${ITEMS.find((i) => i.id === d.id).name} purchased`);
    } else sfx.deny();
    rerender();
  },
  tab: (d) => {
    ui.shopTab = d.t;
    rerender();
  },
  skill: (d) => {
    if (SV.spendSkill(S().sel, d.b)) {
      sfx.xp();
      haptic('collect');
    } else sfx.deny();
    rerender();
  },
  respec: () => {
    SV.respec(S().sel);
    rerender();
  },
  claim: (d) => {
    if (SV.claimQuest(+d.i)) {
      sfx.buy();
      toast('Reward claimed');
    }
    rerender();
  },
  toggle: (d) => {
    const st = S().settings;
    if (d.k === 'mute') st.mute = !st.mute;
    if (d.k === 'vibration') st.vibration = !st.vibration;
    if (d.k === 'bass') st.bass = !st.bass;
    if (d.k === 'controls') st.controls = st.controls === 'dpad' ? 'swipe' : 'dpad';
    SV.save();
    applySettings();
    rerender();
  },
  clearmusic: () => { selectRadio(''); clearCustomTrack(); rerender(); },
  musicmode: (d) => { setPlaybackMode(d.mode); rerender(); },
  reset: () =>
    showConfirm('RESET ALL PROGRESS?', 'Characters, coins, levels and skills will be erased.', () => {
      SV.resetSave();
      applySettings();
      ui.stack = [];
      showMain(true);
      toast('Progress reset');
    }),
  credits: () => {
    openModal(`<h2>Авторы</h2><div style="font-size:8px;line-height:1.9">${MUSIC_CREDITS.map((c) => `<div class="kv" style="display:block"><span class="dim">${c.slot}</span><br><b>${c.title}</b> by ${c.artist}</div>`).join('')}<p class="dim">Music: Pixabay Content License. SFX and fallback music are synthesized. Local audio is chosen by the player.</p></div><button class="btn" data-act="closemodal" id="credits-close">CLOSE</button>`);
  },
  resume: () => ui.scene.resume(),
  restart: () => {
    closeModal();
    ui.scene.startLevel(ui.scene.opts);
    ui.paused = false;
  },
  menu: () => exitToMenu(),
  next: (d) => {
    closeModal();
    startLevel(+d.w, +d.l);
  },
  replay: () => {
    closeModal();
    ui.scene.startLevel(ui.scene.opts);
  },
  closemodal: () => closeModal(),
  confirmyes: () => {
    const f = ui.confirm;
    closeModal();
    if (f) f();
  },
  ending: () => {
    closeModal();
    showResult(ui.pendingResult, true);
  },
  share: () => {
    import('./tg.js').then((m) => m.shareLink('https://t.me/share/url?url=' + encodeURIComponent(location.href) + '&text=' + encodeURIComponent('Stay unmogged. Beat my run in MOGGMAN.')));
  },
};

function onClick(e) {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const fn = actions[el.dataset.act];
  if (!fn) return;
  sfx.click();
  fn(el.dataset);
}

// ---------------- screens ----------------
function charHeader(id) {
  const c = S().chars[id];
  const li = levelFromXp(c.xp);
  const stage = stageForLevel(li.level);
  return { c, li, stage, def: CHAR_BY_ID[id] };
}

export function showMain(reset) {
  if (reset) {
    ui.stack = [];
    ui.cur = [showMain, []];
  }
  ui.inLevel = false;
  const id = S().sel;
  const { c, li, stage, def } = charHeader(id);
  const url = playerPreviewURL(id, c.skin, stage, 6);
  const title = li.level >= 100 ? 'ULTIMATE MOGGER' : STAGE_NAMES[stage];
  setScreen(
    `<div class="feed-header"><span class="feed-logo">moggman<span>✦</span></span><span class="chip"><i class="coin"></i><span id="bank">${fmt(S().coins)}</span></span><button class="gear" data-act="settings" id="btn-settings" aria-label="Музыка и настройки">♫</button></div>
     <div class="feed-heading"><h1>Твой выход.</h1><span>Не дай себя могнуть.</span></div>
     <div class="edit-card"><img class="edit-portrait" src="${portraitURL(id)}" alt="${def.name}"><div class="edit-shade"></div>
       <div class="edit-topline"><span class="live-dot"></span> MOG EDIT <span>LV ${li.level}</span></div>
       <div class="edit-sticker">аура +999 ✨</div><div class="edit-side"><span>✦</span><span>◈</span><span>☄</span></div>
       <div class="edit-caption"><span class="pov">POV: зашёл на один уровень</span><h2>${def.name}</h2><p>${def.tag}</p><span class="edit-hashtags">#moggman #ещёодинзабег</span></div>
     </div>
     <div class="progress-line"><span>${title}</span><span>Уровень ${li.level} / 100</span></div><div class="xpbar"><i style="width:${li.need ? li.into/li.need*100 : 100}%"></i></div>
     <button class="btn primary play-cta" data-act="play" id="btn-play"><span>ПОГНАЛИ</span><span>▶</span></button>
     <div class="feed-nav"><button data-act="chars" id="btn-chars"><span>◉</span>Моггеры</button><button data-act="upgrades" id="btn-upgrades"><span>✦</span>Эволюция${SV.skillPointsLeft(id)>0?' +':''}</button><button data-act="shop" id="btn-shop"><span>◇</span>Магазин</button><button data-act="quests" id="btn-quests"><span>☑</span>Задания${questsReady()?' !':''}</button></div>
     <div class="feed-footer">Лови ауру. Теряй счёт времени.</div>`,
    { coins: false },
  );
  document.body.dataset.playing = '0';
  $('#hud').hidden = true;
  $('#controls').hidden = true;
  if (ui.scene && ui.scene.S) ui.scene.quit();
  ui.scene && ui.scene.drawBackdrop(0);
  startMenuMusic();
}

function startMenuMusic() {
  stopMusic();
  startMusic(0);
}

function questsReady() {
  SV.rollQuests();
  return S().quests.list.some((q) => !q.claimed && q.progress >= SV.questDef(q.id).target);
}

function levelUnlocked(w, l) {
  if (w === 1 && l === 1) return true;
  const prev = l > 1 ? `${w}-${l - 1}` : `${w - 1}-5`;
  return !!(S().levels[prev] && S().levels[prev].c);
}

function worldUnlocked(w) {
  return w === 1 || levelUnlocked(w, 1);
}

function showPlay() {
  const d = S();
  const st = SV.charStats(d.sel);
  let w = ui.world;
  if (!worldUnlocked(w)) w = ui.world = 1;
  const tabs = WORLDS.map((wd) => `<button class="${wd.id === w ? 'on' : ''}" data-act="world" data-w="${wd.id}" ${worldUnlocked(wd.id) ? '' : 'disabled style="opacity:.35"'}>${worldUnlocked(wd.id) ? wd.id : '?'}</button>`).join('');
  const lv = [1, 2, 3, 4, 5]
    .map((l) => {
      const def = levelDef(w, l);
      const rec = d.levels[def.key];
      const ok = levelUnlocked(w, l);
      const s = rec ? [rec.s >= 1, rec.s >= 2, rec.s >= 3] : [false, false, false];
      return `<button class="${def.boss ? 'boss' : ''} ${ok ? '' : 'locked'}" ${ok ? '' : 'disabled'} data-act="lv" data-w="${w}" data-l="${l}" id="lv-${w}-${l}">${def.boss ? 'BOSS' : `${w}-${l}`}<span class="stars">${stars3(s)}</span></button>`;
    })
    .join('');
  const wd = WORLDS[w - 1];
  setScreen(
    `<div class="tabs" style="display:flex">${tabs}</div>
     <div class="card"><h3 style="color:#${wd.neon.toString(16).padStart(6, '0')}">${wd.name}</h3><span class="dim">${worldBlurb(w)}</span></div>
     <div class="lvgrid">${lv}</div>
     <button class="btn ${d.hard && st.hardOk ? 'gold' : ''} ${st.hardOk ? '' : 'off'}" data-act="hard" id="btn-hard">HARD MODE: ${d.hard && st.hardOk ? 'ON (x1.5 rewards)' : st.hardOk ? 'OFF' : 'LOCKED (Lv 61)'}</button>
     <div class="dim" style="font-size:7px;line-height:1.7">Collect 40 dots for MOG RUSH: 6s of double score and +15% speed. Escape a close hunter for +100. Stars: no deaths / fast clear / every coin. Boss: eat an Energy Sphere, then touch the boss.</div>`,
    { back: true, title: 'SELECT LEVEL' },
  );
}

function worldBlurb(w) {
  return (
    {
      1: 'Освой лабиринт и обойди преследователей. На пятом уровне — Elite Hunter.',
      2: 'Ускорители, опасные зоны и тайные стены. На пятом уровне — Gym Tyrant.',
      3: 'Охотники идут по следу. На пятом уровне — ZETABOSS.',
      4: 'Стены меняются каждые 15 секунд. На пятом уровне — HULIOBOSS.',
      5: 'Все испытания сразу. На пятом уровне — финальный босс с тремя фазами.',
    }[w] || ''
  );
}

function bossLockText(ch) {
  const b = BOSSES[ch.unlock.boss];
  return `Сначала победи ${b.name}`;
}

function showChars() {
  const d = S();
  const cards = CHARACTERS.map((ch) => {
    const owned = !!d.chars[ch.id];
    const unlocked = SV.isCharUnlocked(ch.id);
    let info = '';
    let action = '';
    if (owned) {
      const { li, stage } = charHeader(ch.id);
      info = `<span class="gold">Lv ${li.level}</span> · ${STAGE_NAMES[stage]}`;
      action = d.sel === ch.id ? '<span class="green">Выбран</span>' : `<button class="btn small" data-act="pick" data-id="${ch.id}" id="pick-${ch.id}">Выбрать</button>`;
    } else if (!unlocked) {
      info = `<span class="red">Закрыт</span> · ${bossLockText(ch)}, затем ${fmt(ch.price)}`;
    } else {
      info = `${fmt(ch.price)} монет`;
      action = `<button class="btn small gold ${d.coins >= ch.price ? '' : 'off'}" data-act="buychar" data-id="${ch.id}" id="buy-${ch.id}">Купить ${fmt(ch.price)}</button>`;
    }
    const stage = owned ? charHeader(ch.id).stage : 1;
    const skin = owned ? d.chars[ch.id].skin : 'base';
    const img = `<img class="portrait" alt="${ch.name}" src="${portraitURL(ch.id)}">`;
    return `<div class="card ${d.sel === ch.id ? 'sel' : ''}"><div class="row">${img}<div class="grow"><h3>${ch.name}</h3><div class="dim">${ch.tag}</div><div>${info}</div></div></div>
      <div style="margin-top:6px"><b class="cyan">${ch.ability.name}</b> <span class="dim">(cd ${ch.ability.cd}s)</span><br>${ch.ability.text}</div>
      <div class="row" style="margin-top:8px;justify-content:space-between"><img alt="" style="height:64px;width:auto;image-rendering:pixelated" src="${playerPreviewURL(ch.id, skin, stage, 3)}">${action}</div></div>`;
  }).join('');
  setScreen(cards, { back: true, title: 'Выбери своего' });
}

function showUpgrades() {
  const id = S().sel;
  const { c, li, def } = charHeader(id);
  const pts = SV.skillPointsLeft(id);
  const br = SKILL_BRANCHES.map((b) => {
    const have = c.skills[b.id];
    const nodes = b.nodes
      .map((t, i) => {
        const got = i < have;
        const next = i === have;
        return `<button class="node ${got ? 'got' : ''} ${next && pts > 0 ? 'next' : ''}" ${next && pts > 0 ? `data-act="skill" data-b="${b.id}"` : 'disabled'} id="sk-${b.id}-${i}">${i + 1}. ${t}</button>`;
      })
      .join('');
    return `<div><div style="color:${b.color};font-size:9px;margin:4px 0">${b.name} ${have}/5</div>${nodes}</div>`;
  }).join('');
  const leg = LEGENDARY.map((l) => `<div class="kv"><span class="${li.level >= l.lvl ? 'green' : 'dim'}">Lv ${l.lvl}</span><span style="text-align:right;max-width:70%" class="${li.level >= l.lvl ? '' : 'dim'}">${l.text}</span></div>`).join('');
  setScreen(
    `<div class="card"><h3>${def.name} <span class="gold">Lv ${li.level}</span></h3>Skill points: <b class="gold" id="skpts">${pts}</b> <span class="dim">(1 per level)</span><div class="xpbar"><i style="width:${li.need ? (li.into / li.need) * 100 : 100}%"></i></div><div class="dim">XP ${fmt(li.into)} / ${fmt(li.need)}</div></div>
     <div class="branches">${br}</div>
     <button class="btn small" style="margin:8px 0" data-act="respec" id="btn-respec">RESPEC (free)</button>
     <div class="card"><h3>Milestones</h3>${leg}</div>`,
    { back: true, title: 'UPGRADES' },
  );
}

function showShop() {
  const d = S();
  const tab = ui.shopTab;
  const tabs = [
    ['chars', 'Characters'],
    ['skins', 'Skins'],
    ['items', 'Items'],
  ]
    .map(([k, n]) => `<button class="${tab === k ? 'on' : ''}" data-act="tab" data-t="${k}" id="tab-${k}">${n}</button>`)
    .join('');
  let body = '';
  if (tab === 'chars') {
    body = CHARACTERS.filter((c) => c.unlock.type !== 'start')
      .map((ch) => {
        const owned = !!d.chars[ch.id];
        const unlocked = SV.isCharUnlocked(ch.id);
        let right;
        if (owned) right = '<span class="green">OWNED</span>';
        else if (!unlocked) right = `<span class="red">Закрыт</span><div class="dim">${bossLockText(ch)}</div>`;
        else right = `<button class="btn small gold ${d.coins >= ch.price ? '' : 'off'}" data-act="buychar" data-id="${ch.id}" id="shop-buy-${ch.id}">${fmt(ch.price)}</button>`;
        return `<div class="card"><div class="row"><div class="grow"><h3>${ch.name}</h3><span class="dim">${ch.ability.text}</span></div><div style="text-align:right">${right}</div></div></div>`;
      })
      .join('');
  } else if (tab === 'skins') {
    const id = d.sel;
    const c = d.chars[id];
    body = `<div class="dim" style="font-size:8px;margin-bottom:8px">Skins for ${CHAR_BY_ID[id].name}</div>` +
      SKINS.map((sk) => {
        const owned = c.skins.includes(sk.id);
        const equipped = c.skin === sk.id;
        let right;
        if (equipped) right = '<span class="green">Выбран</span>';
        else if (owned) right = `<button class="btn small" data-act="equip" data-id="${id}" data-skin="${sk.id}">Выбрать</button>`;
        else right = `<button class="btn small gold ${d.coins >= sk.price ? '' : 'off'}" data-act="buyskin" data-id="${id}" data-skin="${sk.id}" id="buy-skin-${sk.id}">${fmt(sk.price)}</button>`;
        return `<div class="card"><div class="row"><img alt="" style="height:72px;width:auto;image-rendering:pixelated" src="${playerPreviewURL(id, sk.id, charHeader(id).stage, 4)}"><div class="grow"><h3>${sk.name}</h3><span class="dim">${sk.rarity || 'default'}</span></div>${right}</div></div>`;
      }).join('');
  } else {
    body = ITEMS.map((it) => {
      const have = d.inv[it.id];
      const full = have >= it.max;
      return `<div class="card"><div class="row"><div class="grow"><h3>${it.name}</h3><span class="dim">${it.text}</span><div>В запасе: <b class="gold">${have}/${it.max}</b></div></div>
        <button class="btn small gold ${full || d.coins < it.price ? 'off' : ''}" data-act="buyitem" data-id="${it.id}" id="buy-${it.id}">${full ? 'MAX' : fmt(it.price)}</button></div></div>`;
    }).join('');
  }
  setScreen(`<div class="tabs" style="display:flex">${tabs}</div>${body}`, { back: true, title: 'Магазин' });
}

function showQuests() {
  SV.rollQuests();
  const q = S().quests;
  const body = q.list
    .map((it, i) => {
      const def = SV.questDef(it.id);
      const done = it.progress >= def.target;
      return `<div class="card"><h3>${def.text}</h3><div class="bar ${done ? '' : 'pink'}"><i style="width:${(it.progress / def.target) * 100}%"></i></div>
        <div class="row" style="margin-top:8px;justify-content:space-between"><span>${it.progress}/${def.target} · <span class="gold">+${def.reward}</span></span>
        ${it.claimed ? '<span class="green">Получено</span>' : `<button class="btn small gold ${done ? '' : 'off'}" ${done ? '' : 'disabled'} data-act="claim" data-i="${i}" id="claim-${i}">Забрать</button>`}</div></div>`;
    })
    .join('');
  setScreen(`<div class="dim" style="font-size:8px;margin-bottom:8px">Задания обновляются в полночь (${q.date}).</div>${body}`, { back: true, title: 'Задания' });
}

function showSettings() {
  const customOpen = document.querySelector('details.radio-card')?.open || false;
  const st = S().settings;
  setScreen(
    `<div class="radio-card"><h3>Твой саундтрек</h3><p>Hunter Eyes — SoundCloud. ASCEND — Audiomack. Выбери трек и нажми ▶ в плеере. Файлы загружать не нужно.</p><div class="track-list">${RADIO_TRACKS.map(t=>`<button class="btn small ${radioSelection()===t.id?'active':''}" data-radio="${t.id}" ${radioAvailable(t)?'':'disabled'}><strong>${t.title}</strong><span>${t.artist}${radioAvailable(t)?'':' · плеер недоступен на iPhone'}</span></button>`).join('')}</div><button class="btn small" data-radio="">Встроенная музыка</button><p class="dim">Выбор сохраняется. Нужен интернет и доступ к музыкальному сервису. Выбор остаётся после перезагрузки; телефон может потребовать нажатия ▶.</p></div><details class="radio-card"><summary>Свой аудиофайл</summary><label class="btn primary file-label">Выбрать файл<input id="custom-track" type="file" accept="audio/*,.mp3,.wav,.m4a,.ogg"></label><p id="track-name"></p><div class="radio-modes">${['original','slowed','sped'].map(m => `<button class="btn small ${playbackMode()===m?'active':''}" data-act="musicmode" data-mode="${m}">${m}</button>`).join('')}</div><button class="btn small" data-act="clearmusic">Вернуть встроенную музыку</button><p class="dim">Файл действует до перезагрузки. Скорость и бас применяются только к встроенной музыке и своим файлам.</p></details>
     <div class="card"><div>Громкость встроенной музыки / SoundCloud</div><input id="s-music" class="slider" type="range" min="0" max="100" value="${Math.round(st.music * 100)}"></div>
     <div class="card row"><span class="grow">Усиление баса</span><button class="btn small toggle" data-act="toggle" data-k="bass" id="t-bass">${st.bass ? 'ON' : 'OFF'}</button></div>
     <div class="card"><div>Громкость эффектов</div><input id="s-sfx" class="slider" type="range" min="0" max="100" value="${Math.round(st.sfx * 100)}"></div>
     <div class="card"><div>Голос боссов</div><input id="s-voice" class="slider" type="range" min="0" max="100" value="${Math.round(st.voice * 100)}"></div>
     <div class="card row"><span class="grow">Выключить звук</span><button class="btn small toggle" data-act="toggle" data-k="mute" id="t-mute">${st.mute ? 'ON' : 'OFF'}</button></div>
     <div class="card row"><span class="grow">Вибрация</span><button class="btn small toggle" data-act="toggle" data-k="vibration" id="t-vib">${st.vibration ? 'ON' : 'OFF'}</button></div>
     <div class="card row"><span class="grow">Управление</span><button class="btn small toggle" data-act="toggle" data-k="controls" id="t-ctl">${st.controls === 'dpad' ? 'D-PAD' : 'SWIPE'}</button></div>
     <button class="btn" data-act="credits" id="btn-credits">Авторы</button>
     <button class="btn" style="border-color:var(--red);color:var(--red)" data-act="reset" id="btn-reset">Сбросить прогресс</button>
     <div class="dim" style="font-size:7px;text-align:center;line-height:1.8">MOGGMAN<br>Keys: arrows / WASD, Space = ability, Esc = pause</div>`,
    { back: true, title: 'Музыка и настройки' },
  );
  document.querySelector('details.radio-card').open = customOpen;
  document.querySelectorAll('[data-radio]').forEach(b => b.onclick = () => { selectRadio(b.dataset.radio); showSettings(); if (b.dataset.radio) { document.querySelector('#radio-panel').hidden = false; document.querySelector('#radio-toggle').setAttribute('aria-expanded','true'); } });
  $('#track-name').textContent = customTrackName() || 'Built-in phonk soundtrack';
  $('#custom-track').addEventListener('change', async (e) => {
    const file = e.target.files[0]; if (!file) return;
    const status = $('#track-name'); status.textContent = 'Loading track…';
    try { await setCustomTrack(file); selectRadio(''); status.textContent = customTrackName(); toast('Your track is ready'); }
    catch (err) { status.textContent = err.message; }
  });
  const bind = (id, key) => {
    const el = $(id);
    el.addEventListener('input', () => {
      S().settings[key] = el.value / 100;
      applySettings();
    });
    el.addEventListener('change', () => {
      SV.save();
      sfx.coin();
    });
  };
  bind('#s-music', 'music');
  bind('#s-sfx', 'sfx');
  bind('#s-voice', 'voice');
}

// ---------------- modals ----------------
function openModal(html) {
  const m = $('#modal');
  m.hidden = false;
  m.innerHTML = `<div class="modalbox">${html}</div>`;
  ui.modalOpen = true;
}

function closeModal() {
  $('#modal').hidden = true;
  $('#modal').innerHTML = '';
  ui.modalOpen = false;
}

function showConfirm(title, text, yes) {
  ui.confirm = yes;
  openModal(`<h2>${title}</h2><p style="font-size:8px;line-height:1.7;text-align:center">${text}</p><button class="btn red" data-act="confirmyes" id="confirm-yes">YES</button><button class="btn" data-act="closemodal" id="confirm-no">NO</button>`);
}

function showPause() {
  openModal(`<h2>Аура на паузе</h2><button class="btn primary" data-act="resume" id="btn-resume">RESUME</button><button class="btn" data-act="restart" id="btn-restart">RESTART LEVEL</button><button class="btn" data-act="menu" id="btn-quit">EXIT TO MENU</button>`);
}

function exitToMenu() {
  closeModal();
  ui.paused = false;
  ui.scene.quit();
  ui.stack = [];
  showMain(true);
}

function nextOf(def) {
  if (def.l < 5) return [def.w, def.l + 1];
  if (def.w < 5) return [def.w + 1, 1];
  return null;
}

function showResult(r, afterEnding) {
  ui.pendingResult = r;
  const last = r.def.boss === 'dildo';
  if (last && !S().seenEnding && !afterEnding) {
    S().seenEnding = true;
    SV.save();
    openModal(`<h2>YOU ARE THE<br>ULTIMATE MOGGER</h2><div class="bigstars">★</div>
      <p style="font-size:8px;line-height:1.9;text-align:center">DILDOBOSS has been mogged. The Tower is yours.<br><br>Keep climbing: replay levels in HARD mode, finish daily quests and push your character to level 100 for the golden aura.</p>
      <button class="btn primary" data-act="ending" id="btn-ending">CONTINUE</button><button class="btn" data-act="share">SHARE</button>`);
    sfx.win();
    return;
  }
  const nx = nextOf(r.def);
  const canNext = nx && levelUnlocked(nx[0], nx[1]);
  const lvUp = r.lvAfter > r.lvBefore;
  const unlock = r.unlockedChar ? `<div class="card sel green" style="text-align:center">${CHAR_BY_ID[r.unlockedChar].name} is now available in the SHOP (${fmt(CHAR_BY_ID[r.unlockedChar].price)})</div>` : '';
  openModal(`<h2>${r.boss ? 'БОСС МОГНУТ' : 'ЧИСТЫЙ МOГ'}${r.hard ? ' (HARD)' : ''}</h2>
    <div class="bigstars">${stars3(r.stars)}</div>
    <div class="kv"><span>No deaths</span><span>${r.stars[0] ? 'YES' : 'no'}</span></div>
    <div class="kv"><span>Time ${Math.round(r.time)}s / par ${r.par}s</span><span>${r.stars[1] ? 'YES' : 'no'}</span></div>
    <div class="kv"><span>All coins</span><span>${r.stars[2] ? 'YES' : 'no'}</span></div>
    <div class="kv" style="margin-top:6px"><span>Score</span><b>${fmt(r.score)}</b></div>
    <div class="kv"><span>Mog Coins</span><b class="gold">+${fmt(r.coins)}</b></div>
    <div class="kv"><span>XP</span><b class="green">+${fmt(r.xp)}</b></div>
    ${r.bossBonus ? `<div class="kv"><span>Boss bonus</span><b class="gold">+${r.bossBonus}</b></div>` : ''}
    ${r.secrets ? `<div class="kv"><span>Secrets found</span><b>${r.secrets}</b></div>` : ''}
    ${lvUp ? `<div class="card sel" style="text-align:center;margin-top:8px" id="lvup">LEVEL UP! ${r.lvBefore} → ${r.lvAfter}<br><span class="dim">+${r.lvAfter - r.lvBefore} skill points</span></div>` : ''}
    ${unlock}
    <div style="margin-top:12px">
    ${canNext ? `<button class="btn primary" data-act="next" data-w="${nx[0]}" data-l="${nx[1]}" id="btn-next">NEXT LEVEL</button>` : ''}
    <button class="btn" data-act="replay" id="btn-replay">REPLAY</button>
    <button class="btn" data-act="menu" id="btn-menu">MENU</button></div>`);
  if (lvUp) haptic('levelup');
}

function showLost(r) {
  openModal(`<h2 class="red">GAME OVER</h2>
    <div class="kv"><span>Score</span><b>${fmt(r.score)}</b></div>
    <div class="kv"><span>Pellets</span><b>${r.pellets}</b></div>
    <div class="kv"><span>Coins kept</span><b class="gold">+${fmt(r.coins)}</b></div>
    <div class="kv"><span>XP kept</span><b class="green">+${fmt(r.xp)}</b></div>
    <div style="margin-top:12px"><button class="btn primary" data-act="replay" id="btn-retry">TRY AGAIN</button><button class="btn" data-act="menu" id="btn-menu">MENU</button></div>`);
}

// ---------------- level start / HUD / controls ----------------
function startLevel(w, l) {
  closeRadioPanel();
  hideScreen();
  closeModal();
  ui.inLevel = true;
  ui.paused = false;
  $('#hud').hidden = false;
  $('#controls').hidden = false;
  updateControlsVisibility();
  setBack(() => bus.emit('input:pause'));
  stopMusic();
  ui.scene.startLevel({ w, l, hard: !!S().hard && SV.charStats(S().sel).hardOk });
  document.body.dataset.playing = '1';
}

function updateControlsVisibility() {
  const dp = $('#dpad');
  if (!dp) return;
  const mobile = window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 700;
  dp.hidden = !(S().settings.controls === 'dpad' && mobile);
  const ctl = $('#controls');
  if (ctl) ctl.classList.toggle('slim', dp.hidden);
}
window.addEventListener('resize', () => {
  if (S()) updateControlsVisibility();
});

function bindControls() {
  const map = { u: 0, r: 1, d: 2, l: 3 };
  document.querySelectorAll('#dpad button').forEach((b) => {
    const d = map[b.dataset.d];
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      bus.emit('input:dir', d);
    });
  });
  $('#btn-ability').addEventListener('click', () => bus.emit('input:ability'));
  $('#btn-energy').addEventListener('click', () => bus.emit('input:item', 'energy'));
  $('#btn-shield').addEventListener('click', () => bus.emit('input:item', 'shield'));
  $('#btn-pause').addEventListener('click', () => bus.emit('input:pause'));
  // swipe on the play field
  const stage = $('#stage');
  let sx = 0;
  let sy = 0;
  let down = false;
  stage.addEventListener('pointerdown', (e) => {
    if (!ui.inLevel || ui.paused) return;
    stage.setPointerCapture(e.pointerId);
    down = true;
    sx = e.clientX;
    sy = e.clientY;
  });
  stage.addEventListener('pointermove', (e) => {
    if (!down) return;
    const dx = e.clientX - sx;
    const dy = e.clientY - sy;
    if (Math.abs(dx) > 20 || Math.abs(dy) > 20) {
      bus.emit('input:dir', Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : dy > 0 ? 2 : 0);
      sx = e.clientX;
      sy = e.clientY;
    }
  });
  const up = () => (down = false);
  stage.addEventListener('pointerup', up);
  stage.addEventListener('pointercancel', up);
  stage.addEventListener('lostpointercapture', up);
  window.addEventListener('blur', up);
}

let lastHud = '';
function updateHud(h) {
  if (!ui.inLevel) return;
  const set = (id, v) => {
    const el = document.getElementById(id);
    if (el && el.textContent !== String(v)) el.textContent = v;
  };
  set('h-who', `${h.charName}`);
  set('h-lv', `Lv ${h.level}`);
  $('#h-xp').style.width = `${h.xpPct * 100}%`;
  set('h-coins', fmt(h.coins));
  set('h-lives', '♥'.repeat(h.lives) || '-');
  const bp = $('#h-bp');
  const nb = h.bp;
  const html = [0, 1, 2].map((i) => `<i class="pill ${i < nb ? '' : 'off'}"></i>`).join('');
  if (bp.innerHTML !== html) bp.innerHTML = html;
  set('h-level', `W${h.w}-${h.l}${h.hard ? ' HARD' : ''}`);
  set('h-pct', `${h.pct}%`);
  $('#h-pctbar').style.width = `${h.pct}%`;
  set('h-score', fmt(h.score));
  set('h-mult', h.mult > 1 ? `x${h.mult}` : '');
  set('h-aura', h.rushT > 0 ? `MOG RUSH ${Math.ceil(h.rushT)}s` : `AURA ${h.aura || 0}/40`);
  $('#aura-fill').style.width = `${h.rushT > 0 ? h.rushT / 6 * 100 : (h.aura || 0) / 40 * 100}%`;
  const bon = h.bonuses
    .map((b) => `<span class="bchip" style="color:${BONUS_TYPES[b.type].color};border-color:${BONUS_TYPES[b.type].color}">${BONUS_TYPES[b.type].name.split(' ')[0].toUpperCase()} ${Math.ceil(b.t)}s</span>`)
    .join('');
  const fr = h.frightT > 0 ? `<span class="bchip" style="color:#7cf0ff;border-color:#2a3cff">MOG ${Math.ceil(h.frightT)}s</span>` : '';
  const bh = bon + fr;
  const be = $('#hud-bonus');
  if (be.innerHTML !== bh) be.innerHTML = bh;
  be.hidden = !bh;
  const bossRow = $('#hud-boss');
  if (h.boss) {
    bossRow.hidden = false;
    set('h-bossname', `${h.boss.name}${h.boss.max === 5 ? ` P${h.boss.phase}` : ''}`);
    $('#h-bosshp').style.width = `${(h.boss.hp / h.boss.max) * 100}%`;
  } else bossRow.hidden = true;
  // ability
  const ab = $('#btn-ability');
  const ready = h.ability.cd <= 0 && h.ability.active <= 0;
  ab.classList.toggle('ready', ready);
  ab.querySelector('.nm').textContent = h.ability.active > 0 ? `${Math.ceil(h.ability.active)}с` : ready ? '✦' : `${Math.ceil(h.ability.cd)}с`;
  ab.setAttribute('aria-label', `${h.ability.name}: ${ready ? 'готова' : 'восстанавливается'}`);
  ab.querySelector('.cd').style.height = ready || h.ability.active > 0 ? '0' : `${(h.ability.cd / h.ability.cdMax) * 100}%`;
  const en = $('#btn-energy');
  const sh = $('#btn-shield');
  en.querySelector('b').textContent = h.items.energy;
  sh.querySelector('b').textContent = h.items.shield;
  en.disabled = h.items.energy < 1;
  sh.disabled = h.items.shield < 1;
}

export const uiState = ui;
export { startLevel as playLevel };
