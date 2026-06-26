-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 0004 — economy table
-- ─────────────────────────────────────────────────────────────────────────────
-- Coin balance, hint count, and shard count per player.
-- CHECK constraints enforce non-negative invariants at the DB layer
-- so a bug in the application code can never corrupt economy data.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS economy (
  telegram_id bigint      NOT NULL,
  coins       integer     NOT NULL DEFAULT 0,
  hints       integer     NOT NULL DEFAULT 0,
  shards      integer     NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  -- ── Constraints ────────────────────────────────────────────────────────────
  CONSTRAINT pk_economy
    PRIMARY KEY (telegram_id),

  CONSTRAINT fk_economy_profile
    FOREIGN KEY (telegram_id)
    REFERENCES profiles (telegram_id)
    ON DELETE CASCADE,

  -- Economy values must never go negative.
  CONSTRAINT chk_economy_coins_non_negative
    CHECK (coins >= 0),

  CONSTRAINT chk_economy_hints_non_negative
    CHECK (hints >= 0),

  CONSTRAINT chk_economy_shards_non_negative
    CHECK (shards >= 0),

  -- Reasonable upper bounds guard against integer overflow exploits.
  CONSTRAINT chk_economy_coins_max
    CHECK (coins <= 10_000_000),

  CONSTRAINT chk_economy_hints_max
    CHECK (hints <= 9_999),

  CONSTRAINT chk_economy_shards_max
    CHECK (shards <= 9_999)
);

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE economy ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='economy' AND policyname='economy_select_own') THEN
    CREATE POLICY economy_select_own
      ON economy FOR SELECT
      USING (telegram_id = auth.telegram_id());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='economy' AND policyname='economy_insert_own') THEN
    CREATE POLICY economy_insert_own
      ON economy FOR INSERT
      WITH CHECK (telegram_id = auth.telegram_id());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='economy' AND policyname='economy_update_own') THEN
    CREATE POLICY economy_update_own
      ON economy FOR UPDATE
      USING (telegram_id = auth.telegram_id())
      WITH CHECK (telegram_id = auth.telegram_id());
  END IF;
END $$;

-- ── Grants ────────────────────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE ON economy TO authenticated;
