#!/usr/bin/env python3
"""
Inject economy blocks into all level manifests that are missing them.
Also adds tileWidth/tileHeight derived from actual master dimensions.

Run from project root:
  python3 scripts/add_economy.py
"""

import json
import math
import os
import sys

from PIL import Image

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LEVELS_DIR   = os.path.join(PROJECT_ROOT, 'src', 'assets', 'levels')

HINT_COSTS = [25, 40, 60, 90]

# Economy values per level, sized so maxAttempts > E[min_swaps] for each grid.
# E[min_swaps] ≈ movable * ln(movable) / 2  (all tiles movable in vision-pipeline levels)
# L2-L6: 28 tiles, E[min]≈46  → use 60
# L7-L10: 30 tiles, E[min]≈51 → use 70
ECONOMY: dict[int, dict] = {
    # L2-L6: 28 tiles, E[min_swaps]≈46, threshold for no-warn = 1.5×46 = 69 → use 75
    2:  dict(maxAttempts=75,  coinReward=20,  hintsAllowed=3, hintCosts=HINT_COSTS),
    3:  dict(maxAttempts=75,  coinReward=25,  hintsAllowed=3, hintCosts=HINT_COSTS),
    4:  dict(maxAttempts=75,  coinReward=30,  hintsAllowed=3, hintCosts=HINT_COSTS),
    5:  dict(maxAttempts=75,  coinReward=40,  hintsAllowed=3, hintCosts=HINT_COSTS),
    6:  dict(maxAttempts=75,  coinReward=50,  hintsAllowed=3, hintCosts=HINT_COSTS),
    # L7-L10: 30 tiles, E[min_swaps]≈51, threshold = 1.5×51 = 76.5 → use 80
    7:  dict(maxAttempts=80,  coinReward=60,  hintsAllowed=3, hintCosts=HINT_COSTS),
    8:  dict(maxAttempts=80,  coinReward=70,  hintsAllowed=3, hintCosts=HINT_COSTS),
    9:  dict(maxAttempts=85,  coinReward=80,  hintsAllowed=3, hintCosts=HINT_COSTS),
    10: dict(maxAttempts=85,  coinReward=100, hintsAllowed=3, hintCosts=HINT_COSTS),
}


def process_level(level_num: int) -> bool:
    level_dir = os.path.join(LEVELS_DIR, f'level-{level_num}')
    mf_path   = os.path.join(level_dir, 'manifest.json')
    master_path = os.path.join(level_dir, 'master.png')

    if not os.path.exists(mf_path):
        print(f"  L{level_num}: SKIP — manifest.json not found")
        return False

    mf = json.load(open(mf_path, encoding='utf-8'))

    changed = False

    # Add economy block if missing
    if 'economy' not in mf:
        eco = ECONOMY.get(level_num)
        if eco is None:
            print(f"  L{level_num}: SKIP — no economy spec defined")
            return False
        mf['economy'] = eco
        changed = True
        print(f"  L{level_num}: added economy (maxAttempts={eco['maxAttempts']}, coins={eco['coinReward']})")
    else:
        print(f"  L{level_num}: economy already present — skipping")

    # Add tileWidth / tileHeight derived from actual master dimensions if missing
    if 'tileWidth' not in mf or 'tileHeight' not in mf:
        if os.path.exists(master_path):
            img = Image.open(master_path)
            img_w, img_h = img.size
            rows = mf.get('rows', 0)
            cols = mf.get('cols', 0)
            if rows and cols:
                tile_w = img_w // cols
                tile_h = img_h // rows
                mf['tileWidth']  = tile_w
                mf['tileHeight'] = tile_h
                changed = True
                print(f"  L{level_num}: added tileWidth={tile_w} tileHeight={tile_h}")

    if changed:
        with open(mf_path, 'w', encoding='utf-8') as f:
            json.dump(mf, f, indent=2, ensure_ascii=False)
            f.write('\n')

    return True


def main():
    print("Samarkand Mosaic — Economy Injector")
    print(f"Levels dir: {LEVELS_DIR}\n")

    for num in sorted(ECONOMY.keys()):
        process_level(num)

    print("\nDone. Run python3 scripts/qa_levels.py to verify.")


if __name__ == '__main__':
    main()
