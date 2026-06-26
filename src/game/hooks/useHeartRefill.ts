import { useEffect, useState } from 'react';
import { useGameStore, MAX_HEARTS, HEART_REGEN_MS } from '@/store/gameStore';

export interface HeartRefillState {
  hearts: number;
  full: boolean;
  /** Milliseconds until the next heart regenerates (0 when full). */
  msUntilNext: number;
}

/**
 * Drives the live heart-refill countdown. While mounted it ticks once per second,
 * granting any regenerated hearts and recomputing the time until the next one.
 * Mount it wherever the heart timer is shown (in-game HUD, main menu).
 */
export function useHeartRefill(): HeartRefillState {
  const hearts = useGameStore((s) => s.hearts);
  const lastRefillTs = useGameStore((s) => s.lastRefillTs);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    // Catch up immediately on mount (covers returning from another scene/app).
    useGameStore.getState().applyRefill();
    const id = window.setInterval(() => {
      useGameStore.getState().applyRefill();
      setNow(Date.now());
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  const full = hearts >= MAX_HEARTS;
  const elapsedInCurrent = (now - lastRefillTs) % HEART_REGEN_MS;
  const msUntilNext = full ? 0 : Math.max(0, HEART_REGEN_MS - elapsedInCurrent);

  return { hearts, full, msUntilNext };
}

/** Format a millisecond duration as "M:SS" for the heart countdown. */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
