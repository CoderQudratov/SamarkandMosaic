import { useEffect } from 'react';
import {
  onViewportChanged,
  onThemeChanged,
  getSafeArea,
  applySafeAreaToCSSVars,
  applyViewportToCSSVars,
  getViewportInfo,
} from '@/services/telegram/telegram';
import {
  getCurrentTheme,
  applyThemeToCSSVars,
} from '@/services/telegram/telegramTheme';
import { useUIStore } from '@/store/uiStore';
import type { AppTheme } from '@/services/telegram/telegramTheme';
import type { SafeArea, ViewportInfo } from '@/services/telegram/telegram';

export interface UseTelegramResult {
  isTelegram: boolean;
  theme: AppTheme;
  safeArea: SafeArea;
  viewport: ViewportInfo;
}

export function useTelegram(): UseTelegramResult {
  const isTelegram = useUIStore((s) => s.isTelegram);
  const theme = useUIStore((s) => s.theme);
  const safeArea = useUIStore((s) => s.safeArea);

  useEffect(() => {
    // Viewport changed — update safe area + viewport CSS vars + store
    const unsubViewport = onViewportChanged(() => {
      const area = getSafeArea();
      const info = getViewportInfo();
      applySafeAreaToCSSVars(area);
      applyViewportToCSSVars(info);
      useUIStore.getState().setSafeArea(area);
    });

    // Theme changed — update CSS vars + store
    const unsubTheme = onThemeChanged(() => {
      const next = getCurrentTheme();
      applyThemeToCSSVars(next);
      useUIStore.getState().setTheme(next);
    });

    return () => {
      unsubViewport();
      unsubTheme();
    };
  }, []);

  return {
    isTelegram,
    theme,
    safeArea,
    viewport: getViewportInfo(),
  };
}
