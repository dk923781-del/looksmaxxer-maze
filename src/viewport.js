// Telegram animates viewportHeight while dragging; size only to its stable state.
export function initViewport() {
  const tg = window.Telegram?.WebApp;
  const native = tg?.platform && tg.platform !== 'unknown';
  let timer;
  const apply = () => {
    const height = native && tg.viewportStableHeight > 0 ? tg.viewportStableHeight : window.innerHeight;
    document.documentElement.dataset.layout = window.innerWidth > height && height <= 540 ? 'landscape' : 'portrait';
    document.documentElement.style.setProperty('--app-height', `${Math.round(height)}px`);
    if (native) {
      for (const edge of ['top', 'bottom', 'left', 'right']) {
        const inset = (tg.safeAreaInset?.[edge] || 0) + (tg.contentSafeAreaInset?.[edge] || 0);
        document.documentElement.style.setProperty(`--safe-${edge}`, `${inset}px`);
      }
    }
  };
  apply();
  tg?.onEvent?.('viewportChanged', event => { if (event?.isStateStable) apply(); });
  tg?.onEvent?.('safeAreaChanged', apply);
  tg?.onEvent?.('contentSafeAreaChanged', apply);
  window.addEventListener('resize', () => {
    clearTimeout(timer);
    timer = setTimeout(apply, 120);
  });
}

export function fitCanvas(game, stage, width, height) {
  const W = stage.clientWidth, H = stage.clientHeight;
  if (!W || !H || !game.canvas) return;
  const scale = Math.min(W / width, H / height);
  const canvas = game.canvas;
  canvas.style.width = `${width * scale}px`;
  canvas.style.height = `${height * scale}px`;
  // No scale.resize / setZoom: pickups and HUD text cannot reallocate the renderer.
  if (import.meta.env.DEV) window.__fit = { W, H, scale, gw: width, gh: height, bufferW: canvas.width, bufferH: canvas.height };
}
