import { supabase } from '@/lib/supabase';
import type { PlayerProgress } from '@/game/types';

export class SupabaseService {
  async loadPlayerProgress(telegramId: number): Promise<PlayerProgress | null> {
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
    };
  }

  async savePlayerProgress(
    telegramId: number,
    progress: PlayerProgress,
  ): Promise<void> {
    await supabase.from('player_progress').upsert({
      telegram_id: telegramId,
      completed_levels: progress.completedLevels,
      highest_level: progress.highestLevel,
      total_snaps: progress.totalSnaps,
      updated_at: new Date().toISOString(),
    });
  }
}

export const supabaseService = new SupabaseService();
