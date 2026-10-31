import { setExternalMusic, getVolumes } from './audio.js';
import { bus } from './bus.js';

// Official publisher-hosted players; recordings are never copied.
const isiOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
export const radioAvailable = track => !(isiOS && track.provider === "Audiomack");
export const RADIO_TRACKS = [
  { id: 'hunter', title: 'Hunter Eyes', artist: 'laydownrot', provider: 'SoundCloud', url: 'https://soundcloud.com/laydownrot/mirror-lies-hunter-eyes' },
  { id: 'ascend', title: 'Play Hard · Slowed', artist: 'ASCEND / Hardstyle Demon', provider: 'Audiomack', url: 'https://audiomack.com/embed/song/hardstyle-demon-1/play-hard-slowed' },
  { id: 'ascend-ultra', title: 'Play Hard · Ultra Slowed', artist: 'ASCEND / Hardstyle Demon', provider: 'Audiomack', url: 'https://audiomack.com/embed/song/hardstyle-demon-1/play-hard-ultra-slowed' },
];
const KEY = 'moggman_radio_v1';
let selected = 'hunter', widget, ready = false, request = 0, loadTimer, apiPromise;
let resumeOnVisible = false, playerUrl = "", activeProvider = "", providerMuted = false;
try { selected = localStorage.getItem(KEY) ?? 'hunter'; } catch { /* storage may be disabled */ }
if (!RADIO_TRACKS.some(t => t.id === selected)) selected = '';
if (selected && !radioAvailable(RADIO_TRACKS.find(t => t.id === selected))) selected = 'hunter';
export const radioSelection = () => selected;
const status = text => { document.querySelector('#radio-status').textContent = text; };
function api() {
  if (window.SC?.Widget) return Promise.resolve();
  if (!apiPromise) apiPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://w.soundcloud.com/player/api.js';
    script.onload = () => window.SC?.Widget ? resolve() : reject(new Error('SoundCloud unavailable'));
    script.onerror = () => { script.remove(); apiPromise = null; reject(new Error('SoundCloud unavailable')); };
    document.head.append(script);
  });
  return apiPromise;
}
function volume() {
  const v = getVolumes();
  if (activeProvider === 'Audiomack') {
    const frame = document.querySelector('#radio-player');
    const muted = v.mute || v.music === 0;
    if (muted && !providerMuted) { frame.removeAttribute('src'); status('Звук выключен'); }
    if (!muted && providerMuted) { frame.src = playerUrl; status('Audiomack · нажми ▶ в плеере'); }
    providerMuted = muted;
    return;
  }
  if (ready) widget.setVolume(v.mute ? 0 : Math.round(v.music * 100));
}
export async function selectRadio(id) {
  const track = RADIO_TRACKS.find(t => t.id === id);
  if (track && !radioAvailable(track)) return;
  selected = track?.id || '';
  activeProvider = track?.provider || '';
  providerMuted = false;
  try { localStorage.setItem(KEY, selected || 'off'); } catch { /* keep this session */ }
  const generation = ++request;
  clearTimeout(loadTimer);
  ready = false;
  widget?.pause();
  widget = null;
  const dock = document.querySelector('#radio-dock');
  // Replace the iframe so late events from the previous track cannot affect this one.
  const old = document.querySelector('#radio-player');
  const frame = old.cloneNode(false);
  old.replaceWith(frame);
  frame.style.pointerEvents = '';
  delete frame.dataset.ready;
  setExternalMusic(!!track);
  dock.hidden = !track;
  document.querySelector('#app').classList.toggle('has-radio', !!track);
  if (!track) { frame.removeAttribute('src'); return; }
  document.querySelector('#radio-player').style.height = track.provider === 'Audiomack' ? '252px' : '166px';
  if (track.provider === 'Audiomack') {
    playerUrl = track.url;
    frame.dataset.ready = '0';
    frame.style.pointerEvents = 'none';
    status('Загрузка Audiomack…');
    frame.onload = () => {
      if (generation !== request || frame.getAttribute('src') !== playerUrl) return;
      frame.dataset.ready = '1'; frame.style.pointerEvents = '';
      status(`${track.title} · Audiomack`);
    };
    frame.src = playerUrl;
    document.querySelector('#radio-help').textContent = 'Нажми ▶, затем сверни плеер. Громкость — кнопками устройства. Audiomack может показать настройки cookies.';
    volume();
    return;
  }
  document.querySelector('#radio-help').textContent = 'На iPhone выбери Listen in browser, затем ▶. Сверни плеер — музыка продолжит играть.';
  status('Загрузка SoundCloud…');
  frame.src = `https://w.soundcloud.com/player/?url=${encodeURIComponent(track.url)}&auto_play=false&visual=false&show_artwork=false&show_comments=false&show_playcount=false&color=%23ff638a`;
  loadTimer = setTimeout(() => { if (generation === request && !ready) status('SoundCloud не ответил · можно выключить ×'); }, 12000);
  try {
    await api();
    if (generation !== request) return;
    const w = window.SC.Widget(frame);
    widget = w;
    const current = () => generation === request;
    w.bind(window.SC.Widget.Events.READY, () => {
      if (!current()) return;
      clearTimeout(loadTimer); ready = true; volume();
      status('Нажми ▶ в плеере');
    });
    w.bind(window.SC.Widget.Events.PLAY, () => { if (current()) status(`${track.artist} · играет`); });
    w.bind(window.SC.Widget.Events.PAUSE, () => { if (current()) status('Музыка на паузе · ▶ продолжить'); });
    w.bind(window.SC.Widget.Events.ERROR, () => { if (current()) status('Трек недоступен в SoundCloud · выключить ×'); });
    w.bind(window.SC.Widget.Events.FINISH, () => { if (current() && !document.hidden) { w.seekTo(0); w.play(); } });
  } catch { if (generation === request) status('SoundCloud недоступен · выключить ×'); }
}
export function initRadio() {
  document.querySelector('#radio-off').onclick = () => { closeRadioPanel(); selectRadio(''); };
  document.querySelector('#radio-toggle').onclick = () => {
    const panel = document.querySelector('#radio-panel');
    panel.hidden = !panel.hidden;
    document.querySelector('#radio-toggle').setAttribute('aria-expanded', String(!panel.hidden));
    if (!panel.hidden) bus.emit('radio:opened');
  };
  bus.on('audio:volume', volume);
  // A user gesture may unlock playback; the native play button remains available on iOS.
  let attempted = false;
  document.addEventListener('pointerdown', () => {
    if (!attempted && ready && selected) { attempted = true; widget.play(); }
  });
  document.addEventListener('visibilitychange', () => {
    if (activeProvider === 'Audiomack') {
      if (document.hidden) { document.querySelector('#radio-player').removeAttribute('src'); status('Audiomack · нажми ▶ для продолжения'); }
      else if (!providerMuted) document.querySelector('#radio-player').src = playerUrl;
      return;
    }
    if (!ready) return;
    const w = widget, generation = request;
    if (document.hidden) w.isPaused(paused => {
      if (generation !== request || !document.hidden) return;
      resumeOnVisible = !paused; w.pause();
    });
    else if (resumeOnVisible) { resumeOnVisible = false; w.play(); }
  });
  selectRadio(selected);
}

export function closeRadioPanel() {
  document.querySelector('#radio-panel').hidden = true;
  document.querySelector('#radio-toggle').setAttribute('aria-expanded', 'false');
}
