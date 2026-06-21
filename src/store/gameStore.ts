import { create } from 'zustand';
import type { GameStatus, PieceStatus } from '@/game/types';

interface PieceRuntimeState {
  id: string;
  status: PieceStatus;
}

interface GameStore {
  status: GameStatus;
  hearts: number;
  currentLevelId: number | null;
  pieces: PieceRuntimeState[];
  snappedCount: number;
  totalPieces: number;

  setStatus: (status: GameStatus) => void;
  setLevel: (levelId: number, totalPieces: number) => void;
  setPieces: (pieces: PieceRuntimeState[]) => void;
  updatePieceStatus: (id: string, status: PieceStatus) => void;
  loseHeart: () => void;
  resetHearts: () => void;
  snapPiece: (id: string) => void;
  reset: () => void;
}

const INITIAL_HEARTS = 3;

export const useGameStore = create<GameStore>((set, get) => ({
  status: 'idle',
  hearts: INITIAL_HEARTS,
  currentLevelId: null,
  pieces: [],
  snappedCount: 0,
  totalPieces: 0,

  setStatus: (status) => set({ status }),

  setLevel: (levelId, totalPieces) =>
    set({ currentLevelId: levelId, totalPieces, snappedCount: 0 }),

  setPieces: (pieces) => set({ pieces }),

  updatePieceStatus: (id, status) =>
    set((s) => ({
      pieces: s.pieces.map((p) => (p.id === id ? { ...p, status } : p)),
    })),

  loseHeart: () => {
    const { hearts } = get();
    const next = Math.max(0, hearts - 1);
    set({ hearts: next, status: next === 0 ? 'gameover' : 'playing' });
  },

  resetHearts: () => set({ hearts: INITIAL_HEARTS }),

  snapPiece: (id) => {
    const { snappedCount, totalPieces } = get();
    const next = snappedCount + 1;
    set({
      snappedCount: next,
      status: next === totalPieces ? 'won' : 'playing',
    });
    get().updatePieceStatus(id, 'snapped');
  },

  reset: () =>
    set({
      status: 'idle',
      hearts: INITIAL_HEARTS,
      currentLevelId: null,
      pieces: [],
      snappedCount: 0,
      totalPieces: 0,
    }),
}));
