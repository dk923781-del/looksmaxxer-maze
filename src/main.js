import Phaser from 'phaser';
import '@fontsource/press-start-2p/400.css';
import './styles.css';
import { MW, MH } from './config.js';
import { CHARACTERS } from './data.js';
import GameScene from './scenes/GameScene.js';
import { initTelegram } from './tg.js';
import { loadSave } from './save.js';
import * as SV from './save.js';
import { initUI, playLevel, uiState } from './ui.js';
import { bus } from './bus.js';

const BASE = import.meta.env.BASE_URL;

class Boot extends Phaser.Scene {
  constructor() {
    super('boot');
  }
  preload() {
    // optional custom sprite sheets: list ids in public/assets/characters/manifest.json
    this.load.setBaseURL('');
    for (const id of this.registry.get('sheets') || []) this.load.image('sheet_' + id, `${BASE}assets/characters/${id}.png`);
  }
  create() {
    this.scene.start('game');
  }
}

async function main() {
  initTelegram();
  await loadSave();
  let sheets = [];
  try {
    const r = await fetch(`${BASE}assets/characters/manifest.json`);
    if (r.ok) sheets = (await r.json()).sheets || [];
  } catch (e) {
    sheets = [];
  }
  try {
    await document.fonts.load('8px "Press Start 2P"');
  } catch (e) {
    /* font fallback */
  }
  const stage = document.getElementById('stage');
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: MW,
    height: MH,
    backgroundColor: '#000000',
    pixelArt: true,
    roundPixels: true,
    antialias: false,
    disableContextMenu: true,
    scale: { mode: Phaser.Scale.NONE },
    scene: [Boot, GameScene],
    callbacks: { preBoot: (g) => g.registry.set('sheets', sheets) },
  });

  // Integer scaling: every game pixel is an integer number of device pixels.
  const fit = () => {
    const W = stage.clientWidth;
    const H = stage.clientHeight;
    if (!W || !H) return;
    const dpr = window.devicePixelRatio || 1;
    const s = Math.min(W / MW, H / MH);
    const z = Math.max(1, Math.floor(dpr * s));
    const gw = Math.ceil((W * dpr) / z);
    const gh = Math.ceil((H * dpr) / z);
    game.scale.resize(gw, gh);
    game.scale.setZoom(z / dpr);
    const c = game.canvas;
    if (c) {
      c.style.width = `${(gw * z) / dpr}px`;
      c.style.height = `${(gh * z) / dpr}px`;
    }
    window.__fit = { W, H, dpr, z, gw, gh };
  };
  new ResizeObserver(fit).observe(stage);
  window.addEventListener('resize', fit);

  game.events.once('ready', () => {
    const scene = game.scene.getScene('game');
    const boot = () => {
      fit();
      initUI(scene);
      fit();
      if (import.meta.env.DEV) window.__game = { game, scene, SV, bus, play: playLevel, ui: uiState, get S() { return scene.S; } };
      document.body.dataset.ready = '1';
    };
    if (scene.sys.isActive() && scene.mz) boot();
    else scene.events.once('create', boot);
  });
}

main();
