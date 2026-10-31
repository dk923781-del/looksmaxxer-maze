from playwright.sync_api import sync_playwright
import json,sys
from pathlib import Path
URL=sys.argv[1] if len(sys.argv)>1 else "http://127.0.0.1:5178/"
OUT=Path(__file__).resolve().parents[2]/"checks"
OUT.mkdir(exist_ok=True)
with sync_playwright() as p:
 engine=p.webkit if '--webkit' in sys.argv else p.chromium
 b=engine.launch();device=p.devices['iPhone 13'] if '--webkit' in sys.argv else p.devices['Pixel 7'];ctx=b.new_context(**device);pg=ctx.new_page()
 pg.route('**/telegram.org/**',lambda r:r.fulfill(status=200,content_type='text/javascript',body=''))
 errors=[];pg.on('pageerror',lambda e:errors.append({'message':str(e),'stack':e.stack}))
 pg.goto(URL);pg.wait_for_selector('body[data-ready="1"]')
 pg.click('#radio-toggle');f=pg.frame_locator('#radio-player');f.locator('.playButton').wait_for(timeout=25000)
 listen=f.get_by_text('Listen in browser',exact=True)
 if listen.is_visible():listen.click()
 if f.locator('.playButton').get_attribute('title')=='Play':f.locator('.playButton').click()
 pg.wait_for_timeout(4500)
 read='new Promise(resolve=>SC.Widget(document.querySelector("#radio-player")).getPosition(p=>SC.Widget(document.querySelector("#radio-player")).isPaused(paused=>resolve({position:p,paused}))))'
 a=pg.evaluate(read);assert a['position']>0 and not a['paused'],a
 pg.click('#radio-toggle');pg.wait_for_timeout(1500);c=pg.evaluate(read);assert c['position']>a['position'] and not c['paused'],c
 pg.click('#btn-play');pg.click('#lv-1-1');pg.wait_for_function('window.__game.S.state==="play"');pg.wait_for_timeout(1000)
 assert not pg.evaluate('window.__game.mods.audio.playingFile()')
 c=pg.evaluate(read);assert not c['paused'],c
 pg.screenshot(path=str(OUT/('music-game-webkit.png' if '--webkit' in sys.argv else 'music-game.png')))
 pg.click('#radio-toggle');assert pg.locator('#btn-resume').is_visible();pg.click('#radio-toggle');pg.click('#btn-quit');pg.click('#btn-settings')
 results={'hunter_playing_in_game':c,'collapse_keeps_music':True,'no_mixed_builtin_music':True}
 if '--webkit' in sys.argv:
  assert pg.locator('[data-radio=ascend]').is_disabled()
  assert pg.locator('[data-radio=ascend-ultra]').is_disabled()
  pg.evaluate("localStorage.setItem('moggman_radio_v1','ascend')")
  pg.reload();pg.wait_for_selector('body[data-ready="1"]');assert 'soundcloud.com' in pg.locator('#radio-player').get_attribute('src')
  results['ascend_ios']='unavailable; explicit disabled choice and Hunter fallback verified'
 else:
  for track in ['ascend','ascend-ultra']:
   pg.click('[data-radio="'+track+'"]')
   pg.wait_for_selector('#radio-player[data-ready="1"]',timeout=25000)
   f=pg.frame_locator('#radio-player');play=f.get_by_role('button',name='Play,',exact=False);play.wait_for(timeout=25000);pg.wait_for_timeout(3500);play.click();pg.wait_for_timeout(9000)
   text=f.locator('body').inner_text();print(track,text[-600:],flush=True)
   assert 'Pause Play Hard' in text and '0:00\n0.00% played' not in text,text[-600:]
   pg.click('#radio-toggle');pg.wait_for_timeout(2000)
   text2=f.locator('body').inner_text();assert 'Pause Play Hard' in text2
   results[track]={'playing':True,'continues_collapsed':True}
  pg.locator('#s-music').evaluate('(e)=>{e.value=0;e.dispatchEvent(new Event("input"))}')
  assert pg.locator('#radio-player').get_attribute('src') is None
  pg.locator('#s-music').evaluate('(e)=>{e.value=60;e.dispatchEvent(new Event("input"))}')
  assert 'audiomack.com' in pg.locator('#radio-player').get_attribute('src')
  pg.reload();pg.wait_for_selector('body[data-ready="1"]');assert 'play-hard-ultra-slowed' in pg.locator('#radio-player').get_attribute('src')
 external=[e for e in errors if 'audiomack' in e['stack'].lower() or '__tcfapi' in e['message'] or 'https://audiomack.com' in e['message']]
 assert len(external)==len(errors),errors
 results['provider_errors']=external
 results['game_errors']=[]
 print(json.dumps(results,indent=2));b.close()
