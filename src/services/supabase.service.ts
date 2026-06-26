import { supabase } from '@/lib/supabase';
import type { PlayerProgress } from '@/game/types';

export class SupabaseService {
  // True only when valid credentials were provided at build time.
  get isEnabled(): boolean {
    return supabase !== null;
  }

  async loadPlayerProgress(telegramId: number): Promise<PlayerProgress | null> {
    if (!supabase) return null; // remote disabled — caller falls back to local

    try {
      const { data, error } = await supabase
        .from('player_progress')
        .select('*')
        .eq('telegram_id', telegramId)
        .single();

      if (error || !data) return null;

      return {
        completedLevels: data.completed_levels ?? [],
        highestLevel: data.highest_level ?? 0,
        totalSnaps: data.total_snaps ?? 0,
        stars: data.stars ?? {},
      };
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[supabase] loadPlayerProgress failed — ignoring.', err);
      return null;
    }
  }

  async savePlayerProgress(
    telegramId: number,
    progress: PlayerProgress,
  ): Promise<void> {
    if (!supabase) return; // remote disabled — no-op

    try {
      await supabase.from('player_progress').upsert({
        telegram_id: telegramId,
        completed_levels: progress.completedLevels,
        highest_level: progress.highestLevel,
        total_snaps: progress.totalSnaps,
        updated_at: new Date().toISOString(),
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[supabase] savePlayerProgress failed — ignoring.', err);
    }
  }
}

export const supabaseService = new SupabaseService();
