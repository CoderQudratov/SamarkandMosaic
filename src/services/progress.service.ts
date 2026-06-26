// ─── ProgressService ──────────────────────────────────────────────────────────
// Syncs level-completion state to the `progress` table.
//
// Schema note: completed_levels is jsonb (JSON array) in the MVP schema,
// not a Postgres integer[]. We store it as a plain JSON array: [1, 2, 3].

import { supabase } from '@/lib/supabase';
import type { PlayerProgress } from '@/game/types';

class ProgressService {
  /**
   * Full upsert of player progress. Called after level complete (fire-and-forget).
   */
  async save(telegramId: number, progress: PlayerProgress): Promise<void> {
    if (!supabase || telegramId === 0) return;
    try {
      const { error } = await supabase.from('progress').upsert(
        {
          telegram_id: telegramId,
          // jsonb column — pass as a plain JS array; supabase-js serialises it
          completed_levels: progress.completedLevels,
          highest_level: progress.highestLevel,
          total_snaps: progress.totalSnaps,
          stars: progress.stars ?? {},
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'telegram_id' },
      );
      if (error) throw error;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[progress] save failed — localStorage already persisted.', err);
    }
  }

  /**
   * Load progress from remote. Returns null on any failure — localStorage wins.
   */
  async load(telegramId: number): Promise<PlayerProgress | null> {
    if (!supabase || telegramId === 0) return null;
    try {
      const { data, error } = await supabase
        .from('progress')
        .select('completed_levels, highest_level, total_snaps, stars')
        .eq('telegram_id', telegramId)
        .single();

      if (error || !data) return null;

      // completed_levels is stored as jsonb array; parse carefully.
      const rawLevels = data.completed_levels;
      const completedLevels: number[] = Array.isArray(rawLevels)
        ? (rawLevels as unknown[]).filter((v): v is number => typeof v === 'number')
        : [];

      return {
        completedLevels,
        highestLevel: (data.highest_level as number) ?? 0,
        totalSnaps:   (data.total_snaps   as number) ?? 0,
        stars:        (data.stars as Record<string, number>) ?? {},
      };
    } catch {
      return null;
    }
  }

  /**
   * Record a single level completion atomically.
   * Best-effort: if it races, the full save() on the next boot wins.
   */
  async recordLevelComplete(
    telegramId: number,
    levelId: number,
    stars: number,
    totalSnaps: number,
  ): Promise<void> {
    if (!supabase || telegramId === 0) return;
    try {
      const { data } = await supabase
        .from('progress')
        .select('completed_levels, stars, highest_level, total_snaps')
        .eq('telegram_id', telegramId)
        .single();

      // Build merged state from whatever remote has (or zeros if first run).
      const rawLevels = data?.completed_levels;
      const completedLevels: number[] = Array.isArray(rawLevels)
        ? (rawLevels as unknown[]).filter((v): v is number => typeof v === 'number')
        : [];
      if (!completedLevels.includes(levelId)) completedLevels.push(levelId);

      const remoteStars = (data?.stars as Record<string, number>) ?? {};
      const bestStars = Math.max(remoteStars[levelId] ?? 0, stars);

      await supabase.from('progress').upsert(
        {
          telegram_id: telegramId,
          completed_levels: completedLevels,
          highest_level: Math.max((data?.highest_level as number) ?? 0, levelId),
          total_snaps: Math.max((data?.total_snaps as number) ?? 0, totalSnaps),
          stars: { ...remoteStars, [levelId]: bestStars },
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'telegram_id' },
      );
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[progress] recordLevelComplete failed — no-op.', err);
    }
  }
}

export const progressService = new ProgressService();
