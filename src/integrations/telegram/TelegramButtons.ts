// ─── TelegramButtons ──────────────────────────────────────────────────────────
// MainButton and BackButton management for Telegram Mini Apps.
// All public functions are safe no-ops in browser mode.

import { getTWA, isTelegramEnv } from '@/lib/telegram';

// ── MainButton ────────────────────────────────────────────────────────────────
// The MainButton appears at the bottom of the Telegram UI. Used on the win
// screen to surface "NEXT LEVEL" natively without occupying game UI real estate.

/** Currently registered main-button handler (for cleanup). */
let _mainHandler: (() => void) | null = null;

/**
 * Show the MainButton with `text` and register `onClick`.
 * Previous handler is always unregistered first to avoid stale callbacks.
 */
export function showMainButton(text: string, onClick: () => void): void {
  if (!isTelegramEnv()) return;
  const twa = getTWA();
  if (!twa) return;

  // Clean up any previous handler.
  if (_mainHandler) {
    try { twa.MainButton.offClick(_mainHandler); } catch { /* noop */ }
    _mainHandler = null;
  }

  _mainHandler = onClick;
  try {
    twa.MainButton.setText(text)
      .onClick(_mainHandler)
      .show()
      .enable();
  } catch { /* optional API — older TWA versions */ }
}

/**
 * Hide the MainButton and unregister all click handlers.
 * Call this whenever leaving the win screen.
 */
export function hideMainButton(): void {
  if (!isTelegramEnv()) return;
  const twa = getTWA();
  if (!twa) return;

  try {
    if (_mainHandler) {
      twa.MainButton.offClick(_mainHandler);
      _mainHandler = null;
    }
    twa.MainButton.hide();
  } catch { /* noop */ }
}

// ── BackButton ────────────────────────────────────────────────────────────────
// Telegram's native back button (top-left chevron in the client chrome).
// Must be shown/hidden per-screen and the handler must be replaced, not stacked.

/** Currently registered back-button handler (for cleanup). */
let _backHandler: (() => void) | null = null;

/**
 * Register a new BackButton handler and show the button.
 * Automatically removes any previously registered handler first.
 */
export function registerBackButton(onBack: () => void): void {
  if (!isTelegramEnv()) return;
  const twa = getTWA();
  if (!twa) return;

  // Remove stale handler before registering the new one.
  if (_backHandler) {
    try { twa.BackButton.offClick(_backHandler); } catch { /* noop */ }
    _backHandler = null;
  }

  _backHandler = onBack;
  try {
    twa.BackButton.onClick(_backHandler).show();
  } catch { /* noop */ }
}

/**
 * Unregister the back button handler and hide the button.
 * Call this from the cleanup of any screen that registered it.
 */
export function unregisterBackButton(): void {
  if (!isTelegramEnv()) return;
  const twa = getTWA();
  if (!twa) return;

  try {
    if (_backHandler) {
      twa.BackButton.offClick(_backHandler);
      _backHandler = null;
    }
    twa.BackButton.hide();
  } catch { /* noop */ }
}
