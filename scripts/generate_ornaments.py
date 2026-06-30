#!/usr/bin/env python3
"""
Timurid Ornament Generator — Samarkand Mosaic
=============================================
Generates mathematically precise SVG + PNG master ornaments
for puzzle levels 2, 3, 4, 5, 6, 8, 10, 15, 20.

Each ornament obeys:
  - Transparent background
  - 1200 × 1200 square canvas (divisible by 3, 4, 5, 6)
  - Centered design
  - Exact n-fold symmetry (no approximate rotations)
  - Timurid color palette only
  - Complexity scaling per level spec

Run from project root:
  python3 scripts/generate_ornaments.py

Output: src/assets/levels/level-{N}/master.svg
        src/assets/levels/level-{N}/master.png  (if cairosvg available)
"""

import math
import os
import sys

# ── Canvas ────────────────────────────────────────────────────────────────────

# 1200 = 2^4 × 3 × 5^2 → divisible by 3, 4, 5, 6 (all grid sizes used across levels)
SIZE = 1200
CX = CY = SIZE / 2  # 600.0

# ── Palette (mirrors src/constants/colors.ts) ────────────────────────────────

GOLD   = "#D4AF37"   # primary fill
DGOLD  = "#B8860B"   # stroke / outline
BLUE   = "#1F5FA8"   # secondary fill
IVORY  = "#F8F1E5"   # light accent
BRICK  = "#7B3F00"   # dark accent
SAND   = "#D2B48C"   # mid accent

# ── Geometry constants ────────────────────────────────────────────────────────
# inner/outer radius ratio for each star type.
# Derived from tan(π/n) — produces tightest arms before self-overlap.
# We add 0.08 slack to get wider, more readable arms for puzzle use.

R8  = math.tan(math.pi / 8)  + 0.08   # 8-star  ≈ 0.494
R10 = math.tan(math.pi / 10) + 0.08   # 10-star ≈ 0.405
R12 = math.tan(math.pi / 12) + 0.08   # 12-star ≈ 0.348
R16 = math.tan(math.pi / 16) + 0.08   # 16-star ≈ 0.277

def cosd(deg): return math.cos(math.radians(deg))
def sind(deg): return math.sin(math.radians(deg))

# ── Geometry builders ─────────────────────────────────────────────────────────

def star(n, R_out, R_in, rot=0.0, ox=CX, oy=CY):
    """
    n-pointed star polygon.
    Vertices alternate: outer (R_out) at arm tips, inner (R_in) at notches.
    rot = 0 places first arm pointing straight up (north).
    """
    pts = []
    for i in range(n * 2):
        a = i * 180.0 / n + rot - 90.0
        r = R_out if i % 2 == 0 else R_in
        pts.append((ox + r * cosd(a), oy + r * sind(a)))
    return pts

def ngon(n, R, rot=0.0, ox=CX, oy=CY):
    """Regular n-sided polygon."""
    return [(ox + R * cosd(i * 360.0 / n + rot - 90.0),
             oy + R * sind(i * 360.0 / n + rot - 90.0))
            for i in range(n)]

def notch_positions(n, R_in, rot_offset=None):
    """
    Return (x, y) for each concave notch of an n-pointed star
    centered at (CX, CY) with inner radius R_in.
    rot_offset = angular offset of first notch from -90° in trig space.
    Default: half-arm-angle (notch sits between arm 0 and arm 1).
    """
    half_arm = 180.0 / n                  # half the arm-to-arm angle
    offset = half_arm if rot_offset is None else rot_offset
    pts = []
    for i in range(n):
        a = -90.0 + offset + i * (360.0 / n)
        pts.append((CX + R_in * cosd(a), CY + R_in * sind(a)))
    return pts

def arm_tip_positions(n, R_out, rot_deg=-90.0):
    """Return (x, y) for each arm tip of an n-pointed star."""
    pts = []
    for i in range(n):
        a = rot_deg + i * (360.0 / n)
        pts.append((CX + R_out * cosd(a), CY + R_out * sind(a)))
    return pts

# ── SVG element builders ──────────────────────────────────────────────────────

def _pts(pts):
    return " ".join(f"{x:.2f},{y:.2f}" for x, y in pts)

