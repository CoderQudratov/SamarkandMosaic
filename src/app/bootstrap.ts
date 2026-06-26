import {
  isTelegramEnv,
  getSafeArea,
  applySafeAreaToCSSVars,
  getViewportInfo,
  applyViewportToCSSVars,
} from '@/services/telegram/telegram';
import { getTelegramUser, isMockMode } from '@/services/telegram/telegramUser';
import { initTheme } from '@/services/telegram/telegramTheme';
import { usePlayerStore } from '@/store/playerStore';
import { useUIStore } from '@/store/uiStore';
import { saveSystem } from '@/game/systems/SaveSystem';
import { syncManager } from '@/game/systems/SyncManager';
import { init as telegramInit } from '@/integrations/telegram';
import { sync } from '@/services/sync.service';

// ─── Phase 1: synchronous ────────────────────────────────────────────────────
// Everything here is instant (no network, no disk). Safe to run BEFORE render.
export function bootstrapSync(): void {
  // Telegram SDK — ready(), expand(), enableClosingConfirmation(),
  // disableVerticalSwipes(), header/bg colour. Silent no-op in browser.
  telegramInit();

  // Persist environment flag so UI can adapt
  useUIStore.getState().setIsTelegram(isTelegramEnv());

  if (isMockMode()) {
    // eslint-disable-next-line no-console
    console.info('[bootstrap] Browser dev mode — mock player active');
  }

  // Theme → CSS custom properties on :root (--tg-bg-color etc.)
  const theme = initTheme();
  useUIStore.getState().setTheme(theme);

  // Safe area + viewport → CSS vars (--safe-area-top etc.)
  const safeArea = getSafeArea();
  const viewport = getViewportInfo();
  applySafeAreaToCSSVars(safeArea);
  applyViewportToCSSVars(viewport);
  useUIStore.getState().setSafeArea(safeArea);

  // Telegram user from initDataUnsafe — synchronous read, no network
  const profile = getTelegramUser();
  usePlayerStore.getState().setProfile(profile);

  // Upsert profile to Supabase (fire-and-forget — won't block render).
  sync.profile();

  // ── SaveSystem ────────────────────────────────────────────────────────────
  // load() runs after stores have initialised from their per-key keys so it
  // can intelligently merge/supplement (stats + backup restoration).
  saveSystem.load();
  // init() wires Zustand subscriptions for auto-save on relevant state changes.
  saveSystem.init();

  // Push a final sync when the tab is hidden (page-hide / background on mobile).
  // This is best-effort — some browsers don't fire it reliably.
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') syncManager.push();
    }, { once: false, passive: true });
  }
}

// ─── Phase 2: async ─────────────────────────────────────────────────────────
// Network calls only. Runs AFTER render — never blocks SplashScreen.
export async function bootstrapAsync(): Promise<void> {
  const { profile } = usePlayerStore.getState();
  if (!profile || profile.telegramId === 0) return; // guest/mock user — skip

  // Three-source sync: localStorage + Supabase + Telegram CloudStorage.
  // Resolves conflicts, hydrates stores, writes merged snapshot back.
  // Falls back to local-only on any failure (timeout = 3s).
  try {
    await syncManager.bootSync(profile.telegramId);
  } catch (err) {
    // Should never throw — syncManager swallows all errors internally.
    // eslint-disable-next-line no-console
    console.warn('[bootstrap] SyncManager.bootSync threw unexpectedly.', err);
  }
}
