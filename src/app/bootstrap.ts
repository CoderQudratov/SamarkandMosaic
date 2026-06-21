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

export async function bootstrap(): Promise<void> {
  // ── Step 1: Telegram SDK ────────────────────────────────────────────────
  // ready() + expand() + enableClosingConfirmation()
  // Silent no-op in browser mode
  initTelegramSDK();

  // ── Step 2: Environment flag ─────────────────────────────────────────────
  useUIStore.getState().setIsTelegram(isTelegramEnv());

  if (isMockMode()) {
    // eslint-disable-next-line no-console
    console.info('[bootstrap] Running in browser dev mode — using mock player');
  }

  // ── Step 3: Theme ────────────────────────────────────────────────────────
  // Reads Telegram themeParams (or Timurid defaults) → writes CSS vars → stores
  const theme = initTheme();
  useUIStore.getState().setTheme(theme);

  // ── Step 4: Safe area + viewport ─────────────────────────────────────────
  const safeArea = getSafeArea();
  const viewport = getViewportInfo();
  applySafeAreaToCSSVars(safeArea);
  applyViewportToCSSVars(viewport);
  useUIStore.getState().setSafeArea(safeArea);

  // ── Step 5: User data ────────────────────────────────────────────────────
  const profile = getTelegramUser();
  usePlayerStore.getState().setProfile(profile);

  // ── Step 6: Player progress ──────────────────────────────────────────────
  if (profile.telegramId !== 0) {
    const remoteProgress = await supabaseService.loadPlayerProgress(
      profile.telegramId,
    );
    if (remoteProgress) {
      usePlayerStore.getState().setProgress(remoteProgress);
    }
  }

  // Always check local storage as fallback / offline cache
  const localProgress = storageService.get<ReturnType<typeof usePlayerStore.getState>['progress']>('progress');
  if (localProgress && usePlayerStore.getState().progress.totalSnaps === 0) {
    usePlayerStore.getState().setProgress(localProgress);
  }
}
