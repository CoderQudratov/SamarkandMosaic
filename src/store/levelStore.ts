import { create } from 'zustand';
import type { LevelConfig } from '@/game/types';

interface LevelStore {
  availableLevels: number[];
  currentLevel: LevelConfig | null;
  isLoadingLevel: boolean;

  setCurrentLevel: (level: LevelConfig) => void;
  setLoadingLevel: (loading: boolean) => void;
  setAvailableLevels: (ids: number[]) => void;
  clearCurrentLevel: () => void;
}

export const useLevelStore = create<LevelStore>((set) => ({
  availableLevels: [1, 2, 3, 4, 5],
  currentLevel: null,
  isLoadingLevel: false,

  setCurrentLevel: (currentLevel) => set({ currentLevel }),
  setLoadingLevel: (isLoadingLevel) => set({ isLoadingLevel }),
  setAvailableLevels: (availableLevels) => set({ availableLevels }),
  clearCurrentLevel: () => set({ currentLevel: null }),
}));
