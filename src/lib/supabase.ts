import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { CONFIG } from '@/constants';

// ─── Supabase is OPTIONAL ─────────────────────────────────────────────────────
// The frontend MVP must run with NO backend env present. We never call
// createClient unless both url and anonKey exist, and even then we guard against
// malformed values — so module evaluation can never throw and crash root render.
//
// When credentials are absent: `supabase` is null and all remote sync is
// silently disabled. The app falls back to localStorage-only persistence.

function createSupabaseClient(): SupabaseClient | null {
  const { url, anonKey } = CONFIG.supabase;

  if (!url || !anonKey) {
    // eslint-disable-next-line no-console
    console.info(
      '[supabase] No credentials found — remote sync disabled, using localStorage only.',
    );
    return null;
  }

  try {
    return createClient(url, anonKey);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[supabase] createClient failed — remote sync disabled.', err);
    return null;
  }
}

export const supabase: SupabaseClient | null = createSupabaseClient();

export const isSupabaseEnabled = supabase !== null;
