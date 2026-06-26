-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 0005 — daily_rewards table
-- ─────────────────────────────────────────────────────────────────────────────
-- Login-streak state: which day in the 7-day cycle the player is on,
-- and when they last claimed. streak_day is the NEXT day to award (1–7);
-- it wraps back to 1 after day 7 is claimed.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS daily_rewards (
  telegram_id   bigint      NOT NULL,
  -- streak_day = the day that WILL BE awarded on the next claim (1..7)
  streak_day    integer     NOT NULL DEFAULT 1,
  last_claim_at timestamptz,          -- NULL = never claimed
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  -- ── Constraints ────────────────────────────────────────────────────────────
  CONSTRAINT pk_daily_rewards
    PRIMARY KEY (telegram_id),

  CONSTRAINT fk_daily_rewards_profile
    FOREIGN KEY (telegram_id)
    REFERENCES profiles (telegram_id)
    ON DELETE CASCADE,

  CONSTRAINT chk_daily_rewards_streak_day_range
    CHECK (streak_day BETWEEN 1 AND 7)
);

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE daily_rewards ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='daily_rewards' AND policyname='daily_rewards_select_own') THEN
    CREATE POLICY daily_rewards_select_own
      ON daily_rewards FOR SELECT
      USING (telegram_id = auth.telegram_id());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='daily_rewards' AND policyname='daily_rewards_insert_own') THEN
    CREATE POLICY daily_rewards_insert_own
      ON daily_rewards FOR INSERT
      WITH CHECK (telegram_id = auth.telegram_id());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='daily_rewards' AND policyname='daily_rewards_update_own') THEN
    CREATE POLICY daily_rewards_update_own
      ON daily_rewards FOR UPDATE
      USING (telegram_id = auth.telegram_id())
      WITH CHECK (telegram_id = auth.telegram_id());
  END IF;
END $$;

-- ── Grants ────────────────────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE ON daily_rewards TO authenticated;
