import sys, json
from playwright.sync_api import sync_playwright
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:5173/'
errs = []
with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, has_touch=True)
    ctx.route('**/telegram.org/**', lambda r: r.fulfill(status=200, content_type='application/javascript', body=''))
    page = ctx.new_page()
    page.on('console', lambda m: errs.append(m.text) if m.type in ('error',) else None)
    page.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e)))
    page.goto(URL)
    page.wait_for_selector('body[data-ready="1"]', timeout=15000)
    page.screenshot(path='tests/shots/smoke_menu.png')
    page.click('#btn-play')
    page.click('#lv-1-1')
    page.wait_for_timeout(2500)
    page.screenshot(path='tests/shots/smoke_level.png')
    print(page.evaluate('JSON.stringify({fit:window.__fit, st:window.__game.scene.S && window.__game.scene.S.state})'))
    print('ERRORS', errs)
    b.close()
