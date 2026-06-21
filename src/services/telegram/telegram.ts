import { getTWA, isTelegramEnv } from '@/lib/telegram';
import type { ViewportChangedPayload } from '@/lib/telegram';

export interface SafeArea {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface ViewportInfo {
  height: number;
  stableHeight: number;
  isExpanded: boolean;
}

// ─── Initialisation ──────────────────────────────────────────────────────────

export function initTelegramSDK(): void {
  const twa = getTWA();
  if (!twa) return; // browser dev mode — silent no-op

  twa.ready();
  twa.expand();
  twa.enableClosingConfirmation();
}

// ─── Safe Area ───────────────────────────────────────────────────────────────

export function getSafeArea(): SafeArea {
  const twa = getTWA();
  if (!twa) return { top: 0, bottom: 0, left: 0, right: 0 };

  // contentSafeAreaInset accounts for Telegram chrome (header bar etc.)
  // safeAreaInset accounts for device notches / home bar
  // We prefer contentSafeAreaInset (TWA 7.x+); fall back to safeAreaInset then zero
  const inset =
    twa.contentSafeAreaInset ??
    twa.safeAreaInset ??
    { top: 0, bottom: 0, left: 0, right: 0 };

  return {
    top: inset.top,
    bottom: inset.bottom,
    left: inset.left,
    right: inset.right,
  };
}

// Writes safe area as CSS custom properties so any component can consume them
export function applySafeAreaToCSSVars(area: SafeArea): void {
  const r = document.documentElement;
  r.style.setProperty('--safe-area-top', `${area.top}px`);
  r.style.setProperty('--safe-area-bottom', `${area.bottom}px`);
  r.style.setProperty('--safe-area-left', `${area.left}px`);
  r.style.setProperty('--safe-area-right', `${area.right}px`);
}

// ─── Viewport ────────────────────────────────────────────────────────────────

export function getViewportInfo(): ViewportInfo {
  const twa = getTWA();
  if (!twa) {
    return {
      height: window.innerHeight,
      stableHeight: window.innerHeight,
      isExpanded: true,
    };
  }
  return {
    height: twa.viewportHeight,
    stableHeight: twa.viewportStableHeight,
    isExpanded: twa.isExpanded,
  };
}

// Also updates --viewport-height so Pixi canvas can size itself
export function applyViewportToCSSVars(info: ViewportInfo): void {
  document.documentElement.style.setProperty(
    '--viewport-height',
    `${info.stableHeight}px`,
  );
}

// ─── Event subscriptions ─────────────────────────────────────────────────────

// Returns an unsubscribe function
export function onViewportChanged(
  handler: (payload: ViewportChangedPayload) => void,
): () => void {
  const twa = getTWA();
  if (!twa) return () => {};
  twa.onEvent('viewportChanged', handler);
  return () => twa.offEvent('viewportChanged', handler);
}

export function onThemeChanged(handler: () => void): () => void {
  const twa = getTWA();
  if (!twa) return () => {};
  twa.onEvent('themeChanged', handler);
  return () => twa.offEvent('themeChanged', handler);
}

// ─── Re-exports ───────────────────────────────────────────────────────────────

export { isTelegramEnv };