def poly(pts, fill, sk=None, sw=3):
    s = f'<polygon points="{_pts(pts)}" fill="{fill}"'
    if sk:
        s += f' stroke="{sk}" stroke-width="{sw:.1f}" stroke-linejoin="miter"'
    return s + '/>\n'

def circ(r, fill, sk=None, sw=2, ox=CX, oy=CY):
    s = f'<circle cx="{ox:.2f}" cy="{oy:.2f}" r="{r:.2f}" fill="{fill}"'
    if sk:
        s += f' stroke="{sk}" stroke-width="{sw:.1f}"'
    return s + '/>\n'

def line(x1, y1, x2, y2, sk, sw=3):
    return (f'<line x1="{x1:.2f}" y1="{y1:.2f}" '
            f'x2="{x2:.2f}" y2="{y2:.2f}" '
            f'stroke="{sk}" stroke-width="{sw:.1f}"/>\n')

def svg_wrap(body, include_frame=True):
    """
    Wraps SVG body. include_frame=True prepends the structural_frame() which
    ensures corner/edge tiles always have visible content (never fully transparent).
    """
    frame = structural_frame() if include_frame else ''
    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {SIZE} {SIZE}">\n'
        + frame
        + body
        + '</svg>\n'
    )

# ── Structural frame (applied to ALL ornaments) ───────────────────────────────
#
# Every Timurid panel has a border frame. In puzzle terms this is also essential:
# it ensures every edge tile and corner tile contains visible content, preventing
# fully-transparent tiles which are unplayable.
#
# Corner quarter-medallions: 4-pointed star halves at each canvas corner.
# They extend CX/4 = 300px inward, ensuring corner tiles always have content.
# SVG viewBox clips the outside half — each corner shows a perfect quarter-star.

def structural_frame():
    """
    Two-layer border frame + 4 corner quarter-medallions.
    Drawn FIRST (bottom layer) so main ornament sits on top.
    """
    s = ''
    M = 18          # outer frame margin from canvas edge
    M2 = 34         # inner frame margin (creates classic Timurid double-border)

    # Outer frame line (dark gold)
    s += (f'<rect x="{M}" y="{M}" '
          f'width="{SIZE - 2*M}" height="{SIZE - 2*M}" '
          f'fill="none" stroke="{DGOLD}" stroke-width="7"/>\n')

    # Inner frame line (gold)
    s += (f'<rect x="{M2}" y="{M2}" '
          f'width="{SIZE - 2*M2}" height="{SIZE - 2*M2}" '
          f'fill="none" stroke="{GOLD}" stroke-width="3"/>\n')

    # Corner quarter-medallions: star(4, R, r) centered at each canvas corner.
    # Radius = 240 → extends well into the corner tile for any grid from 3×3 to 6×6.
    CORNER_R_OUT = 240
    CORNER_R_IN  = int(CORNER_R_OUT * 0.40)  # ~96
    for (cx, cy) in [(0, 0), (SIZE, 0), (0, SIZE), (SIZE, SIZE)]:
        pts = star(4, CORNER_R_OUT, CORNER_R_IN, 45.0, cx, cy)
        s += poly(pts, GOLD, DGOLD, 4)
        # Tiny center dot at each corner
        s += circ(28, IVORY, DGOLD, 2, cx, cy)

    return s

# ── Small reusable motifs ─────────────────────────────────────────────────────

def diamond(ox, oy, R=25, fill=IVORY, sk=DGOLD, sw=2):
    """4-pointed star (diamond shape) at custom center."""
    pts = star(4, R, R * 0.35, 0.0, ox, oy)
    return poly(pts, fill, sk, sw)

def hex_rosette(ox, oy, R=50, fill=BLUE, sk=DGOLD, sw=2):
    """Regular hexagon."""
    pts = ngon(6, R, 30.0, ox, oy)
    return poly(pts, fill, sk, sw)

# ── Level ornament generators ─────────────────────────────────────────────────

