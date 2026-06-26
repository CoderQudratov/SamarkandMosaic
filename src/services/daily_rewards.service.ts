// ─── DailyRewardsService ──────────────────────────────────────────────────────
// Persists daily-reward streak to `daily_rewards`.
// Loaded on boot to restore streak from a different device.

import { supabase } from '@/lib/supabase';

export interface DailyRewardState {
  streakDay: number;
  lastClaimAt: number; // ms epoch
}

class DailyRewardsService {
  /** Upsert after a successful claim. */
  async save(telegramId: number, state: DailyRewardState): Promise<void> {
    if (!supabase || telegramId === 0) return;
    try {
      const { error } = await supabase.from('daily_rewards').upsert(
        {
          telegram_id: telegramId,
          streak_day: state.streakDay,
          last_claim_at: new Date(state.lastClaimAt).toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'telegram_id' },
      );
      if (error) throw error;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[daily_rewards] save failed — localStorage already persisted.', err);
    }
  }

  /** Load from remote. Returns null on failure or when no row exists. */
  async load(telegramId: number): Promise<DailyRewardState | null> {
    if (!supabase || telegramId === 0) return null;
    try {
      const { data, error } = await supabase
        .from('daily_rewards')
        .select('streak_day, last_claim_at')
        .eq('telegram_id', telegramId)
        .single();

      if (error || !data) return null;

      return {
        streakDay: (data.streak_day as number) ?? 1,
        lastClaimAt: data.last_claim_at
          ? new Date(data.last_claim_at as string).getTime()
          : 0,
      };
    } catch {
      return null;
    }
  }
}

export const dailyRewardsService = new DailyRewardsService();
