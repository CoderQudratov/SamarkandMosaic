// ─── SupabaseAuthService ──────────────────────────────────────────────────────
// Exchanges Telegram's `initData` for a Supabase JWT (via the `telegram-auth`
// Edge Function) and installs it as the active session, so PostgREST/RLS can
// read the `telegram_id` claim through auth.telegram_id().
//
// Guest/browser dev mode (no real Telegram initData) skips this — RLS-gated
// tables simply stay empty for that session, same as before this existed.

import { supabase } from '@/lib/supabase';
import { getTWA } from '@/lib/telegram';
import { CONFIG } from '@/constants';

let authPromise: Promise<boolean> | null = null;

async function requestAccessToken(initData: string): Promise<string | null> {
  const { url, anonKey } = CONFIG.supabase;
  if (!url || !anonKey) return null;

  try {
    const res = await fetch(`${url}/functions/v1/telegram-auth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: anonKey,
      },
      body: JSON.stringify({ initData }),
    });
    if (!res.ok) {
      // eslint-disable-next-line no-console
      console.warn('[supabaseAuth] telegram-auth rejected:', res.status, await res.text());
      return null;
    }
    const { access_token } = await res.json();
    return access_token ?? null;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[supabaseAuth] telegram-auth request failed — continuing offline.', err);
    return null;
  }
}

/**
 * Authenticates the current Telegram user against Supabase.
 * Idempotent — concurrent callers share one in-flight request.
 * Resolves `true` once a session is installed, `false` if auth was skipped
 * or failed (gameplay continues unauthenticated/local-only either way).
 */
export function ensureSupabaseSession(): Promise<boolean> {
  if (!authPromise) authPromise = doAuthenticate();
  return authPromise;
}

async function doAuthenticate(): Promise<boolean> {
  if (!supabase) return false;

  const initData = getTWA()?.initData;
  if (!initData) return false; // browser dev mode — no Telegram identity to prove

  const accessToken = await requestAccessToken(initData);
  if (!accessToken) return false;

  try {
    // The Edge Function issues short-lived, self-contained access tokens and
    // deliberately has no matching refresh token (there is no Supabase Auth
    // user behind it). Reusing accessToken as the refresh slot keeps
    // supabase-js's client happy; when it expires we simply re-run this flow
    // on the next app boot rather than silently refreshing mid-session.
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: accessToken,
    });
    if (error) throw error;
    return true;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[supabaseAuth] setSession failed — continuing offline.', err);
    return false;
  }
}
