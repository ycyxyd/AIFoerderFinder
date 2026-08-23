"""Generate FörderFinder brand icon sources (1024x1024) for @capacitor/assets.

Matches public/icon.svg: teal (#0f766e) rounded rect, white growth-chart
polyline, amber (#fbbf24) endpoint dot. Outputs to web/assets/.
"""
import os
from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(__file__), '..', 'assets')
os.makedirs(OUT, exist_ok=True)

TEAL = (15, 118, 110, 255)      # #0f766e
WHITE = (255, 255, 255, 255)
AMBER = (251, 191, 36, 255)     # #fbbf24
TRANSPARENT = (0, 0, 0, 0)

S = 1024
R = 192  # rounded-corner radius (96/512 in the SVG -> 192/1024)


def rounded_icon():
    """Full icon: teal rounded rect + white motif (used as icon-only)."""
    img = Image.new('RGBA', (S, S), TRANSPARENT)
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, S - 1, S - 1], radius=R, fill=TEAL)
    draw_motif(d, scale=1.0)
    return img


def foreground():
    """Adaptive-icon foreground: motif only, transparent bg, safe-zone centred."""
    img = Image.new('RGBA', (S, S), TRANSPARENT)
    d = ImageDraw.Draw(img)
    # Safe zone is ~66% of the canvas: shrink motif to ~55% and centre it.
    draw_motif(d, scale=0.62, cx=S / 2, cy=S / 2)
    return img


def background():
    img = Image.new('RGBA', (S, S), TEAL)
    return img


def draw_motif(d, scale=1.0, cx=None, cy=None):
    """Growth-chart polyline + amber dot, scaled around (cx, cy)."""
    cx = S / 2 if cx is None else cx
    cy = S / 2 if cy is None else cy
    pts = [(140, 300), (196, 220), (248, 268), (308, 160), (372, 240)]
    # Recenter around canvas middle and scale
    src_cx = sum(p[0] for p in pts) / len(pts)
    src_cy = sum(p[1] for p in pts) / len(pts)
    pts = [
        (cx + (x - src_cx) * scale, cy + (y - src_cy) * scale)
        for (x, y) in pts
    ]
    lw = max(6, int(36 * scale))          # stroke width 36/512 -> scaled
    d.line(pts, fill=WHITE, width=lw, joint='curve')
    ex, ey = pts[-1]
    r = max(6, int(18 * scale))           # dot radius 18/512 -> scaled
    d.ellipse([ex - r, ey - r, ex + r, ey + r], fill=AMBER)


def splash():
    """Solid teal splash canvas (2732x2732) with centred motif."""
    img = Image.new('RGBA', (2732, 2732), TEAL)
    d = ImageDraw.Draw(img)
    draw_motif(d, scale=3.4)
    return img


rounded_icon().save(os.path.join(OUT, 'icon-only.png'))
foreground().save(os.path.join(OUT, 'icon-foreground.png'))
background().save(os.path.join(OUT, 'icon-background.png'))
splash().save(os.path.join(OUT, 'splash.png'))
print('Generated:', sorted(os.listdir(OUT)))
