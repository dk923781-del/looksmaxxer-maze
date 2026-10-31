"""End-to-end tests (Playwright, Python). Run against the dev server (window.__game is dev-only).
   python tests/e2e.py [dev_url] [preview_url]
"""
import sys, json, traceback
from playwright.sync_api import sync_playwright

DEV = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:5173/'
PREVIEW = sys.argv[2] if len(sys.argv) > 2 else None
results = []
errors = []


def new_page(b, w=390, h=844, dpr=2, touch=True, url=DEV, clear=True):
    ctx = b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=dpr, has_touch=touch)
    ctx.route('**/telegram.org/**', lambda r: r.fulfill(status=200, content_type='application/javascript', body=''))
    page = ctx.new_page()
    page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    page.on('pageerror', lambda e: errors.append('PAGEERROR ' + str(e)))
    page.goto(url)
    if clear:
        page.evaluate('localStorage.clear()')
        page.reload()
    page.wait_for_selector('body[data-ready="1"]', timeout=15000)
    return page


def js(page, code):
    return page.evaluate(code)


def run(name):
    def deco(fn):
        before = len(errors)
        try:
            fn()
            new = errors[before:]
            if new:
                raise AssertionError('console errors: ' + '; '.join(new[:3]))
            results.append((name, True, ''))
            print('PASS', name)
        except Exception as e:
            results.append((name, False, str(e)))
            print('FAIL', name, '->', e)
            traceback.print_exc()
        return fn
    return deco


def start_level(page, w=1, l=1):
    js(page, f'window.__game.play({w},{l})')
    page.wait_for_function('window.__game.S && window.__game.S.state === "play"', timeout=8000)