def ornament_L2():
    """
    Level 2 — "The First Star" (Hasht Par)
    Simple 8-pointed gold star. 3 layers. Tutorial object.
    Complexity: baseline.
    """
    Ro, Ri = 460, int(460 * R8)        # outer=460, inner≈227
    s = ''

    # Large gold star — fills most of canvas
    s += poly(star(8, Ro, Ri), GOLD, DGOLD, 5)

    # Blue octagonal center region
    s += poly(ngon(8, 118, 22.5), BLUE, DGOLD, 3)

    # Ivory center dot
    s += circ(36, IVORY)

    return svg_wrap(s)


def ornament_L3():
    """
    Level 3 — "The Star with Ring" (+15%)
    8-star + sandstone mid-ring + inner 8-star inside blue octagon.
    One additional geometric layer over L2.
    """
    Ro, Ri = 450, int(450 * R8)        # 450 / ~222
    s = ''

    # Outer gold star
    s += poly(star(8, Ro, Ri), GOLD, DGOLD, 5)

    # Sandstone octagonal intermediate ring
    s += poly(ngon(8, 172, 22.5), SAND, DGOLD, 3)

    # Blue octagon center zone
    s += poly(ngon(8, 105, 22.5), BLUE, DGOLD, 3)

    # Small inner gold 8-star
    s += poly(star(8, 82, int(82 * R8)), GOLD, DGOLD, 2)

    # Ivory center
    s += circ(24, IVORY)

    return svg_wrap(s)


def ornament_L4():
    """
    Level 4 — "The Star with Notch Diamonds" (+15%)
    L3 base + 8 ivory diamond accents at the concave notch positions.
    Notch diamonds teach players that negative space has geometry.
    """
    Ro, Ri = 440, int(440 * R8)        # 440 / ~218
    s = ''

    # Outer gold star
    s += poly(star(8, Ro, Ri), GOLD, DGOLD, 5)

    # 8 ivory diamond stars at each concave notch (inner vertex positions)
    for (px, py) in notch_positions(8, Ri):
        s += diamond(px, py, 30, IVORY, DGOLD, 2)

    # Sandstone ring
    s += poly(ngon(8, 172, 22.5), SAND, DGOLD, 3)

    # Blue center octagon
    s += poly(ngon(8, 105, 22.5), BLUE, DGOLD, 3)

    # Inner gold 8-star
    s += poly(star(8, 82, int(82 * R8)), GOLD, DGOLD, 2)

    # Small sandstone octagon detail
    s += poly(ngon(8, 45, 22.5), SAND, DGOLD, 2)

    # Ivory center
    s += circ(20, IVORY)

    return svg_wrap(s)


def ornament_L5():
    """
    Level 5 — "The Full Medallion" (+15%)
    L4 + small blue squares at arm tips + concentric circle detail.
    Completes the "classic Timurid medallion" form.
    """
    Ro, Ri = 430, int(430 * R8)        # 430 / ~213
    s = ''

    # Outer gold star
    s += poly(star(8, Ro, Ri), GOLD, DGOLD, 5)

    # 8 ivory notch diamonds
    for (px, py) in notch_positions(8, Ri):
        s += diamond(px, py, 32, IVORY, DGOLD, 2)

    # 8 small blue squares at arm-tip midpoints (halfway between tip and inner ring)
    R_mid = (Ro + Ri) // 2             # ~321
    for (px, py) in arm_tip_positions(8, R_mid):
        s += poly(ngon(4, 22, 45.0, px, py), BLUE, DGOLD, 2)

    # Sandstone ring
    s += poly(ngon(8, 175, 22.5), SAND, DGOLD, 3)

    # Blue octagon center
    s += poly(ngon(8, 110, 22.5), BLUE, DGOLD, 3)

    # Inner gold 8-star
    s += poly(star(8, 86, int(86 * R8)), GOLD, DGOLD, 2)

    # Sandstone concentric circle
    s += circ(52, SAND, DGOLD, 2)

    # Ivory center
    s += circ(28, IVORY)

    return svg_wrap(s)


