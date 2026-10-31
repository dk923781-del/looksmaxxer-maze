"""Regression: pickups, scores, Telegram dragging and rotation must not resize renderer."""
from playwright.sync_api import sync_playwright
from pathlib import Path
import json,sys
URL=sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:5178/'
OUT=Path(__file__).resolve().parents[2]/'checks';OUT.mkdir(exist_ok=True)
TG='''window.events={};window.Telegram={WebApp:{platform:'ios',initData:'test',viewportHeight:760,viewportStableHeight:760,safeAreaInset:{top:0,bottom:20},contentSafeAreaInset:{top:0},isVersionAtLeast:()=>false,ready(){},expand(){},onEvent:(n,fn)=>window.events[n]=fn}};'''
with sync_playwright() as p:
 b=p.chromium.launch();results=[]
 for w,h,dpr in [(320,568,2),(390,844,3),(430,932,3),(844,390,2),(1440,900,1)]:
  pg=b.new_page(viewport={'width':w,'height':h},device_scale_factor=dpr,has_touch=w<900)
  pg.route('**/telegram.org/**',lambda r:r.fulfill(status=200,content_type='text/javascript',body=''))
  pg.add_init_script("localStorage.setItem('moggman_radio_v1','off')")
  errors=[];pg.on('pageerror',lambda e:errors.append(str(e)))
  pg.goto(URL);pg.wait_for_selector('body[data-ready="1"]');pg.click('#btn-play');pg.click('#lv-1-1');pg.wait_for_function('window.__game.S.state==="play"');pg.evaluate('window.__game.scene.autoTick=false')
  pg.wait_for_timeout(250)
  measure='''()=>{const r=s=>{const b=document.querySelector(s).getBoundingClientRect();return [b.x,b.y,b.width,b.height]};return {stage:r('#stage'),canvas:r('canvas'),hud:r('#hud'),controls:r('#controls'),buffer:[document.querySelector('canvas').width,document.querySelector('canvas').height]}}'''
  before=pg.evaluate(measure)
  for js in ["document.querySelector('#hud-bonus').hidden=false;document.querySelector('#hud-bonus').textContent='MOG 10s · SHIELD 9s'", "document.querySelector('#hud-boss').hidden=false;document.querySelector('#h-bossname').textContent='PLATINUM BOSS'", "document.querySelector('#h-coins').textContent='999,999';document.querySelector('#h-score').textContent='999,999';document.querySelector('#h-aura').textContent='MOG RUSH 6s'", "document.querySelector('#hud-bonus').hidden=true;document.querySelector('#hud-boss').hidden=true"]:
   pg.evaluate(js);pg.wait_for_timeout(80);assert pg.evaluate(measure)==before,(w,h,before,pg.evaluate(measure))
  btns=pg.locator('#controls button:visible').evaluate_all('(bs)=>bs.map(b=>{const r=b.getBoundingClientRect(),s=getComputedStyle(b);return {x:r.x,y:r.y,w:r.width,h:r.height,radius:s.borderRadius,border:s.borderWidth}})')
  assert len({(v['w'],v['h'],v['radius'],v['border']) for v in btns})==1,btns
  for v in btns:assert v['w']>=44 and v['h']>=44 and v['x']>=0 and v['x']+v['w']<=w+.5 and v['y']+v['h']<=h+.5,(w,h,v)
  sx,sy,sw,sh=before['stage'];cx,cy,cw,ch=before['canvas'];assert cx>=sx-.5 and cy>=sy-.5 and cx+cw<=sx+sw+.5 and cy+ch<=sy+sh+.5,(before,w,h)
  assert not errors,errors
  pg.screenshot(path=str(OUT/f'polish-{w}x{h}.png'));results.append({'viewport':[w,h,dpr],'stable':True,'buttons':btns,'canvas':before['canvas']});pg.close()
 pg=b.new_page(viewport={'width':390,'height':760},has_touch=True)
 pg.route('**/telegram.org/**',lambda r:r.fulfill(status=200,content_type='text/javascript',body=''))
 pg.add_init_script(TG+"localStorage.setItem('moggman_radio_v1','off')")
 pg.goto(URL);pg.wait_for_selector('body[data-ready="1"]');pg.click('#btn-play');pg.click('#lv-1-1');pg.wait_for_function('window.__game.S.state==="play"');pg.evaluate('window.__game.scene.autoTick=false');pg.wait_for_timeout(200)
 before=pg.evaluate(measure)
 for height in [740,600,300,600,750]:
  pg.set_viewport_size({"width":390,"height":height})
  pg.evaluate('(h)=>{Telegram.WebApp.viewportHeight=h;events.viewportChanged({isStateStable:false})}',height);pg.wait_for_timeout(50)
  assert pg.evaluate(measure)==before
 pg.set_viewport_size({'width':390,'height':700})
 pg.evaluate('Telegram.WebApp.viewportStableHeight=700;events.viewportChanged({isStateStable:true})');pg.wait_for_timeout(150)
 after=pg.evaluate(measure);assert after['buffer']==before['buffer'];assert after['stage'][3]<before['stage'][3]
 pg.set_viewport_size({'width':760,'height':390});pg.evaluate('Telegram.WebApp.viewportStableHeight=390;events.viewportChanged({isStateStable:true})');pg.wait_for_timeout(250)
 assert pg.evaluate(measure)['buffer']==before['buffer']
 results.append({'telegram_unstable_events_ignored':True,'stable_resize_and_rotation':True})
 b.close();print(json.dumps(results,indent=2))
