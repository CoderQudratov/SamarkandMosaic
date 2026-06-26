-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 0002 — profiles table
-- ─────────────────────────────────────────────────────────────────────────────
-- One row per Telegram user, upserted on every app open.
-- telegram_id is the natural PK; no surrogate uuid needed.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS profiles (
  telegram_id   bigint      NOT NULL,
  username      text,
  first_name    text        NOT NULL DEFAULT '',
  last_name     text,
  display_name  text        NOT NULL DEFAULT '',
  language_code text        NOT NULL DEFAULT 'en',
  is_premium    boolean     NOT NULL DEFAULT false,
  photo_url     text,
  last_seen_at  timestamptz NOT NULL DEFAULT now(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  -- ── Constraints ────────────────────────────────────────────────────────────
  CONSTRAINT pk_profiles
    PRIMARY KEY (telegram_id),

  CONSTRAINT chk_profiles_telegram_id_positive
    CHECK (telegram_id > 0),

  CONSTRAINT chk_profiles_display_name_length
    CHECK (char_length(display_name) <= 128),

  CONSTRAINT chk_profiles_username_length
    CHECK (username IS NULL OR char_length(username) <= 64)
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
-- username lookup (sparse — many users have no username)
CREATE INDEX IF NOT EXISTS idx_profiles_username
  ON profiles (username)
  WHERE username IS NOT NULL;

-- recent activity (admin dashboards)
CREATE INDEX IF NOT EXISTS idx_profiles_last_seen
  ON profiles (last_seen_at DESC);

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Each player can SELECT their own row only.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'profiles' AND policyname = 'profiles_select_own'
  ) THEN
    CREATE POLICY profiles_select_own
      ON profiles
      FOR SELECT
      USING (telegram_id = auth.telegram_id());
  END IF;
END $$;

-- INSERT: new row must match the caller's JWT claim.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'profiles' AND policyname = 'profiles_insert_own'
  ) THEN
    CREATE POLICY profiles_insert_own
      ON profiles
      FOR INSERT
      WITH CHECK (telegram_id = auth.telegram_id());
  END IF;
END $$;

-- UPDATE: can only modify own row.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'profiles' AND policyname = 'profiles_update_own'
  ) THEN
    CREATE POLICY profiles_update_own
      ON profiles
      FOR UPDATE
      USING (telegram_id = auth.telegram_id())
      WITH CHECK (telegram_id = auth.telegram_id());
  END IF;
END $$;

-- DELETE is intentionally not permitted via RLS.
-- Account deletion requires a privileged Edge Function.

-- ── Grants ────────────────────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE ON profiles TO authenticated;
