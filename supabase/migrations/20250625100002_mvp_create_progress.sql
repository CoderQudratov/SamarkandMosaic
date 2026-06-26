-- ═════════════════════════════════════════════════════════════════════════════
-- MVP Migration 002 — progress
-- ═════════════════════════════════════════════════════════════════════════════
-- Tracks level-completion state per player.
--
-- completed_levels  jsonb  — JSON array of completed level ids, e.g. [1,2,3]
--                            Using jsonb (not integer[]) for portability across
--                            clients and to avoid array-casting issues in the
--                            TypeScript service layer.
--
-- stars             jsonb  — Object keyed by level_id string → best star count
--                            e.g. {"1":3,"2":2,"5":1}
--                            Only the BEST score per level is stored.
-- ═════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS progress (
  telegram_id      bigint      NOT NULL,

  -- JSON array of integer level ids that the player has fully completed.
  -- Example: [1, 2, 3]
  completed_levels jsonb       NOT NULL DEFAULT '[]'::jsonb,

  -- JSON object: string(level_id) → integer(0–3 stars, best ever)
  -- Example: {"1": 3, "2": 2}
  stars            jsonb       NOT NULL DEFAULT '{}'::jsonb,

  highest_level    integer     NOT NULL DEFAULT 0,
  total_snaps      integer     NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT pk_progress
    PRIMARY KEY (telegram_id),

  CONSTRAINT fk_progress_profiles
    FOREIGN KEY (telegram_id)
    REFERENCES profiles (telegram_id)
    ON DELETE CASCADE,

  CONSTRAINT chk_progress_highest_level_non_negative
    CHECK (highest_level >= 0),

  CONSTRAINT chk_progress_total_snaps_non_negative
    CHECK (total_snaps >= 0),

  -- Validate that completed_levels is a JSON array (not an object or scalar).
  CONSTRAINT chk_progress_completed_levels_is_array
    CHECK (jsonb_typeof(completed_levels) = 'array'),

  -- Validate that stars is a JSON object (not an array or scalar).
  CONSTRAINT chk_progress_stars_is_object
    CHECK (jsonb_typeof(stars) = 'object')
);

-- Composite index for leaderboard-style queries:
-- "top players by highest level" or "most active by snap count"
CREATE INDEX IF NOT EXISTS idx_progress_highest_level
  ON progress (highest_level DESC);

CREATE INDEX IF NOT EXISTS idx_progress_total_snaps
  ON progress (total_snaps DESC);

-- GIN index on completed_levels for set-membership queries:
-- e.g. WHERE completed_levels @> '[5]'
CREATE INDEX IF NOT EXISTS idx_progress_completed_levels_gin
  ON progress USING GIN (completed_levels);

-- GIN index on stars for key existence queries
CREATE INDEX IF NOT EXISTS idx_progress_stars_gin
  ON progress USING GIN (stars);

-- ── updated_at trigger ────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_progress_updated_at ON progress;
CREATE TRIGGER trg_progress_updated_at
  BEFORE UPDATE ON progress
  FOR EACH ROW
  EXECUTE FUNCTION moddatetime();

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE progress ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'progress' AND policyname = 'progress_select_own'
  ) THEN
    CREATE POLICY progress_select_own ON progress
      FOR SELECT USING (telegram_id = auth.telegram_id());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'progress' AND policyname = 'progress_insert_own'
  ) THEN
    CREATE POLICY progress_insert_own ON progress
      FOR INSERT WITH CHECK (telegram_id = auth.telegram_id());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'progress' AND policyname = 'progress_update_own'
  ) THEN
    CREATE POLICY progress_update_own ON progress
      FOR UPDATE
      USING (telegram_id = auth.telegram_id())
      WITH CHECK (telegram_id = auth.telegram_id());
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE ON progress TO authenticated;
