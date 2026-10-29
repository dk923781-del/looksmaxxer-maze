from playwright.sync_api import sync_playwright
JS = r'''
async () => {
  const { playerPreviewURL } = window.__game.mods.textures;
  document.body.innerHTML = '';
  const c = document.createElement('canvas'); c.width = 640; c.height = 360; c.id = 'cv';
  c.style.cssText = 'position:fixed;left:0;top:0;image-rendering:pixelated';
  document.body.appendChild(c);
  const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
  const g = x.createLinearGradient(0, 0, 0, 360); g.addColorStop(0, '#07040f'); g.addColorStop(1, '#2a0f4e');
  x.fillStyle = g; x.fillRect(0, 0, 640, 360);
  let s = 7; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 50; i++) { x.fillStyle = 'rgba(255,255,255,' + (0.3 + r() * 0.5) + ')'; x.fillRect(Math.floor(r() * 640), Math.floor(r() * 200), 2, 2); }
  let bx = 0;
  while (bx < 640) { const w = 28 + Math.floor(r() * 40), h = 60 + Math.floor(r() * 110);
    x.fillStyle = '#1b1038'; x.fillRect(bx, 360 - h, w, h); x.fillStyle = 'rgba(176,108,255,.5)'; x.fillRect(bx, 360 - h, w, 2);
    for (let wy = 360 - h + 8; wy < 350; wy += 12) for (let wx = bx + 6; wx < bx + w - 6; wx += 9) if (r() < 0.3) { x.fillStyle = 'rgba(255,211,107,.55)'; x.fillRect(wx, wy, 4, 6); }
    bx += w + 4; }
  x.fillStyle = 'rgba(0,0,0,.45)'; x.fillRect(0, 0, 640, 360);
  // neon maze frame lines
  x.fillStyle = '#b06cff';
  for (const [a, b, w, h] of [[24, 24, 120, 4], [24, 24, 4, 60], [496, 24, 120, 4], [612, 24, 4, 60], [24, 332, 120, 4], [24, 272, 4, 64], [496, 332, 120, 4], [612, 272, 4, 64]]) x.fillRect(a, b, w, h);
  x.fillStyle = '#5a2bd6';
  for (const [a, b, w, h] of [[28, 28, 116, 3], [496, 28, 116, 3]]) x.fillRect(a, b, w, h);
  // pellets + coins
  for (let i = 0; i < 24; i++) { x.fillStyle = '#ffe9c4'; x.fillRect(60 + i * 22, 318, 4, 4); }
  for (const cx of [70, 250, 570]) { x.fillStyle = '#ffd23f'; x.fillRect(cx, 296, 14, 18); x.fillStyle = '#ffb800'; x.fillRect(cx + 10, 296, 4, 18); }
  const load = (u) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = u; });
  const chars = [['valera_broke', 1, 150], ['moggsu', 2, 320], ['zetaboss', 3, 490]];
  for (const [id, st, cx] of chars) { const im = await load(playerPreviewURL(id, 'base', st, 10)); const sc = st === 2 ? 1.05 : 1; const hh = 175 * sc, ww = hh * 28 / 30; x.drawImage(im, cx - ww / 2, 300 - hh, ww, hh); }
  await document.fonts.load('20px "Press Start 2P"');
  x.textAlign = 'center';
  x.font = '31px "Press Start 2P"';
  x.fillStyle = '#3b1a8a'; x.fillText('LOOKSMAXXER MAZE', 324, 76);
  x.fillStyle = '#ff4fd8'; x.fillText('LOOKSMAXXER MAZE', 320, 72);
  x.font = '14px "Press Start 2P"'; x.fillStyle = '#7cf0ff'; x.fillText('PIXEL EVOLUTION', 320, 104);
  return true;
}
'''
with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    pg = b.new_page(viewport={'width': 640, 'height': 360}, device_scale_factor=1)
    pg.route('**/telegram.org/**', lambda r: r.fulfill(status=200, content_type='application/javascript', body=''))
    pg.goto('http://127.0.0.1:5173/'); pg.wait_for_selector('body[data-ready="1"]')
    pg.evaluate(JS)
    pg.locator('#cv').screenshot(path='cover.png')
    b.close()
