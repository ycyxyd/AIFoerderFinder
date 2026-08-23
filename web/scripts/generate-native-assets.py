"""Generate native launcher icons (Android + iOS) for FörderFinder.

Reuses the brand design from public/icon.svg: teal (#0f766e) rounded rect,
white growth-chart polyline, amber (#fbbf24) endpoint dot.

Run:  uv run --with pillow python scripts/generate-native-assets.py
"""
import os
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RES = os.path.join(ROOT, 'android', 'app', 'src', 'main', 'res')
IOS_ICONSET = os.path.join(ROOT, 'ios', 'App', 'App', 'Assets.xcassets', 'AppIcon.appiconset')

TEAL = (15, 118, 110, 255)      # #0f766e
WHITE = (255, 255, 255, 255)
AMBER = (251, 191, 36, 255)     # #fbbf24
TRANSPARENT = (0, 0, 0, 0)

# Original motif coordinates in a 512 viewBox (from icon.svg)
MOTIF = [(140, 300), (196, 220), (248, 268), (308, 160), (372, 240)]
SRC_CX = sum(p[0] for p in MOTIF) / len(MOTIF)
SRC_CY = sum(p[1] for p in MOTIF) / len(MOTIF)


def draw_motif(d, size, scale, cx=None, cy=None):
    cx = size / 2 if cx is None else cx
    cy = size / 2 if cy is None else cy
    pts = [(cx + (x - SRC_CX) * scale, cy + (y - SRC_CY) * scale) for (x, y) in MOTIF]
    lw = max(2, int(36 / 512 * size * scale))
    d.line(pts, fill=WHITE, width=lw, joint='curve')
    ex, ey = pts[-1]
    r = max(2, int(18 / 512 * size * scale))
    d.ellipse([ex - r, ey - r, ex + r, ey + r], fill=AMBER)


def full_icon(size):
    """Rounded teal square + motif (launcher / iOS icon)."""
    img = Image.new('RGBA', (size, size), TRANSPARENT)
    d = ImageDraw.Draw(img)
    radius = int(size * 96 / 512)
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=TEAL)
    draw_motif(d, size, scale=1.0)
    return img


def foreground(size):
    """Transparent canvas, motif centred in the adaptive-icon safe zone."""
    img = Image.new('RGBA', (size, size), TRANSPARENT)
    d = ImageDraw.Draw(img)
    draw_motif(d, size, scale=0.62)  # ~55-60% keeps it inside the 66% safe zone
    return img


def save(img, path):
    img.save(path)
    print(f'  {os.path.relpath(path, ROOT)}  {img.size}')


def main():
    # --- Android launcher icons (traditional mipmaps) ---
    sizes = {'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}
    for density, px in sizes.items():
        d = os.path.join(RES, f'mipmap-{density}')
        save(full_icon(px), os.path.join(d, 'ic_launcher.png'))
        save(full_icon(px), os.path.join(d, 'ic_launcher_round.png'))

    # --- Android adaptive-icon foregrounds (108dp canvas) ---
    fg_sizes = {'mdpi': 108, 'hdpi': 162, 'xhdpi': 216, 'xxhdpi': 324, 'xxxhdpi': 432}
    for density, px in fg_sizes.items():
        d = os.path.join(RES, f'mipmap-{density}')
        save(foreground(px), os.path.join(d, 'ic_launcher_foreground.png'))

    # --- iOS AppIcon (Capacitor 8: single 1024 universal icon) ---
    os.makedirs(IOS_ICONSET, exist_ok=True)
    save(full_icon(1024), os.path.join(IOS_ICONSET, 'AppIcon-512@2x.png'))

    print('Done.')


if __name__ == '__main__':
    main()
