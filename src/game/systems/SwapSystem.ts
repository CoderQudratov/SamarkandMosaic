import { storageService } from '@/services/storage.service';
import { useSwapStore } from '@/store/swapStore';

export const SWAP_MAX_ATTEMPTS: Record<number, number> = { 1: 12 };

// ── Shuffle ──────────────────────────────────────────────────────────────────

function fisherYates<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function createShuffledGrid(cols: number, total: number): number[] {
  const grid = Array.from({ length: total }, (_, i) => i + 1);
  const movableStart = cols;
  const movableEnd = total - cols;
  const movableSlots = Array.from({ length: movableEnd - movableStart }, (_, i) => i + movableStart);
  const shuffledTiles = fisherYates(movableSlots.map(i => grid[i]));
  for (let i = 0; i < movableSlots.length; i++) {
    grid[movableSlots[i]] = shuffledTiles[i];
  }
  if (isGridSolved(grid)) return createShuffledGrid(cols, total);
  return grid;
}

export function isGridSolved(grid: number[]): boolean {
  return grid.every((t, i) => t === i + 1);
}

// ── Good swap detection ──────────────────────────────────────────────────────

function distToCorrect(tileId: number, slotIndex: number, cols: number): number {
  const correctSlot = tileId - 1;
  const cRow = Math.floor(correctSlot / cols);
  const cCol = correctSlot % cols;
  const sRow = Math.floor(slotIndex / cols);
  const sCol = slotIndex % cols;
  return Math.abs(sRow - cRow) + Math.abs(sCol - cCol);
}

export function isTileImproved(tileId: number, slotIndex: number, cols: number): boolean {
  return distToCorrect(tileId, slotIndex, cols) <= 1;
}

export function isGoodSwap(grid: number[], slotA: number, slotB: number, cols: number): boolean {
  return isTileImproved(grid[slotB], slotA, cols) || isTileImproved(grid[slotA], slotB, cols);
}

// ── Best move hint ───────────────────────────────────────────────────────────

export function findBestMove(
  grid: number[],
  cols: number,
  total: number,
): [number, number] | null {
  const movable: number[] = [];
  for (let i = 0; i < total; i++) {
    const locked = i < cols || i >= total - cols;
    if (!locked && grid[i] !== i + 1) movable.push(i);
  }
  if (movable.length < 2) return null;

  // Prefer swaps where both tiles improve.
  for (let ai = 0; ai < movable.length; ai++) {
    for (let bi = ai + 1; bi < movable.length; bi++) {
      const a = movable[ai], b = movable[bi];
      if (isTileImproved(grid[b], a, cols) && isTileImproved(grid[a], b, cols)) {
        return [a, b];
      }
    }
  }
  // Fall back to any single-improvement swap.
  for (let ai = 0; ai < movable.length; ai++) {
    for (let bi = ai + 1; bi < movable.length; bi++) {
      if (isGoodSwap(grid, movable[ai], movable[bi], cols)) {
        return [movable[ai], movable[bi]];
      }
    }
  }
  return [movable[0], movable[1]];
}

// ── Save / Restore ───────────────────────────────────────────────────────────

interface SwapSaveState {
  grid: number[];
  attemptsLeft: number;
}

export function saveSwapState(levelNum: number): void {
  const { grid, attemptsLeft } = useSwapStore.getState();
  storageService.set<SwapSaveState>(`swap_l${levelNum}`, { grid, attemptsLeft });
}

export function loadSwapState(levelNum: number, expectedLength: number): SwapSaveState | null {
  const raw = storageService.get<SwapSaveState>(`swap_l${levelNum}`);
  if (!raw || !Array.isArray(raw.grid) || raw.grid.length !== expectedLength) return null;
  if (typeof raw.attemptsLeft !== 'number') return null;
  return raw;
}

export function clearSwapState(levelNum: number): void {
  storageService.remove(`swap_l${levelNum}`);
}

// ── Tutorial ─────────────────────────────────────────────────────────────────

const TUTORIAL_KEY = 'sm_tutorial_level1_done';

export function isTutorialDone(): boolean {
  try { return localStorage.getItem(TUTORIAL_KEY) === 'true'; } catch { return true; }
}

export function markTutorialDone(): void {
  try { localStorage.setItem(TUTORIAL_KEY, 'true'); } catch { /* noop */ }
}

// ── Level data loading ───────────────────────────────────────────────────────

export interface SwapTileDef {
  id: number;
  image: string;
  correctRow: number;
  correctCol: number;
}

export interface SwapLevelData {
  id: string;
  rows: number;
  cols: number;
  tileSize?: number;
  imageWidth?: number;
  imageHeight?: number;
  board: string;
  guide: string;
  tiles: SwapTileDef[];
}

export async function fetchSwapLevelData(levelNum: number): Promise<SwapLevelData> {
  const base = `/assets/levels/level-${levelNum}`;
  const res = await fetch(`${base}/level.json`);
  if (!res.ok) throw new Error(`level.json not found: HTTP ${res.status}`);
  const raw = await res.json() as Record<string, unknown>;

  if (typeof raw.rows !== 'number' || raw.rows <= 0) {
    throw new Error(
      `level.json missing "rows". Ensure public/assets/levels/level-${levelNum}/level.json ` +
      `uses the tile-grid format (rows, cols, tiles[]).`
    );
  }
  if (typeof raw.cols !== 'number' || raw.cols <= 0) {
    throw new Error(`level.json missing "cols"`);
  }
  if (!Array.isArray(raw.tiles) || raw.tiles.length === 0) {
    throw new Error(`level.json missing "tiles" array`);
  }

  const rows = raw.rows as number;
  const cols = raw.cols as number;
  const expectedCount = rows * cols;

  if (raw.tiles.length !== expectedCount) {
    throw new Error(
      `tile count mismatch: expected ${expectedCount} (${rows}×${cols}), got ${raw.tiles.length}`
    );
  }

  const ids = new Set<number>();
  for (let i = 0; i < raw.tiles.length; i++) {
    const t = raw.tiles[i] as Record<string, unknown>;
    if (typeof t.id !== 'number') throw new Error(`tiles[${i}].id must be a number`);
    if (typeof t.image !== 'string' || !t.image) throw new Error(`tiles[${i}].image missing`);
    if (typeof t.correctRow !== 'number') throw new Error(`tiles[${i}].correctRow missing`);
    if (typeof t.correctCol !== 'number') throw new Error(`tiles[${i}].correctCol missing`);
    if (ids.has(t.id as number)) throw new Error(`duplicate tile id ${t.id}`);
    ids.add(t.id as number);
  }

  return raw as unknown as SwapLevelData;
}
