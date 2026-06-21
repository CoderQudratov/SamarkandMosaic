import { create } from 'zustand';
import type { PlayerProfile, PlayerProgress } from '@/game/types';

interface PlayerStore {
  profile: PlayerProfile | null;
  progress: PlayerProgress;
  setProfile: (profile: PlayerProfile) => void;
  setProgress: (progress: Partial<PlayerProgress>) => void;
  markLevelComplete: (levelId: number) => void;
}

export const usePlayerStore = create<PlayerStore>((set, get) => ({
  profile: null,
  progress: {
    completedLevels: [],
    highestLevel: 0,
    totalSnaps: 0,
  },

  setProfile: (profile) => set({ profile }),

  setProgress: (partial) =>
    set((s) => ({ progress: { ...s.progress, ...partial } })),

  markLevelComplete: (levelId) => {
    const { progress } = get();
    const completedLevels = progress.completedLevels.includes(levelId)
      ? progress.completedLevels
      : [...progress.completedLevels, levelId];
    set({
      progress: {
        ...progress,
        completedLevels,
        highestLevel: Math.max(progress.highestLevel, levelId),
      },
    });
  },
}));
