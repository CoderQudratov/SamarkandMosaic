import { create } from 'zustand';
import type { SceneKey } from '@/game/types';

interface UIStore {
  scene: SceneKey;
  isLoading: boolean;
  loadingProgress: number;
  showPauseMenu: boolean;

  setScene: (scene: SceneKey) => void;
  setLoading: (loading: boolean) => void;
  setLoadingProgress: (progress: number) => void;
  togglePauseMenu: () => void;
  setPauseMenu: (open: boolean) => void;
}

export const useUIStore = create<UIStore>((set) => ({
  scene: 'menu',
  isLoading: false,
  loadingProgress: 0,
  showPauseMenu: false,

  setScene: (scene) => set({ scene }),
  setLoading: (isLoading) => set({ isLoading }),
  setLoadingProgress: (loadingProgress) => set({ loadingProgress }),
  togglePauseMenu: () => set((s) => ({ showPauseMenu: !s.showPauseMenu })),
  setPauseMenu: (showPauseMenu) => set({ showPauseMenu }),
}));
