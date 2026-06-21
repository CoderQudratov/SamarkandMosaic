import { create } from 'zustand';
import type { PlayerProfile, PlayerProgress } from '@/game/types';

interface PlayerStore {
  // Telegram identity — null until bootstrap resolves
  profile: PlayerProfile | null;

  // Player-chosen display name (overrides profile.displayName in UI)
  customName: string | null;

  // Game progress
  progress: PlayerProgress;

  // Derived helpers
  isGuest: boolean; // true when running in browser dev mode (telegramId === 0)

  // Actions
  setProfile: (profile: PlayerProfile) => void;
  setCustomName: (name: string) => void;
  setProgress: (partial: Partial<PlayerProgress>) => void;
  markLevelComplete: (levelId: number) => void;
  incrementSnaps: () => void;

  // Computed — returns customName ?? profile.displayName ?? 'Guest'
  getDisplayName: () => string;
}

export const usePlayerStore = create<PlayerStore>((set, get) => ({
  profile: null,
  customName: null,
  isGuest: true,
  progress: {
    completedLevels: [],
    highestLevel: 0,
    totalSnaps: 0,
  },

  setProfile: (profile) =>
    set({ profile, isGuest: profile.telegramId === 0 }),

  setCustomName: (name) => set({ customName: name.trim() }),

  getDisplayName: () => {
    const { customName, profile } = get();
    return customName ?? profile?.displayName ?? 'Guest';
  },

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

  incrementSnaps: () =>
    set((s) => ({
      progress: { ...s.progress, totalSnaps: s.progress.totalSnaps + 1 },
    })),
}));
