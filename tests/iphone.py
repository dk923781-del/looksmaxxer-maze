from playwright.sync_api import sync_playwright
import json,sys
from pathlib import Path
OUT=Path(__file__).resolve().parents[2]/"checks"
OUT.mkdir(exist_ok=True)
with sync_playwright() as p:
 b=p.webkit.launch()
 ctx=b.new_context(**p.devices['iPhone 13'])
 ctx.route('**/telegram.org/**',lambda r:r.fulfill(status=200,content_type='text/javascript',body=''))
 ctx.add_init_script("localStorage.setItem('moggman_radio_v1','off')")
 pg=ctx.new_page();errors=[];pg.on('pageerror',lambda e:errors.append(str(e)))
 pg.goto(sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:5178/');pg.wait_for_selector('body[data-ready="1"]',timeout=30000);pg.click('#btn-play');pg.click('#lv-1-1');pg.wait_for_function('window.__game.S.state==="play"',timeout=20000)
 # Real touch tap selects a direction; gameplay advances.
 pg.locator('[data-d="l"]').tap();pg.wait_for_timeout(700)
 assert pg.evaluate('window.__game.scene.P.x')!=9
 pg.locator('#btn-pause').tap();assert pg.locator('#btn-resume').is_visible();pg.locator('#btn-resume').tap()
 before=pg.locator('canvas').bounding_box();pg.evaluate('window.__game.scene.autoTick=false;document.querySelector("#hud-bonus").hidden=false;document.querySelector("#hud-bonus").textContent="MOG 9s"');pg.wait_for_timeout(100);assert pg.locator('canvas').bounding_box()==before
 pg.screenshot(path=str(OUT/'iphone-webkit.png'))
 assert not errors,errors
 print(json.dumps({'engine':'WebKit','device_emulation':'iPhone 13','touch':True,'pause':True,'stable_pickup_layout':True,'page_errors':errors}));b.close()
