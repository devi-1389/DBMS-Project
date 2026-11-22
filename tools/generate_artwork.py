"""
Generates the bundled SVG artwork used for experiences, categories and the hero banner.

The illustrations are drawn procedurally (layered landscapes + subject silhouettes) so the
site always has appropriate, locally hosted images that load offline. Real photographs can
replace any of them through Admin -> Experiences -> Edit -> Photo upload.

    python tools/generate_artwork.py
"""
import math
import os
import random

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_EXP = os.path.join(ROOT, 'app', 'static', 'images', 'experiences')
OUT_CAT = os.path.join(ROOT, 'app', 'static', 'images', 'categories')
OUT_IMG = os.path.join(ROOT, 'app', 'static', 'images')
W, H = 1200, 800


# --------------------------------------------------------------------------- primitives
class Scene:
    def __init__(self, name, seed=7):
        self.name = name
        self.defs = []
        self.body = []
        self.rng = random.Random(seed)
        self._gid = 0

    def gid(self, prefix='g'):
        self._gid += 1
        return f"{self.name}-{prefix}{self._gid}"

    def lin(self, stops, x1=0, y1=0, x2=0, y2=1):
        gid = self.gid('lg')
        parts = []
        for st in stops:
            o, c = st[0], st[1]
            opacity = f' stop-opacity="{st[2]}"' if len(st) > 2 else ''
            parts.append(f'<stop offset="{o}" stop-color="{c}"{opacity}/>')
        s = ''.join(parts)
        self.defs.append(f'<linearGradient id="{gid}" x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}">{s}</linearGradient>')
        return f'url(#{gid})'

    def rad(self, stops, cx=0.5, cy=0.5, r=0.5):
        gid = self.gid('rg')
        s = ''.join(f'<stop offset="{o}" stop-color="{c}" stop-opacity="{a}"/>' for o, c, a in stops)
        self.defs.append(f'<radialGradient id="{gid}" cx="{cx}" cy="{cy}" r="{r}">{s}</radialGradient>')
        return f'url(#{gid})'

    def blur(self, std):
        gid = self.gid('bl')
        self.defs.append(f'<filter id="{gid}" x="-20%" y="-50%" width="140%" height="200%">'
                         f'<feGaussianBlur stdDeviation="{std}"/></filter>')
        return f'url(#{gid})'

    def add(self, svg):
        self.body.append(svg)

    def render(self):
        return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" preserveAspectRatio="xMidYMid slice" '
                f'role="img" aria-label="{self.name.replace("_", " ")}">'
                f'<defs>{"".join(self.defs)}</defs>{"".join(self.body)}</svg>')


def pts(points):
    return ' '.join(f'{x:.1f},{y:.1f}' for x, y in points)


def sky(sc, stops):
    sc.add(f'<rect width="{W}" height="{H}" fill="{sc.lin(stops)}"/>')