def ornament_L6():
    """
    Level 6 — "The Girih Star" (+20%)
    10-pointed star. Phase shift from 8-fold to 5-fold symmetry.
    Deliberately smaller inner-to-outer ratio: arms appear thinner, more exotic.
    """
    Ro, Ri = 460, int(460 * R10)       # 460 / ~186
    s = ''

    # 10-pointed gold star
    s += poly(star(10, Ro, Ri), GOLD, DGOLD, 5)

    # 10 ivory diamonds at notch positions
    for (px, py) in notch_positions(10, Ri):
        s += diamond(px, py, 28, IVORY, DGOLD, 2)

    # Blue inner decagon (10-sided center)
    s += poly(ngon(10, 132, 18.0), BLUE, DGOLD, 3)

    # Inner gold 10-star
    s += poly(star(10, 105, int(105 * R10)), GOLD, DGOLD, 2)

    # Ivory center
    s += circ(36, IVORY)

    return svg_wrap(s)


def ornament_L7():
    """
    Level 7 — "The Adorned Star" (+22%)
    10-star + ivory notch diamonds + small blue squares at arm-tip midpoints
    + sandstone concentric ring inside. More layered than L6, still single focal.
    """
    Ro, Ri = 460, int(460 * R10)       # same star as L6
    s = ''

    # 10-pointed gold star
    s += poly(star(10, Ro, Ri), GOLD, DGOLD, 5)

    # 10 ivory diamonds at notch positions (larger than L6's 28 → 32)
    for (px, py) in notch_positions(10, Ri):
        s += diamond(px, py, 32, IVORY, DGOLD, 2)

    # 10 small blue squares at arm-tip midpoints (NEW vs L6)
    R_mid = (Ro + Ri) // 2             # halfway along arm
    for (px, py) in arm_tip_positions(10, R_mid):
        s += poly(ngon(4, 20, 45.0, px, py), BLUE, DGOLD, 2)

    # Sandstone outer ring (decagon, same as L6)
    s += poly(ngon(10, 132, 18.0), SAND, DGOLD, 3)

    # Blue inner decagon
    s += poly(ngon(10, 95, 18.0), BLUE, DGOLD, 3)

    # Inner gold 10-star
    s += poly(star(10, 76, int(76 * R10)), GOLD, DGOLD, 2)

    # Sandstone concentric ring (NEW vs L6)
    s += circ(46, SAND, DGOLD, 2)

    # Ivory center
    s += circ(26, IVORY)

    return svg_wrap(s)


def ornament_L8():
    """
    Level 8 — "The Girih Medallion" (+25%)
    10-star + 10 sandstone pentagon petals in the gaps between arms
    + richer inner mandala. First ornament where background fills with shapes.
    """
    Ro, Ri = 430, int(430 * R10)       # 430 / ~174
    s = ''

    # 10-pointed gold star
    s += poly(star(10, Ro, Ri), GOLD, DGOLD, 5)

    # 10 sandstone pentagons in the gap zones (centered just outside inner radius)
    # They float in the concave notch areas between arms.
    for (px, py) in notch_positions(10, Ri + 50):
        # Pentagon: 5-gon, one vertex pointing toward center
        # Direction from (px,py) to center: atan2(CY-py, CX-px)
        angle_to_center = math.degrees(math.atan2(CY - py, CX - px))
        # Orient pentagon with a vertex facing center → rot = angle_to_center + 90
        pent_rot = angle_to_center + 90.0
        s += poly(ngon(5, 60, pent_rot, px, py), SAND, DGOLD, 3)

    # 10 small ivory diamonds at the actual notch positions (inside pentagons)
    for (px, py) in notch_positions(10, Ri - 18):
        s += diamond(px, py, 22, IVORY, DGOLD, 2)

    # Blue inner decagon
    s += poly(ngon(10, 148, 18.0), BLUE, DGOLD, 3)

    # Inner gold 10-star
    s += poly(star(10, 118, int(118 * R10)), GOLD, DGOLD, 2)

    # Sandstone small decagon
    s += poly(ngon(10, 62, 18.0), SAND, DGOLD, 2)

    # Ivory center
    s += circ(30, IVORY)

    return svg_wrap(s)


