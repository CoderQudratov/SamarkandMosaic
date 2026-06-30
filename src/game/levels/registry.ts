// ─── Level Registry ───────────────────────────────────────────────────────────
// Single source of truth for all level metadata.
// Engine, economy, level-select, validator, and future content pipeline all
// derive their data from here — no numbers are duplicated elsewhere.
//
// To add levels beyond 10: append entries to LEVEL_REGISTRY and create the
// corresponding public/assets/levels/level-N/ folder structure.

export interface LevelMeta {
  /** 1-based numeric id.  Maps to the "level-N" directory. */
  id: number;
  /** Directory name used in asset paths, e.g. "level-1". */
  dirId: string;
  /** Number of pieces this level is cut into. */
  pieceCount: number;
  /**
   * Base coin reward on completion (formula: pieceCount × 5).
   * Perfect-clear and speed bonuses are added on top by EconomySystem.
   */
  baseReward: number;
  /** Display name shown in the Level Select screen. */
  name: string;
  /** Thematic subtitle (historical Timurid site). */
  theme: string;
  /**
   * Grid layout for the placeholder level.json when real art is not yet
   * authored: [cols, rows]. cols × rows must equal pieceCount.
   */
  grid: [number, number];
  /**
   * Approximate star-rating difficulty description.
   * Used by future tutorial/hint systems — not rendered yet.
   */
  difficulty: 'easy' | 'medium' | 'hard' | 'expert' | 'master';
  /**
   * When false, assets are not ready yet. The level select shows the card as
   * permanently locked and loading is blocked. Defaults to true when absent.
   */
  available?: boolean;
}

export const LEVEL_REGISTRY: readonly LevelMeta[] = [
  {
    id: 1,  dirId: 'level-1',  pieceCount: 4,  baseReward: 20,
    name: 'The First Gate',    theme: 'Registan Entrance',
    grid: [2, 2], difficulty: 'easy',
  },
  {
    id: 2,  dirId: 'level-2',  pieceCount: 6,  baseReward: 30,
    name: 'Shah-i-Zinda',      theme: 'Necropolis Avenue',
    grid: [3, 2], difficulty: 'easy',
  },
  {
    id: 3,  dirId: 'level-3',  pieceCount: 8,  baseReward: 40,
    name: 'Bibi-Khanym',       theme: 'The Grand Mosque',
    grid: [4, 2], difficulty: 'easy',
  },
  {
    id: 4,  dirId: 'level-4',  pieceCount: 10, baseReward: 50,
    name: 'Gur-e-Amir',        theme: 'Mausoleum of Tamerlane',
    grid: [5, 2], difficulty: 'medium',
  },
  {
    id: 5,  dirId: 'level-5',  pieceCount: 12, baseReward: 60,
    name: 'Ulugh Beg',         theme: 'The Royal Observatory',
    grid: [4, 3], difficulty: 'medium',
  },
  {
    id: 6,  dirId: 'level-6',  pieceCount: 16, baseReward: 80,
    name: 'Shakrisabz',        theme: 'Ak-Saray Palace',
    grid: [4, 4], difficulty: 'medium',
  },
  {
    id: 7,  dirId: 'level-7',  pieceCount: 30, baseReward: 100,
    name: 'Registan Square',   theme: 'Heart of Samarkand',
    grid: [6, 5], difficulty: 'hard',
  },
  {
    id: 8,  dirId: 'level-8',  pieceCount: 30, baseReward: 120,
    name: 'Tillya-Kori',       theme: 'The Gilded Madrasah',
    grid: [6, 5], difficulty: 'hard',
  },
  {
    id: 9,  dirId: 'level-9',  pieceCount: 30, baseReward: 140,
    name: 'Khoja Ahrar',       theme: 'The Sacred Complex',
    grid: [6, 5], difficulty: 'expert',
  },
  {
    id: 10, dirId: 'level-10', pieceCount: 32, baseReward: 160,
    name: 'The Grand Mosaic',  theme: 'Eternal Samarkand',
    grid: [8, 4], difficulty: 'master',
  },
] as const;

export const TOTAL_LEVELS = LEVEL_REGISTRY.length;  // 10

/** Look up metadata by numeric id (1-based). Returns undefined for invalid ids. */
export function getLevelMeta(id: number): LevelMeta | undefined {
  return LEVEL_REGISTRY.find((l) => l.id === id);
}

/** All numeric level ids in order. */
export const ALL_LEVEL_IDS: readonly number[] =
  LEVEL_REGISTRY.map((l) => l.id);

/** Piece count for a given level id. Returns 0 for unknown ids. */
export function getPieceCount(levelId: number): number {
  return getLevelMeta(levelId)?.pieceCount ?? 0;
}

/**
 * Returns false when a level's assets are not ready (available === false).
 * Levels without an explicit `available` field are treated as available.
 */
export function isLevelAvailable(levelId: number): boolean {
  const meta = getLevelMeta(levelId);
  return meta ? (meta.available !== false) : false;
}
