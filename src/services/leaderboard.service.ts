// ─── LeaderboardService ───────────────────────────────────────────────────────
// Writes to and reads from the `leaderboard` table.
// Leaderboard tracks per-level best stars + total completed levels per player.

import { supabase } from '@/lib/supabase';

export interface LeaderboardEntry {
  telegramId: number;
  displayName: string;
  totalStars: number;
  completedLevels: number;
  updatedAt: string;
}

export interface LevelEntry {
  telegramId: number;
  displayName: string;
  stars: number;
  completedAt: string;
}

class LeaderboardService {
  /**
   * Atomically recompute the player's global leaderboard row via the
   * `update_leaderboard` RPC (sums stars + counts levels inside a transaction).
   * Falls back to a direct upsert if the RPC is unavailable.
   */
  async updateGlobal(
    telegramId: number,
    displayName: string,
    totalStars: number,
    completedLevels: number,
  ): Promise<void> {
    if (!supabase || telegramId === 0) return;
    try {
      // Prefer the atomic RPC (migration 0008).
      const { error } = await supabase.rpc('update_leaderboard', {
        p_telegram_id: telegramId,
        p_display_name: displayName,
      });
      if (error) {
        // RPC not deployed yet — fall back to direct upsert.
        const { error: e2 } = await supabase.from('leaderboard').upsert(
          { telegram_id: telegramId, display_name: displayName, total_stars: totalStars, completed_levels: completedLevels },
          { onConflict: 'telegram_id' },
        );
        if (e2) throw e2;
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[leaderboard] updateGlobal failed — no-op.', err);
    }
  }

  /**
   * Upsert the player's best score for a specific level via the
   * `upsert_level_score` RPC (which guards against star regression).
   */
  async updateLevel(
    telegramId: number,
    displayName: string,
    levelId: number,
    stars: number,
  ): Promise<void> {
    if (!supabase || telegramId === 0) return;
    try {
      const { error } = await supabase.rpc('upsert_level_score', {
        p_telegram_id: telegramId,
        p_display_name: displayName,
        p_level_id: levelId,
        p_stars: stars,
      });
      if (error) {
        // RPC not deployed yet — fall back to direct upsert.
        const { error: e2 } = await supabase.from('leaderboard_levels').upsert(
          { telegram_id: telegramId, display_name: displayName, level_id: levelId, stars },
          { onConflict: 'telegram_id,level_id' },
        );
        if (e2) throw e2;
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[leaderboard] updateLevel failed — no-op.', err);
    }
  }

  /** Fetch the global top-N leaderboard. */
  async getGlobalTop(limit = 20): Promise<LeaderboardEntry[]> {
    if (!supabase) return [];
    try {
      const { data, error } = await supabase
        .from('leaderboard')
        .select('telegram_id, display_name, total_stars, completed_levels, updated_at')
        .order('total_stars', { ascending: false })
        .order('completed_levels', { ascending: false })
        .limit(limit);

      if (error || !data) return [];

      return data.map((row) => ({
        telegramId: row.telegram_id as number,
        displayName: row.display_name as string,
        totalStars: row.total_stars as number,
        completedLevels: row.completed_levels as number,
        updatedAt: row.updated_at as string,
      }));
    } catch {
      return [];
    }
  }

  /** Fetch top-N for a specific level. */
  async getLevelTop(levelId: number, limit = 20): Promise<LevelEntry[]> {
    if (!supabase) return [];
    try {
      const { data, error } = await supabase
        .from('leaderboard_levels')
        .select('telegram_id, display_name, stars, completed_at')
        .eq('level_id', levelId)
        .order('stars', { ascending: false })
        .order('completed_at', { ascending: true })
        .limit(limit);

      if (error || !data) return [];

      return data.map((row) => ({
        telegramId: row.telegram_id as number,
        displayName: row.display_name as string,
        stars: row.stars as number,
        completedAt: row.completed_at as string,
      }));
    } catch {
      return [];
    }
  }
}

export const leaderboardService = new LeaderboardService();
