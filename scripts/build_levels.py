#!/usr/bin/env python3
"""
Level Build Pipeline — Samarkand Mosaic
========================================
Roles fulfilled:
  1. Puzzle Segmentation Engineer  — slices master.png into exact tiles (no gap, no overlap)
  2. Game Asset Metadata Engineer  — writes manifest.json, level.json, placements.json
  3. Mobile Economy Designer       — embeds attempts/coins/hints into manifest.json

Grid config per level:
  Each grid is chosen so movable piece count matches the design spec.
  Lock strategies: 'rows' (L2-5) → top+bottom rows locked
                   'corners' (L6-10) → 4 corner tiles locked
                   'none' (L15-20) → all tiles movable

Run from project root:
  python3 scripts/build_levels.py
"""

import json
import math
import os
from PIL import Image

SIZE = 1200   # master.png is always 1200 × 1200 (divisible by 3,4,5,6)

# ── Level configurations ──────────────────────────────────────────────────────
#
# rows × cols = total tiles
# lock: determines locked slot set
# attempts: swap budget (swap budget formula: E[min_swaps] × difficulty_mult)
# coins: reward on completion
# hint_costs: escalating cost per hint used in this level

LEVELS = {
    2:  dict(rows=3, cols=3, lock='rows',    attempts=20,  coins=20,  hints_total=3),
    3:  dict(rows=3, cols=4, lock='rows',    attempts=26,  coins=25,  hints_total=3),
    4:  dict(rows=4, cols=4, lock='rows',    attempts=34,  coins=30,  hints_total=3),
    5:  dict(rows=4, cols=4, lock='rows',    attempts=42,  coins=40,  hints_total=3),
    6:  dict(rows=4, cols=4, lock='corners', attempts=30,  coins=50,  hints_total=3),
    7:  dict(rows=4, cols=5, lock='corners', attempts=42,  coins=60,  hints_total=3),
    8:  dict(rows=4, cols=5, lock='corners', attempts=52,  coins=70,  hints_total=3),
    10: dict(rows=5, cols=5, lock='corners', attempts=72,  coins=100, hints_total=3),
    15: dict(rows=5, cols=6, lock='none',    attempts=95,  coins=180, hints_total=3),
    20: dict(rows=6, cols=6, lock='none',    attempts=132, coins=300, hints_total=3),
}

# Escalating hint costs (same for all levels — economy rule from spec)
HINT_COSTS = [25, 40, 60, 90]

# ── Locked slot logic ─────────────────────────────────────────────────────────

def compute_locked_slots(rows, cols, lock):
    """
    Returns a list of (row, col) pairs that are locked.
    'rows':    top row + bottom row
    'corners': top-left, top-right, bottom-left, bottom-right
    'none':    empty
    """
    if lock == 'rows':
        locked = []
        for c in range(cols):
            locked.append((0, c))            # top row
            locked.append((rows - 1, c))     # bottom row
        return locked
    elif lock == 'corners':
        return [
            (0, 0), (0, cols - 1),
            (rows - 1, 0), (rows - 1, cols - 1),
        ]
    else:
        return []

# ── Tile slicing ──────────────────────────────────────────────────────────────

def slice_master(master_path, tiles_dir, rows, cols):
    """
    Slice master.png into rows×cols equal tiles.
    Each tile is exactly (SIZE//cols) × (SIZE//rows) pixels.
    No gap, no overlap, no scaling.
    Returns list of tile metadata dicts.
    """
    img = Image.open(master_path).convert('RGBA')
    W, H = img.size

    if W != SIZE or H != SIZE:
        raise ValueError(
            f"master.png must be {SIZE}×{SIZE}, got {W}×{H}: {master_path}"
        )

    tile_w = SIZE // cols
    tile_h = SIZE // rows

    # Verify exact fit — reject fractional tiles
    if tile_w * cols != SIZE or tile_h * rows != SIZE:
        raise ValueError(
            f"Grid {rows}×{cols} does not divide {SIZE}×{SIZE} evenly. "
            f"tile size would be {tile_w}×{tile_h}"
        )

    # Clear any stale tiles from previous runs before writing new ones
    import shutil
    if os.path.isdir(tiles_dir):
        shutil.rmtree(tiles_dir)
    os.makedirs(tiles_dir, exist_ok=True)
    tiles = []

    for row in range(rows):
        for col in range(cols):
            tile_id = row * cols + col + 1
            left   = col * tile_w
            top    = row * tile_h
            right  = left + tile_w
            bottom = top  + tile_h

            tile = img.crop((left, top, right, bottom))
            filename = f'tile_{tile_id:03d}.png'
            tile_path = os.path.join(tiles_dir, filename)
            tile.save(tile_path, 'PNG', optimize=False)

            tiles.append({
                'id':         tile_id,
                'image':      f'tiles/{filename}',
                'correctRow': row,
                'correctCol': col,
                'x':          left,
                'y':          top,
                'width':      tile_w,
                'height':     tile_h,
            })

    return tiles, tile_w, tile_h

# ── Metadata writers ──────────────────────────────────────────────────────────

def write_manifest(out_dir, rows, cols, tile_w, tile_h,
                   attempts, coins, hints_total):
    """
    manifest.json — read by SwapLevelLoader at load time.
    Contains grid geometry + economy data.
    """
    total = rows * cols
    manifest = {
        'rows':        rows,
        'cols':        cols,
        'tileCount':   total,
        'imageWidth':  SIZE,
        'imageHeight': SIZE,
        'tileWidth':   tile_w,
        'tileHeight':  tile_h,
        'economy': {
            'maxAttempts':  attempts,
            'coinReward':   coins,
            'hintsAllowed': hints_total,
            'hintCosts':    HINT_COSTS,
        },
    }
    path = os.path.join(out_dir, 'manifest.json')
    with open(path, 'w') as f:
        json.dump(manifest, f, indent=2)
    return manifest

