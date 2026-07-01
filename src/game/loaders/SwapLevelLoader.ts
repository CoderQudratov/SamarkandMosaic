// Dynamic level loader for the swap puzzle.
// Any level folder at /public/assets/levels/level-{id}/ is picked up automatically:
//   1. Try manifest.json (rich tiling info, optional)
//   2. Fall back to level.json (always present, tiles[] format)
//
// Drop a new level folder → loadLevel(id) works with zero code changes.

export interface LevelEconomy {
  maxAttempts: number;
  coinReward: number;
  hintsAllowed: number;
  hintCosts: number[];  // cost of 1st, 2nd, 3rd, 4th hint use in this level
}

export interface LevelManifest {
  rows: number;
  cols: number;
  tileCount: number;
  imageWidth: number;
  imageHeight: number;
  economy?: LevelEconomy;
  tiling?: {
    colEdges: number[];
    rowEdges: number[];
    colWidths: number[];
    rowHeights: number[];
  };
}

export interface LevelTile {
  id: number;
  image: string;
  correctRow: number;
  correctCol: number;
  locked?: boolean;  // authoritative from level.json — absence means "not specified"
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

export interface LoadedLevel {
  id: string;
  levelNum: number;
  manifest: LevelManifest;
  economy: LevelEconomy;
  tiles: LevelTile[];
  baseUrl: string;
  boardSrc: string;
  guideSrc: string | null;
  lockedSlots: Set<number>;
  tileImageMap: Record<number, string>;
  /**
   * Fully decoded tile images, keyed by tile id. Populated by the blocking
   * preload in loadLevel() before the promise resolves, so the board can paint
   * atomically from cache with no progressive pop-in. Holding the references
   * also keeps the decoded bitmaps from being evicted.
   */
  tileImages: Map<number, HTMLImageElement>;
  cacheBust: string;
}

// Default economy values when manifest.economy is absent (legacy levels)
const DEFAULT_ECONOMY: LevelEconomy = {
  maxAttempts:  30,
  coinReward:   20,
  hintsAllowed: 3,
  hintCosts:    [25, 40, 60, 90],
};

// Levels 1-4: top+bottom rows locked.
// Levels 5-8: corners only.
// Levels 9+: no locked slots.
export function detectLockedSlots(levelNum: number, rows: number, cols: number): Set<number> {
  const total = rows * cols;
  const locked = new Set<number>();
  if (levelNum <= 4) {
    for (let i = 0; i < cols; i++) locked.add(i);
    for (let i = total - cols; i < total; i++) locked.add(i);
  } else if (levelNum <= 8) {
    locked.add(0);
    locked.add(cols - 1);
    locked.add(total - cols);
    locked.add(total - 1);
  }
  return locked;
}

/**
 * Load AND decode a single image, resolving only once the bitmap is ready to
 * paint. Prefers HTMLImageElement.decode() (guarantees the next paint won't
 * block on decode); falls back to the onload event where decode() is missing.
 * Never hard-fails the level on a single bad asset — a broken tile resolves so
 * Promise.all can complete and the board still appears.
 */
async function preloadImage(url: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.decoding = 'async';
  img.src = url;
  try {
    if (typeof img.decode === 'function') {
      await img.decode();
      return img;
    }
  } catch {
    // decode() can reject spuriously on some browsers even when the bitmap is
    // usable; fall through to the onload path rather than failing.
  }
  await new Promise<void>((resolve) => {
    if (img.complete && img.naturalWidth > 0) return resolve();
    img.onload = () => resolve();
    img.onerror = () => resolve();
  });
  return img;
}

function deriveManifest(raw: Record<string, unknown>, levelId: string): LevelManifest {
  const rows = raw.rows as number | undefined;
  const cols = raw.cols as number | undefined;
  if (!rows || !cols) {
    throw new Error(
      `[LevelLoader] level.json for level-${levelId} missing "rows" or "cols". ` +
      `Ensure public/assets/levels/level-${levelId}/level.json uses tile-grid format.`,
    );
  }
  const imageWidth  = raw.imageWidth  as number | undefined;
  const imageHeight = raw.imageHeight as number | undefined;
  if (!imageWidth || !imageHeight) {
    throw new Error(
      `[LevelLoader] level.json for level-${levelId} missing "imageWidth"/"imageHeight". ` +
      `All built levels must declare master image dimensions.`,
    );
  }
  return {
    rows,
    cols,
    tileCount: (raw.tileCount as number | undefined) ?? rows * cols,
    imageWidth,
    imageHeight,
  };
}

function validateTiles(rawTiles: unknown[], rows: number, cols: number, levelId: string): LevelTile[] {
  const total = rows * cols;
  if (rawTiles.length !== total) {
    throw new Error(
      `[LevelLoader] tile count mismatch for level-${levelId}: ` +
      `expected ${total} (${rows}×${cols}), got ${rawTiles.length}`,
    );
  }
  const seen = new Set<number>();
  const tiles: LevelTile[] = [];
  for (let i = 0; i < rawTiles.length; i++) {
    const t = rawTiles[i] as Record<string, unknown>;
    if (typeof t.id !== 'number') throw new Error(`[LevelLoader] tiles[${i}].id must be a number in level-${levelId}`);
    if (typeof t.image !== 'string' || !t.image) throw new Error(`[LevelLoader] tiles[${i}].image missing in level-${levelId}`);
    if (typeof t.correctRow !== 'number') throw new Error(`[LevelLoader] tiles[${i}].correctRow missing in level-${levelId}`);
    if (typeof t.correctCol !== 'number') throw new Error(`[LevelLoader] tiles[${i}].correctCol missing in level-${levelId}`);
    if (seen.has(t.id as number)) throw new Error(`[LevelLoader] duplicate tile id ${t.id} in level-${levelId}`);
    seen.add(t.id as number);
    tiles.push({
      id: t.id as number,
      image: t.image as string,
      correctRow: t.correctRow as number,
      correctCol: t.correctCol as number,
      locked: typeof t.locked === 'boolean' ? t.locked : undefined,
      x: t.x as number | undefined,
      y: t.y as number | undefined,
      width: t.width as number | undefined,
      height: t.height as number | undefined,
    });
  }
  return tiles;
}

export async function loadLevel(levelId: string): Promise<LoadedLevel> {
  const levelNum = parseInt(levelId, 10);
  if (!Number.isFinite(levelNum) || levelNum <= 0) {
    throw new Error(`[LevelLoader] Invalid level ID: "${levelId}"`);
  }

  // Guard against levels whose assets aren't built yet (available: false in registry).
  // Import lazily to avoid circular deps — registry is pure data, no Pixi/React.
  const { isLevelAvailable } = await import('@/game/levels/registry');
  if (!isLevelAvailable(levelNum)) {
    throw new Error(
      `[LevelLoader] Level ${levelId} is not available yet (assets not built). ` +
      `Set available: true in registry.ts once the asset pipeline has run.`,
    );
  }

  const ts = Date.now();
  const base = `/assets/levels/level-${levelId}`;

  // Try manifest.json for rich tiling data + economy config (optional)
  let manifest: LevelManifest | null = null;
  let economy: LevelEconomy = { ...DEFAULT_ECONOMY };
  try {
    const mRes = await fetch(`${base}/manifest.json?ts=${ts}`);
    if (mRes.ok) {
      const raw = await mRes.json() as Record<string, unknown>;
      if (typeof raw.rows === 'number' && typeof raw.cols === 'number') {
        // Read economy block if present
        const eco = raw.economy as Partial<LevelEconomy> | undefined;
        if (eco) {
          economy = {
            maxAttempts:  eco.maxAttempts  ?? DEFAULT_ECONOMY.maxAttempts,
            coinReward:   eco.coinReward   ?? DEFAULT_ECONOMY.coinReward,
            hintsAllowed: eco.hintsAllowed ?? DEFAULT_ECONOMY.hintsAllowed,
            hintCosts:    eco.hintCosts    ?? DEFAULT_ECONOMY.hintCosts,
          };
        }
        manifest = {
          rows: raw.rows,
          cols: raw.cols,
          tileCount: (raw.tileCount as number | undefined) ?? raw.rows * raw.cols,
          imageWidth: raw.imageWidth as number,
          imageHeight: raw.imageHeight as number,
          economy,
          tiling: raw.tiling as LevelManifest['tiling'] | undefined,
        };
      }
    }
  } catch { /* manifest.json absent — fall through to level.json */ }

  // Always load level.json for tile definitions
  const lRes = await fetch(`${base}/level.json?ts=${ts}`);
  if (!lRes.ok) {
    throw new Error(`[LevelLoader] level.json not found for level-${levelId}: HTTP ${lRes.status}`);
  }
  const levelJson = await lRes.json() as Record<string, unknown>;

  if (!manifest) {
    manifest = deriveManifest(levelJson, levelId);
  }

  const { rows, cols } = manifest;

  if (!Array.isArray(levelJson.tiles) || levelJson.tiles.length === 0) {
    throw new Error(
      `[LevelLoader] level.json for level-${levelId} missing "tiles" array. ` +
      `This loader only supports tile-grid swap format, not the pieces[] format.`,
    );
  }

  const tiles = validateTiles(levelJson.tiles as unknown[], rows, cols, levelId);

  const boardFile = (levelJson.board as string | undefined) ?? 'board.png';
  const guideFile = levelJson.guide as string | undefined;
  const boardSrc = `${base}/${boardFile}?ts=${ts}`;
  const guideSrc = guideFile ? `${base}/${guideFile}?ts=${ts}` : null;

  // Use level.json tiles[].locked as the authoritative source.
  // Fall back to detectLockedSlots() only when no tile carries a locked field
  // (backward-compatible with legacy levels that predate the locked schema).
  const hasLockData = tiles.some(t => typeof t.locked === 'boolean');
  const lockedSlots = hasLockData
    ? new Set(
        tiles
          .filter(t => t.locked === true)
          .map(t => t.correctRow * cols + t.correctCol),
      )
    : detectLockedSlots(levelNum, rows, cols);

  const tileImageMap: Record<number, string> = {};
  for (const t of tiles) {
    tileImageMap[t.id] = `${base}/${t.image}?ts=${ts}`;
  }

  console.log(`[LevelLoader] LEVEL LOADED: level-${levelId}`);
  console.log(`[LevelLoader] BOARD SRC: ${boardSrc}`);
  console.log(`[LevelLoader] GUIDE SRC: ${guideSrc ?? 'null'}`);
  console.log(`[LevelLoader] TILE COUNT: ${tiles.length}`);
  console.log(`[LevelLoader] ROWS: ${rows}`);
  console.log(`[LevelLoader] COLS: ${cols}`);
  console.log(`[LevelLoader] LOCKED COUNT: ${lockedSlots.size}`);

  // ── Blocking preload ─────────────────────────────────────────────────────
  // Decode EVERY visible asset before this promise resolves. The board's load
  // effect awaits loadLevel(), so nothing renders until this completes — the
  // mosaic paints atomically from cache instead of hydrating tile-by-tile over
  // the network (the progressive top/middle/bottom pop-in seen on Vercel).
  console.log(`[PRELOAD START] level-${levelId}: ${tiles.length} tiles + board${guideSrc ? ' + guide' : ''}`);
  const tileImages = new Map<number, HTMLImageElement>();
  const jobs: Promise<void>[] = [];
  for (const t of tiles) {
    jobs.push(preloadImage(tileImageMap[t.id]).then((img) => { tileImages.set(t.id, img); }));
  }
  jobs.push(preloadImage(boardSrc).then(() => undefined));
  if (guideSrc) jobs.push(preloadImage(guideSrc).then(() => undefined));
  await Promise.all(jobs);
  console.log(`[PRELOAD DONE] level-${levelId}: ${tileImages.size}/${tiles.length} tiles decoded`);

  return {
    id: levelId,
    levelNum,
    manifest,
    economy,
    tiles,
    baseUrl: base,
    boardSrc,
    guideSrc,
    lockedSlots,
    tileImageMap,
    tileImages,
    cacheBust: String(ts),
  };
}
