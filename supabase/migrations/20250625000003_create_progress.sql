-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 0003 — progress table
-- ─────────────────────────────────────────────────────────────────────────────
-- Level completions, stars per level, and cumulative snap count.
-- One row per player; upserted on every level completion.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS progress (
  telegram_id      bigint      NOT NULL,
  completed_levels integer[]   NOT NULL DEFAULT '{}',
  highest_level    integer     NOT NULL DEFAULT 0,
  total_snaps      integer     NOT NULL DEFAULT 0,
  -- stars: JSON object keyed by level_id string → star count 0-3
  -- e.g. {"1": 3, "2": 2, "5": 1}
  stars            jsonb       NOT NULL DEFAULT '{}',
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),

  -- ── Constraints ────────────────────────────────────────────────────────────
  CONSTRAINT pk_progress
    PRIMARY KEY (telegram_id),

  CONSTRAINT fk_progress_profile
    FOREIGN KEY (telegram_id)
    REFERENCES profiles (telegram_id)
    ON DELETE CASCADE,

  CONSTRAINT chk_progress_highest_level_non_negative
    CHECK (highest_level >= 0),

  CONSTRAINT chk_progress_total_snaps_non_negative
    CHECK (total_snaps >= 0)
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
-- useful for admin queries: find players who have never completed any level
CREATE INDEX IF NOT EXISTS idx_progress_highest_level
  ON progress (highest_level DESC);

-- GIN index on the integer array for @> queries
-- e.g. SELECT * FROM progress WHERE completed_levels @> ARRAY[5]
CREATE INDEX IF NOT EXISTS idx_progress_completed_levels_gin
  ON progress USING GIN (completed_levels);

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE progress ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='progress' AND policyname='progress_select_own') THEN
    CREATE POLICY progress_select_own
      ON progress FOR SELECT
      USING (telegram_id = auth.telegram_id());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='progress' AND policyname='progress_insert_own') THEN
    CREATE POLICY progress_insert_own
      ON progress FOR INSERT
      WITH CHECK (telegram_id = auth.telegram_id());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='progress' AND policyname='progress_update_own') THEN
    CREATE POLICY progress_update_own
      ON progress FOR UPDATE
      USING (telegram_id = auth.telegram_id())
      WITH CHECK (telegram_id = auth.telegram_id());
  END IF;
END $$;

-- ── Grants ────────────────────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE ON progress TO authenticated;
