// ─── EconomyService ───────────────────────────────────────────────────────────
// Persists coins, hints, hearts, and shards to the `economy` table.
// Always fires async after a local store write — gameplay is never blocked.

import { supabase } from '@/lib/supabase';

export interface EconomySnapshot {
  coins: number;
  hints: number;
  hearts: number;
  shards: number;
}

class EconomyService {
  /**
   * Upsert the player's full economy snapshot.
   * Only called on significant events (purchase, reward claim, level complete).
   */
  async save(telegramId: number, snapshot: EconomySnapshot): Promise<void> {
    if (!supabase || telegramId === 0) return;
    try {
      const { error } = await supabase.from('economy').upsert(
        {
          telegram_id: telegramId,
          coins: snapshot.coins,
          hints: snapshot.hints,
          hearts: snapshot.hearts,
          shards: snapshot.shards,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'telegram_id' },
      );
      if (error) throw error;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[economy] save failed — localStorage already persisted.', err);
    }
  }

  /**
   * Load economy from remote. Returns null on any failure.
   * Local values are always the primary source; remote only wins when strictly
   * higher (prevents stale remote state from overwriting newer local data).
   */
  async load(telegramId: number): Promise<EconomySnapshot | null> {
    if (!supabase || telegramId === 0) return null;
    try {
      const { data, error } = await supabase
        .from('economy')
        .select('coins, hints, hearts, shards')
        .eq('telegram_id', telegramId)
        .single();

      if (error || !data) return null;
      return {
        coins:  (data.coins  as number) ?? 0,
        hints:  (data.hints  as number) ?? 0,
        hearts: (data.hearts as number) ?? 3,
        shards: (data.shards as number) ?? 0,
      };
    } catch {
      return null;
    }
  }
}

export const economyService = new EconomyService();
