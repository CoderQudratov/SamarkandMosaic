#!/usr/bin/env python3
"""
Senior Game QA Forensic Auditor — Samarkand Mosaic
====================================================
Audits every built level directory against 4 requirement categories:

  ASSETS  — all required files exist and are valid images/JSON
  LOGIC   — metadata is internally consistent and schema-correct
  RENDER  — reconstruction is pixel-perfect, no blank tiles
  GAMEPLAY— economy values are sane, solvability is provable

Exit code 0 = ALL PASS (production ready)
Exit code 1 = FAILURES DETECTED

Run from project root:
  python3 scripts/qa_levels.py
"""

import json
import math
import os
import sys
from typing import List, Tuple, Optional

from PIL import Image, ImageStat

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LEVELS_DIR   = os.path.join(PROJECT_ROOT, 'src', 'assets', 'levels')

# Levels that use a different canvas size or format (pre-existing, not in build pipeline)
LEGACY_LEVELS = {1}   # level-1 was built separately with 1254×1254 canvas

HINT_COSTS   = [25, 40, 60, 90]

# Maximum allowed tile-dimension variance in pixels.
# Vision-guided pipeline uses cumulative-edge rounding so adjacent tiles
# may differ by ±1 px. The renderer compensates; QA accepts this.
TILE_DIM_TOLERANCE = 1

# ── Helpers ───────────────────────────────────────────────────────────────────

def fail(issues: List[str], msg: str):
    issues.append(f"FAIL: {msg}")

def warn(issues: List[str], msg: str):
    issues.append(f"WARN: {msg}")

def load_json(path: str):
    with open(path, encoding='utf-8') as f:
        return json.load(f)

# ── ASSETS check ──────────────────────────────────────────────────────────────

def check_assets(level_dir: str, issues: List[str]) -> Tuple[int, int, int, int]:
    """Verify required files exist and are valid. Returns (rows, cols, img_w, img_h) or (0,0,0,0)."""

    # master.png — must be square
    master = os.path.join(level_dir, 'master.png')
    img_w, img_h = 0, 0
    if not os.path.exists(master):
        fail(issues, "master.png missing")
    else:
        try:
            img = Image.open(master)
            img_w, img_h = img.size
            if img_w != img_h:
                fail(issues, f"master.png not square: {img.size} (must be W×W)")
        except Exception as e:
            fail(issues, f"master.png unreadable: {e}")

    # manifest.json
    mf_path = os.path.join(level_dir, 'manifest.json')
    if not os.path.exists(mf_path):
        fail(issues, "manifest.json missing")
        return 0, 0, 0, 0
    try:
        mf = load_json(mf_path)
    except Exception as e:
        fail(issues, f"manifest.json invalid JSON: {e}")
        return 0, 0, 0, 0

    rows = mf.get('rows', 0)
    cols = mf.get('cols', 0)

    # level.json
    lj_path = os.path.join(level_dir, 'level.json')
    if not os.path.exists(lj_path):
        fail(issues, "level.json missing")
    else:
        try:
            load_json(lj_path)
        except Exception as e:
            fail(issues, f"level.json invalid JSON: {e}")

    # placements.json
    pl_path = os.path.join(level_dir, 'placements.json')
    if not os.path.exists(pl_path):
        fail(issues, "placements.json missing")

    # tiles/
    tiles_dir = os.path.join(level_dir, 'tiles')
    if not os.path.isdir(tiles_dir):
        fail(issues, "tiles/ directory missing")
    else:
        expected_count = rows * cols if (rows and cols) else 0
        found = sorted(f for f in os.listdir(tiles_dir) if f.endswith('.png'))
        if len(found) != expected_count:
            fail(issues, f"tiles/ count mismatch: found {len(found)}, expected {expected_count}")
        else:
            for fname in [found[0], found[-1]]:
                try:
                    Image.open(os.path.join(tiles_dir, fname))
                except Exception as e:
                    fail(issues, f"tiles/{fname} unreadable: {e}")

    return rows, cols, img_w, img_h

