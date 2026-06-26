// ─── EconomySystem ────────────────────────────────────────────────────────────
// Pure functions for all economy calculations. No side effects — callers decide
// what to do with the result (UI display, store updates, etc.).

import { CONFIG } from '@/constants';
import { getLevelMeta } from '@/game/levels/registry';

export interface LevelRewardBreakdown {
  base: number;
  perfectBonus: number;
  speedBonus: number;
  total: number;
}

// ── Reward calculators ────────────────────────────────────────────────────────

/**
 * Base reward for completing a level: pieceCount × 5.
 * Falls back to CONFIG.coins.completion for unknown level ids.
 *
 * Examples:
 *   Level 1  (4  pieces) = 20 coins
 *   Level 5  (12 pieces) = 60 coins
 *   Level 10 (32 pieces) = 160 coins
 */
export function getLevelReward(levelId: number): number {
  const meta = getLevelMeta(levelId);
  return meta ? meta.baseReward : CONFIG.coins.completion;
}

/**
 * Bonus when the player earns 3 stars (no mistakes, no hint).
 */
export function getPerfectBonus(earnedStars: number): number {
  return earnedStars === 3 ? CONFIG.coins.perfectBonus : 0;
}

/**
 * Bonus when the level was cleared in under 60 seconds.
 */
export function getSpeedBonus(elapsedMs: number): number {
  return elapsedMs < 60_000 ? CONFIG.coins.speedBonus : 0;
}

/**
 * Full breakdown of coins earned for a level completion.
 * @param levelId — 1-based level number (drives the difficulty-scaled base reward)
 */
export function calcLevelReward(
  earnedStars: number,
  elapsedMs: number,
  levelId: number,
): LevelRewardBreakdown {
  const base = getLevelReward(levelId);
  const perfectBonus = getPerfectBonus(earnedStars);
  const speedBonus = getSpeedBonus(elapsedMs);
  return { base, perfectBonus, speedBonus, total: base + perfectBonus + speedBonus };
}

// ── Cost queries ──────────────────────────────────────────────────────────────

/** Coin cost of a single hint. */
export function getHintCost(): number {
  return CONFIG.coins.hintCost;
}

/** Coin cost of a full heart refill (0 → 3). */
export function getHeartRefillCost(): number {
  return CONFIG.coins.heartRefillCost;
}

// ── Last win payload ──────────────────────────────────────────────────────────
// PuzzleBoard writes this after each win; WinScene reads it to display the
// breakdown. Module-level singleton avoids creating a new Zustand store slice.

export interface WinPayload {
  breakdown: LevelRewardBreakdown;
  earnedStars: number;
}

let _lastWin: WinPayload | null = null;

export function setLastWinPayload(payload: WinPayload): void {
  _lastWin = payload;
}

export function getLastWinPayload(): WinPayload | null {
  return _lastWin;
}
