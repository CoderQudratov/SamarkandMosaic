// ─── ProfileService ───────────────────────────────────────────────────────────
// Upserts and reads the `profiles` table.
// Never throws — every method swallows errors so gameplay is never blocked.

import { supabase } from '@/lib/supabase';
import type { PlayerProfile } from '@/game/types';

interface DbProfile {
  telegram_id: number;
  username: string | null;
  first_name: string;
  last_name: string | null;
  display_name: string;
  language_code: string;
  is_premium: boolean;
  photo_url: string | null;
  last_seen_at: string;
}

function profileToRow(p: PlayerProfile): DbProfile {
  return {
    telegram_id: p.telegramId,
    username: p.username || null,
    first_name: p.firstName,
    last_name: p.lastName || null,
    display_name: p.displayName,
    language_code: p.language,
    is_premium: p.isPremium,
    photo_url: p.photoUrl,
    last_seen_at: new Date().toISOString(),
  };
}

class ProfileService {
  /**
   * Upsert the player's Telegram profile. Called once on app boot.
   * Conflict target: telegram_id (PK).
   */
  async upsert(profile: PlayerProfile): Promise<void> {
    if (!supabase || profile.telegramId === 0) return;
    try {
      const { error } = await supabase
        .from('profiles')
        .upsert(profileToRow(profile), { onConflict: 'telegram_id' });
      if (error) throw error;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[profiles] upsert failed — continuing offline.', err);
    }
  }

  /** Load display name override from remote (e.g. player changed it on another device). */
  async loadDisplayName(telegramId: number): Promise<string | null> {
    if (!supabase) return null;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('telegram_id', telegramId)
        .single();
      if (error || !data) return null;
      return data.display_name as string;
    } catch {
      return null;
    }
  }
}

export const profileService = new ProfileService();