def sun(sc, cx, cy, r, core, glow, glow_r=3.2, glow_op=0.55):
    g = sc.rad([(0, glow, glow_op), (0.45, glow, glow_op * 0.35), (1, glow, 0)])
    sc.add(f'<circle cx="{cx}" cy="{cy}" r="{r * glow_r}" fill="{g}"/>')
    sc.add(f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{core}"/>')


def stars(sc, n, max_y, color='#fff'):
    for _ in range(n):
        x, y = sc.rng.uniform(0, W), sc.rng.uniform(0, max_y)
        r = sc.rng.choice([0.8, 1.1, 1.5, 2.1])
        sc.add(f'<circle cx="{x:.0f}" cy="{y:.0f}" r="{r}" fill="{color}" opacity="{sc.rng.uniform(0.35, 0.95):.2f}"/>')


def ridge(sc, base, amp, color, rough=0.55, seed=None, opacity=1, peaks=None):
    """Mountain silhouette via midpoint displacement."""
    rng = random.Random(seed if seed is not None else sc.rng.random())
    n = 7
    ys = [base - rng.uniform(0.2, 1) * amp for _ in range(2 ** n // 16 + 1)]
    points = [(i * W / (len(ys) - 1), ys[i]) for i in range(len(ys))]
    disp = amp * 0.5
    for _ in range(4):
        new = []
        for (x1, y1), (x2, y2) in zip(points, points[1:]):
            new.append((x1, y1))
            new.append(((x1 + x2) / 2, (y1 + y2) / 2 + rng.uniform(-disp, disp)))
        new.append(points[-1])
        points = new
        disp *= rough
    if peaks:
        for px, py in peaks:
            points = [(x, min(y, py + abs(x - px) * 0.9) if abs(x - px) < 260 else y) for x, y in points]
    points = [(x, min(y, H)) for x, y in points]
    sc.add(f'<polygon points="{pts([(0, H)] + points + [(W, H)])}" fill="{color}" opacity="{opacity}"/>')


def hills(sc, base, waves, color, opacity=1):
    points = []
    for i in range(0, W + 21, 20):
        y = base + sum(a * math.sin(i / l + p) for a, l, p in waves)
        points.append((i, y))
    sc.add(f'<polygon points="{pts([(0, H)] + points + [(W, H)])}" fill="{color}" opacity="{opacity}"/>')


def mist(sc, y, height, opacity=0.45, color='#ffffff'):
    sc.add(f'<rect x="-100" y="{y}" width="{W + 200}" height="{height}" fill="{color}" opacity="{opacity}" '
           f'filter="{sc.blur(height / 3)}"/>')


def water(sc, top, c1, c2, sun_x=None, glint='#ffe2a8', lines=26):
    sc.add(f'<rect x="0" y="{top}" width="{W}" height="{H - top}" fill="{sc.lin([(0, c1), (1, c2)])}"/>')
    for i in range(lines):
        y = top + 6 + (i ** 1.6) * 1.9
        if y > H:
            break
        x = sc.rng.uniform(-50, W)
        w = sc.rng.uniform(60, 260)
        sc.add(f'<rect x="{x:.0f}" y="{y:.0f}" width="{w:.0f}" height="1.6" rx="1" fill="#ffffff" opacity="{sc.rng.uniform(0.08, 0.22):.2f}"/>')
    if sun_x is not None:
        for i in range(18):
            y = top + 8 + i * 14
            w = max(12, 120 - i * 5) * sc.rng.uniform(0.6, 1.2)
            sc.add(f'<rect x="{sun_x - w / 2:.0f}" y="{y:.0f}" width="{w:.0f}" height="3" rx="1.5" fill="{glint}" opacity="{max(0.12, 0.75 - i * 0.04):.2f}"/>')


def pine(sc, x, y, h, color, opacity=1):
    w = h * 0.42
    tiers = []
    for i in range(4):
        ty = y - h + i * h * 0.2
        tw = w * (0.45 + i * 0.2)
        tiers.append(f'<polygon points="{x},{ty:.0f} {x - tw / 2:.0f},{ty + h * 0.34:.0f} {x + tw / 2:.0f},{ty + h * 0.34:.0f}"/>')
    sc.add(f'<g fill="{color}" opacity="{opacity}"><rect x="{x - h * 0.03:.0f}" y="{y - h * 0.2:.0f}" width="{h * 0.06:.0f}" height="{h * 0.2:.0f}"/>{"".join(tiers)}</g>')


def forest_band(sc, base, count, hmin, hmax, color, opacity=1):
    for _ in range(count):
        pine(sc, sc.rng.uniform(-20, W + 20), base + sc.rng.uniform(-6, 10), sc.rng.uniform(hmin, hmax), color, opacity)


def round_tree(sc, x, y, r, color, trunk=None):
    if trunk:
        sc.add(f'<rect x="{x - r * 0.08:.0f}" y="{y - r * 0.4:.0f}" width="{r * 0.16:.0f}" height="{r * 0.9:.0f}" fill="{trunk}"/>')
    blobs = ''.join(f'<circle cx="{x + dx * r:.0f}" cy="{y - r * 0.9 + dy * r:.0f}" r="{r * s:.0f}"/>'
                    for dx, dy, s in [(0, 0, 0.62), (-0.45, 0.15, 0.48), (0.45, 0.15, 0.5), (-0.2, -0.35, 0.45), (0.25, -0.3, 0.42)])
    sc.add(f'<g fill="{color}">{blobs}</g>')


def canopy_band(sc, base, count, rmin, rmax, color, opacity=1):
    blobs = []
    for _ in range(count):
        x = sc.rng.uniform(-40, W + 40)
        r = sc.rng.uniform(rmin, rmax)
        blobs.append(f'<circle cx="{x:.0f}" cy="{base + sc.rng.uniform(-r * 0.3, r * 0.3):.0f}" r="{r:.0f}"/>')
    sc.add(f'<g fill="{color}" opacity="{opacity}">{"".join(blobs)}<rect x="0" y="{base}" width="{W}" height="{H - base}"/></g>')


def palm(sc, x, y, h, color, lean=0.15, fronds=7):
    tx, ty = x + h * lean, y - h
    sc.add(f'<path d="M{x},{y} Q{x + h * lean * 0.2:.0f},{y - h * 0.55:.0f} {tx:.0f},{ty:.0f}" stroke="{color}" '
           f'stroke-width="{h * 0.045:.1f}" fill="none" stroke-linecap="round"/>')
    for i in range(fronds):
        ang = math.pi * (0.05 + 0.9 * i / (fronds - 1))
        length = h * sc.rng.uniform(0.42, 0.55)
        ex = tx + math.cos(ang) * length * (1 if i % 2 else -1) * 0.95
        ex = tx - math.cos(ang) * length
        ey = ty - math.sin(ang) * length * 0.35 + length * 0.35
        cx_, cy_ = (tx + ex) / 2, ty - length * 0.32
        sc.add(f'<path d="M{tx:.0f},{ty:.0f} Q{cx_:.0f},{cy_:.0f} {ex:.0f},{ey:.0f} Q{cx_ + 6:.0f},{cy_ + 16:.0f} {tx:.0f},{ty + 4:.0f}Z" fill="{color}"/>')


def birds(sc, cx, cy, n, color, spread=160, size=12):
    for _ in range(n):
        x, y = cx + sc.rng.uniform(-spread, spread), cy + sc.rng.uniform(-spread * 0.35, spread * 0.35)
        s = size * sc.rng.uniform(0.6, 1.2)
        sc.add(f'<path d="M{x - s:.0f},{y:.0f} Q{x - s / 2:.0f},{y - s * 0.6:.0f} {x:.0f},{y:.0f} Q{x + s / 2:.0f},{y - s * 0.6:.0f} {x + s:.0f},{y:.0f}" '
               f'stroke="{color}" stroke-width="2.4" fill="none" stroke-linecap="round"/>')


POSES = {
    # joint coordinates relative to feet baseline (y up negative), figure ~100 units tall
    'stand': dict(neck=(0, -78), hip=(0, -46), lk=(-4, -23), lf=(-6, 0), rk=(4, -23), rf=(6, 0),
                  le=(-10, -60), lh=(-11, -44), re=(10, -60), rh=(11, -44)),
    'walk': dict(neck=(3, -78), hip=(0, -46), lk=(-9, -24), lf=(-16, 0), rk=(8, -24), rf=(12, 0),
                 le=(-6, -60), lh=(-12, -46), re=(14, -60), rh=(22, -50)),
    'hike': dict(neck=(6, -76), hip=(0, -45), lk=(-8, -24), lf=(-15, 0), rk=(10, -26), rf=(14, 0),
                 le=(16, -62), lh=(26, -52), re=(-4, -60), rh=(-14, -52)),
    'victory': dict(neck=(0, -78), hip=(0, -46), lk=(-5, -23), lf=(-8, 0), rk=(5, -23), rf=(8, 0),
                    le=(-14, -92), lh=(-20, -110), re=(14, -92), rh=(20, -110)),
    'tree': dict(neck=(0, -78), hip=(0, -46), lk=(0, -23), lf=(0, 0), rk=(18, -36), rf=(2, -30),
                 le=(-8, -98), lh=(0, -116), re=(8, -98), rh=(0, -116)),
    'sit': dict(neck=(0, -58), hip=(0, -26), lk=(18, -26), lf=(18, 0), rk=(20, -24), rf=(22, 0),
                le=(10, -40), lh=(22, -36), re=(12, -42), rh=(24, -38)),
    'paddle': dict(neck=(0, -44), hip=(0, -12), lk=(16, -14), lf=(30, -8), rk=(16, -14), rf=(30, -8),
                   le=(-12, -32), lh=(-22, -40), re=(14, -32), rh=(22, -26)),
    'cycle': dict(neck=(18, -74), hip=(-4, -54), lk=(10, -34), lf=(4, -12), rk=(4, -40), rf=(-6, -22),
                  le=(28, -62), lh=(36, -54), re=(28, -62), rh=(36, -54)),
    'lotus': dict(neck=(0, -58), hip=(0, -26), lk=(-22, -14), lf=(10, -10), rk=(22, -14), rf=(-10, -10),
                  le=(-16, -40), lh=(-22, -22), re=(16, -40), rh=(22, -22)),
}


def figure(sc, x, y, scale, pose, color, backpack=False, poles=False, hair=False):
    p = {k: (x + v[0] * scale, y + v[1] * scale) for k, v in POSES[pose].items()}
    s = scale
    seg = lambda a, b, w: f'<line x1="{a[0]:.1f}" y1="{a[1]:.1f}" x2="{b[0]:.1f}" y2="{b[1]:.1f}" stroke-width="{w * s:.1f}"/>'
    parts = [seg(p['neck'], p['hip'], 12)]
    for side in 'lr':
        parts += [seg(p['hip'], p[side + 'k'], 8), seg(p[side + 'k'], p[side + 'f'], 7),
                  seg(p['neck'], p[side + 'e'], 6), seg(p[side + 'e'], p[side + 'h'], 5)]
    head = (p['neck'][0] + (2 if pose in ('hike', 'cycle') else 0) * s, p['neck'][1] - 10 * s)
    extra = ''
    if backpack:
        bx, by = p['neck'][0] - 12 * s, p['neck'][1] + 2 * s
        extra += f'<rect x="{bx:.1f}" y="{by:.1f}" width="{11 * s:.1f}" height="{24 * s:.1f}" rx="{3 * s:.1f}" fill="{color}"/>'
    if poles:
        for hand in ('lh', 'rh'):
            hx, hy = p[hand]
            extra += f'<line x1="{hx:.1f}" y1="{hy:.1f}" x2="{hx + 6 * s:.1f}" y2="{y:.1f}" stroke="{color}" stroke-width="{2 * s:.1f}"/>'
    if hair:
        extra += f'<circle cx="{head[0] - 3 * s:.1f}" cy="{head[1] - 2 * s:.1f}" r="{5 * s:.1f}" fill="{color}"/>'
    sc.add(f'<g stroke="{color}" stroke-linecap="round" fill="none">{"".join(parts)}</g>'
           f'<circle cx="{head[0]:.1f}" cy="{head[1]:.1f}" r="{7.5 * s:.1f}" fill="{color}"/>{extra}')


def kayak(sc, x, y, length, color, paddler_color=None, paddle=True):
    sc.add(f'<path d="M{x - length / 2:.0f},{y} Q{x:.0f},{y + length * 0.09:.0f} {x + length / 2:.0f},{y} '
           f'Q{x:.0f},{y - length * 0.035:.0f} {x - length / 2:.0f},{y}Z" fill="{color}"/>')
    if paddler_color:
        s = length / 260
        figure(sc, x, y - 2, s * 1.2, 'paddle', paddler_color)
        if paddle:
            sc.add(f'<line x1="{x - 60 * s:.0f}" y1="{y - 70 * s:.0f}" x2="{x + 60 * s:.0f}" y2="{y + 10 * s:.0f}" '
                   f'stroke="{paddler_color}" stroke-width="{4 * s:.1f}" stroke-linecap="round"/>')


def vignette(sc, strength=0.35):
    g = sc.rad([(0.55, '#000000', 0), (1, '#000000', strength)], r=0.75)
    sc.add(f'<rect width="{W}" height="{H}" fill="{g}"/>')


# --------------------------------------------------------------------------- palettes
SUNSET = [(0, '#2b2f5a'), (0.45, '#b4536a'), (0.75, '#f08a5d'), (1, '#f9c784')]
DAWN = [(0, '#5f7fa6'), (0.5, '#e7b7a5'), (0.8, '#f6d6a8'), (1, '#fbe9c8')]
DAY = [(0, '#7fb7c9'), (0.6, '#cfe6e4'), (1, '#f4efe2')]
FOREST_MORNING = [(0, '#a9c7b1'), (0.6, '#e2ead9'), (1, '#f3f1e3')]
NIGHT = [(0, '#050b14'), (0.6, '#0e2233'), (1, '#173a3f')]
GOLDEN = [(0, '#405d72'), (0.45, '#d99c6b'), (0.8, '#f3c27b'), (1, '#f8dfa8')]


# --------------------------------------------------------------------------- scenes
def scene_sunset_cliff():
    sc = Scene('sunset_cliff', 11)
    sky(sc, SUNSET); stars(sc, 25, 180, '#fde8c8')
    sun(sc, 640, 470, 70, '#ffd89a', '#ffb070')
    water(sc, 480, '#c06b5e', '#3a2f4e', sun_x=640)
    sc.add('<path d="M700,800 L760,560 Q820,520 900,515 L1200,500 L1200,800Z" fill="#2a1d2b"/>')
    sc.add('<path d="M760,560 Q820,520 900,515 L1200,500 L1200,520 L900,532 Q830,540 776,572Z" fill="#4a2f3a"/>')
    # string lights
    sc.add('<path d="M860,380 Q960,420 1060,370 Q1120,350 1180,380" stroke="#3a2a33" stroke-width="2" fill="none"/>')
    for i in range(12):
        t = i / 11
        x = 860 + 320 * t
        y = 380 + math.sin(t * math.pi * 2) * -18 + 20 * math.sin(t * math.pi)
        sun(sc, x, y, 3.5, '#fff1c9', '#ffd27a', glow_r=4, glow_op=0.7)
    # table, chairs, lantern
    sc.add('<rect x="940" y="440" width="150" height="10" rx="3" fill="#f3e7d3"/>'
           '<path d="M948,450 L960,500 L1070,500 L1082,450Z" fill="#efe1c8" opacity="0.95"/>'
           '<rect x="1008" y="500" width="14" height="18" fill="#2a1d2b"/>')
    sun(sc, 1015, 425, 7, '#fff3cf', '#ffcf6b', glow_r=6, glow_op=0.8)
    sc.add('<rect x="1011" y="420" width="8" height="18" rx="2" fill="#f7e3b0"/>')
    figure(sc, 905, 516, 0.95, 'sit', '#1b1420')
    sc.add('<g transform="translate(2120,0) scale(-1,1)">')
    figure(sc, 995, 516, 0.95, 'sit', '#1b1420', hair=True)
    sc.add('</g>')
    vignette(sc, 0.3)
    return sc


def scene_catamaran():
    sc = Scene('catamaran', 12)
    sky(sc, SUNSET)
    sun(sc, 380, 455, 80, '#ffe0a6', '#ffb26b')
    ridge(sc, 470, 50, '#6d4a6b', seed=3, opacity=0.6)
    water(sc, 470, '#d07a63', '#2c3557', sun_x=380)
    x, y = 720, 560
    sc.add(f'<path d="M{x - 170},{y} L{x + 190},{y} L{x + 160},{y + 22} L{x - 150},{y + 22}Z" fill="#1d1a2a"/>'
           f'<path d="M{x - 150},{y - 6} L{x + 170},{y - 6} L{x + 165},{y + 4} L{x - 145},{y + 4}Z" fill="#f2e6d6"/>'
           f'<rect x="{x - 60}" y="{y - 40}" width="140" height="34" rx="6" fill="#f2e6d6"/>'
           f'<rect x="{x - 50}" y="{y - 32}" width="120" height="12" rx="3" fill="#2c3557" opacity="0.8"/>'
           f'<line x1="{x}" y1="{y - 40}" x2="{x}" y2="{y - 330}" stroke="#1d1a2a" stroke-width="6"/>'
           f'<path d="M{x + 6},{y - 320} L{x + 6},{y - 52} L{x + 170},{y - 52}Z" fill="#fbf1e2"/>'
           f'<path d="M{x - 6},{y - 300} L{x - 6},{y - 60} L{x - 140},{y - 60}Z" fill="#f1dfc8"/>')
    sc.add(f'<path d="M{x - 220},{y + 26} Q{x},{y + 40} {x + 240},{y + 26}" stroke="#fff" stroke-width="3" fill="none" opacity="0.35"/>')
    birds(sc, 900, 220, 5, '#3b2a3f')
    # dolphin
    sc.add('<path d="M300,640 Q330,600 370,615 Q385,622 392,640 Q370,628 352,632 Q330,636 300,640Z" fill="#2b2f4a"/>')
    vignette(sc, 0.28)
    return sc


def scene_ayurvedic_spa():
    sc = Scene('ayurvedic_spa', 13)
    sky(sc, [(0, '#e9dfcf'), (1, '#c9b79c')])
    sc.add(f'<rect y="520" width="{W}" height="280" fill="{sc.lin([(0, "#8a6a4a"), (1, "#5a4330")])}"/>')
    # leaves backdrop
    for i in range(9):
        x = 80 + i * 130 + sc.rng.uniform(-20, 20)
        sc.add(f'<path d="M{x},520 Q{x - 60},{360 - i % 3 * 30} {x + 10},{220 + i % 2 * 40} Q{x + 50},{380} {x},520Z" fill="#6f8f6a" opacity="0.55"/>')
    sun(sc, 980, 160, 40, '#fff6e0', '#fff2cf', glow_r=5, glow_op=0.6)
    # stacked stones
    stones = [(600, 520, 150, 40, '#4c4a46'), (600, 470, 118, 32, '#6a6560'), (600, 428, 92, 26, '#86807a'), (600, 394, 66, 20, '#a49d95')]
    for cx, cy, rx, ry, c in stones:
        sc.add(f'<ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" fill="{c}"/>'
               f'<ellipse cx="{cx - rx * 0.3:.0f}" cy="{cy - ry * 0.35:.0f}" rx="{rx * 0.45:.0f}" ry="{ry * 0.25:.0f}" fill="#fff" opacity="0.12"/>')
    # lotus
    for i, (dx, rot) in enumerate([(-34, -40), (-18, -20), (0, 0), (18, 20), (34, 40)]):
        sc.add(f'<ellipse cx="{600 + dx}" cy="352" rx="13" ry="34" fill="{"#f3c6c6" if i % 2 else "#f7d9d4"}" transform="rotate({rot} {600 + dx} 380)"/>')
    # oil bowl & candles
    sc.add('<path d="M240,600 Q300,680 360,600Z" fill="#b5893f"/><ellipse cx="300" cy="600" rx="60" ry="12" fill="#d8b46a"/>'
           '<ellipse cx="300" cy="600" rx="50" ry="8" fill="#8a5a1d"/>')
    for cx in (880, 940, 1000):
        h = 60 + (cx % 3) * 15
        sc.add(f'<rect x="{cx - 16}" y="{620 - h}" width="32" height="{h}" rx="4" fill="#f6efe2"/>')
        sun(sc, cx, 620 - h - 14, 6, '#fff3c4', '#ffcf6b', glow_r=5, glow_op=0.7)
    sc.add('<path d="M0,700 Q300,660 600,700 T1200,690 L1200,800 L0,800Z" fill="#3e2e21" opacity="0.7"/>')
    vignette(sc, 0.22)
    return sc


def scene_cabana():
    sc = Scene('cabana', 14)
    sky(sc, DAY)
    sun(sc, 1020, 140, 50, '#fff7df', '#fff2c4', glow_r=4)
    water(sc, 400, '#4fb0b4', '#2b7d8f', lines=18)
    sc.add('<path d="M0,520 Q300,470 600,500 T1200,480 L1200,800 L0,800Z" fill="#efdcb8"/>'
           '<path d="M0,520 Q300,470 600,500 T1200,480" stroke="#ffffff" stroke-width="6" fill="none" opacity="0.6"/>')
    palm(sc, 120, 620, 420, '#2f4a35', lean=0.2)
    palm(sc, 1110, 600, 380, '#2f4a35', lean=-0.25)
    # cabana
    sc.add('<path d="M470,330 L760,330 L800,380 L430,380Z" fill="#f7f2e7"/><path d="M430,380 L800,380 L800,394 L430,394Z" fill="#d8c8a8"/>'
           '<rect x="450" y="390" width="10" height="230" fill="#8a6a4a"/><rect x="770" y="390" width="10" height="230" fill="#8a6a4a"/>'
           '<path d="M460,394 Q480,500 452,620 L470,620 Q500,500 480,394Z" fill="#fbf7ee" opacity="0.95"/>'
           '<path d="M770,394 Q752,500 778,620 L760,620 Q730,500 750,394Z" fill="#fbf7ee" opacity="0.95"/>')
    sc.add('<path d="M520,560 L720,560 L740,540 L700,540Z" fill="#ffffff"/><rect x="520" y="560" width="200" height="16" rx="4" fill="#e9e1d1"/>'
           '<rect x="530" y="576" width="8" height="40" fill="#8a6a4a"/><rect x="700" y="576" width="8" height="40" fill="#8a6a4a"/>')
    sc.add('<circle cx="880" cy="600" r="22" fill="#f6c35c"/><rect x="876" y="560" width="8" height="40" fill="#7a5a3a"/>')
    vignette(sc, 0.2)
    return sc


def scene_birdwatching():
    sc = Scene('birdwatching', 15)
    sky(sc, FOREST_MORNING)
    sun(sc, 300, 200, 60, '#fff8e6', '#fff0c8', glow_r=4, glow_op=0.7)
    canopy_band(sc, 430, 40, 40, 80, '#a6bea7', 0.8)
    mist(sc, 400, 80, 0.5)
    canopy_band(sc, 520, 36, 50, 95, '#6f8f73')
    mist(sc, 520, 70, 0.35)
    canopy_band(sc, 640, 30, 60, 110, '#3f5f48')
    # branch + hornbill
    sc.add('<path d="M560,420 Q800,380 1200,400 L1200,418 Q800,400 566,434Z" fill="#2f2620"/>')
    bx, by = 850, 395
    sc.add(f'<path d="M{bx},{by} Q{bx - 30},{by - 40} {bx},{by - 80} Q{bx + 40},{by - 100} {bx + 70},{by - 60} '
           f'Q{bx + 80},{by - 20} {bx + 50},{by}Z" fill="#1a1a1a"/>'
           f'<path d="M{bx + 10},{by - 6} L{bx - 30},{by + 90} L{bx + 20},{by + 6}Z" fill="#1a1a1a"/>'
           f'<path d="M{bx + 62},{by - 66} Q{bx + 150},{by - 40} {bx + 170},{by - 10} Q{bx + 130},{by - 30} {bx + 64},{by - 50}Z" fill="#f0c04a"/>'
           f'<path d="M{bx + 60},{by - 74} Q{bx + 120},{by - 80} {bx + 140},{by - 56} Q{bx + 110},{by - 62} {bx + 66},{by - 62}Z" fill="#e6a93a"/>'
           f'<circle cx="{bx + 50}" cy="{by - 68}" r="5" fill="#f5f0e6"/>'
           f'<path d="M{bx + 10},{by - 30} Q{bx + 30},{by - 10} {bx + 45},{by - 5}" stroke="#f5f0e6" stroke-width="6" fill="none"/>')
    birds(sc, 420, 300, 6, '#4b5a4e', spread=180)
    vignette(sc, 0.22)
    return sc


def scene_mangrove_kayak():
    sc = Scene('mangrove_kayak', 16)
    sky(sc, DAWN)
    sun(sc, 600, 330, 55, '#fff1d0', '#ffd8a0')
    water(sc, 430, '#7fa39a', '#2f5650', sun_x=600, glint='#fff1d0')
    for side in (-1, 1):
        for i in range(5):
            x = (60 + i * 95) if side < 0 else (1140 - i * 95)
            base = 440 + i * 4
            sc.add(f'<g fill="#2e3f2f">')
            for k in range(4):
                rx = x + side * (k * 14 - 20)
                sc.add(f'<path d="M{x},{base - 70} Q{rx},{base - 20} {rx + side * 26},{base + 14}" stroke="#2e3f2f" stroke-width="5" fill="none"/>')
            sc.add('</g>')
            canopy_cx = x + side * 10
            sc.add(f'<g fill="{["#3b5b40", "#4a6d4b", "#2f4a35"][i % 3]}">'
                   f'<circle cx="{canopy_cx}" cy="{base - 120}" r="{70 - i * 4}"/><circle cx="{canopy_cx + 50}" cy="{base - 100}" r="{55 - i * 3}"/>'
                   f'<circle cx="{canopy_cx - 50}" cy="{base - 95}" r="{50 - i * 3}"/></g>')
    # reflections
    sc.add('<rect x="0" y="440" width="300" height="80" fill="#24372a" opacity="0.35"/><rect x="900" y="440" width="300" height="80" fill="#24372a" opacity="0.35"/>')
    kayak(sc, 600, 560, 330, '#c9673b', paddler_color='#1d2a24')
    sc.add('<path d="M380,580 Q600,600 820,580" stroke="#ffffff" stroke-width="2" fill="none" opacity="0.35"/>')
    birds(sc, 760, 200, 3, '#3a4a46')
    vignette(sc, 0.25)
    return sc


def scene_spice_farm():
    sc = Scene('spice_farm', 17)
    sky(sc, [(0, '#9cc3c9'), (0.7, '#eef0d8'), (1, '#f6efd6')])
    sun(sc, 920, 170, 55, '#fff6d8', '#ffe9a8', glow_r=4)
    ridge(sc, 360, 90, '#8fae9a', seed=5, opacity=0.8)
    hills(sc, 430, [(26, 160, 0), (14, 70, 1)], '#7fa463')
    for r in range(9):
        y0 = 450 + r * 40
        sc.add(f'<path d="M-20,{y0} Q300,{y0 - 30 + r * 2} 620,{y0 - 4} T1240,{y0 - 18}" stroke="#4d7b3a" stroke-width="{10 + r * 2.2:.0f}" fill="none" stroke-linecap="round" stroke-dasharray="{14 + r * 3} {10 + r}"/>')
    hills(sc, 640, [(20, 130, 2)], '#5f8a45', 0.35)
    # areca palms
    for x in (140, 210, 1040, 1100):
        palm(sc, x, 470, 240, '#3b5a33', lean=0.05, fronds=6)
    # basket
    sc.add('<path d="M500,640 Q600,740 700,640Z" fill="#a8743f"/><ellipse cx="600" cy="640" rx="100" ry="20" fill="#c08a4c"/>'
           '<path d="M510,650 L690,650 M520,670 L680,670 M540,690 L660,690" stroke="#8a5a2b" stroke-width="4"/>')
    for cx, cy, c in [(560, 628, '#6f8f2f'), (590, 622, '#2f2a26'), (620, 626, '#c7432e'), (648, 630, '#e3b23c'), (600, 634, '#6f8f2f')]:
        sc.add(f'<circle cx="{cx}" cy="{cy}" r="14" fill="{c}"/>')
    figure(sc, 820, 640, 1.5, 'walk', '#2c3a2c', hair=True)
    vignette(sc, 0.2)
    return sc


def scene_nocturnal_trail():
    sc = Scene('nocturnal_trail', 18)
    sky(sc, NIGHT); stars(sc, 90, 420)
    sc.add('<circle cx="930" cy="140" r="46" fill="#f2f0e1"/><circle cx="912" cy="128" r="46" fill="#081420" opacity="0.9"/>')
    forest_band(sc, 520, 26, 220, 360, '#08161a')
    sc.add(f'<rect y="560" width="{W}" height="240" fill="#061014"/>')
    sc.add('<path d="M420,800 Q560,640 600,560 L640,560 Q700,650 820,800Z" fill="#0e2228"/>')
    for cx, cy, s in [(300, 640, 1.2), (360, 660, 0.8), (880, 650, 1), (930, 670, 1.4), (980, 640, 0.7), (200, 690, 0.9)]:
        sun(sc, cx, cy - 22 * s, 18 * s, '#7ff5d6', '#3ee6b8', glow_r=3.2, glow_op=0.75)
        sc.add(f'<path d="M{cx - 20 * s:.0f},{cy - 22 * s:.0f} Q{cx:.0f},{cy - 50 * s:.0f} {cx + 20 * s:.0f},{cy - 22 * s:.0f}Z" fill="#b9fff0"/>'
               f'<rect x="{cx - 4 * s:.0f}" y="{cy - 22 * s:.0f}" width="{8 * s:.0f}" height="{22 * s:.0f}" fill="#d7fff6"/>')
    for _ in range(40):
        sun(sc, sc.rng.uniform(0, W), sc.rng.uniform(380, 720), sc.rng.uniform(1.5, 3), '#fffbc0', '#e8ff7a', glow_r=4, glow_op=0.6)
    figure(sc, 620, 600, 0.9, 'walk', '#020608')
    sun(sc, 640, 552, 5, '#c9a0ff', '#9b6bff', glow_r=10, glow_op=0.6)
    vignette(sc, 0.35)
    return sc


def scene_sunrise_trek():
    sc = Scene('sunrise_trek', 19)
    sky(sc, [(0, '#3d4f7a'), (0.4, '#c77b74'), (0.7, '#f3b27a'), (1, '#fbe1b0')])
    sun(sc, 420, 420, 75, '#ffe4a8', '#ffb46a')
    ridge(sc, 470, 80, '#a26a77', seed=21, opacity=0.65)
    mist(sc, 440, 60, 0.35, '#fbd9b6')
    ridge(sc, 540, 110, '#6d4a63', seed=22, opacity=0.85)
    mist(sc, 520, 60, 0.25, '#f2c6a8')
    ridge(sc, 640, 120, '#3e2f45', seed=23)
    sc.add('<path d="M560,800 L860,470 L900,462 L940,476 L1200,640 L1200,800Z" fill="#1d1824"/>')
    figure(sc, 902, 462, 1.25, 'victory', '#120e16', backpack=True)
    sc.add('<line x1="880" y1="462" x2="868" y2="380" stroke="#120e16" stroke-width="3"/>')
    birds(sc, 300, 220, 4, '#4a3550')
    vignette(sc, 0.25)
    return sc


def scene_sea_kayak():
    sc = Scene('sea_kayak', 20)
    sky(sc, [(0, '#5da4c4'), (0.7, '#cfe9ee'), (1, '#f2f2e6')])
    sun(sc, 300, 140, 45, '#fffbe8', '#fff3c4', glow_r=4)
    water(sc, 470, '#2fb2b3', '#0e5f73', lines=22)
    # rock arch
    sc.add('<path d="M560,800 L560,300 Q600,200 760,190 Q960,180 1040,280 L1080,470 L1200,520 L1200,800 L1010,800 '
           'L1010,560 Q1000,440 880,430 Q760,430 740,560 L740,800Z" fill="#5b4a3f"/>'
           '<path d="M560,300 Q600,200 760,190 Q960,180 1040,280 L1010,290 Q940,214 780,220 Q630,226 600,320Z" fill="#7a6556"/>'
           '<path d="M740,560 Q760,430 880,430 Q1000,440 1010,560 L1010,600 L740,600Z" fill="#0b3f4c" opacity="0.85"/>')
    sc.add('<path d="M0,800 L0,420 Q80,380 160,400 L240,470 L240,800Z" fill="#4a3b33"/>')
    for i in range(8):
        sc.add(f'<rect x="{750 + i * 30}" y="{600 + i * 3}" width="{24 - i}" height="2" fill="#bff3f0" opacity="0.4"/>')
    kayak(sc, 470, 600, 300, '#f2b13a', paddler_color='#152a30')
    kayak(sc, 860, 640, 200, '#e2573b', paddler_color='#152a30')
    birds(sc, 400, 260, 4, '#2d4a58')
    vignette(sc, 0.22)
    return sc


def scene_mountain_bike():
    sc = Scene('mountain_bike', 21)
    sky(sc, [(0, '#8fb3c7'), (0.7, '#e3e8de'), (1, '#efe6d2')])
    sun(sc, 960, 160, 50, '#fff7e0', '#fff0c0', glow_r=4)
    ridge(sc, 380, 120, '#9bb0a8', seed=31, opacity=0.8)
    forest_band(sc, 470, 30, 120, 220, '#5e7a68', 0.9)
    forest_band(sc, 560, 22, 160, 280, '#3b5446')
    sc.add('<path d="M0,800 L0,610 Q300,520 620,600 Q900,670 1200,560 L1200,800Z" fill="#7a5a3c"/>'
           '<path d="M0,610 Q300,520 620,600 Q900,670 1200,560" stroke="#a37a52" stroke-width="18" fill="none"/>')
    # bike
    bx, by = 600, 540
    sc.add(f'<g stroke="#15130f" stroke-width="7" fill="none" transform="rotate(-12 {bx} {by})">'
           f'<circle cx="{bx - 60}" cy="{by}" r="42"/><circle cx="{bx + 60}" cy="{by}" r="42"/>'
           f'<path d="M{bx - 60},{by} L{bx - 10},{by - 50} L{bx + 40},{by - 50} L{bx + 60},{by} M{bx - 10},{by - 50} L{bx + 6},{by} L{bx - 60},{by} M{bx + 40},{by - 50} L{bx + 46},{by - 70}"/></g>')
    figure(sc, bx - 6, by - 4, 1.15, 'cycle', '#15130f')
    for i in range(10):
        sc.add(f'<circle cx="{bx - 120 - i * 18}" cy="{by + 40 + sc.rng.uniform(-10, 10):.0f}" r="{10 - i * 0.6:.1f}" fill="#c9a77e" opacity="{0.5 - i * 0.04:.2f}"/>')
    vignette(sc, 0.22)
    return sc


def scene_waterfall_yoga():
    sc = Scene('waterfall_yoga', 22)
    sky(sc, FOREST_MORNING)
    sc.add('<path d="M380,0 L820,0 L840,520 L360,520Z" fill="#40524a"/><path d="M300,0 L420,0 L400,540 L250,560Z" fill="#33443d"/>'
           '<path d="M780,0 L920,0 L960,560 L820,540Z" fill="#33443d"/>')
    fall = sc.lin([(0, '#e8f4f2'), (1, '#bfe0dc')], 0, 0, 1, 0)
    sc.add(f'<path d="M500,0 L700,0 L720,520 L480,520Z" fill="{fall}"/>')
    for i in range(16):
        x = 500 + i * 13
        sc.add(f'<line x1="{x}" y1="0" x2="{x + (i - 8) * 1.5:.0f}" y2="520" stroke="#ffffff" stroke-width="2" opacity="0.5"/>')
    canopy_band(sc, 260, 18, 50, 90, '#4f7a58', 0.9)
    sc.add('<rect x="0" y="0" width="1200" height="40" fill="#4f7a58" opacity="0.6"/>')
    water(sc, 520, '#6fb3ad', '#2d6f6b', lines=14)
    mist(sc, 470, 90, 0.55)
    sc.add('<path d="M0,800 L0,660 L700,640 L760,800Z" fill="#8a6a4a"/><path d="M0,660 L700,640 L700,652 L0,672Z" fill="#a8845e"/>')
    sc.add('<rect x="180" y="652" width="200" height="10" rx="4" fill="#c66b4a"/>')
    figure(sc, 280, 652, 1.6, 'tree', '#203028')
    round_tree(sc, 1080, 640, 120, '#3c6046', trunk='#3b2e24')
    round_tree(sc, 110, 520, 90, '#4f7a58')
    vignette(sc, 0.22)
    return sc


def scene_sound_bath():
    sc = Scene('sound_bath', 23)
    sky(sc, [(0, '#2a1f2e'), (0.7, '#5b3a3a'), (1, '#8a5a3a')])
    glow = sc.rad([(0, '#ffb36b', 0.45), (0.5, '#ffb36b', 0.15), (1, '#ffb36b', 0)])
    sc.add(f'<circle cx="600" cy="420" r="420" fill="{glow}"/>')
    for i, r in enumerate((150, 210, 270, 330, 390)):
        sc.add(f'<ellipse cx="600" cy="470" rx="{r}" ry="{r * 0.32:.0f}" fill="none" stroke="#f3c98b" stroke-width="2" opacity="{0.55 - i * 0.09:.2f}"/>')
    sc.add(f'<rect y="560" width="{W}" height="240" fill="{sc.lin([(0, "#3a2620"), (1, "#1b120f")])}"/>')
    for cx, rx, c in [(600, 130, '#c79a4a'), (330, 80, '#b0833a'), (870, 90, '#b0833a')]:
        top = 560 - rx * 0.05
        sc.add(f'<path d="M{cx - rx},{top} Q{cx - rx * 0.95},{top + rx * 0.9} {cx},{top + rx * 0.95} Q{cx + rx * 0.95},{top + rx * 0.9} {cx + rx},{top}Z" fill="{c}"/>'
               f'<ellipse cx="{cx}" cy="{top}" rx="{rx}" ry="{rx * 0.18:.0f}" fill="#e6c27a"/>'
               f'<ellipse cx="{cx}" cy="{top}" rx="{rx * 0.86:.0f}" ry="{rx * 0.13:.0f}" fill="#7a5420"/>')
    sc.add('<line x1="700" y1="470" x2="820" y2="380" stroke="#6b3f22" stroke-width="12" stroke-linecap="round"/>'
           '<circle cx="700" cy="470" r="14" fill="#8a5a3a"/>')
    for cx in (140, 200, 1000, 1060):
        sc.add(f'<rect x="{cx - 12}" y="610" width="24" height="60" rx="3" fill="#efe2cb"/>')
        sun(sc, cx, 598, 5, '#fff3c4', '#ffb84d', glow_r=7, glow_op=0.7)
    vignette(sc, 0.35)
    return sc


def scene_forest_bathing():
    sc = Scene('forest_bathing', 24)
    sky(sc, [(0, '#d9e6c9'), (1, '#f4f0dc')])
    for i in range(14):
        x = sc.rng.uniform(0, W)
        w = sc.rng.uniform(20, 60)
        shade = ['#6b7d64', '#55684f', '#41543d'][i % 3]
        sc.add(f'<rect x="{x:.0f}" y="0" width="{w:.0f}" height="800" fill="{shade}" opacity="{0.35 + (i % 3) * 0.2:.2f}"/>')
    for i in range(6):
        x = 350 + i * 90
        sc.add(f'<polygon points="{x},0 {x + 60},0 {x + 220},800 {x + 80},800" fill="#fff8d8" opacity="0.18"/>')
    for x, w in [(80, 90), (300, 60), (900, 110), (1100, 70)]:
        sc.add(f'<rect x="{x}" y="0" width="{w}" height="800" fill="#2f3b2a"/>'
               f'<rect x="{x + w * 0.15:.0f}" y="0" width="{w * 0.12:.0f}" height="800" fill="#4b5a40" opacity="0.6"/>')
    sc.add('<path d="M0,620 Q600,560 1200,620 L1200,800 L0,800Z" fill="#4f6b3d"/>'
           '<path d="M480,800 Q560,680 610,600 L650,600 Q680,700 760,800Z" fill="#c9b48a"/>')
    for _ in range(40):
        x = sc.rng.uniform(0, W)
        sc.add(f'<path d="M{x:.0f},{620 + sc.rng.uniform(0, 160):.0f} l-8,-26 l8,10 l8,-24 l4,30Z" fill="#6f8f4f"/>')
    figure(sc, 630, 640, 1.1, 'walk', '#2a3324', hair=True)
    mist(sc, 520, 80, 0.3, '#fffbe6')
    vignette(sc, 0.2)
    return sc


def scene_pottery():
    sc = Scene('pottery', 25)
    sky(sc, [(0, '#e9d7bf'), (1, '#d1b48f')])
    sc.add('<rect x="0" y="0" width="1200" height="60" fill="#8a5a3a" opacity="0.4"/>')
    # shelves with pots
    for row, y in enumerate((210, 340)):
        sc.add(f'<rect x="760" y="{y}" width="400" height="12" fill="#7a4e30"/>')
        for i in range(5):
            x = 790 + i * 75
            h = 50 + ((i + row) % 3) * 18
            c = ['#b8643f', '#a65532', '#c97a4f'][(i + row) % 3]
            sc.add(f'<path d="M{x - 18},{y} Q{x - 30},{y - h * 0.5} {x - 12},{y - h} L{x + 12},{y - h} Q{x + 30},{y - h * 0.5} {x + 18},{y}Z" fill="{c}"/>')
    sc.add(f'<rect y="560" width="{W}" height="240" fill="{sc.lin([(0, "#9a6a45"), (1, "#6b4529")])}"/>')
    # wheel
    sc.add('<ellipse cx="460" cy="560" rx="220" ry="46" fill="#5a3a24"/><ellipse cx="460" cy="548" rx="200" ry="38" fill="#7a5235"/>'
           '<rect x="430" y="560" width="60" height="140" fill="#4a2f1c"/>')
    sc.add('<path d="M380,548 Q340,470 390,410 Q410,385 400,350 L520,350 Q510,385 530,410 Q580,470 540,548Z" fill="#b8643f"/>'
           '<ellipse cx="460" cy="350" rx="60" ry="12" fill="#8a4426"/><path d="M392,430 Q460,446 528,430" stroke="#d68a5f" stroke-width="5" fill="none"/>')
    # hands
    sc.add('<path d="M300,470 Q350,440 392,452 Q400,470 382,480 Q340,488 300,500Z" fill="#6b4329"/>'
           '<path d="M620,470 Q570,440 528,452 Q520,470 538,480 Q580,488 620,500Z" fill="#6b4329"/>')
    for i in range(3):
        sc.add(f'<path d="M{300 - i * 30},{520 + i * 18} Q{460},{600 + i * 6} {620 + i * 30},{520 + i * 18}" stroke="#f1dcc0" stroke-width="2" fill="none" opacity="0.35"/>')
    vignette(sc, 0.25)
    return sc


def scene_cooking_class():
    sc = Scene('cooking_class', 26)
    sky(sc, [(0, '#f1e3c8'), (1, '#e3c79a')])
    # hanging herb bundles
    for i in range(7):
        x = 90 + i * 170
        sc.add(f'<line x1="{x}" y1="0" x2="{x}" y2="{110 + (i % 3) * 25}" stroke="#7a5a3a" stroke-width="2"/>')
        for k in range(5):
            sc.add(f'<ellipse cx="{x + (k - 2) * 7}" cy="{125 + (i % 3) * 25 + abs(k - 2) * 6}" rx="7" ry="20" fill="#6f8f4a" opacity="0.75" transform="rotate({(k - 2) * 14} {x} {110 + (i % 3) * 25})"/>')
    sc.add(f'<rect y="520" width="{W}" height="280" fill="{sc.lin([(0, "#7a5235"), (1, "#4e331f")])}"/>')
    # banana leaf on table
    sc.add('<path d="M120,640 Q520,520 1080,620 Q600,720 120,640Z" fill="#3f7a3a"/><path d="M140,640 Q600,610 1060,622" stroke="#6fae5a" stroke-width="4" fill="none"/>')
    # pot with steam
    sc.add('<path d="M480,560 Q470,470 600,460 Q730,470 720,560 Q600,600 480,560Z" fill="#3a3330"/>'
           '<ellipse cx="600" cy="462" rx="122" ry="20" fill="#5a4f4a"/><ellipse cx="600" cy="462" rx="104" ry="14" fill="#d98a2b"/>'
           '<rect x="440" y="480" width="44" height="14" rx="6" fill="#3a3330"/><rect x="716" y="480" width="44" height="14" rx="6" fill="#3a3330"/>')
    for i, x in enumerate((560, 600, 640)):
        sc.add(f'<path d="M{x},440 q-24,-40 0,-80 q24,-40 0,-80" stroke="#ffffff" stroke-width="7" fill="none" opacity="{0.55 - i * 0.1:.2f}" stroke-linecap="round"/>')
    for cx, c in [(250, '#e3b23c'), (340, '#c7432e'), (860, '#5a3a26'), (950, '#9fbf3f'), (1040, '#e98a2b')]:
        sc.add(f'<ellipse cx="{cx}" cy="610" rx="44" ry="14" fill="#c8a072"/><path d="M{cx - 44},610 Q{cx},660 {cx + 44},610Z" fill="#a37a4f"/>'
               f'<ellipse cx="{cx}" cy="606" rx="36" ry="9" fill="{c}"/>')
    sc.add('<g fill="#c7432e"><path d="M720,660 q30,-10 60,8 q-30,4 -60,-8Z"/><path d="M760,676 q30,-10 60,8 q-30,4 -60,-8Z"/></g>')
    vignette(sc, 0.22)
    return sc


def scene_village_trail():
    sc = Scene('village_trail', 27)
    sky(sc, GOLDEN)
    sun(sc, 820, 380, 60, '#ffe7b0', '#ffc070')
    water(sc, 420, '#d9a274', '#456a78', sun_x=820)
    sc.add('<path d="M0,560 Q400,500 800,540 T1200,520 L1200,800 L0,800Z" fill="#d9bf92"/>')
    for x, w, h in [(120, 150, 110), (300, 120, 90), (980, 160, 120)]:
        y = 540
        sc.add(f'<rect x="{x}" y="{y - h * 0.55:.0f}" width="{w}" height="{h * 0.55:.0f}" fill="#b07a4f"/>'
               f'<polygon points="{x - 18},{y - h * 0.55:.0f} {x + w / 2:.0f},{y - h} {x + w + 18},{y - h * 0.55:.0f}" fill="#7a3f2a"/>'
               f'<rect x="{x + w * 0.4:.0f}" y="{y - h * 0.32:.0f}" width="{w * 0.2:.0f}" height="{h * 0.32:.0f}" fill="#4a2a1c"/>')
    palm(sc, 470, 560, 320, '#3e3a2a', lean=0.18)
    palm(sc, 1150, 560, 300, '#3e3a2a', lean=-0.2)
    for x, y, s in [(560, 640, 1.0), (780, 690, 1.25)]:
        sc.add(f'<path d="M{x - 130 * s:.0f},{y} Q{x:.0f},{y + 50 * s:.0f} {x + 140 * s:.0f},{y - 20 * s:.0f} L{x + 110 * s:.0f},{y - 6 * s:.0f} L{x - 110 * s:.0f},{y - 6 * s:.0f}Z" fill="#3a5a7a"/>'
               f'<path d="M{x - 120 * s:.0f},{y - 4 * s:.0f} L{x + 120 * s:.0f},{y - 14 * s:.0f}" stroke="#f2d8a8" stroke-width="{5 * s:.0f}"/>'
               f'<line x1="{x:.0f}" y1="{y - 10 * s:.0f}" x2="{x:.0f}" y2="{y - 150 * s:.0f}" stroke="#3a2a22" stroke-width="{5 * s:.0f}"/>')
    for i in range(10):
        sc.add(f'<line x1="{240 + i * 14}" y1="600" x2="{240 + i * 14}" y2="660" stroke="#6b4a2f" stroke-width="1.5" opacity="0.6"/>'
               f'<line x1="240" y1="{600 + i * 6}" x2="370" y2="{600 + i * 6}" stroke="#6b4a2f" stroke-width="1.5" opacity="0.6"/>')
    vignette(sc, 0.25)
    return sc


def scene_solar_ev():
    sc = Scene('solar_ev', 28)
    sky(sc, [(0, '#6fa8c8'), (0.7, '#d9ece9'), (1, '#f5eedb')])
    sun(sc, 240, 150, 55, '#fffbe6', '#fff2c0', glow_r=4)
    water(sc, 430, '#4d9fb0', '#2b6c80', lines=14)
    sc.add('<path d="M600,800 L700,440 Q760,380 900,370 L1200,350 L1200,800Z" fill="#6b8a5a"/>')
    sc.add('<rect x="1010" y="170" width="50" height="190" fill="#f5f1e8"/><rect x="1010" y="210" width="50" height="22" fill="#c2453a"/>'
           '<rect x="1010" y="270" width="50" height="22" fill="#c2453a"/><path d="M1000,170 L1070,170 L1035,130Z" fill="#2b3a40"/>'
           '<rect x="1018" y="140" width="34" height="30" fill="#ffe9a8"/>')
    sc.add('<path d="M0,800 L0,600 Q300,560 560,580 Q760,600 1200,520 L1200,800Z" fill="#4f6e48"/>'
           '<path d="M-20,700 Q400,600 700,640 T1220,560" stroke="#3a3a3a" stroke-width="70" fill="none"/>'
           '<path d="M-20,700 Q400,600 700,640 T1220,560" stroke="#f3e7c4" stroke-width="3" fill="none" stroke-dasharray="26 22"/>')
    x, y = 560, 600
    sc.add(f'<g transform="rotate(-4 {x} {y})">'
           f'<rect x="{x - 130}" y="{y - 150}" width="260" height="16" rx="4" fill="#1d2b3a"/>'
           + ''.join(f'<rect x="{x - 126 + i * 32}" y="{y - 147}" width="28" height="10" fill="#3a6fa0"/>' for i in range(8)) +
           f'<line x1="{x - 110}" y1="{y - 134}" x2="{x - 100}" y2="{y - 50}" stroke="#2b2b2b" stroke-width="6"/>'
           f'<line x1="{x + 110}" y1="{y - 134}" x2="{x + 100}" y2="{y - 50}" stroke="#2b2b2b" stroke-width="6"/>'
           f'<path d="M{x - 150},{y - 10} L{x - 140},{y - 60} L{x + 150},{y - 60} L{x + 160},{y - 10}Z" fill="#f1f4ef"/>'
           f'<rect x="{x - 150}" y="{y - 30}" width="310" height="10" fill="#2f7a5a"/>'
           f'<circle cx="{x - 90}" cy="{y}" r="30" fill="#1b1b1b"/><circle cx="{x - 90}" cy="{y}" r="12" fill="#9aa4a8"/>'
           f'<circle cx="{x + 100}" cy="{y}" r="30" fill="#1b1b1b"/><circle cx="{x + 100}" cy="{y}" r="12" fill="#9aa4a8"/></g>')
    figure(sc, x - 10, y - 40, 0.75, 'sit', '#1d2b3a')
    figure(sc, x + 60, y - 40, 0.75, 'sit', '#1d2b3a', hair=True)
    vignette(sc, 0.2)
    return sc


def scene_bamboo_bike():
    sc = Scene('bamboo_bike', 29)
    sky(sc, [(0, '#a8cbd6'), (0.7, '#eef0d8'), (1, '#f7ecd0')])
    sun(sc, 980, 150, 55, '#fff8e0', '#fff0c2', glow_r=4)
    ridge(sc, 380, 110, '#8fae9a', seed=41, opacity=0.8)
    for r in range(7):
        y = 420 + r * 55
        c = ['#9cc46a', '#86b257', '#6f9e48', '#5d8b3c', '#4f7a33', '#456b2d', '#3b5f27'][r]
        sc.add(f'<path d="M-20,{y} Q300,{y - 26 - r * 2} 600,{y - 6} T1220,{y - 14} L1220,800 L-20,800Z" fill="{c}"/>'
               f'<path d="M-20,{y} Q300,{y - 26 - r * 2} 600,{y - 6} T1220,{y - 14}" stroke="#cfe7e6" stroke-width="3" fill="none" opacity="0.6"/>')
    palm(sc, 160, 470, 260, '#3b5a33', lean=0.1, fronds=6)
    sc.add('<path d="M0,700 Q600,640 1200,690 L1200,712 Q600,662 0,722Z" fill="#c9b48a"/>')
    bx, by = 620, 640
    sc.add(f'<g stroke="#8a6a3a" stroke-width="9" fill="none" stroke-linecap="round">'
           f'<path d="M{bx - 70},{by} L{bx - 20},{by - 60} L{bx + 50},{by - 60} L{bx + 70},{by} M{bx - 20},{by - 60} L{bx},{by} L{bx - 70},{by} M{bx + 50},{by - 60} L{bx + 56},{by - 84}"/></g>'
           f'<g stroke="#1e1e1e" stroke-width="6" fill="none"><circle cx="{bx - 70}" cy="{by}" r="46"/><circle cx="{bx + 70}" cy="{by}" r="46"/></g>')
    figure(sc, bx - 10, by - 6, 1.25, 'cycle', '#2a2a22', hair=True)
    birds(sc, 400, 240, 5, '#4a5a4a')
    vignette(sc, 0.2)
    return sc


def scene_hero():
    sc = Scene('hero_resort', 51)
    sky(sc, GOLDEN)
    sun(sc, 760, 400, 70, '#ffe6ac', '#ffbf72')
    ridge(sc, 420, 120, '#7d6a7a', seed=61, opacity=0.55)
    mist(sc, 400, 70, 0.3, '#f6d6aa')
    ridge(sc, 470, 90, '#56506a', seed=62, opacity=0.75)
    water(sc, 470, '#d79a72', '#3b5a6a', sun_x=760)
    # infinity pool foreground
    sc.add('<rect x="0" y="600" width="1200" height="200" fill="#e8dcc6"/>'
           f'<rect x="0" y="600" width="1200" height="120" fill="{sc.lin([(0, "#4fb3b8"), (1, "#2f8796")])}"/>'
           '<rect x="0" y="596" width="1200" height="6" fill="#f6efe2"/>')
    for i in range(14):
        sc.add(f'<rect x="{sc.rng.uniform(0, 1100):.0f}" y="{610 + i * 7}" width="{sc.rng.uniform(60, 200):.0f}" height="2" fill="#fff" opacity="0.25"/>')
    # villa pavilion
    sc.add('<path d="M820,600 L820,470 L1200,470 L1200,600Z" fill="#efe4d0"/><path d="M790,476 L1000,380 L1200,420 L1200,476Z" fill="#5a3b2a"/>'
           '<rect x="860" y="500" width="80" height="100" fill="#f6c879" opacity="0.85"/><rect x="960" y="500" width="80" height="100" fill="#f6c879" opacity="0.85"/>'
           '<rect x="1060" y="500" width="80" height="100" fill="#f6c879" opacity="0.85"/>')
    palm(sc, 120, 640, 460, '#2d2a28', lean=0.18)
    palm(sc, 300, 620, 340, '#2d2a28', lean=0.28)
    palm(sc, 1160, 640, 420, '#2d2a28', lean=-0.22)
    sc.add('<rect x="420" y="730" width="180" height="16" rx="5" fill="#ffffff"/><path d="M420,730 L460,700 L470,730Z" fill="#ffffff"/>'
           '<rect x="430" y="746" width="8" height="30" fill="#8a6a4a"/><rect x="580" y="746" width="8" height="30" fill="#8a6a4a"/>')
    birds(sc, 520, 230, 5, '#4a3a4a')
    vignette(sc, 0.3)
    return sc


def scene_default():
    sc = Scene('default', 71)
    sky(sc, DAWN)
    sun(sc, 600, 380, 60, '#fff0cc', '#ffd29a')
    ridge(sc, 430, 120, '#8f8aa6', seed=72, opacity=0.6)
    ridge(sc, 520, 120, '#5e6d7a', seed=73, opacity=0.8)
    forest_band(sc, 640, 40, 120, 220, '#2f4a3c')
    sc.add(f'<rect y="640" width="{W}" height="160" fill="#2f4a3c"/>')
    vignette(sc, 0.25)
    return sc


EXPERIENCE_SCENES = {
    'sunset_cliff': scene_sunset_cliff, 'catamaran': scene_catamaran, 'ayurvedic_spa': scene_ayurvedic_spa,
    'cabana': scene_cabana, 'birdwatching': scene_birdwatching, 'mangrove_kayak': scene_mangrove_kayak,
    'spice_farm': scene_spice_farm, 'nocturnal_trail': scene_nocturnal_trail, 'sunrise_trek': scene_sunrise_trek,
    'sea_kayak': scene_sea_kayak, 'mountain_bike': scene_mountain_bike, 'waterfall_yoga': scene_waterfall_yoga,
    'sound_bath': scene_sound_bath, 'forest_bathing': scene_forest_bathing, 'pottery': scene_pottery,
    'cooking_class': scene_cooking_class, 'village_trail': scene_village_trail, 'solar_ev': scene_solar_ev,
    'bamboo_bike': scene_bamboo_bike,
}
CATEGORY_SCENES = {
    'luxury': scene_cabana, 'nature': scene_birdwatching, 'adventure': scene_sunrise_trek,
    'wellness': scene_waterfall_yoga, 'culture': scene_village_trail, 'sustainability': scene_solar_ev,
    'default': scene_default,
}


def main():
    for folder in (OUT_EXP, OUT_CAT):
        os.makedirs(folder, exist_ok=True)
    for name, fn in EXPERIENCE_SCENES.items():
        with open(os.path.join(OUT_EXP, f'{name}.svg'), 'w', encoding='utf-8') as fh:
            fh.write(fn().render())
    for name, fn in CATEGORY_SCENES.items():
        with open(os.path.join(OUT_CAT, f'{name}.svg'), 'w', encoding='utf-8') as fh:
            fh.write(fn().render())
    with open(os.path.join(OUT_IMG, 'hero_resort.svg'), 'w', encoding='utf-8') as fh:
        fh.write(scene_hero().render())
    print(f'Wrote {len(EXPERIENCE_SCENES)} experience, {len(CATEGORY_SCENES)} category and 1 hero illustration(s).')


if __name__ == '__main__':
    main()
