import { create } from 'zustand';
import type { SceneKey } from '@/game/types';
import type { SafeArea } from '@/services/telegram/telegram';
import type { AppTheme } from '@/services/telegram/telegramTheme';

const DEFAULT_SAFE_AREA: SafeArea = { top: 0, bottom: 0, left: 0, right: 0 };

const DEFAULT_THEME: AppTheme = {
  bgColor: '#1a0f00',
  textColor: '#F8F1E5',
  hintColor: '#D2B48C',
  linkColor: '#D4AF37',
  buttonColor: '#D4AF37',
  buttonTextColor: '#1a0f00',
  secondaryBgColor: '#2a1a00',
  colorScheme: 'dark',
};

interface UIStore {
  scene: SceneKey;
  isLoading: boolean;
  loadingProgress: number;
  showPauseMenu: boolean;

  // Telegram environment
  isTelegram: boolean;
  theme: AppTheme;
  safeArea: SafeArea;

  /** Global shop modal toggle — a single instance is mounted in App.tsx. */
  shopOpen: boolean;

  // Actions
  setScene: (scene: SceneKey) => void;
  setLoading: (loading: boolean) => void;
  setLoadingProgress: (progress: number) => void;
  togglePauseMenu: () => void;
  setPauseMenu: (open: boolean) => void;
  setIsTelegram: (value: boolean) => void;
  setTheme: (theme: AppTheme) => void;
  setSafeArea: (area: SafeArea) => void;
  setShopOpen: (open: boolean) => void;
}

export const useUIStore = create<UIStore>((set) => ({
  scene: 'splash',   // app always starts at splash
  isLoading: false,
  loadingProgress: 0,
  showPauseMenu: false,
  isTelegram: false,
  theme: DEFAULT_THEME,
  safeArea: DEFAULT_SAFE_AREA,

  shopOpen: false,

  setScene: (scene) => set({ scene }),
  setLoading: (isLoading) => set({ isLoading }),
  setLoadingProgress: (loadingProgress) => set({ loadingProgress }),
  togglePauseMenu: () => set((s) => ({ showPauseMenu: !s.showPauseMenu })),
  setPauseMenu: (showPauseMenu) => set({ showPauseMenu }),
  setIsTelegram: (isTelegram) => set({ isTelegram }),
  setTheme: (theme) => set({ theme }),
  setSafeArea: (safeArea) => set({ safeArea }),
  setShopOpen: (shopOpen) => set({ shopOpen }),
}));
