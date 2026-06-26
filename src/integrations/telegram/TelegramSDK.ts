// ─── TelegramSDK ──────────────────────────────────────────────────────────────
// High-level wrapper around window.Telegram.WebApp with safe browser fallbacks.
// All methods are no-ops outside a real Telegram client — the app always runs.

import { getTWA, isTelegramEnv } from '@/lib/telegram';
import type { TelegramWebApp } from '@/lib/telegram';

// ── Detection ────────────────────────────────────────────────────────────────

/** True only inside a real Telegram WebApp client. */
export function isTelegram(): boolean {
  return isTelegramEnv();
}

/** Raw TWA object, or null in browser mode. Always null-check callers. */
export function getTelegramWebApp(): TelegramWebApp | null {
  return getTWA();
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────

/**
 * Call once on app boot.
 * Signals TWA the app is ready, expands to full-screen, enables closing
 * confirmation, and opts out of vertical swipes/overscroll.
 */
export function init(): void {
  const twa = getTWA();
  if (!twa) return; // browser mode — silent no-op

  // Signal readiness before any UI is painted.
  twa.ready();

  // Expand to the full screen height of the Telegram client.
  twa.expand();

  // Ask the user to confirm before accidentally closing the Mini App.
  twa.enableClosingConfirmation();

  // Disable vertical overscroll so pull-to-close doesn't interfere with gameplay.
  try { twa.disableVerticalSwipes?.(); } catch { /* optional API */ }

  // Dark Timurid background in the Telegram header/status bar area.
  try {
    twa.setHeaderColor?.('#1a0f00');
    twa.setBackgroundColor?.('#1a0f00');
  } catch { /* optional API */ }
}

export function expand(): void {
  getTWA()?.expand();
}

export function closeMiniApp(): void {
  getTWA()?.close();
}

// ── User ──────────────────────────────────────────────────────────────────────

export interface TelegramUser {
  id: number;
  firstName: string;
  lastName: string;
  username: string;
  languageCode: string;
  isPremium: boolean;
  photoUrl: string | null;
}

/** Reads initDataUnsafe.user and normalises field names. Null in browser mode. */
export function getUser(): TelegramUser | null {
  const user = getTWA()?.initDataUnsafe?.user;
  if (!user) return null;
  return {
    id: user.id,
    firstName: user.first_name,
    lastName: user.last_name ?? '',
    username: user.username ?? '',
    languageCode: user.language_code ?? 'en',
    isPremium: user.is_premium ?? false,
    photoUrl: user.photo_url ?? null,
  };
}

/**
 * Returns the best display name for the player:
 * Telegram first_name → "Guest" if unavailable.
 */
export function getUserDisplayName(): string {
  const u = getUser();
  if (!u) return 'Guest';
  return u.firstName || u.username || 'Guest';
}

// ── Theme ─────────────────────────────────────────────────────────────────────

export interface TelegramThemeSnapshot {
  bgColor: string;
  textColor: string;
  buttonColor: string;
  colorScheme: 'light' | 'dark';
}

export function getTheme(): TelegramThemeSnapshot {
  const twa = getTWA();
  return {
    bgColor: twa?.themeParams?.bg_color ?? '#1a0f00',
    textColor: twa?.themeParams?.text_color ?? '#F8F1E5',
    buttonColor: twa?.themeParams?.button_color ?? '#D4AF37',
    colorScheme: twa?.colorScheme ?? 'dark',
  };
}

// ── Platform ──────────────────────────────────────────────────────────────────

/**
 * Returns the Telegram platform string (e.g. "android", "ios", "tdesktop")
 * or "browser" in non-Telegram environments.
 */
export function getPlatform(): string {
  return getTWA()?.platform ?? 'browser';
}

export function getVersion(): string {
  return getTWA()?.version ?? '0.0';
}
