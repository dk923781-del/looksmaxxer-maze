from playwright.sync_api import sync_playwright
import sys
from pathlib import Path
with sync_playwright() as p:
 b=p.chromium.launch()
 pg=b.new_page(viewport={'width':390,'height':844})
 pg.route('**/telegram.org/**',lambda r:r.fulfill(status=200,content_type='text/javascript',body=''))
 pg.goto(sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:5178/');pg.wait_for_selector('body[data-ready="1"]')
 # Every high resolution portrait is unique, decoded and used in the game.
 d=pg.evaluate('''() => {const g=window.__game,t=g.mods.textures,ids=g.mods.data.CHARACTERS.map(c=>c.id);return {sheets:ids.every(t.hasSheet),unique:new Set(ids.map(t.portraitURL)).size};}''')
 assert d=={'sheets':True,'unique':5},d
 pg.click('#btn-chars');pg.screenshot(path=str(Path(__file__).resolve().parents[2]/'moggman-characters-v2.png'))
 assert pg.locator('.portrait').count()==5
 assert pg.evaluate('Array.from(document.querySelectorAll(".portrait")).every(x=>x.complete&&x.naturalWidth>=512)')
 pg.click('[data-act="back"]');pg.click('#btn-play');pg.click('#lv-1-1');pg.wait_for_function('window.__game.S.state==="play"')
 # Mock only the remote version manifest; update must not interrupt gameplay.
 pg.route('**/version.json*',lambda r:r.fulfill(status=200,content_type='application/json',body='{"build":"test-next-release"}'))
 pg.evaluate('window.dispatchEvent(new Event("focus"))');pg.wait_for_selector('#update-notice')
 assert pg.evaluate('window.__game.ui.inLevel')
 assert 'test-next-release' not in pg.url
 pg.click('#btn-pause');pg.click('#btn-quit')
 pg.wait_for_url('**v=test-next-release**',timeout=8000)
 assert 'refresh=' in pg.url
 print('PASS 5 distinct high-resolution portraits; portrait-based actors; update waits during gameplay and reloads on return to menu.')
 b.close()