def ornament_L10():
    """
    Level 10 — "The Twelve Spires" (+30%)
    12-pointed star + 12 accent diamonds in both notch and arm positions
    + double concentric inner rings. Maximum density within single medallion form.
    """
    Ro, Ri = 450, int(450 * R12)       # 450 / ~157
    s = ''

    # 12-pointed gold star
    s += poly(star(12, Ro, Ri), GOLD, DGOLD, 5)

    # 12 ivory diamonds at notch positions (between arms)
    for (px, py) in notch_positions(12, Ri):
        s += diamond(px, py, 24, IVORY, DGOLD, 2)

    # 12 small blue diamonds at arm mid-points
    R_mid = int((Ro + Ri) * 0.5)       # halfway point on arm
    for (px, py) in arm_tip_positions(12, R_mid, rot_deg=-90.0):
        s += diamond(px, py, 18, BLUE, DGOLD, 2)

    # Sandstone dodecagonal outer ring
    s += poly(ngon(12, 188, 15.0), SAND, DGOLD, 3)

    # Blue inner dodecagon
    s += poly(ngon(12, 122, 15.0), BLUE, DGOLD, 3)

    # Inner gold 12-star
    s += poly(star(12, 98, int(98 * R12)), GOLD, DGOLD, 2)

    # Sandstone concentric circle
    s += circ(60, SAND, DGOLD, 2)

    # Ivory inner circle
    s += circ(38, IVORY, DGOLD, 2)

    # Gold center dot
    s += circ(18, GOLD)

    return svg_wrap(s)


def ornament_L15():
    """
    Level 15 — "The Constellation" (+40%)
    Central 8-star + 4 satellite 6-stars at N/E/S/W
    + 4 corner 4-stars + connecting band lines.
    First multi-focal composition — player must solve multiple sub-regions.
    """
    # Central star (smaller, makes room for satellites)
    C_Ro, C_Ri = 260, int(260 * R8)   # 260 / ~129
    # Satellite position: 8-star satellite at each cardinal direction
    SAT_R = 330                        # distance from center to satellite center
    SAT_Ro, SAT_Ri = 115, int(115 * math.tan(math.pi / 6) * 0.80)  # 6-pointed

    s = ''

    # ── Connecting band lines (drawn UNDER everything else) ──
    for i in range(4):
        a = -90.0 + i * 90.0
        # From central inner radius to just outside satellite inner radius
        x1 = CX + C_Ri * cosd(a)
        y1 = CY + C_Ri * sind(a)
        x2 = CX + (SAT_R - SAT_Ro - 8) * cosd(a)
        y2 = CY + (SAT_R - SAT_Ro - 8) * sind(a)
        s += line(x1, y1, x2, y2, GOLD, 22)
        # Dark gold edge lines on each side of the band
        offset = 14
        ox = offset * cosd(a + 90)
        oy = offset * sind(a + 90)
        s += line(x1 + ox, y1 + oy, x2 + ox, y2 + oy, DGOLD, 4)
        s += line(x1 - ox, y1 - oy, x2 - ox, y2 - oy, DGOLD, 4)

    # ── 4 corner 4-pointed stars ──
    CORNER_DIST = int(CX * 0.84)       # ~430 — near corner but inside canvas
    for i in range(4):
        a = -45.0 + i * 90.0
        px = CX + CORNER_DIST * cosd(a)
        py = CY + CORNER_DIST * sind(a)
        s += poly(star(4, 58, int(58 * 0.38), 0.0, px, py), SAND, DGOLD, 3)
        s += circ(14, IVORY, None, 0, px, py)

    # ── 4 satellite 6-pointed stars ──
    for i in range(4):
        a = -90.0 + i * 90.0
        px = CX + SAT_R * cosd(a)
        py = CY + SAT_R * sind(a)
        # 6-pointed star (hexagram) — two overlapping triangles
        s += poly(star(6, SAT_Ro, int(SAT_Ro * 0.50), 0.0, px, py), GOLD, DGOLD, 4)
        # Blue hexagonal center in each satellite
        s += poly(ngon(6, int(SAT_Ro * 0.38), 30.0, px, py), BLUE, DGOLD, 2)
        s += circ(10, IVORY, None, 0, px, py)

    # ── Central 8-star ──
    s += poly(star(8, C_Ro, C_Ri), GOLD, DGOLD, 5)

    # 8 notch diamonds on central star
    for (px, py) in notch_positions(8, C_Ri):
        s += diamond(px, py, 22, IVORY, DGOLD, 2)

    # Central medallion rings
    s += poly(ngon(8, 115, 22.5), SAND, DGOLD, 3)
    s += poly(ngon(8, 72,  22.5), BLUE, DGOLD, 3)
    s += poly(star(8, 55, int(55 * R8)), GOLD, DGOLD, 2)
    s += circ(20, IVORY)

    return svg_wrap(s)


