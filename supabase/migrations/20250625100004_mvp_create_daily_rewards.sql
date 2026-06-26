-- ═════════════════════════════════════════════════════════════════════════════
-- MVP Migration 004 — daily_rewards
-- ═════════════════════════════════════════════════════════════════════════════
-- Login streak: tracks which day in the 7-day reward cycle the player is on
-- and when they last claimed.
--
-- streak_day semantics:
--   The value is the day that WILL BE awarded on the player's NEXT successful
--   claim, not the day most recently received. After claiming day 7 it wraps
--   to 1. This matches the DailyRewardSystem.ts logic in the frontend.
-- ═════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS daily_rewards (
  telegram_id   bigint      NOT NULL,

  -- Which day in the cycle is next to be claimed (1–7).
  -- After claiming day 7 the frontend resets this to 1.
  streak_day    integer     NOT NULL DEFAULT 1,

  -- Timestamp of the most recent successful claim; NULL = never claimed.
  last_claim_at timestamptz,

  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT pk_daily_rewards
    PRIMARY KEY (telegram_id),

  CONSTRAINT fk_daily_rewards_profiles
    FOREIGN KEY (telegram_id)
    REFERENCES profiles (telegram_id)
    ON DELETE CASCADE,

  CONSTRAINT chk_daily_rewards_streak_day_range
    CHECK (streak_day BETWEEN 1 AND 7),

  -- last_claim_at must not be in the future (guards against client clock skew).
  -- We allow a 60-second grace window to account for network latency.
  CONSTRAINT chk_daily_rewards_last_claim_not_future
    CHECK (last_claim_at IS NULL OR last_claim_at <= now() + interval '60 seconds')
);

-- Index for admin analytics: "how many players are on day 7 streak?"
CREATE INDEX IF NOT EXISTS idx_daily_rewards_streak_day
  ON daily_rewards (streak_day);

-- Index for recency queries
CREATE INDEX IF NOT EXISTS idx_daily_rewards_last_claim
  ON daily_rewards (last_claim_at DESC NULLS LAST);

-- ── updated_at trigger ────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_daily_rewards_updated_at ON daily_rewards;
CREATE TRIGGER trg_daily_rewards_updated_at
  BEFORE UPDATE ON daily_rewards
  FOR EACH ROW
  EXECUTE FUNCTION moddatetime();

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE daily_rewards ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'daily_rewards' AND policyname = 'daily_rewards_select_own'
  ) THEN
    CREATE POLICY daily_rewards_select_own ON daily_rewards
      FOR SELECT USING (telegram_id = auth.telegram_id());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'daily_rewards' AND policyname = 'daily_rewards_insert_own'
  ) THEN
    CREATE POLICY daily_rewards_insert_own ON daily_rewards
      FOR INSERT WITH CHECK (telegram_id = auth.telegram_id());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'daily_rewards' AND policyname = 'daily_rewards_update_own'
  ) THEN
    CREATE POLICY daily_rewards_update_own ON daily_rewards
      FOR UPDATE
      USING (telegram_id = auth.telegram_id())
      WITH CHECK (telegram_id = auth.telegram_id());
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE ON daily_rewards TO authenticated;
