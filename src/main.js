import Phaser from 'phaser';
import '@fontsource/press-start-2p/400.css';
import './styles.css';
import './moggman.css';
import './feed.css';
import { initViewport, fitCanvas } from './viewport.js';
import { initRadio } from './radio.js';
import './playfield.css';
import { watchUpdates } from './updates.js';
import { MW, MH } from './config.js';
import * as texMod from './textures.js';
import * as audioMod from './audio.js';
import { configureMusicFiles } from './audio.js';
import * as dataMod from './data.js';
import { loadSheets, loadPortraitAtlas } from './textures.js';
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

  }
  create() {
    this.scene.start('game');
  }
}

async function main() {
  initTelegram();
  initViewport();
  await loadSave();
  let sheets = [];
  try {
    const r = await fetch(`${BASE}assets/characters/manifest.json`);
    if (r.ok) sheets = (await r.json()).sheets || [];
  } catch (e) {
    sheets = [];
  }
  await loadSheets(sheets, BASE);
  await loadPortraitAtlas(BASE);
  await configureMusicFiles(BASE);
  try {
    await document.fonts.load('8px "Press Start 2P"');
  } catch (e) {
    /* font fallback */
  }
  const stage = document.getElementById('stage');
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: MW + 16,
    height: MH + 16,
    backgroundColor: '#000000',
    pixelArt: false,
    roundPixels: false,
    antialias: true,
    disableContextMenu: true,
    scale: { mode: Phaser.Scale.NONE },
    scene: [Boot, GameScene],
    callbacks: { preBoot: (g) => g.registry.set('sheets', sheets) },
  });

  // Keep the renderer and logical world fixed. Only the displayed canvas scales.
  const fit = () => fitCanvas(game, stage, MW + 16, MH + 16);
  new ResizeObserver(fit).observe(stage);

  game.events.once('ready', () => {
    const scene = game.scene.getScene('game');
    const boot = () => {
      fit();
      initUI(scene);
      initRadio();
      fit();
      if (import.meta.env.DEV) window.__game = { game, scene, SV, bus, play: playLevel, mods: { textures: texMod, audio: audioMod, data: dataMod }, ui: uiState, get S() { return scene.S; } };
      document.body.dataset.ready = '1';
      watchUpdates(() => !uiState.inLevel);
    };
    if (scene.sys.isActive() && scene.mz) boot();
    else scene.events.once('create', boot);
  });
}

main();
