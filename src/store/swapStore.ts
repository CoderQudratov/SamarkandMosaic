import { create } from 'zustand';

// Slot membership check used by swap logic and render layers.
export function isSlotLocked(slotIndex: number, lockedSlots: Set<number>): boolean {
  return lockedSlots.has(slotIndex);
}

// Legacy helper kept for callers that haven't migrated to lockedSlots yet.
export function isLockedSlot(slotIndex: number, cols: number, total: number): boolean {
  return slotIndex < cols || slotIndex >= total - cols;
}

interface SwapStore {
  levelId: string | null;
  grid: number[];
  selectedSlot: number | null;
  attemptsLeft: number;
  maxAttempts: number;
  isSolved: boolean;
  isLoaded: boolean;
  isAnimating: boolean;
  hintUsed: boolean;
  cols: number;
  rows: number;
  lockedSlots: Set<number>;

  initBoard: (
    levelId: string,
    grid: number[],
    attemptsLeft: number,
    maxAttempts: number,
    cols: number,
    rows: number,
    lockedSlots?: Set<number>,
  ) => void;
  selectSlot: (slotIndex: number) => void;
  deselectSlot: () => void;
  doSwap: (slotA: number, slotB: number, isGood: boolean) => void;
  setAnimating: (v: boolean) => void;
  setHintUsed: (v: boolean) => void;
  reset: () => void;
}

const EMPTY_LOCKED = new Set<number>();

export const useSwapStore = create<SwapStore>((set, get) => ({
  levelId: null,
  grid: [],
  selectedSlot: null,
  attemptsLeft: 12,
  maxAttempts: 12,
  isSolved: false,
  isLoaded: false,
  isAnimating: false,
  hintUsed: false,
  cols: 4,
  rows: 7,
  lockedSlots: EMPTY_LOCKED,

  initBoard: (levelId, grid, attemptsLeft, maxAttempts, cols, rows, lockedSlots = EMPTY_LOCKED) => {
    const isSolved = grid.every((t, i) => t === i + 1);
    set({
      levelId, grid, attemptsLeft, maxAttempts, isSolved,
      isLoaded: true, selectedSlot: null, isAnimating: false, cols, rows, lockedSlots,
    });
  },

  selectSlot: (slotIndex) => set({ selectedSlot: slotIndex }),
  deselectSlot: () => set({ selectedSlot: null }),

  doSwap: (slotA, slotB, isGood) => {
    const { grid, attemptsLeft } = get();
    const newGrid = [...grid];
    [newGrid[slotA], newGrid[slotB]] = [newGrid[slotB], newGrid[slotA]];
    const newAttempts = isGood ? attemptsLeft : Math.max(0, attemptsLeft - 1);
    const isSolved = newGrid.every((t, i) => t === i + 1);
    set({ grid: newGrid, attemptsLeft: newAttempts, selectedSlot: null, isAnimating: false, isSolved });
  },

  setAnimating: (v) => set({ isAnimating: v }),
  setHintUsed: (v) => set({ hintUsed: v }),

  reset: () => set({
    levelId: null, grid: [], selectedSlot: null,
    attemptsLeft: 12, maxAttempts: 12,
    isSolved: false, isLoaded: false, isAnimating: false, hintUsed: false,
    cols: 4, rows: 7, lockedSlots: EMPTY_LOCKED,
  }),
}));
