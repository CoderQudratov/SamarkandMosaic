import { create } from 'zustand';
import { useUIStore } from '@/store/uiStore';
import type {
  PuzzleLevel,
  PuzzleLoadState,
  PuzzlePieceRuntime,
} from '@/game/types';

interface BoardStore {
  levelId: string | null;
  level: PuzzleLevel | null;
  loadState: PuzzleLoadState;
  error: string | null;

  // Natural board coordinate space (board image px, or slots bounding box)
  naturalWidth: number;
  naturalHeight: number;

  pieces: Record<string, PuzzlePieceRuntime>;
  trayOrder: string[]; // ids of unplaced pieces, in tray display order

  // ── Actions ───────────────────────────────────────────────────────────────
  beginLoad: (levelId: string) => void;
  setError: (message: string) => void;
  setLevelData: (
    level: PuzzleLevel,
    naturalWidth: number,
    naturalHeight: number,
    pieces: Record<string, PuzzlePieceRuntime>,
    trayOrder: string[],
  ) => void;
  placePiece: (id: string) => void;
  reset: () => void;
}

const INITIAL = {
  levelId: null,
  level: null,
  loadState: 'idle' as PuzzleLoadState,
  error: null,
  naturalWidth: 0,
  naturalHeight: 0,
  pieces: {} as Record<string, PuzzlePieceRuntime>,
  trayOrder: [] as string[],
};

export const useBoardStore = create<BoardStore>((set, get) => ({
  ...INITIAL,

  beginLoad: (levelId) =>
    set({ ...INITIAL, levelId, loadState: 'loading' }),

  setError: (message) => set({ loadState: 'error', error: message }),

  setLevelData: (level, naturalWidth, naturalHeight, pieces, trayOrder) =>
    set({
      level,
      levelId: level.id,
      naturalWidth,
      naturalHeight,
      pieces,
      trayOrder,
      loadState: 'ready',
      error: null,
    }),

  placePiece: (id) => {
    const state = get();
    const piece = state.pieces[id];
    if (!piece || piece.placed) return;

    const pieces = { ...state.pieces, [id]: { ...piece, placed: true } };
    const trayOrder = state.trayOrder.filter((p) => p !== id);
    set({ pieces, trayOrder });

    // Completion: all pieces placed → transition to win scene.
    const allPlaced = Object.values(pieces).every((p) => p.placed);
    if (allPlaced) {
      // Brief hold so the final snap is visible before the scene change.
      setTimeout(() => useUIStore.getState().setScene('win'), 600);
    }
  },

  reset: () => set({ ...INITIAL }),
}));

// ── Derived selectors (pure, computed from state) ────────────────────────────

export function selectProgress(state: BoardStore): {
  placed: number;
  total: number;
  percent: number;
} {
  const all = Object.values(state.pieces);
  const total = all.length;
  const placed = all.filter((p) => p.placed).length;
  const percent = total === 0 ? 0 : Math.round((placed / total) * 100);
  return { placed, total, percent };
}
