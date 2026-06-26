// ─── DailyRewardSystem ───────────────────────────────────────────────────────
// Manages the daily login streak and reward eligibility. Pure module — no React.
//
// Streak rules:
//   • Claimable once per calendar day (00:00 local time boundary).
//   • If the player returns the next calendar day → streak continues.
//   • If >1 calendar day has been missed since the last claim → streak resets to 1.
//   • Day 7 is the maximum; after day 7 it wraps back to 1.
//
// Storage: single key  sm_daily  = { streakDay, lastClaimAt (ms epoch) }

import { storageService } from '@/services/storage.service';
import { usePlayerStore } from '@/store/playerStore';
import { saveSystem } from '@/game/systems/SaveSystem';
import { sync } from '@/services/sync.service';
import { syncManager } from '@/game/systems/SyncManager';

const DAILY_KEY = 'daily';

// ── Reward table ──────────────────────────────────────────────────────────────
// Index 0 = Day 1, index 6 = Day 7.
export const DAILY_REWARDS: ReadonlyArray<{ day: number; coins: number }> = [
  { day: 1, coins: 50  },
  { day: 2, coins: 75  },
  { day: 3, coins: 100 },
  { day: 4, coins: 150 },
  { day: 5, coins: 200 },
  { day: 6, coins: 300 },
  { day: 7, coins: 500 },
] as const;

// ── Persistence ────────────────────────────────────────────────────────────────

interface DailyState {
  streakDay: number;   // 1–7 (day that will be claimed next)
  lastClaimAt: number; // ms epoch of the last successful claim (0 = never)
}

function loadState(): DailyState {
  const saved = storageService.get<Partial<DailyState>>(DAILY_KEY);
  const streakDay =
    typeof saved?.streakDay === 'number' && saved.streakDay >= 1 && saved.streakDay <= 7
      ? saved.streakDay
      : 1;
  const lastClaimAt =
    typeof saved?.lastClaimAt === 'number' && saved.lastClaimAt > 0
      ? saved.lastClaimAt
      : 0;
  return { streakDay, lastClaimAt };
}

function saveState(state: DailyState): void {
  storageService.set(DAILY_KEY, state);
}

// ── Calendar helpers ──────────────────────────────────────────────────────────

/** Start of the current calendar day in ms (local midnight). */
function todayMs(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** How many calendar days have elapsed since `claimedAtMs`. */
function calendarDaysSince(claimedAtMs: number): number {
  if (claimedAtMs <= 0) return Infinity;
  const today = todayMs();
  const claimDay = new Date(claimedAtMs);
  claimDay.setHours(0, 0, 0, 0);
  return Math.round((today - claimDay.getTime()) / 86_400_000);
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface DailyStatus {
  /** True when the player may claim their reward right now. */
  claimable: boolean;
  /** Current streak day index (1–7). */
  streakDay: number;
  /** Coins awarded for claiming today's day. */
  coinsForToday: number;
  /** Ms until midnight (next claim window opens). 0 when claimable. */
  msUntilNextClaim: number;
  /** Epoch ms of the last claim, or 0. */
  lastClaimAt: number;
}

export function getDailyStatus(): DailyStatus {
  const { streakDay, lastClaimAt } = loadState();
  const daysSince = calendarDaysSince(lastClaimAt);
  const claimable = daysSince >= 1; // at least a new calendar day has passed
  const coinsForToday = DAILY_REWARDS[Math.min(streakDay - 1, 6)].coins;

  // Time until the next calendar day (midnight local).
  const now = Date.now();
  const tomorrowMidnight = todayMs() + 86_400_000;
  const msUntilNextClaim = claimable ? 0 : Math.max(0, tomorrowMidnight - now);

  return { claimable, streakDay, coinsForToday, msUntilNextClaim, lastClaimAt };
}

/**
 * Claim today's reward. Call only when `getDailyStatus().claimable` is true.
 * Returns the coins awarded (or 0 if ineligible).
 */
export function claimDailyReward(): number {
  const { streakDay, lastClaimAt } = loadState();
  const daysSince = calendarDaysSince(lastClaimAt);

  if (daysSince < 1) return 0; // already claimed today — shouldn't happen if UI is correct

  // If the player missed more than one calendar day, streak resets to 1.
  const nextDay = daysSince > 1 ? 1 : Math.min(streakDay + (lastClaimAt === 0 ? 0 : 1), 7);
  // On the very first ever claim, streakDay is already 1 — don't advance it.
  const claimDay = lastClaimAt === 0 ? 1 : nextDay;
  const coins = DAILY_REWARDS[Math.min(claimDay - 1, 6)].coins;

  // Persist new state: after claiming day N, streakDay advances to N+1 (wraps to 1 after 7).
  const nextStreakDay = claimDay >= 7 ? 1 : claimDay + 1;
  saveState({ streakDay: nextStreakDay, lastClaimAt: Date.now() });

  // Apply reward to economy (addCoins persists to localStorage automatically).
  usePlayerStore.getState().addCoins(coins);
  // Unified local save.
  saveSystem.save();
  // Remote sync: streak state + economy (fire-and-forget).
  sync.dailyReward(nextStreakDay, Date.now());
  sync.economy();
  syncManager.bumpVersion(); // reward claim

  return coins;
}

/** Clear daily state — used by SaveSystem.reset(). */
export function resetDailyState(): void {
  storageService.remove(DAILY_KEY);
}