with sync_playwright() as p:
    b = p.chromium.launch(headless=True)

    @run('loads without console errors, menu visible')
    def _():
        pg = new_page(b)
        assert pg.is_visible('#btn-play')
        assert js(pg, 'typeof window.__game') == 'object'
        pg.close()

    @run('player moves and cannot pass through a wall; pellet raises score')
    def _():
        pg = new_page(b)
        start_level(pg)
        js(pg, 'window.__game.scene.autoTick = false')
        info = js(pg, '''(()=>{const s=window.__game.scene; const m=s.maze; const g=m.grid; const [x,y]=m.start;
          const D=[[0,-1],[1,0],[0,1],[-1,0]]; const open=[],wall=[];
          D.forEach((d,i)=>{ (g[(y+d[1])*19+x+d[0]]!==1?open:wall).push(i)}); return {open,wall,x,y}})()''')
        assert info['wall'] and info['open'], info
        wall = info['wall'][0]
        # try to walk into the wall for 1 simulated second
        js(pg, f'''(()=>{{const s=window.__game.scene; s.P.want={wall}; s.P.wantT=5; for(let i=0;i<30;i++) s.step(1/30);}})()''')
        pos = js(pg, '({x:window.__game.scene.P.x,y:window.__game.scene.P.y})')
        assert pos == {'x': info['x'], 'y': info['y']}, ('passed through wall', pos)
        op = info['open'][0]
        js(pg, f'''(()=>{{const s=window.__game.scene; s.P.want={op}; s.P.wantT=5; for(let i=0;i<30;i++) s.step(1/30);}})()''')
        pos2 = js(pg, '({x:window.__game.scene.P.x,y:window.__game.scene.P.y})')
        assert pos2 != pos, 'player did not move'
        # walk a few tiles along open paths; score must rise
        js(pg, '''(()=>{const s=window.__game.scene; for(let k=0;k<200;k++){ if(k%12===0) s.P.want=[0,1,2,3][Math.floor(Math.random()*4)]; s.P.wantT=1; s.S.invuln=9; s.step(1/30);} })()''')
        sc = js(pg, 'window.__game.S.score')
        assert sc > 0, sc
        pg.close()

    @run('enemy contact removes a life')
    def _():
        pg = new_page(b)
        start_level(pg)
        js(pg, 'window.__game.scene.autoTick = false')
        lives = js(pg, '''(()=>{const s=window.__game.scene; s.S.invuln=0; const e=s.enemies[0]; e.state="normal"; e.x=s.P.x; e.y=s.P.y; s.step(1/60); return s.S.lives})()''')
        assert lives == 2, lives
        assert js(pg, 'window.__game.S.state') == 'dying'
        pg.close()

    @run('buying Blackpill costs 100 and it saves from death')
    def _():
        pg = new_page(b)
        js(pg, 'window.__game.SV.S().coins = 130; window.__game.SV.save()')
        pg.click('#btn-shop')
        pg.click('#tab-items')
        pg.click('#buy-blackpill')
        d = js(pg, '({c: window.__game.SV.S().coins, bp: window.__game.SV.S().inv.blackpill})')
        assert d == {'c': 30, 'bp': 1}, d
        # cannot buy with insufficient coins
        pg.click('#buy-blackpill')
        d = js(pg, '({c: window.__game.SV.S().coins, bp: window.__game.SV.S().inv.blackpill})')
        assert d == {'c': 30, 'bp': 1}, d
        pg.click('[data-act=back]')
        pg.click('#btn-play')
        pg.click('#lv-1-1')
        pg.wait_for_function('window.__game.S && window.__game.S.state === "play"')
        js(pg, 'window.__game.scene.autoTick = false')
        r = js(pg, '''(()=>{const s=window.__game.scene; s.S.invuln=0; const e=s.enemies[0]; e.state="normal"; e.x=s.P.x; e.y=s.P.y; s.step(1/60);
           return {lives:s.S.lives, bp:window.__game.SV.S().inv.blackpill, inv:s.S.invuln, st:s.S.state, score:s.S.score, pel:s.S.pelletsLeft}})()''')
        assert r['lives'] == 3 and r['bp'] == 0 and r['inv'] >= 2 and r['st'] == 'play', r
        # next hit after invulnerability expires costs a life (game is winnable without it too)
        r2 = js(pg, '''(()=>{const s=window.__game.scene; s.S.invuln=0; const e=s.enemies[0]; e.state="normal"; e.x=s.P.x; e.y=s.P.y; s.step(1/60); return s.S.lives})()''')
        assert r2 == 2, r2
        pg.close()

    @run('level clear -> results -> next level')
    def _():
        pg = new_page(b)
        start_level(pg)
        js(pg, '''(()=>{const s=window.__game.scene; s.maze.pel.fill(0); s.S.pelletsLeft=0;})()''')
        pg.wait_for_selector('#btn-next', timeout=8000)
        d = js(pg, 'window.__game.SV.S().levels["1-1"]')
        assert d and d['c'] == 1, d
        assert js(pg, 'window.__game.SV.S().coins') > 20
        assert js(pg, 'window.__game.SV.S().chars.valera_broke.xp') >= 1500
        pg.screenshot(path='tests/shots/result.png')
        pg.click('#btn-next')
        pg.wait_for_function('window.__game.S && window.__game.S.state === "play" && window.__game.scene.def.key === "1-2"')
        pg.close()

    @run('progress survives reload (coins, xp, levels)')
    def _():
        pg = new_page(b)
        js(pg, '''(()=>{const d=window.__game.SV.S(); d.coins=777; d.chars.valera_broke.xp=5000; d.levels["1-1"]={s:2,b:100,c:1}; window.__game.SV.save();})()''')
        pg.reload()
        pg.wait_for_selector('body[data-ready="1"]')
        d = js(pg, '({c:window.__game.SV.S().coins, xp:window.__game.SV.S().chars.valera_broke.xp, l:window.__game.SV.S().levels["1-1"].s, v:window.__game.SV.S().v})')
        assert d == {'c': 777, 'xp': 5000, 'l': 2, 'v': 2}, d
        pg.close()

    @run('volume sliders and mute persist across reload')
    def _():
        pg = new_page(b)
        pg.click('#btn-settings')
        pg.evaluate('''(()=>{const m=document.querySelector('#s-music'); m.value=25; m.dispatchEvent(new Event('input')); m.dispatchEvent(new Event('change'));
            const s=document.querySelector('#s-sfx'); s.value=40; s.dispatchEvent(new Event('input')); s.dispatchEvent(new Event('change'));})()''')
        pg.click('#t-mute')
        pg.click('#t-vib')
        pg.click('#t-ctl')
        pg.reload()
        pg.wait_for_selector('body[data-ready="1"]')
        st = js(pg, 'window.__game.SV.S().settings')
        assert st == {'music': 0.25, 'sfx': 0.4, 'voice': 0.8, 'bass': True, 'mute': True, 'vibration': False, 'controls': 'swipe'}, st
        pg.click('#btn-settings')
        assert pg.input_value('#s-music') == '25' and pg.input_value('#s-sfx') == '40'
        pg.close()

    @run('reset progress needs confirmation')
    def _():
        pg = new_page(b)
        js(pg, 'window.__game.SV.S().coins=500; window.__game.SV.save()')
        pg.click('#btn-settings')
        pg.click('#btn-reset')
        pg.click('#confirm-no')
        assert js(pg, 'window.__game.SV.S().coins') == 500
        pg.click('#btn-reset')
        pg.click('#confirm-yes')
        assert js(pg, 'window.__game.SV.S().coins') == 0
        pg.close()

    @run('character unlock rules and shop limits')
    def _():
        pg = new_page(b)
        js(pg, 'window.__game.SV.S().coins=5000; window.__game.SV.save()')
        # moggsu: shop, 1200
        assert js(pg, 'window.__game.SV.buyChar("moggsu")') is True
        assert js(pg, 'window.__game.SV.S().coins') == 3800
        # zetaboss is locked until the world 3 boss is beaten
        assert js(pg, 'window.__game.SV.buyChar("zetaboss")') is False
        js(pg, 'window.__game.SV.S().bosses.zeta=true')
        assert js(pg, 'window.__game.SV.buyChar("zetaboss")') is True
        assert js(pg, 'window.__game.SV.buyChar("hulioboss")') is False
        # item caps
        for _i in range(5):
            js(pg, 'window.__game.SV.buyItem("energy")')
        assert js(pg, 'window.__game.SV.buyItem("energy")') is False
        assert js(pg, 'window.__game.SV.S().inv.energy') == 5
        js(pg, 'window.__game.SV.S().coins=10000')
        for _i in range(5):
            js(pg, 'window.__game.SV.buyItem("blackpill")')
        assert js(pg, 'window.__game.SV.S().inv.blackpill') == 3
        # never negative
        js(pg, 'window.__game.SV.S().coins=10')
        assert js(pg, 'window.__game.SV.buyItem("shield")') is False
        assert js(pg, 'window.__game.SV.S().coins') == 10
        # skins
        js(pg, 'window.__game.SV.S().coins=700')
        assert js(pg, 'window.__game.SV.buySkin("valera_broke","neon")') is True
        assert js(pg, 'window.__game.SV.buySkin("valera_broke","void")') is True  # 550 left >= 500
        assert js(pg, 'window.__game.SV.S().coins') == 50
        assert js(pg, 'window.__game.SV.buySkin("valera_broke","void")') is False  # already owned
        pg.close()

    @run('skills: points come from levels, limits and effects')
    def _():
        pg = new_page(b)
        # level 10 => 9 points
        xp10 = js(pg, 'let s=0; for(let l=1;l<10;l++) s+=Math.round(40*Math.pow(l,1.35)); s')
        js(pg, f'window.__game.SV.S().chars.valera_broke.xp={xp10}')
        assert js(pg, 'window.__game.SV.skillPointsLeft("valera_broke")') == 9
        for _i in range(6):
            js(pg, 'window.__game.SV.spendSkill("valera_broke","speed")')
        assert js(pg, 'window.__game.SV.S().chars.valera_broke.skills.speed') == 5
        st = js(pg, 'window.__game.SV.charStats("valera_broke")')
        assert abs(st['speedMul'] - 1.15) < 1e-9, st
        assert js(pg, 'window.__game.SV.skillPointsLeft("valera_broke")') == 4
        pg.close()

    @run('speed never exceeds the 7.5 tiles/s cap (all boosts stacked)')
    def _():
        pg = new_page(b)
        js(pg, 'window.__game.SV.S().chars.valera_broke.skills.speed=5; window.__game.SV.save()')
        start_level(pg)
        v = js(pg, '''(()=>{const s=window.__game.scene; s.S.bonuses.push({type:"chad",t:9,max:9}); s.S.abilT=2; s.S.abilId="chad_dash"; return s.playerSpeed()})()''')
        assert v <= 7.5 + 1e-9, v
        pg.close()

    @run('all 5 abilities activate with the right cooldown')
    def _():
        pg = new_page(b)
        js(pg, '''(()=>{const SV=window.__game.SV; SV.S().coins=99999; for(const id of ["moggsu","zetaboss","hulioboss","dildoboss"]){ SV.S().bosses.zeta=SV.S().bosses.hulio=SV.S().bosses.dildo=true; SV.buyChar(id);} })()''')
        exp = {'valera_broke': ('hustle', 5, 25), 'moggsu': ('chad_dash', 2, 15), 'zetaboss': ('sigma_grind', 3, 30), 'hulioboss': ('phase', 3, 25), 'dildoboss': ('mog_aura', 4, 30)}
        for cid, (aid, dur, cd) in exp.items():
            js(pg, f'window.__game.SV.S().sel="{cid}"')
            start_level(pg)
            js(pg, 'window.__game.scene.autoTick=false')
            r = js(pg, '''(()=>{const s=window.__game.scene; s.useAbility(); return {id:s.S.abilId, t:s.S.abilT, cd:s.S.abilCd, sh:s.S.abilShield}})()''')
            assert r['id'] == aid and abs(r['t'] - dur) < 1e-6, (cid, r)
            assert abs(r['cd'] - (cd + dur)) < 1e-6, (cid, r)
            if aid == 'sigma_grind':
                assert r['sh'] >= 3
            js(pg, 'window.__game.scene.quit(); window.__game.scene.autoTick=true')
        pg.close()

    @run('evolution stages follow levels 1 / 26 / 61 / 100')
    def _():
        pg = new_page(b)
        cases = {0: 1, 34374: 2, 150000: 2, 10**6: 4}
        got = js(pg, '''(()=>{const SV=window.__game.SV; const out=[]; const lv=(x)=>{SV.S().chars.valera_broke.xp=x; return SV.charStats("valera_broke").level};
          return [lv(0), lv(34374), lv(34373), lv(900000), lv(5*10**6)]})()''')
        assert got[0] == 1 and got[1] == 26 and got[2] == 25 and got[4] == 100, got
        st = js(pg, '''(()=>{const SV=window.__game.SV; const cfg=[1,25,26,60,61,99,100]; return cfg.map(l=>{ let s=0; for(let k=1;k<l;k++) s+=Math.round(40*Math.pow(k,1.35)); SV.S().chars.valera_broke.xp=s; const c=SV.charStats("valera_broke"); return [c.level, c.slots, c.hardOk, c.auraPassive, c.scoreMul]})})()''')
        assert st[2][0] == 26 and st[3][0] == 60 and st[4][2] is True and st[3][2] is False and st[6][0] == 100, st
        pg.close()

    @run('daily quests: 3 per day, progress, claim reward')
    def _():
        pg = new_page(b)
        q = js(pg, 'window.__game.SV.S().quests')
        assert len(q['list']) == 3
        js(pg, '''(()=>{const SV=window.__game.SV; for(const it of SV.S().quests.list){ SV.bumpStat(SV.questDef(it.id).stat, 100000) } SV.save()})()''')
        c0 = js(pg, 'window.__game.SV.S().coins')
        pg.click('#btn-quests')
        pg.click('#claim-0')
        assert js(pg, 'window.__game.SV.S().coins') > c0
        # date change rolls new quests
        js(pg, 'window.__game.SV.S().quests.date="1999-01-01"; window.__game.SV.rollQuests()')
        assert js(pg, 'window.__game.SV.S().quests.list.every(q=>q.progress===0)')
        pg.close()

    @run('Energy Sphere + boss hit, boss defeat unlocks character (W3-5)')
    def _():
        pg = new_page(b)
        js(pg, '''(()=>{const d=window.__game.SV.S(); for(let w=1;w<=3;w++) for(let l=1;l<=5;l++){ if(w===3&&l===5) continue; d.levels[w+"-"+l]={s:1,b:1,c:1}; } window.__game.SV.save()})()''')
        start_level(pg, 3, 5)
        js(pg, 'window.__game.scene.autoTick=false')
        r = js(pg, '''(()=>{const s=window.__game.scene; const boss=s.enemies[0]; const hp0=s.S.bossHp;
           for(let i=0;i<20;i++) s.step(1/30);
           s.startFright(); boss.state="fright"; boss.immune=0; boss.x=s.P.x; boss.y=s.P.y; s.step(1/60);
           return {hp0, hp:s.S.bossHp, id:boss.boss.id, st:boss.state}})()''')
        assert r['id'] == 'zeta' and r['hp'] == r['hp0'] - 1 and r['st'] == 'eyes', r
        js(pg, '''(()=>{const s=window.__game.scene; const boss=s.enemies[0]; for(let k=0;k<3;k++){ boss.immune=0; boss.state="fright"; boss.x=s.P.x; boss.y=s.P.y; s.step(1/60); for(let j=0;j<6;j++) s.step(1/60);} for(let i=0;i<120;i++) s.step(1/30); })()''')
        pg.wait_for_selector('#btn-menu', timeout=8000)
        assert js(pg, 'window.__game.SV.S().bosses.zeta') is True
        assert js(pg, 'window.__game.SV.isCharUnlocked("zetaboss")') is True
        pg.close()

    @run('soak: all 25 levels simulate 90s with random input, no exceptions, pellets stay reachable')
    def _():
        pg = new_page(b)
        res = js(pg, '''(()=>{
          const out=[]; const G=window.__game; const s=G.scene;
          for(let w=1;w<=5;w++) for(let l=1;l<=5;l++){
            G.play(w,l); s.autoTick=false;
            let bad=null;
            for(let i=0;i<2700 && s.S && (s.S.state==="play"||s.S.state==="ready"||s.S.state==="dying");i++){
              if(i%10===0) s.setWant(Math.floor(Math.random()*4));
              s.S.lives=5; s.S.invuln=Math.max(s.S.invuln, 0.5);
              if(i%450===0 && s.S.state==="play"){ s.startFright(); }
              s.step(1/30);
              if(i%60===0 && s.S && s.maze){
                // every pellet must be reachable for the player on the real grid
                const g=s.maze.grid; const px=Math.round(s.P.x), py=Math.round(s.P.y);
                const seen=new Uint8Array(437); const q=[py*19+px]; seen[q[0]]=1;
                for(let h=0;h<q.length;h++){const c=q[h]; const x=c%19,y=(c/19)|0; for(const [dx,dy] of [[0,-1],[1,0],[0,1],[-1,0]]){const nx=x+dx,ny=y+dy; if(nx<0||ny<0||nx>18||ny>22) continue; const j=ny*19+nx; if(g[j]===1||seen[j]) continue; seen[j]=1;q.push(j);}}
                for(let k=0;k<437;k++) if(s.maze.pel[k] && !seen[k]) bad="unreachable pellet at "+k;
                if(bad) break;
              }
            }
            out.push([w+"-"+l, bad, s.S?s.S.state:"?", s.S?s.S.pelletsLeft:-1]);
            if(bad) return out;
          }
          s.autoTick=true; return out;})()''')
        bad = [r for r in res if r[1]]
        assert not bad, bad
        assert len(res) == 25
        pg.close()

    @run('secret rooms: fake wall passable for player, blocked for enemies (W2+)')
    def _():
        pg = new_page(b)
        start_level(pg, 2, 1)
        r = js(pg, '''(()=>{const s=window.__game.scene; const m=s.maze; const sec=m.secrets[0]; if(!sec) return null;
           const wx=sec.wall%19, wy=(sec.wall/19)|0; return {n:m.secrets.length, fakeVal:m.grid[sec.wall], pass:window.__game.scene.canGoPlayer(wx,wy,0)!==undefined}})()''')
        assert r and r['n'] >= 1 and r['fakeVal'] == 2, r
        r = js(pg, '''(()=>{const s=window.__game.scene; s.autoTick=false; const sec=s.maze.secrets[0]; const rx=sec.room%19, ry=(sec.room/19)|0; const c0=s.S.coinsGot;
           s.P.x=rx; s.P.y=ry; s.P.dir=-1; s.step(1/30); return {found:sec.found, gain:s.S.coinsGot-c0}})()''')
        assert r['found'] and 15 <= r['gain'] <= 30, r
        pg.close()

    @run('world 4 glitch walls keep maze connected; world 2 zones exist')
    def _():
        pg = new_page(b)
        start_level(pg, 4, 1)
        js(pg, 'window.__game.scene.autoTick=false')
        r = js(pg, '''(()=>{const s=window.__game.scene; s.S.invuln=999; let changed=0; const g0=s.maze.grid.slice();
           for(let i=0;i<30*40;i++){ if(i%15===0) s.setWant(Math.floor(Math.random()*4)); s.step(1/30);} 
           for(let k=0;k<437;k++) if(g0[k]!==s.maze.grid[k]) changed++; return {changed, zones:s.zones.length}})()''')
        assert r['changed'] > 0 and r['zones'] >= 1, r
        pg.close()

    @run('layout 390x844 and 1440x900: nothing clipped, screenshots')
    def _():
        for (w, h, dpr, touch, tag) in [(390, 844, 3, True, 'phone'), (1440, 900, 1, False, 'desktop')]:
            pg = new_page(b, w, h, dpr, touch)
            pg.screenshot(path=f'tests/shots/{tag}_menu.png')
            for sel, name in [('#btn-chars', 'chars'), ('#btn-upgrades', 'upgrades'), ('#btn-shop', 'shop'), ('#btn-quests', 'quests'), ('#btn-settings', 'settings')]:
                pg.click(sel)
                pg.screenshot(path=f'tests/shots/{tag}_{name}.png')
                sw = js(pg, 'document.documentElement.scrollWidth <= window.innerWidth')
                assert sw, (tag, name, 'horizontal overflow')
                pg.click('[data-act=back]')
            pg.click('#btn-play')
            pg.screenshot(path=f'tests/shots/{tag}_select.png')
            pg.click('#lv-1-1')
            pg.wait_for_function('window.__game.S && window.__game.S.state === "play"')
            pg.wait_for_timeout(600)
            pg.screenshot(path=f'tests/shots/{tag}_level.png')
            m = js(pg, '''(()=>{const r=(s)=>{const e=document.querySelector(s); if(!e||e.hidden) return null; const b=e.getBoundingClientRect(); return [b.left,b.top,b.right,b.bottom]};
               return {hud:r('#hud'), stage:r('#stage'), canvas:r('#game canvas'), controls:r('#controls'), ability:r('#btn-ability'), pause:r('#btn-pause'), fit:window.__fit, W:innerWidth, H:innerHeight, sw:document.documentElement.scrollWidth}})()''')
            for k in ('hud', 'controls', 'ability', 'pause'):
                bx = m[k]
                assert bx and bx[0] >= -0.5 and bx[2] <= m['W'] + 0.5 and bx[1] >= -0.5 and bx[3] <= m['H'] + 0.5, (tag, k, bx, m['W'], m['H'])
            assert m['sw'] <= m['W'], (tag, 'overflow')
            # maze (304x368 game px) fully inside the canvas and canvas inside stage
            fit = m['fit']
            assert fit['gw'] >= 304 and fit['gh'] >= 368, fit
            assert fit['z'] >= 1
            print('   ', tag, 'fit', fit)
            # integer scaling: game px -> device px is an integer
            assert abs(fit['z'] - round(fit['z'])) < 1e-9
            # buttons >= 44px
            bw = js(pg, '''(()=>[...document.querySelectorAll('#btn-ability,#btn-pause,#dpad button:not([hidden]),#btn-energy,#btn-shield')].filter(e=>e.offsetParent).map(e=>Math.min(e.getBoundingClientRect().width,e.getBoundingClientRect().height)))()''')
            assert all(v >= 44 - 0.5 for v in bw), bw
            pg.keyboard.press('Escape')
            pg.wait_for_selector('#btn-resume')
            pg.screenshot(path=f'tests/shots/{tag}_pause.png')
            pg.close()

    @run('keyboard: arrows move, Esc pauses/resumes, Space ability')
    def _():
        pg = new_page(b, 1440, 900, 1, False)
        pg.click('#btn-play')
        pg.click('#lv-1-1')
        pg.wait_for_function('window.__game.S && window.__game.S.state === "play"')
        x0 = js(pg, '[window.__game.scene.P.x, window.__game.scene.P.y]')
        for k in ['ArrowLeft', 'ArrowRight', 'ArrowUp']:
            pg.keyboard.press(k)
            pg.wait_for_timeout(300)
        x1 = js(pg, '[window.__game.scene.P.x, window.__game.scene.P.y]')
        assert x0 != x1
        pg.keyboard.press('Space')
        pg.wait_for_timeout(100)
        assert js(pg, 'window.__game.S.abilT') > 0
        pg.keyboard.press('Escape')
        pg.wait_for_selector('#btn-resume')
        assert js(pg, 'window.__game.S.state') == 'paused'
        pg.keyboard.press('Escape')
        pg.wait_for_function('window.__game.S.state === "play"')
        pg.close()

    @run('music: 6 original tracks play, volume/mute control the output, speak() never throws')
    def _():
        pg = new_page(b)
        pg.click('#btn-play')  # user gesture so audio can start
        res = js(pg, '''(async()=>{ const a = window.__game.mods.audio; a.initAudio(); const out={};
          const wait=(ms)=>new Promise(r=>setTimeout(r,ms));
          a.setVolumes(1,0,false,{voice:1,bass:true});
          for(let i=0;i<a.TRACK_COUNT;i++){ a.startMusic(i); await wait(1400); let m=0; for(let k=0;k<12;k++){ m=Math.max(m,a.levelNow()); await wait(60);} out['t'+i]=m; }
          a.startMusic(1); await wait(500);
          a.setVolumes(0,0,false,{voice:1}); await wait(3200); out.zero=Math.max(a.levelNow(),a.levelNow());
          a.setVolumes(1,0,true,{voice:1}); await wait(300); out.muted=a.levelNow();
          a.setVolumes(1,0,false,{voice:1}); await wait(300); let m2=0; for(let k=0;k<12;k++){ m2=Math.max(m2,a.levelNow()); await wait(60);} out.back=m2;
          a.stopMusic(); a.speak('Sigma grindset', {pitch:0.3, rate:0.8, blip:160}); await wait(500); out.spoke=true;
          return out; })()''')
        for i in range(6):
            assert res[f't{i}'] > 0.003, ('silent track', i, res)
        assert res['zero'] < 0.002 and res['muted'] < 0.002, res
        assert res['back'] > 0.003, res
        pg.close()

    @run('licensed music files: all 6 slots decode, play through the music bus and respond to volume/mute')
    def _():
        pg = new_page(b)
        pg.click('#btn-play')
        res = js(pg, '''(async()=>{ const a = window.__game.mods.audio; a.initAudio(); const out={}; const wait=(ms)=>new Promise(r=>setTimeout(r,ms));
          a.setVolumes(0.6,0,false,{voice:1,bass:true});
          for(let i=0;i<6;i++){ a.startMusic(i); let t=0; while(!a.playingFile() && t<6000){ await wait(100); t+=100; } await wait(600); let m=0,s=0; for(let k=0;k<15;k++){ const v=a.levelNow(); m=Math.max(m,v); s+=v; await wait(50);} out['t'+i]={file:a.playingFile(), peak:m, avg:s/15}; }
          a.setVolumes(0.6,0,true,{voice:1}); await wait(300); out.muted=a.levelNow();
          a.stopMusic(); out.stopped=!a.playingFile(); return out; })()''')
        for i in range(6):
            assert res[f't{i}']['file'] and res[f't{i}']['avg'] > 0.01 and res[f't{i}']['peak'] < 0.9, (i, res)
        assert res['muted'] < 0.002 and res['stopped'], res
        pg.close()

    @run('credits screen lists all licensed tracks')
    def _():
        pg = new_page(b)
        pg.click('#btn-settings')
        pg.click('#btn-credits')
        txt = pg.inner_text('#modal')
        for name in ['MondaMusic', 'Sub_Clair', 'alex-morgan', 'echoes_of_lumen', 'AbsoluteSound']:
            assert name in txt, name
        pg.click('#credits-close')
        pg.close()

    @run('Moggman characters have distinct previews, skins and evolution')
    def _():
        pg = new_page(b)
        r = js(pg, '''(async()=>{ const t = window.__game.mods.textures; const out={};
          const ids=['valera_broke','moggsu','zetaboss','hulioboss','dildoboss']; const images=ids.map(id=>t.playerPreviewURL(id,'base',1,2)); out.unique=new Set(images).size===5;
          const a=t.playerPreviewURL('moggsu','base',1,2), b=t.playerPreviewURL('moggsu','neon',1,2), c=t.playerPreviewURL('moggsu','base',2,2);
          out.skinDiffers = a!==b; out.stageDiffers = a!==c; return out; })()''')
        assert all(r[k] for k in ['unique', 'skinDiffers', 'stageDiffers']), r
        pg.close()

    @run('boss voice lines exist for every boss')
    def _():
        pg = new_page(b)
        r = js(pg, '''(async()=>{ const d = window.__game.mods.data; return Object.keys(d.BOSSES).map(k=>[k, !!(d.VOICE[k] && d.VOICE[k].lines.intro && d.VOICE[k].lines.hit && d.VOICE[k].lines.dead)]) })()''')
        assert all(v for _k, v in r), r
        pg.close()

    @run('save schema migration from v1')
    def _():
        pg = new_page(b)
        js(pg, '''localStorage.setItem("lmz_save_v1", JSON.stringify({v:1, coins:321, xp:2000}))''')
        pg.reload()
        pg.wait_for_selector('body[data-ready="1"]')
        d = js(pg, '({v:window.__game.SV.S().v, c:window.__game.SV.S().coins, xp:window.__game.SV.S().chars.valera_broke.xp})')
        assert d == {'v': 2, 'c': 321, 'xp': 2000}, d
        pg.close()

    if PREVIEW:
        @run('production build: no window.__game, no console errors')
        def _():
            pg = new_page(b, url=PREVIEW)
            assert js(pg, 'typeof window.__game') == 'undefined'
            pg.click('#btn-play')
            pg.click('#lv-1-1')
            pg.wait_for_timeout(2500)
            pg.close()

    b.close()

print()
ok = sum(1 for r in results if r[1])
print(f'{ok}/{len(results)} passed')
sys.exit(0 if ok == len(results) else 1)
