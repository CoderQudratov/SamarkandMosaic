-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 0006 — leaderboard + leaderboard_levels tables
-- ─────────────────────────────────────────────────────────────────────────────
-- Both tables have PUBLIC READ (anyone can see rankings) but OWNER WRITE
-- (a player can only update their own row, enforced by RLS + the RPC).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Global leaderboard ────────────────────────────────────────────────────────
-- Aggregated view: total stars + total completed levels per player.
-- Populated/updated by the update_leaderboard() RPC (see migration 0008).

CREATE TABLE IF NOT EXISTS leaderboard (
  telegram_id      bigint      NOT NULL,
  display_name     text        NOT NULL DEFAULT '',
  total_stars      integer     NOT NULL DEFAULT 0,
  completed_levels integer     NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),

  -- ── Constraints ────────────────────────────────────────────────────────────
  CONSTRAINT pk_leaderboard
    PRIMARY KEY (telegram_id),

  CONSTRAINT fk_leaderboard_profile
    FOREIGN KEY (telegram_id)
    REFERENCES profiles (telegram_id)
    ON DELETE CASCADE,

  CONSTRAINT chk_leaderboard_total_stars_non_negative
    CHECK (total_stars >= 0),

  CONSTRAINT chk_leaderboard_completed_levels_non_negative
    CHECK (completed_levels >= 0),

  CONSTRAINT chk_leaderboard_display_name_length
    CHECK (char_length(display_name) <= 128)
);

-- Composite DESC index — supports `ORDER BY total_stars DESC, completed_levels DESC`
-- without a sort step.
CREATE INDEX IF NOT EXISTS idx_leaderboard_rank
  ON leaderboard (total_stars DESC, completed_levels DESC, updated_at DESC);

-- ── Per-level leaderboard ─────────────────────────────────────────────────────
-- Best star score per (player, level) pair.

CREATE TABLE IF NOT EXISTS leaderboard_levels (
  telegram_id  bigint      NOT NULL,
  level_id     integer     NOT NULL,
  display_name text        NOT NULL DEFAULT '',
  stars        integer     NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),   -- bumped when star improves

  -- ── Constraints ────────────────────────────────────────────────────────────
  CONSTRAINT pk_leaderboard_levels
    PRIMARY KEY (telegram_id, level_id),

  CONSTRAINT fk_leaderboard_levels_profile
    FOREIGN KEY (telegram_id)
    REFERENCES profiles (telegram_id)
    ON DELETE CASCADE,

  CONSTRAINT chk_leaderboard_levels_level_id_positive
    CHECK (level_id > 0),

  CONSTRAINT chk_leaderboard_levels_stars_range
    CHECK (stars BETWEEN 0 AND 3),

  CONSTRAINT chk_leaderboard_levels_display_name_length
    CHECK (char_length(display_name) <= 128)
);

-- Supports: SELECT top-N for a given level ordered by stars desc then earliest.
CREATE INDEX IF NOT EXISTS idx_leaderboard_levels_rank
  ON leaderboard_levels (level_id, stars DESC, created_at ASC);

-- ── RLS — leaderboard ─────────────────────────────────────────────────────────
ALTER TABLE leaderboard ENABLE ROW LEVEL SECURITY;

-- Public read: anyone can browse the leaderboard (even without a JWT).
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='leaderboard' AND policyname='leaderboard_select_public') THEN
    CREATE POLICY leaderboard_select_public
      ON leaderboard FOR SELECT
      USING (true);
  END IF;
END $$;

-- Insert/update: owner only.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='leaderboard' AND policyname='leaderboard_insert_own') THEN
    CREATE POLICY leaderboard_insert_own
      ON leaderboard FOR INSERT
      WITH CHECK (telegram_id = auth.telegram_id());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='leaderboard' AND policyname='leaderboard_update_own') THEN
    CREATE POLICY leaderboard_update_own
      ON leaderboard FOR UPDATE
      USING (telegram_id = auth.telegram_id())
      WITH CHECK (telegram_id = auth.telegram_id());
  END IF;
END $$;

-- ── RLS — leaderboard_levels ──────────────────────────────────────────────────
ALTER TABLE leaderboard_levels ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='leaderboard_levels' AND policyname='leaderboard_levels_select_public') THEN
    CREATE POLICY leaderboard_levels_select_public
      ON leaderboard_levels FOR SELECT
      USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='leaderboard_levels' AND policyname='leaderboard_levels_insert_own') THEN
    CREATE POLICY leaderboard_levels_insert_own
      ON leaderboard_levels FOR INSERT
      WITH CHECK (telegram_id = auth.telegram_id());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='leaderboard_levels' AND policyname='leaderboard_levels_update_own') THEN
    CREATE POLICY leaderboard_levels_update_own
      ON leaderboard_levels FOR UPDATE
      USING (telegram_id = auth.telegram_id())
      WITH CHECK (telegram_id = auth.telegram_id());
  END IF;
END $$;

-- ── Grants ────────────────────────────────────────────────────────────────────
-- anon can SELECT (public leaderboard); authenticated can write own rows.
GRANT SELECT ON leaderboard TO anon, authenticated;
GRANT INSERT, UPDATE ON leaderboard TO authenticated;

GRANT SELECT ON leaderboard_levels TO anon, authenticated;
GRANT INSERT, UPDATE ON leaderboard_levels TO authenticated;
