// ─── SyncService ──────────────────────────────────────────────────────────────
// Coordinates all Supabase write operations.
//
// Design rules:
//   1. Every write is fire-and-forget — callers never await.
//   2. localStorage is always written FIRST by the individual store actions.
//      Remote sync is a best-effort copy, never the primary source on write.
//   3. On boot, remote can upgrade local state (higher totalSnaps, bigger coins,
//      further streak) but never downgrade it.
//   4. A single 300ms debounce per sync type prevents spam writes.
//   5. Guest users (telegramId === 0) are skipped silently.

import { usePlayerStore } from '@/store/playerStore';
import { useGameStore } from '@/store/gameStore';
import { profileService } from './profile.service';
import { progressService } from './progress.service';
import { economyService } from './economy.service';
import { dailyRewardsService } from './daily_rewards.service';
import { storageService } from './storage.service';

// ── Debounce map ──────────────────────────────────────────────────────────────
const _debounce: Map<string, ReturnType<typeof setTimeout>> = new Map();

function debounce(key: string, ms: number, fn: () => void): void {
  const existing = _debounce.get(key);
  if (existing) clearTimeout(existing);
  _debounce.set(key, setTimeout(() => { _debounce.delete(key); fn(); }, ms));
}

// ── Retry helper ──────────────────────────────────────────────────────────────
async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 2,
  delayMs = 1500,
): Promise<T | null> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch {
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, delayMs * (attempt + 1)));
      }
    }
  }
  return null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getTelegramId(): number {
  return usePlayerStore.getState().profile?.telegramId ?? 0;
}

// ── Public API ─────────────────────────────────────────────────────────────────

const sync = {
  // ── Profile ─────────────────────────────────────────────────────────────────

  /** Upsert profile on boot (debounced — only fires once even if called twice). */
  profile(): void {
    const profile = usePlayerStore.getState().profile;
    if (!profile || profile.telegramId === 0) return;
    debounce('profile', 300, () => profileService.upsert(profile));
  },

  // ── Progress ─────────────────────────────────────────────────────────────────

  /** Called after a level is completed. Stars arg kept for API stability. */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  levelComplete(_levelId: number, _stars: number): void {
    const tid = getTelegramId();
    if (!tid) return;

    const { progress } = usePlayerStore.getState();

    debounce('progress', 300, () =>
      withRetry(() => progressService.save(tid, progress)),
    );
    debounce('economy-win', 500, () => {
      const { coins, hints, shards } = usePlayerStore.getState();
      const hearts = useGameStore.getState().hearts;
      return economyService.save(tid, { coins, hints, hearts, shards: shards ?? 0 });
    });
  },

  // ── Economy ──────────────────────────────────────────────────────────────────

  /** Called after any coin/hint/heart/shard change (purchase, reward, etc.). */
  economy(): void {
    const tid = getTelegramId();
    if (!tid) return;
    const { coins, hints, shards } = usePlayerStore.getState();
    const hearts = useGameStore.getState().hearts;
    debounce('economy', 300, () =>
      economyService.save(tid, { coins, hints, hearts, shards: shards ?? 0 }),
    );
  },

  // ── Daily reward ─────────────────────────────────────────────────────────────

  /** Called immediately after claimDailyReward() returns a non-zero amount. */
  dailyReward(streakDay: number, lastClaimAt: number): void {
    const tid = getTelegramId();
    if (!tid) return;
    debounce('daily', 300, () =>
      dailyRewardsService.save(tid, { streakDay, lastClaimAt }),
    );
  },

  // ── Boot load ─────────────────────────────────────────────────────────────────

  /**
   * Called from bootstrapAsync. Loads all remote state and merges into stores.
   * Returns when complete or times out — never throws.
   */
  async bootLoad(telegramId: number): Promise<void> {
    if (!telegramId) return;

    const TIMEOUT = 3000;
    const race = <T>(p: Promise<T>): Promise<T | null> =>
      Promise.race([p, new Promise<null>((r) => setTimeout(() => r(null), TIMEOUT))]);

    await Promise.allSettled([
      // ── Progress ──────────────────────────────────────────────────────────
      race(progressService.load(telegramId)).then((remote) => {
        if (!remote) return;
        const local = usePlayerStore.getState().progress;
        if (remote.totalSnaps >= local.totalSnaps) {
          usePlayerStore.getState().setProgress({
            ...remote,
            stars: { ...local.stars, ...remote.stars },
          });
        }
      }),

      // ── Economy ───────────────────────────────────────────────────────────
      race(economyService.load(telegramId)).then((remote) => {
        if (!remote) return;
        const local = usePlayerStore.getState();
        // Only adopt remote value if it's strictly higher (avoids overwrite by stale remote).
        if (remote.coins > local.coins) {
          usePlayerStore.setState({ coins: remote.coins });
          storageService.set('coins', remote.coins);
        }
        if (remote.hints > local.hints) {
          usePlayerStore.setState({ hints: remote.hints });
          storageService.set('hints', remote.hints);
        }
      }),

      // ── Daily reward ──────────────────────────────────────────────────────
      race(dailyRewardsService.load(telegramId)).then((remote) => {
        if (!remote) return;
        const LOCAL_KEY = 'daily';
        const localRaw = storageService.get<{ streakDay: number; lastClaimAt: number }>(LOCAL_KEY);
        const localTs = localRaw?.lastClaimAt ?? 0;
        // Remote wins if it recorded a more recent claim.
        if (remote.lastClaimAt > localTs) {
          storageService.set(LOCAL_KEY, { streakDay: remote.streakDay, lastClaimAt: remote.lastClaimAt });
        }
      }),
    ]);
  },
};

export { sync };
