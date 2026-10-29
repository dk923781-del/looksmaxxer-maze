from playwright.sync_api import sync_playwright
JS = r'''
async () => {
  const { playerPreviewURL } = window.__game.mods.textures;
  document.body.innerHTML = '';
  const c = document.createElement('canvas'); c.width = 640; c.height = 640; c.id = 'cv';
  c.style.cssText = 'position:fixed;left:0;top:0;image-rendering:pixelated';
  document.body.appendChild(c);
  const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
  const g = x.createLinearGradient(0, 0, 0, 640); g.addColorStop(0, '#0a0618'); g.addColorStop(1, '#3a1470');
  x.fillStyle = g; x.fillRect(0, 0, 640, 640);
  let s = 11; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 40; i++) { x.fillStyle = 'rgba(255,255,255,' + (0.3 + r() * 0.5) + ')'; x.fillRect(Math.floor(r() * 640), Math.floor(r() * 300), 4, 4); }
  let bx = 0;
  while (bx < 640) { const w = 50 + Math.floor(r() * 60), h = 90 + Math.floor(r() * 200);
    x.fillStyle = '#1b1038'; x.fillRect(bx, 640 - h, w, h); x.fillStyle = 'rgba(176,108,255,.55)'; x.fillRect(bx, 640 - h, w, 4);
    for (let wy = 640 - h + 14; wy < 625; wy += 22) for (let wx = bx + 10; wx < bx + w - 10; wx += 16) if (r() < 0.3) { x.fillStyle = 'rgba(255,211,107,.5)'; x.fillRect(wx, wy, 8, 12); }
    bx += w + 6; }
  x.fillStyle = 'rgba(0,0,0,.4)'; x.fillRect(0, 0, 640, 640);
  x.fillStyle = '#b06cff'; x.fillRect(24, 24, 592, 8); x.fillRect(24, 608, 592, 8); x.fillRect(24, 24, 8, 592); x.fillRect(608, 24, 8, 592);
  x.fillStyle = '#5a2bd6'; x.fillRect(32, 32, 576, 4); x.fillRect(32, 604, 576, 4);
  const im = await new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = playerPreviewURL('moggsu', 'base', 2, 10); });
  x.drawImage(im, 640/2 - 168, 150, 336, 360);
  x.fillStyle = '#ffd23f'; for (const [a, b] of [[70, 480], [530, 470], [90, 120], [520, 110]]) { x.fillRect(a, b, 28, 36); x.fillStyle = '#ffb800'; x.fillRect(a + 20, b, 8, 36); x.fillStyle = '#ffd23f'; }
  await document.fonts.load('20px "Press Start 2P"');
  x.textAlign = 'center';
  x.font = '60px "Press Start 2P"'; x.fillStyle = '#3b1a8a'; x.fillText('MAZE', 326, 152); x.fillStyle = '#ff4fd8'; x.fillText('MAZE', 320, 146);
  x.font = '26px "Press Start 2P"'; x.fillStyle = '#3b1a8a'; x.fillText('LOOKSMAXXER', 324, 78); x.fillStyle = '#ff4fd8'; x.fillText('LOOKSMAXXER', 320, 74);
  return true;
}
'''
with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    pg = b.new_page(viewport={'width': 640, 'height': 640}, device_scale_factor=1)
    pg.route('**/telegram.org/**', lambda r: r.fulfill(status=200, content_type='application/javascript', body=''))
    pg.goto('http://127.0.0.1:5173/'); pg.wait_for_selector('body[data-ready="1"]')
    pg.evaluate(JS)
    pg.locator('#cv').screenshot(path='avatar.png')
    b.close()
