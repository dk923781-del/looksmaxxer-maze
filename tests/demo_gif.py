"""Records a demo GIF: a simple bot plays level 1-1 (dev server must run on :5173)."""
from playwright.sync_api import sync_playwright
from PIL import Image, ImageDraw, ImageFont
import io, glob

BOT = r'''
() => {
  const G = window.__game, s = G.scene;
  window.__bot = (steps) => {
    for (let k = 0; k < steps; k++) {
      if (!s.S || s.S.state !== 'play') { s.step(1/30); continue; }
      s.S.invuln = Math.max(s.S.invuln, 1);
      const P = s.P, g = s.maze.grid;
      const px = Math.round(P.x), py = Math.round(P.y);
      // goal: frightened enemy if any, else nearest pellet/coin/sphere
      let goals = new Set();
      for (const e of s.enemies) if (e.state === 'fright') goals.add(Math.round(e.y) * 19 + Math.round(e.x));
      if (!goals.size) {
        s.maze.pel.forEach((v, i) => v && goals.add(i));
        for (const [i] of s.coinSpr) goals.add(i);
        for (const [i] of s.sphSpr) goals.add(i);
      }
      const prev = new Map([[py * 19 + px, -1]]); const q = [[px, py, -1]];
      let first = -1;
      for (let h = 0; h < q.length; h++) {
        const [x, y, f] = q[h];
        if (goals.has(y * 19 + x) && (x !== px || y !== py)) { first = f; break; }
        for (let d = 0; d < 4; d++) {
          const nx = x + [0,1,0,-1][d], ny = y + [-1,0,1,0][d];
          if (nx < 0 || ny < 0 || nx > 18 || ny > 22 || g[ny*19+nx] === 1 || prev.has(ny*19+nx)) continue;
          prev.set(ny*19+nx, 1); q.push([nx, ny, f < 0 ? d : f]);
        }
      }
      if (first >= 0) s.setWant(first);
      s.step(1/30);
    }
  };
  return true;
}
'''
frames = []
with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    pg = b.new_page(viewport={'width': 400, 'height': 600}, device_scale_factor=1)
    pg.route('**/telegram.org/**', lambda r: r.fulfill(status=200, content_type='application/javascript', body=''))
    pg.goto('http://127.0.0.1:5173/'); pg.evaluate('localStorage.clear()'); pg.reload()
    pg.wait_for_selector('body[data-ready="1"]')
    pg.evaluate('(()=>{const d=window.__game.SV.S(); d.chars.valera_broke.xp=36000; window.__game.SV.save();})()')
    pg.add_style_tag(content='#hud-bonus{display:none!important}')
    pg.evaluate('window.__game.play(1,1)')
    pg.wait_for_function('window.__game.S && window.__game.S.state==="play"')
    pg.evaluate('window.__game.scene.autoTick=false')
    pg.evaluate(BOT)
    pg.evaluate('window.__bot(1)')
    pg.wait_for_timeout(500)
    BOXJS = '(()=>{const c=document.querySelector("#game canvas").getBoundingClientRect(); const s=window.__game.scene; return {x:c.left+s.ox, y:c.top+s.oy}})()'
    for f in range(110):
        if f == 45: pg.evaluate('window.__game.scene.startFright()')
        pg.evaluate('window.__bot(4)')
        pg.wait_for_timeout(40)
        box = pg.evaluate(BOXJS)
        png = pg.screenshot(clip={'x': box['x'], 'y': box['y'], 'width': 304, 'height': 368})
        frames.append(Image.open(io.BytesIO(png)).convert('RGB'))
    b.close()

W, H = 640, 360
bg = Image.new('RGB', (W, H), (7, 4, 15))
d = ImageDraw.Draw(bg)
for y in range(H):
    d.line([(0, y), (W, y)], fill=(7 + y // 14, 4, 15 + y // 6))
font_path = glob.glob('node_modules/@fontsource/press-start-2p/files/press-start-2p-latin-400-normal.woff')
try:
    from fontTools.ttLib import TTFont  # noqa
except Exception:
    pass
def font(sz):
    try: return ImageFont.truetype('node_modules/@fontsource/press-start-2p/files/press-start-2p-latin-400-normal.woff', sz)
    except Exception: pass
    for fp in ['/System/Library/Fonts/Menlo.ttc', '/System/Library/Fonts/Supplemental/Courier New Bold.ttf']:
        try: return ImageFont.truetype(fp, sz, index=1) if fp.endswith('.ttc') else ImageFont.truetype(fp, sz)
        except Exception: pass
    return ImageFont.load_default()
f1, f2 = font(20), font(10)
def center(txt, cx, y, fnt, col):
    w = d.textlength(txt, font=fnt); d.text((cx - w / 2, y), txt, font=fnt, fill=col)
for i, t in enumerate(['LOOKS', 'MAXXER', 'MAZE']):
    center(t, 96, 70 + i * 36, f1, (255, 79, 216))
center('PIXEL', 96, 190, f2, (124, 240, 255)); center('EVOLUTION', 96, 210, f2, (124, 240, 255))
for i, t in enumerate(['EAT COINS', 'BEAT BOSSES', 'MOG EVERYONE']):
    center(t, 544, 120 + i * 40, f2, (255, 210, 63))
out = []
for fr in frames:
    im = bg.copy()
    g = fr.resize((298, 360), Image.NEAREST)
    im.paste(g, ((W - 298) // 2, 0))
    out.append(im.quantize(colors=128, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE))
out[0].save('demo.gif', save_all=True, append_images=out[1:], duration=100, loop=0, optimize=True, disposal=1)
print('frames', len(out))
