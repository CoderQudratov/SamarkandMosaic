// ─── StreamLoader ─────────────────────────────────────────────────────────────
// Background streaming: while the player works on the current level, silently
// decode the next two levels so transitions are instant. Also bounds memory by
// releasing levels outside the current window (current + next two).
//
// Fully silent — missing/unauthored levels simply no-op. Scheduled on idle time
// so it never competes with the active level's interactions.

import { assetCache } from './AssetCache';
import { preloadLevel, levelDirId } from './LevelLoader';

const LOOKAHEAD = 2;

type IdleScheduler = (cb: () => void) => void;

const scheduleIdle: IdleScheduler =
  typeof window !== 'undefined' &&
  'requestIdleCallback' in window
    ? (cb) =>
        (window as unknown as {
          requestIdleCallback: (c: () => void, o?: { timeout: number }) => void;
        }).requestIdleCallback(cb, { timeout: 2500 })
    : (cb) => window.setTimeout(cb, 350);

/** Level ids that should stay resident given the current level. */
function residentWindow(currentLevelId: string): string[] {
  const n = parseInt(currentLevelId.replace('level-', ''), 10);
  if (!Number.isFinite(n)) return [currentLevelId];
  const ids = [currentLevelId];
  for (let i = 1; i <= LOOKAHEAD; i++) ids.push(levelDirId(n + i));
  return ids;
}

/**
 * Trigger background prefetch of the next `LOOKAHEAD` levels and release any
 * level art outside the resident window. Safe to call repeatedly.
 */
export function streamNextLevels(currentLevelId: string): void {
  const window = residentWindow(currentLevelId);

  // Free memory first so prefetching the new neighbours stays bounded.
  assetCache.unloadExcept(window);

  const upcoming = window.slice(1); // exclude the current level
  if (upcoming.length === 0) return;

  scheduleIdle(() => {
    for (const id of upcoming) {
      // Skip levels already (or nearly) resident; preloadLevel de-dups anyway.
      preloadLevel(id).catch(() => {
        /* missing/failed upcoming level — streaming is best-effort */
      });
    }
  });
}
