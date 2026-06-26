// ─── TelegramHaptics ──────────────────────────────────────────────────────────
// Named game-event haptic wrappers that route to Telegram native haptics or
// the existing HapticsManager (which in turn falls back to navigator.vibrate).
// Every function is a guaranteed safe no-op when Telegram is unavailable.

import { getTWA } from '@/lib/telegram';
import { hapticsManager } from '@/game/haptics/HapticsManager';

// ── Primitives ────────────────────────────────────────────────────────────────

function impact(style: 'light' | 'medium' | 'heavy'): void {
  try { getTWA()?.HapticFeedback.impactOccurred(style); } catch { /* noop */ }
}

function notify(type: 'success' | 'error' | 'warning'): void {
  try { getTWA()?.HapticFeedback.notificationOccurred(type); } catch { /* noop */ }
}

// ── Named wrappers ─────────────────────────────────────────────────────────────

/**
 * Correct piece snap → light impact.
 * Prefer Telegram native; fall back to hapticsManager (which uses vibrate).
 */
export function impactLight(): void {
  impact('light');
}

/**
 * Buying in the shop, hint used → medium impact.
 */
export function impactMedium(): void {
  impact('medium');
}

/**
 * Win celebration, daily reward claimed → success notification.
 */
export function hapticSuccess(): void {
  notify('success');
}

/**
 * Wrong piece drop, locked level tap → error notification.
 */
export function hapticError(): void {
  notify('error');
}

// ── Game-event mappings ────────────────────────────────────────────────────────
// These map semantic game events to the correct haptic.
// They route through hapticsManager (which already has debounce + vibrate
// fallback) so we never need to duplicate that logic here.

/** Correct snap placement. */
export function onSnap(): void {
  hapticsManager.trigger('success');
}

/** Wrong piece drop. */
export function onWrongDrop(): void {
  hapticsManager.trigger('warning');
  setTimeout(() => hapticsManager.trigger('error'), 60); // life-lost stagger
}

/** Puzzle win. */
export function onWin(): void {
  hapticsManager.trigger('win');
}

/** Shop purchase. */
export function onPurchase(): void {
  hapticsManager.trigger('medium');
}

/** Button tap / navigation. */
export function onTap(): void {
  hapticsManager.trigger('light');
}