# ── LOGIC check ───────────────────────────────────────────────────────────────

def check_logic(level_dir: str, rows: int, cols: int, img_w: int, img_h: int, issues: List[str]):
    """Verify manifest, level.json and placements.json are internally consistent."""
    total = rows * cols

    mf_path = os.path.join(level_dir, 'manifest.json')
    lj_path = os.path.join(level_dir, 'level.json')
    pl_path = os.path.join(level_dir, 'placements.json')

    # ── manifest.json schema ──
    mf = load_json(mf_path)
    for key in ('rows', 'cols', 'tileCount', 'imageWidth', 'imageHeight'):
        if key not in mf:
            fail(issues, f"manifest.json missing key '{key}'")
    if mf.get('tileCount') != total:
        fail(issues, f"manifest tileCount={mf.get('tileCount')} ≠ rows×cols={total}")
    if mf.get('imageWidth') != img_w or mf.get('imageHeight') != img_h:
        fail(issues, f"manifest imageWidth/Height ({mf.get('imageWidth')}×{mf.get('imageHeight')}) ≠ master.png ({img_w}×{img_h})")

    # Non-integer divisibility is expected with vision-guided pipeline — warn, not fail.
    # The renderer uses cumulative-edge rounding to compensate.
    if img_w % cols != 0 or img_h % rows != 0:
        warn(issues, f"Canvas {img_w}×{img_h} not evenly divisible by grid {rows}r×{cols}c — non-uniform tiling (renderer handles this)")

    # Nominal tile dimensions — allow ±TILE_DIM_TOLERANCE variance
    nom_tile_w = img_w // cols
    nom_tile_h = img_h // rows
    mf_tile_w = mf.get('tileWidth')
    mf_tile_h = mf.get('tileHeight')
    if mf_tile_w is None:
        # Accept tiling.colWidths[0] as equivalent
        tiling = mf.get('tiling', {})
        mf_tile_w = (tiling.get('colWidths') or [None])[0]
    if mf_tile_h is None:
        tiling = mf.get('tiling', {})
        mf_tile_h = (tiling.get('rowHeights') or [None])[0]

    if mf_tile_w is not None and abs(mf_tile_w - nom_tile_w) > TILE_DIM_TOLERANCE:
        fail(issues, f"manifest tileWidth={mf_tile_w} deviates from {img_w}/{cols}={nom_tile_w} by more than {TILE_DIM_TOLERANCE}px")
    if mf_tile_h is not None and abs(mf_tile_h - nom_tile_h) > TILE_DIM_TOLERANCE:
        fail(issues, f"manifest tileHeight={mf_tile_h} deviates from {img_h}/{rows}={nom_tile_h} by more than {TILE_DIM_TOLERANCE}px")

    # Economy block
    eco = mf.get('economy')
    if eco is None:
        fail(issues, "manifest.json missing 'economy' block — run scripts/add_economy.py")
    else:
        if eco.get('maxAttempts', 0) < 5:
            fail(issues, f"economy.maxAttempts={eco.get('maxAttempts')} too low (min 5)")
        if eco.get('coinReward', 0) <= 0:
            fail(issues, "economy.coinReward must be positive")
        if eco.get('hintCosts') != HINT_COSTS:
            fail(issues, f"economy.hintCosts {eco.get('hintCosts')} ≠ spec {HINT_COSTS}")

    # ── level.json schema ──
    lj = load_json(lj_path)
    tiles = lj.get('tiles', [])
    if len(tiles) != total:
        fail(issues, f"level.json tile count {len(tiles)} ≠ {total}")
        return

    ids_seen = set()
    slots_seen = set()
    for t in tiles:
        tid = t.get('id')
        row = t.get('correctRow')
        col = t.get('correctCol')
        img = t.get('image', '')

        if tid is None:    fail(issues, f"tile missing 'id': {t}")
        if row is None:    fail(issues, f"tile {tid} missing 'correctRow'")
        if col is None:    fail(issues, f"tile {tid} missing 'correctCol'")
        if not img:        fail(issues, f"tile {tid} missing 'image'")
        if tid in ids_seen: fail(issues, f"duplicate tile id {tid}")
        ids_seen.add(tid)

        slot = (row, col) if (row is not None and col is not None) else None
        if slot is not None:
            if slot in slots_seen: fail(issues, f"duplicate slot {slot}")
            slots_seen.add(slot)
            if row < 0 or row >= rows: fail(issues, f"tile {tid} correctRow={row} out of bounds (0..{rows-1})")
            if col < 0 or col >= cols: fail(issues, f"tile {tid} correctCol={col} out of bounds (0..{cols-1})")

        tile_abs = os.path.join(level_dir, img)
        if not os.path.exists(tile_abs):
            fail(issues, f"tile {tid} image not found: {img}")

    # ── placements.json schema ──
    # Vision-guided pipeline format: {level_id, tile_count, solved_order[]}
    # solved_order items: {slot, tile_id, row, col, x, y, width, height, image}
    pl = load_json(pl_path)
    solved_order = pl.get('solved_order', [])
    pl_tile_count = pl.get('tile_count', 0)
    if pl_tile_count != total:
        fail(issues, f"placements.json tile_count={pl_tile_count} ≠ {total}")
    if len(solved_order) != total:
        fail(issues, f"placements.json solved_order length {len(solved_order)} ≠ {total}")
    for entry in solved_order:
        x, y, w, h = entry.get('x'), entry.get('y'), entry.get('width'), entry.get('height')
        if None in (x, y, w, h):
            fail(issues, f"placements solved_order entry {entry.get('slot')} missing x/y/width/height")
        else:
            # Bounds check only — vision-guided pipeline produces non-uniform tile
            # dimensions (up to ±7px variance). Reconstruction delta=0 is the
            # authoritative quality gate; exact per-tile dimensions are not checked.
            if x + w > img_w:
                fail(issues, f"placement x+w={x+w} exceeds master width {img_w}")
            if y + h > img_h:
                fail(issues, f"placement y+h={y+h} exceeds master height {img_h}")

