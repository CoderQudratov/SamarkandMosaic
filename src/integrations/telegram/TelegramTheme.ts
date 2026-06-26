// ─── TelegramTheme ────────────────────────────────────────────────────────────
// Reads Telegram theme params and writes them as CSS custom properties.
// Subscribes to themeChanged and re-applies automatically.
// Delegates to the existing telegramTheme service to avoid duplication.

import {
  getCurrentTheme,
  applyThemeToCSSVars,
  initTheme,
} from '@/services/telegram/telegramTheme';
import { onThemeChanged } from '@/services/telegram/telegram';
import { useUIStore } from '@/store/uiStore';

export type { AppTheme } from '@/services/telegram/telegramTheme';

// ── One-shot boot helper ───────────────────────────────────────────────────────

/**
 * Apply current theme and register the live-update listener.
 * Returns an unsubscribe function (call on app unmount if needed).
 */
export function setupTheme(): () => void {
  // Apply immediately so the first frame already has correct colours.
  const initial = initTheme();
  useUIStore.getState().setTheme(initial);

  // Subscribe to future theme changes from the Telegram client.
  const unsub = onThemeChanged(() => {
    const next = getCurrentTheme();
    applyThemeToCSSVars(next);
    useUIStore.getState().setTheme(next);
  });

  return unsub;
}

// ── Snapshot access ────────────────────────────────────────────────────────────

export { getCurrentTheme, applyThemeToCSSVars };
