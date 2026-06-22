import {
  initTelegramSDK,
  isTelegramEnv,
  getSafeArea,
  applySafeAreaToCSSVars,
  getViewportInfo,
  applyViewportToCSSVars,
} from '@/services/telegram/telegram';
import { getTelegramUser, isMockMode } from '@/services/telegram/telegramUser';
import { initTheme } from '@/services/telegram/telegramTheme';
import { supabaseService } from '@/services/supabase.service';
import { storageService } from '@/services/storage.service';
import { usePlayerStore } from '@/store/playerStore';
import { useUIStore } from '@/store/uiStore';

// Resolves with null after `ms` milliseconds — used to cap network waits.
function timeout(ms: number): Promise<null> {
  return new Promise((resolve) => setTimeout(() => resolve(null), ms));
}

// ─── Phase 1: synchronous ────────────────────────────────────────────────────
// Everything here is instant (no network, no disk). Safe to run BEFORE render.
export function bootstrapSync(): void {
  // Telegram SDK — ready(), expand(), enableClosingConfirmation()
  // Silent no-op in browser / non-Telegram contexts
  initTelegramSDK();

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
}

// ─── Phase 2: async ─────────────────────────────────────────────────────────
// Network calls only. Runs AFTER render — never blocks SplashScreen.
export async function bootstrapAsync(): Promise<void> {
  const { profile } = usePlayerStore.getState();
  if (!profile) return;

  // ── Local storage (fast, synchronous under the hood) ────────────────────
  try {
    type Progress = ReturnType<typeof usePlayerStore.getState>['progress'];
    const local = storageService.get<Progress>('progress');
    if (local) {
      usePlayerStore.getState().setProgress(local);
    }
  } catch {
    // localStorage unavailable in some Telegram sandbox contexts — ignore
  }

  // ── Supabase (network — capped at 3 s to prevent indefinite hang) ───────
  if (profile.telegramId === 0) return; // guest/mock user — skip remote

  try {
    const result = await Promise.race([
      supabaseService.loadPlayerProgress(profile.telegramId),
      timeout(3000),
    ]);

    if (result) {
      // Remote wins only if the player has more progress than the local cache
      const current = usePlayerStore.getState().progress;
      if (result.totalSnaps >= current.totalSnaps) {
        usePlayerStore.getState().setProgress(result);
      }
    }
  } catch (err) {
    // Network failure — local cache already applied above, app continues fine
    // eslint-disable-next-line no-console
    console.warn('[bootstrap] Supabase load failed — using local cache', err);
  }
}