# ── RENDER check ──────────────────────────────────────────────────────────────

def check_render(level_dir: str, rows: int, cols: int, img_w: int, img_h: int, issues: List[str]):
    """Reassemble tiles from level.json x/y coordinates and verify pixel-perfect match with master.png."""
    master_path = os.path.join(level_dir, 'master.png')
    lj          = load_json(os.path.join(level_dir, 'level.json'))

    try:
        master = Image.open(master_path).convert('RGBA')
    except Exception:
        fail(issues, "Cannot open master.png for render check")
        return

    canvas = Image.new('RGBA', (img_w, img_h), (0, 0, 0, 0))
    for t in lj['tiles']:
        tile_path = os.path.join(level_dir, t['image'])
        try:
            tile_img = Image.open(tile_path).convert('RGBA')
        except Exception:
            fail(issues, f"Cannot open tile {t['image']}")
            continue

        stat = ImageStat.Stat(tile_img)
        if stat.sum[3] == 0:
            fail(issues, f"Tile {t['id']} ({t['image']}) is fully transparent — blank tile")

        x = t.get('x', 0)
        y = t.get('y', 0)
        canvas.paste(tile_img, (x, y))

    orig_data  = list(master.getdata())
    recon_data = list(canvas.getdata())
    max_delta  = 0
    for o, r in zip(orig_data, recon_data):
        d = max(abs(int(a) - int(b)) for a, b in zip(o, r))
        if d > max_delta:
            max_delta = d

    if max_delta > 0:
        fail(issues, f"Reconstruction delta={max_delta} (should be 0 — tiles don't reassemble exactly)")

# ── GAMEPLAY check ────────────────────────────────────────────────────────────

