"""Moggman regression checks: new mechanics, local audio, responsive UI."""
from playwright.sync_api import sync_playwright
from pathlib import Path
import json,sys
ROOT=Path(__file__).resolve().parents[1]
URL=sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:5178/'
OUT=ROOT.parent
with sync_playwright() as p:
 b=p.chromium.launch(headless=True)
 page=b.new_page(viewport={'width':390,'height':844},device_scale_factor=2)
 errors=[]; uploads=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.on('request',lambda r: uploads.append(r.url) if r.method=='POST' else None)
 page.add_init_script("localStorage.setItem('moggman_radio_v1','off')")
 page.goto(URL); page.wait_for_selector('body[data-ready="1"]')
 assert page.title().startswith('MOGGMAN')
 for w,h in [(390,844),(320,568),(1440,900)]:
  page.set_viewport_size({'width':w,'height':h})
  assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
  page.locator('#btn-play').scroll_into_view_if_needed()
  assert page.locator('#btn-play').is_visible()
 page.set_viewport_size({'width':390,'height':844})
 page.screenshot(path=str(OUT/'moggman-menu.png'))
 page.click('#btn-settings')
 page.locator('summary').click()
 page.set_input_files('#custom-track',str(ROOT/'public/assets/music/menu.mp3'))
 page.wait_for_function("window.__game.mods.audio.customTrackName()==='menu.mp3'")
 page.wait_for_function('window.__game.mods.audio.playingFile()')
 page.click('[data-mode="slowed"]')
 assert page.evaluate('window.__game.mods.audio.playbackMode()')=='slowed'
 page.click('#t-mute'); page.wait_for_timeout(350)
 assert page.evaluate('window.__game.mods.audio.levelNow()')<.001
 page.click('#t-mute'); page.wait_for_timeout(350)
 assert page.evaluate('window.__game.mods.audio.levelNow()')>.0001
 page.set_input_files('#custom-track',{'name':'broken.mp3','mimeType':'audio/mpeg','buffer':b'not music'})
 page.wait_for_function("document.querySelector('#track-name').textContent.includes('Cannot play')")
 assert page.evaluate('window.__game.mods.audio.customTrackName()')=='menu.mp3'
 page.click('[data-act="clearmusic"]')
 assert page.evaluate('window.__game.mods.audio.customTrackName()')==''
 assert not uploads,uploads
 page.screenshot(path=str(OUT/'moggman-radio.png'))
 page.click('[data-act="back"]'); page.click('#btn-play');page.click('#lv-1-1')
 page.wait_for_function('window.__game.S.state === "play"')
 # Actual keyboard input moves the player.
 before=page.evaluate('({x:window.__game.scene.P.x,y:window.__game.scene.P.y})')
 page.keyboard.down('ArrowLeft');page.wait_for_timeout(400);page.keyboard.up('ArrowLeft')
 after=page.evaluate('({x:window.__game.scene.P.x,y:window.__game.scene.P.y})')
 assert before!=after,(before,after)
 # Deterministically collect a real pellet at the aura threshold.
 result=page.evaluate('''() => {
 const g=window.__game,s=g.scene,S=g.S; s.autoTick=false;
 S.aura=39; S.rushT=0;
 const i=s.maze.pel.findIndex(Boolean); s.P.x=i%19;s.P.y=Math.floor(i/19);
 s.pickups(0); const active=S.rushT===6 && S.aura===0;
 const before=S.score;s.addScore(100);const double=S.score-before===200;
 const fast=s.playerSpeed();S.rushT=0;const normal=s.playerSpeed();
 S.rushT=.01;s.tick(.02);const expired=S.rushT===0;
 // Close escape: proximity then separation, awarded only once.
 S.invuln=0;S.abilT=0;S.state='play';s.enemies.forEach(e=>e.state='wait');
 const e=s.enemies[0];e.state='normal';e.boss=null;e.x=s.P.x+.8;e.y=s.P.y;e.nearMissAfter=0;
 s.collisions();e.x=s.P.x+2;const score=S.score;s.collisions();const bonus=S.score-score===100;
 s.collisions();const once=S.score-score===100;
 s.emitHud(true); return {active,double,faster:fast>normal,expired,bonus,once};
}''')
 assert all(result.values()),result
 page.screenshot(path=str(OUT/'moggman-game.png'))
 page.click('#btn-pause'); assert page.locator('#btn-resume').is_visible()
 page.click('#btn-restart')
 assert page.evaluate('window.__game.S.aura===0 && window.__game.S.rushT===0')
 assert not errors,errors
 print(json.dumps({'responsive':True,'keyboard':True,'audio_import':True,'audio_mute':True,'invalid_file_preserves_track':True,'no_upload':True,'mechanics':result,'restart_resets':True,'page_errors':errors},indent=2))
 b.close()
