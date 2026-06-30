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

export function createShuffledGrid(lockedSlots: Set<number>, total: number): number[] {
  const grid = Array.from({ length: total }, (_, i) => i + 1);
  const movableSlots = Array.from({ length: total }, (_, i) => i).filter((i) => !lockedSlots.has(i));
  // With ≤1 movable tile there is only one possible arrangement — return it as-is.
  // Recursing to escape the solved-check would loop forever.
  if (movableSlots.length <= 1) return grid;
  const shuffledTiles = fisherYates(movableSlots.map((i) => grid[i]));
  for (let i = 0; i < movableSlots.length; i++) {
    grid[movableSlots[i]] = shuffledTiles[i];
  }
  if (isGridSolved(grid)) return createShuffledGrid(lockedSlots, total);

  const nullSlots = grid.map((v, i) => (v == null || typeof v !== 'number') ? i : -1).filter(i => i >= 0);
  if (nullSlots.length > 0) {
    throw new Error(`[BOARD AUDIT] INVALID BOARD: NULL/INVALID SLOT at indices [${nullSlots.join(', ')}]. grid=${JSON.stringify(grid)}`);
  }
  console.log('[BOARD AUDIT]', { totalSlots: total, filledSlots: grid.filter(Boolean).length, nullSlots: nullSlots.length, grid });

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
  lockedSlots?: Set<number>,
): [number, number] | null {
  const movable: number[] = [];
  for (let i = 0; i < total; i++) {
    const locked = lockedSlots ? lockedSlots.has(i) : (i < cols || i >= total - cols);
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
  // No swap improves any tile's position — caller must handle null gracefully.
  return null;
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
  // Reject any save where a slot is null, not a number, or out of the valid tileId range.
  if (raw.grid.some(v => v == null || typeof v !== 'number' || v < 1 || v > expectedLength)) {
    console.warn('[BOARD AUDIT] Discarding corrupted save: invalid slot values in grid', raw.grid);
    storageService.remove(`swap_l${levelNum}`);
    return null;
  }
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