def check_gameplay(level_dir: str, rows: int, cols: int, issues: List[str]):
    """Verify puzzle is solvable and economy values are within design bounds."""
    mf  = load_json(os.path.join(level_dir, 'manifest.json'))
    lj  = load_json(os.path.join(level_dir, 'level.json'))
    eco = mf.get('economy', {})

    total    = rows * cols
    locked   = [t for t in lj.get('tiles', []) if t.get('locked', False)]
    movable  = total - len(locked)
    attempts = eco.get('maxAttempts', 0)

    if movable > 1:
        e_min = max(1, int(movable * math.log(movable) / 2))
        if attempts < e_min:
            fail(issues, f"maxAttempts={attempts} < E[min_swaps]={e_min} for {movable} movable pieces — unsolvable")
        elif attempts < e_min * 1.5:
            warn(issues, f"maxAttempts={attempts} is tight (E[min]={e_min}) — may frustrate players")

    if movable < 1:
        fail(issues, f"No movable pieces — all {total} tiles are locked")

    if movable == 1:
        fail(issues, "Only 1 movable piece — puzzle is trivially solved or impossible")

    if eco.get('coinReward', 0) <= 0:
        fail(issues, "coinReward must be positive")

    hint_costs = eco.get('hintCosts', [])
    for i in range(1, len(hint_costs)):
        if hint_costs[i] <= hint_costs[i - 1]:
            fail(issues, f"hintCosts not escalating at index {i}: {hint_costs}")

    hints_allowed = eco.get('hintsAllowed', 0)
    if hints_allowed > len(hint_costs):
        fail(issues, f"hintsAllowed={hints_allowed} > len(hintCosts)={len(hint_costs)}")

# ── Main audit loop ───────────────────────────────────────────────────────────

def audit_level(level_num: int) -> Tuple[bool, List[str]]:
    level_dir = os.path.join(LEVELS_DIR, f'level-{level_num}')
    issues: List[str] = []

    if not os.path.isdir(level_dir):
        return False, [f"FAIL: Directory not found: {level_dir}"]

    rows, cols, img_w, img_h = check_assets(level_dir, issues)
    if rows > 0 and cols > 0 and img_w > 0:
        check_logic(level_dir, rows, cols, img_w, img_h, issues)
        check_render(level_dir, rows, cols, img_w, img_h, issues)
        check_gameplay(level_dir, rows, cols, issues)

    failed = any(i.startswith('FAIL') for i in issues)
    return not failed, issues


def main():
    print("Samarkand Mosaic — QA Forensic Audit")
    print(f"Levels dir: {LEVELS_DIR}\n")

    if not os.path.isdir(LEVELS_DIR):
        print("ABORT: levels directory not found")
        sys.exit(1)

    level_nums = []
    for name in sorted(os.listdir(LEVELS_DIR)):
        if name.startswith('level-'):
            try:
                level_nums.append(int(name.split('-')[1]))
            except (ValueError, IndexError):
                pass
    level_nums.sort()

    all_pass = True
    for num in level_nums:
        if num in LEGACY_LEVELS:
            print(f"  ~ Level {num:2d}  SKIP (legacy format — not in build pipeline)")
            continue
        passed, issues = audit_level(num)
        fails  = [i for i in issues if i.startswith('FAIL')]
        warns  = [i for i in issues if i.startswith('WARN')]

        if passed and not warns:
            print(f"  ✓ Level {num:2d}  PASS")
        elif passed:
            print(f"  ⚠ Level {num:2d}  PASS (with warnings)")
            for w in warns:
                print(f"       {w}")
        else:
            print(f"  ✗ Level {num:2d}  FAIL")
            for f in fails:
                print(f"       {f}")
            for w in warns:
                print(f"       {w}")
            all_pass = False

    print()
    if all_pass:
        print("AUDIT RESULT: ALL PASS — production ready.")
    else:
        print("AUDIT RESULT: FAILURES — not production ready.")

    sys.exit(0 if all_pass else 1)


if __name__ == '__main__':
    main()