def write_level_json(out_dir, tiles, locked_slots_rc):
    """
    level.json — tile definitions array.
    Each entry: id, image path, correctRow, correctCol, locked flag.
    locked_slots_rc is a set of (row, col) tuples.
    """
    locked_set = set(tuple(s) for s in locked_slots_rc)
    tile_defs = []
    for t in tiles:
        tile_defs.append({
            'id':         t['id'],
            'image':      t['image'],
            'correctRow': t['correctRow'],
            'correctCol': t['correctCol'],
            'locked':     (t['correctRow'], t['correctCol']) in locked_set,
        })

    level = {'tiles': tile_defs}
    path = os.path.join(out_dir, 'level.json')
    with open(path, 'w') as f:
        json.dump(level, f, indent=2)
    return level

def write_placements(out_dir, tiles):
    """
    placements.json — pixel-exact placement data for each tile.
    Used by debug reconstruction tools and the preview renderer.
    Guarantees that stacking all tiles at their (x, y) reconstructs master.png exactly.
    """
    placements = [
        {
            'id':     t['id'],
            'image':  t['image'],
            'x':      t['x'],
            'y':      t['y'],
            'width':  t['width'],
            'height': t['height'],
        }
        for t in tiles
    ]
    data = {
        'imageWidth':  SIZE,
        'imageHeight': SIZE,
        'tiles': placements,
    }
    path = os.path.join(out_dir, 'placements.json')
    with open(path, 'w') as f:
        json.dump(data, f, indent=2)
    return data

def write_reconstruction(out_dir, tiles, rows, cols):
    """
    debug_reconstruction.png — reassembles all tiles to verify no gaps/overlaps.
    Should be pixel-identical to master.png.
    """
    canvas = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    tiles_dir = os.path.join(out_dir, 'tiles')
    for t in tiles:
        tile_img = Image.open(os.path.join(out_dir, t['image'])).convert('RGBA')
        canvas.paste(tile_img, (t['x'], t['y']))
    path = os.path.join(out_dir, 'debug_reconstruction.png')
    canvas.save(path, 'PNG')
    return path

# ── QA checks ─────────────────────────────────────────────────────────────────

def verify_reconstruction(master_path, recon_path):
    """
    Compare master.png to debug_reconstruction.png pixel by pixel.
    Returns (passed, max_delta) — max_delta should be 0 for perfect reconstruction.
    """
    orig = Image.open(master_path).convert('RGBA')
    recon = Image.open(recon_path).convert('RGBA')

    if orig.size != recon.size:
        return False, 999

    import struct
    orig_bytes  = list(orig.getdata())
    recon_bytes = list(recon.getdata())

    max_delta = 0
    for o, r in zip(orig_bytes, recon_bytes):
        delta = max(abs(int(a) - int(b)) for a, b in zip(o, r))
        if delta > max_delta:
            max_delta = delta

    return max_delta == 0, max_delta

# ── Main pipeline ─────────────────────────────────────────────────────────────

def build_level(level_num, cfg, project_root):
    rows   = cfg['rows']
    cols   = cfg['cols']
    lock   = cfg['lock']

    level_dir   = os.path.join(project_root, 'src', 'assets', 'levels',
                               f'level-{level_num}')
    master_path = os.path.join(level_dir, 'master.png')
    tiles_dir   = os.path.join(level_dir, 'tiles')

    if not os.path.exists(master_path):
        return False, f"MISSING master.png"

    # 1. Slice tiles
    try:
        tiles, tile_w, tile_h = slice_master(master_path, tiles_dir, rows, cols)
    except ValueError as e:
        return False, str(e)

    # 2. Compute locked slots
    locked_rc = compute_locked_slots(rows, cols, lock)
    movable = rows * cols - len(locked_rc)

    # 3. Write metadata
    write_manifest(level_dir, rows, cols, tile_w, tile_h,
                   cfg['attempts'], cfg['coins'], cfg['hints_total'])
    write_level_json(level_dir, tiles, locked_rc)
    write_placements(level_dir, tiles)

    # 4. Reconstruction verify
    recon_path = write_reconstruction(level_dir, tiles, rows, cols)
    passed, max_delta = verify_reconstruction(master_path, recon_path)

    status = (
        f"{rows}×{cols}={rows*cols} tiles | {len(locked_rc)} locked | "
        f"{movable} movable | tile {tile_w}×{tile_h}px | "
        f"recon delta={max_delta}"
    )
    return passed, status


def main():
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    print("Samarkand Mosaic — Level Build Pipeline")
    print(f"Root: {project_root}\n")

    all_pass = True
    results = []

    for level_num, cfg in sorted(LEVELS.items()):
        passed, status = build_level(level_num, cfg, project_root)
        icon = '✓' if passed else '✗'
        print(f"  {icon} L{level_num:2d}  {status}")
        if not passed:
            all_pass = False
        results.append((level_num, passed, status))

    print()
    if all_pass:
        print("ALL LEVELS PASSED — assets are production ready.")
    else:
        print("FAILURES DETECTED — fix issues above before deploying.")

    return 0 if all_pass else 1


if __name__ == '__main__':
    exit(main())
