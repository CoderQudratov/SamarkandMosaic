import { create } from 'zustand';
import type { LevelConfig } from '@/game/types';
import { storageService } from '@/services/storage.service';
import { ALL_LEVEL_IDS } from '@/game/levels/registry';

const LAST_LEVEL_KEY = 'last_level';

interface LevelStore {
  availableLevels: number[];
  currentLevel: LevelConfig | null;
  /** Level id chosen on the level-select screen — what the board loads. */
  selectedLevelId: number;
  isLoadingLevel: boolean;

  setCurrentLevel: (level: LevelConfig) => void;
  setSelectedLevelId: (id: number) => void;
  setLoadingLevel: (loading: boolean) => void;
  setAvailableLevels: (ids: number[]) => void;
  clearCurrentLevel: () => void;
}

// Restore the last-played level from localStorage so a mid-session app close
// returns the player to the same level on next open.
function loadLastLevel(): number {
  const v = storageService.get<number>(LAST_LEVEL_KEY);
  return typeof v === 'number' && v >= 1 ? v : 1;
}

export const useLevelStore = create<LevelStore>((set) => ({
  availableLevels: [...ALL_LEVEL_IDS],
  currentLevel: null,
  selectedLevelId: loadLastLevel(),
  isLoadingLevel: false,

  setCurrentLevel: (currentLevel) => set({ currentLevel }),
  setSelectedLevelId: (selectedLevelId) => {
    storageService.set(LAST_LEVEL_KEY, selectedLevelId);
    set({ selectedLevelId });
  },
  setLoadingLevel: (isLoadingLevel) => set({ isLoadingLevel }),
  setAvailableLevels: (availableLevels) => set({ availableLevels }),
  clearCurrentLevel: () => set({ currentLevel: null }),
}));
