import { getTWA } from '@/lib/telegram';

// ── Public API types ──────────────────────────────────────────────────────────

export type HapticEvent =
  | 'light'       // button tap, menu open/close
  | 'medium'      // hint used
  | 'heavy'       // internal — used as part of win combo
  | 'success'     // correct snap
  | 'warning'     // wrong drop
  | 'error'       // life lost
  | 'win';        // win combo: heavy → 90 ms → success

// ── How long each event locks itself against re-trigger (ms) ─────────────────
// Prevents vibration spam when the user mashes quickly.
const COOLDOWN_MS: Record<HapticEvent, number> = {
  light:   80,
  medium:  110,
  heavy:   120,
  success: 120,
  warning: 115,
  error:   150,
  win:     800,   // one-time celebration — no repeat needed
};

// ── navigator.vibrate fallback patterns ──────────────────────────────────────
// Tuples are [on, off, on, …] millisecond sequences.
// Single numbers are a single pulse.
const VIBRATE: Record<Exclude<HapticEvent, 'win'>, number | number[]> = {
  light:   8,
  medium:  20,
  heavy:   40,
  success: [12, 60, 20],        // two quick pulses — "yes!"
  warning: [18, 35, 18],        // soft interrupted double-tap — "oops"
  error:   [28, 20, 28, 20, 28],// three short sharp pulses — "life lost"
};

// ── Manager ───────────────────────────────────────────────────────────────────

class HapticsManagerClass {
  private lastAt  = new Map<HapticEvent, number>();
  // Detect vibration support once at construction time
  private canVibrate = typeof navigator !== 'undefined' && 'vibrate' in navigator;

  /** Fire a named haptic event. Silently no-ops if unsupported or debounced. */
  trigger(event: HapticEvent): void {
    const now     = Date.now();
    const lastFired = this.lastAt.get(event) ?? 0;

    if (now - lastFired < COOLDOWN_MS[event]) return; // debounced — skip
    this.lastAt.set(event, now);

    if (event === 'win') {
      // Win combo: heavy impact → brief pause → success notification
      this._fire('heavy');
      setTimeout(() => this._fire('success'), 90);
      return;
    }

    this._fire(event);
  }

  // ── Internal fire — does NOT debounce (debounce lives in trigger()) ─────────
  private _fire(event: Exclude<HapticEvent, 'win'>): void {
    const twa = getTWA();

    if (twa) {
      // ── Telegram WebApp haptics (preferred — most precise on mobile) ────────
      try {
        if (event === 'success' || event === 'warning' || event === 'error') {
          twa.HapticFeedback.notificationOccurred(event);
        } else {
          // 'light' | 'medium' | 'heavy' map 1-to-1 to TWA impact styles
          twa.HapticFeedback.impactOccurred(event as 'light' | 'medium' | 'heavy');
        }
      } catch {
        // Older TWA versions may not support the method — fall through silently
      }
      return; // Telegram handled it; skip browser fallback to avoid double-fire
    }

    // ── Browser vibration fallback ───────────────────────────────────────────
    if (this.canVibrate) {
      try {
        navigator.vibrate(VIBRATE[event]);
      } catch {
        // navigator.vibrate can throw if the document loses focus — safe to ignore
      }
    }
  }
}

export const hapticsManager = new HapticsManagerClass();
