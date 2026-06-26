-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 0001 — Helper functions
-- ─────────────────────────────────────────────────────────────────────────────
-- This helper centralises the JWT claim extraction so all RLS policies share
-- one expression rather than repeating the verbose inline cast everywhere.
--
-- ── Auth model note ───────────────────────────────────────────────────────────
-- Telegram Mini Apps do not use Supabase Auth's built-in email/OAuth flow.
-- The recommended production pattern is:
--   1. Client sends Telegram `initData` to a Supabase Edge Function.
--   2. The Edge Function validates the HMAC signature using the Bot token.
--   3. On success it calls `auth.sign()` with `{ telegram_id: <n> }` as a
--      custom claim and returns the JWT to the client.
--   4. The client attaches that JWT to every subsequent Supabase request.
--   5. `auth.telegram_id()` below reads that claim to enforce RLS.
--
-- During development (no validated JWT): use the service-role key directly
-- from the backend only. Never expose the service-role key in client code.
-- ─────────────────────────────────────────────────────────────────────────────

-- Extracts the `telegram_id` claim from the current request JWT.
-- Returns NULL when no JWT is present (blocks all owner-only RLS policies,
-- which is the correct safe-fail behaviour for unauthenticated requests).
CREATE OR REPLACE FUNCTION auth.telegram_id()
RETURNS bigint
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $$
  SELECT NULLIF(
    current_setting('request.jwt.claims', true)::jsonb ->> 'telegram_id',
    ''
  )::bigint;
$$;

-- Grant execute to both authenticated and anon roles.
-- The function itself returns NULL for anon (no JWT) so RLS still blocks them.
GRANT EXECUTE ON FUNCTION auth.telegram_id() TO authenticated, anon;
