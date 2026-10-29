"""Builds character sprite sheets from the reference portraits (public/assets/characters/ref*.jpg).
Each sheet: 10 frames (d0 d1 u0 u1 l0 l1 r0 r1 hurt win) x 4 evolution rows (stage 1..4), 24x26 px per frame.
Usage: python tools/make_sprites.py   (needs Pillow)"""
import json, os, colorsys
from PIL import Image, ImageDraw

SRC = 'public/assets/characters'
K = 7 / 6  # scale vs the 24x26 base layout
FW, FH, HEAD = 28, 30, 21
BASEHEAD = 18
CHARS = {
    # id: (ref, crop box, profile_left, shirt, accent, hair override)
    'valera_broke': ('ref3.jpg', (210, 10, 1050, 850), False, '#2a2a35', '#ffd36b'),
    'moggsu': ('ref2.jpg', (80, 0, 1180, 1100), False, '#5a2bd6', '#7cf0ff'),
    'zetaboss': ('ref1.jpg', (170, 20, 1180, 1030), True, '#1f7a4d', '#9aa7ff'),
    'hulioboss': ('ref4.jpg', (190, 0, 1100, 1000), False, '#101018', '#39ffb0'),
    'dildoboss': ('ref2.jpg', (80, 0, 1180, 1100), False, '#8a1fa8', '#ffd23f'),
}

def hexrgb(h):
    h = h.lstrip('#'); return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))