def ornament_L20():
    """
    Level 20 — "The Eternal Knot" (+50%)
    Nested multi-scale star system: 16-star + 12-star + 8-star + 6-star.
    Gold on transparent. Maximum local tile similarity = maximum difficulty.
    The dark game background creates the depth between star layers.
    """
    s = ''

    # ── Layer 1: Outer 16-pointed star (very sharp arms) ──
    Ro16, Ri16 = 490, int(490 * R16)  # 490 / ~136
    s += poly(star(16, Ro16, Ri16), GOLD, DGOLD, 5)

    # 16 ivory diamonds at 16-star notches
    for (px, py) in notch_positions(16, Ri16):
        s += diamond(px, py, 16, IVORY, DGOLD, 2)

    # ── Layer 2: 12-pointed blue star (rotated 15° for interlocking) ──
    Ro12, Ri12 = 350, int(350 * R12)  # 350 / ~122
    s += poly(star(12, Ro12, Ri12, 15.0), BLUE, DGOLD, 4)

    # 12 sand diamonds at 12-star notches
    for (px, py) in notch_positions(12, Ri12, rot_offset=15.0 + 15.0):
        s += diamond(px, py, 14, SAND, DGOLD, 2)

    # ── Layer 3: 8-pointed gold star (rotated 22.5° for interlocking) ──
    Ro8, Ri8 = 228, int(228 * R8)     # 228 / ~113
    s += poly(star(8, Ro8, Ri8, 22.5), GOLD, DGOLD, 4)

    # ── Layer 4: 6-pointed blue star (innermost) ──
    Ro6 = 135
    Ri6 = int(Ro6 * 0.50)             # ~67
    s += poly(star(6, Ro6, Ri6, 30.0), BLUE, DGOLD, 3)

    # ── Center ──
    s += poly(ngon(12, 68, 15.0), SAND, DGOLD, 2)
    s += circ(32, IVORY, DGOLD, 2)

    return svg_wrap(s)


# ── Output ────────────────────────────────────────────────────────────────────

LEVELS = {
    2:  ornament_L2,
    3:  ornament_L3,
    4:  ornament_L4,
    5:  ornament_L5,
    6:  ornament_L6,
    7:  ornament_L7,
    8:  ornament_L8,
    10: ornament_L10,
    15: ornament_L15,
    20: ornament_L20,
}


def main():
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    print(f"Samarkand Mosaic — Ornament Generator")
    print(f"Project root: {project_root}\n")

    # Try to import cairosvg for SVG→PNG conversion
    try:
        import cairosvg
        has_cairo = True
    except ImportError:
        has_cairo = False

    # Try PIL as fallback renderer (via Wand or rsvg-convert)
    # We'll just save SVG and note PNG needs separate conversion

    for level_num, fn in sorted(LEVELS.items()):
        out_dir = os.path.join(
            project_root, 'src', 'assets', 'levels', f'level-{level_num}'
        )
        os.makedirs(out_dir, exist_ok=True)

        svg_content = fn()

        # Write SVG
        svg_path = os.path.join(out_dir, 'master.svg')
        with open(svg_path, 'w', encoding='utf-8') as f:
            f.write(svg_content)

        # Convert to PNG if cairosvg available
        png_path = os.path.join(out_dir, 'master.png')
        if has_cairo:
            cairosvg.svg2png(
                bytestring=svg_content.encode('utf-8'),
                write_to=png_path,
                output_width=SIZE,
                output_height=SIZE,
            )
            print(f"  ✓ Level {level_num:2d}  master.svg  master.png")
        else:
            print(f"  ✓ Level {level_num:2d}  master.svg  (no cairosvg — PNG skipped)")

    print()
    if not has_cairo:
        print("To convert SVG→PNG, install cairosvg:")
        print("  pip install cairosvg")
        print("Then re-run this script, or use Inkscape:")
        print("  for f in src/assets/levels/*/master.svg; do")
        print("    inkscape \"$f\" --export-filename=\"${f%.svg}.png\"")
        print("  done")
    print("\nDone.")


if __name__ == '__main__':
    main()
