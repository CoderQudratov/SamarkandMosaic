-- ═════════════════════════════════════════════════════════════════════════════
-- MVP Migration 001 — profiles
-- ═════════════════════════════════════════════════════════════════════════════
-- One row per Telegram user, upserted on every app open.
-- telegram_id is the natural PK (Telegram guarantees global uniqueness).
--
-- Auth model:
--   This game uses Telegram initData for identity. Production flow:
--     1. Client sends initData to a Supabase Edge Function.
--     2. Edge Function validates the HMAC, then calls auth.sign() with
--        { telegram_id: <n> } as a custom claim.
--     3. Client attaches the returned JWT to all subsequent Supabase calls.
--     4. auth.telegram_id() (created below) reads that claim for RLS.
--
--   During local development, use the service-role key from a trusted backend
--   only — never expose it in client code.
-- ═════════════════════════════════════════════════════════════════════════════

-- ── JWT claim helper ──────────────────────────────────────────────────────────
-- Centralises JWT claim extraction so every RLS policy shares one expression.
-- Returns NULL when no valid JWT is present, which causes all owner-only
-- policies to safely deny the request.
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

GRANT EXECUTE ON FUNCTION auth.telegram_id() TO authenticated, anon;

-- ── Table ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  telegram_id  bigint       NOT NULL,
  username     text,
  first_name   text         NOT NULL DEFAULT '',
  display_name text         NOT NULL DEFAULT '',
  is_premium   boolean      NOT NULL DEFAULT false,
  created_at   timestamptz  NOT NULL DEFAULT now(),
  updated_at   timestamptz  NOT NULL DEFAULT now(),

  CONSTRAINT pk_profiles
    PRIMARY KEY (telegram_id),

  CONSTRAINT chk_profiles_telegram_id_positive
    CHECK (telegram_id > 0),

  CONSTRAINT chk_profiles_display_name_length
    CHECK (char_length(display_name) <= 128),

  CONSTRAINT chk_profiles_username_length
    CHECK (username IS NULL OR char_length(username) <= 64),

  CONSTRAINT chk_profiles_first_name_length
    CHECK (char_length(first_name) <= 128)
);

-- Index: sparse username lookup (many users have no Telegram username)
CREATE UNIQUE INDEX IF NOT EXISTS uq_profiles_username
  ON profiles (username)
  WHERE username IS NOT NULL;

-- ── updated_at trigger ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION moddatetime()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION moddatetime();

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- SELECT: own row only
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'profiles' AND policyname = 'profiles_select_own'
  ) THEN
    CREATE POLICY profiles_select_own ON profiles
      FOR SELECT USING (telegram_id = auth.telegram_id());
  END IF;
END $$;

-- INSERT: new row must carry the caller's own telegram_id
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'profiles' AND policyname = 'profiles_insert_own'
  ) THEN
    CREATE POLICY profiles_insert_own ON profiles
      FOR INSERT WITH CHECK (telegram_id = auth.telegram_id());
  END IF;
END $$;

-- UPDATE: can only modify own row; cannot change telegram_id
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'profiles' AND policyname = 'profiles_update_own'
  ) THEN
    CREATE POLICY profiles_update_own ON profiles
      FOR UPDATE
      USING (telegram_id = auth.telegram_id())
      WITH CHECK (telegram_id = auth.telegram_id());
  END IF;
END $$;

-- DELETE: intentionally blocked via RLS.
-- Account deletion requires a privileged server-side function.

GRANT SELECT, INSERT, UPDATE ON profiles TO authenticated;