def head_image(ref, box, blonde=False):
    im = Image.open(os.path.join(SRC, ref)).convert('RGB').crop(box)
    bg = im.getpixel((2, 2))
    im = im.resize((HEAD * 4, HEAD * 4), Image.LANCZOS)
    if blonde:  # recolor dark hair to platinum blonde
        px = im.load()
        for y in range(im.height):
            for x in range(im.width):
                r, g, b = px[x, y]
                h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
                if v < 0.42 and s < 0.55 and y < im.height * 0.5:
                    t = min(1, v / 0.42)
                    px[x, y] = (int(150 + 100 * t), int(120 + 95 * t), int(40 + 70 * t))
    small = im.resize((HEAD, HEAD), Image.BOX).quantize(colors=22, method=Image.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')
    # transparent background: flood fill from the edges over near-background colours
    a = Image.new('L', small.size, 255)
    px = small.load(); ap = a.load()
    bgc = tuple(int(c * 0.9) for c in bg)
    def near(c): return sum(abs(c[i] - bgc[i]) for i in range(3)) < 34 and max(c) < 60
    stack = [(x, y) for x in range(HEAD) for y in (0, HEAD - 1)] + [(x, y) for y in range(HEAD) for x in (0, HEAD - 1)]
    seen = set()
    while stack:
        x, y = stack.pop()
        if (x, y) in seen or not (0 <= x < HEAD and 0 <= y < HEAD): continue
        seen.add((x, y))
        if min(x, y, HEAD - 1 - x, HEAD - 1 - y) > 1: continue   # only the outer 2px band
        if not near(px[x, y]): continue
        ap[x, y] = 0
        stack += [(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)]
    for cx, cy in [(0, 0), (HEAD - 1, 0), (0, HEAD - 1), (HEAD - 1, HEAD - 1)]:
        sx = 1 if cx == 0 else -1; sy = 1 if cy == 0 else -1
        for (dx, dy) in [(0, 0), (1, 0), (0, 1), (2, 0), (0, 2), (1, 1)]:
            ap[cx + sx * dx, cy + sy * dy] = 0
    out = small.convert('RGBA'); out.putalpha(a)
    return out

def hair_color(head):
    px = [head.getpixel((x, y)) for y in range(0, 4) for x in range(4, HEAD - 4)]
    px = [p for p in px if p[3] > 0] or [(30, 24, 20, 255)]
    px.sort(key=lambda p: sum(p[:3]))
    return px[len(px) // 2][:3]

def squeeze(head, w, left):
    h = head.resize((w, HEAD), Image.NEAREST)
    return h

class SD:
    """ImageDraw wrapper that takes coordinates in the 24x26 base layout and scales them by K."""
    def __init__(self, im): self.d = ImageDraw.Draw(im)
    def _s(self, x0, y0, x1, y1):
        return (round(x0 * K), round(y0 * K), max(round((x1 + 1) * K) - 1, round(x0 * K)), max(round((y1 + 1) * K) - 1, round(y0 * K)))
    def rectangle(self, box, fill): self.d.rectangle(self._s(*box), fill=fill)
    def ellipse(self, box, fill): self.d.ellipse(self._s(*box), fill=fill)
    def point(self, xy, fill):
        x0, y0, x1, y1 = self._s(xy[0], xy[1], xy[0], xy[1]); self.d.rectangle((x0, y0, x1, y1), fill=fill)

def make_frame(head, hair, profile_left, shirt, accent, direction, f, stage, mode):
    im = Image.new('RGBA', (FW, FH), (0, 0, 0, 0))
    d = SD(im)
    skin = (232, 180, 138)
    dark = (20, 18, 28)
    bob = 1 if (f and mode == 'walk') else 0
    ly = 23
    d.rectangle([7, ly, 9, 25 - (1 if f and mode == 'walk' else 0)], fill=dark)
    d.rectangle([14, ly, 16, 25 - (0 if f and mode == 'walk' else (1 if mode == 'walk' else 0))], fill=dark)
    bx0, bx1 = (4, 19) if stage >= 3 else (6, 17)
    d.rectangle([bx0, 17 + bob, bx1, 23], fill=hexrgb(shirt))
    if stage >= 3: d.rectangle([bx0, 17 + bob, bx1, 17 + bob], fill=hexrgb(accent))
    ay = 11 if mode == 'win' else 18 + bob
    d.rectangle([bx0 - 2, ay, bx0 - 1, ay + 4], fill=skin)
    d.rectangle([bx1 + 1, ay, bx1 + 2, ay + 4], fill=skin)
    hx, hy = 3, bob
    px0, py0 = round(hx * K), round(hy * K)
    if direction == 'u':
        d.ellipse([hx, hy, hx + BASEHEAD - 1, hy + BASEHEAD - 1], fill=hair + (255,))
        import random
        rnd = random.Random(sum(hair))
        for _ in range(40):
            x = rnd.randint(hx + 3, hx + BASEHEAD - 4); y = rnd.randint(hy + 2, hy + BASEHEAD - 4)
            k = rnd.choice([-22, 28, 14])
            d.point((x, y), fill=tuple(max(0, min(255, c + k)) for c in hair) + (255,))
    else:
        if direction == 'd':
            face = head if not profile_left else squeeze(head, round(13 * K), True)
            ox = px0 + (0 if not profile_left else round(2 * K))
        else:
            face = head if profile_left else squeeze(head, round(12 * K), True)
            ox = px0
            if not profile_left:
                d.ellipse([hx + 3, hy + 1, hx + BASEHEAD - 1, hy + BASEHEAD - 2], fill=hair + (255,))
        im.alpha_composite(face, (ox, py0))
        if direction == 'r':
            region = im.crop((px0, 0, px0 + HEAD, HEAD + 2)).transpose(Image.FLIP_LEFT_RIGHT)
            im.paste((0, 0, 0, 0), (px0, 0, px0 + HEAD, HEAD + 2))
            im.alpha_composite(region, (px0, 0))
        if stage >= 2:
            ey = hy + 7
            if direction == 'd': d.rectangle([hx + 3, ey, hx + BASEHEAD - 4, ey + 1], fill=(5, 5, 10))
            elif direction == 'l': d.rectangle([hx + 1, ey, hx + 9, ey + 1], fill=(5, 5, 10))
            else: d.rectangle([hx + BASEHEAD - 10, ey, hx + BASEHEAD - 2, ey + 1], fill=(5, 5, 10))
    if stage >= 2: d.rectangle([11, 18 + bob, 12, 18 + bob], fill=hexrgb(accent))
    if stage >= 4:
        gold = (255, 210, 63)
        d.rectangle([hx + 2, hy, hx + BASEHEAD - 3, hy + 1], fill=gold)
        for x in (hx + 2, hx + 7, hx + 12): d.rectangle([x, hy - 1, x + 1, hy - 1], fill=gold)
    if mode == 'hurt':
        pxl = im.load()
        for y in range(im.height):
            for x in range(im.width):
                r, g, b, a = pxl[x, y]
                if a: pxl[x, y] = (min(255, r + 120), g // 2, b // 2, a)
    return im

def build(cid):
    ref, box, prof, shirt, accent = CHARS[cid]
    head = head_image(ref, box, blonde=(cid == 'dildoboss'))
    hair = hair_color(head)
    sheet = Image.new('RGBA', (FW * 10, FH * 4), (0, 0, 0, 0))
    for stage in (1, 2, 3, 4):
        frames = []
        for d in 'dulr':
            for f in (0, 1):
                frames.append(make_frame(head, hair, prof, shirt, accent, d, f, stage, 'walk'))
        frames.append(make_frame(head, hair, prof, shirt, accent, 'd', 0, stage, 'hurt'))
        frames.append(make_frame(head, hair, prof, shirt, accent, 'd', 0, stage, 'win'))
        for i, fr in enumerate(frames): sheet.alpha_composite(fr, (i * FW, (stage - 1) * FH))
    sheet.save(os.path.join(SRC, cid + '.png'))
    return sheet

if __name__ == '__main__':
    ids = list(CHARS)
    sheets = [build(c) for c in ids]
    with open(os.path.join(SRC, 'manifest.json'), 'w') as fh:
        json.dump({'sheets': ids, 'frame': [FW, FH]}, fh)
    # contact sheet for eyeballing
    S = 4
    cs = Image.new('RGBA', (FW * 10 * S, FH * 4 * S * len(ids) // 2 + 10), (40, 30, 70, 255))
    big = Image.new('RGBA', (FW * 10 * S, FH * 2 * S * len(ids)), (40, 30, 70, 255))
    for i, sh in enumerate(sheets):
        part = sh.crop((0, 0, FW * 10, FH * 2)).resize((FW * 10 * S, FH * 2 * S), Image.NEAREST)
        big.alpha_composite(part, (0, i * FH * 2 * S))
    big.save('tests/shots/sprites_contact.png')
    print('ok', ids)
