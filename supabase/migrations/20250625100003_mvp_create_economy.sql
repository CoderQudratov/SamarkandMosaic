-- ═════════════════════════════════════════════════════════════════════════════
-- MVP Migration 003 — economy
-- ═════════════════════════════════════════════════════════════════════════════
-- Coins, hints, hearts (regenerating lives), and decorative shards.
-- All currency columns carry non-negative CHECK constraints enforced at the
-- database layer — a bug in application logic can never create negative balances.
-- Upper bounds guard against integer overflow and potential exploit values.
-- ═════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS economy (
  telegram_id bigint      NOT NULL,
  coins       integer     NOT NULL DEFAULT 0,
  hints       integer     NOT NULL DEFAULT 0,
  hearts      integer     NOT NULL DEFAULT 3,   -- starts full (max 3)
  shards      integer     NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT pk_economy
    PRIMARY KEY (telegram_id),

  CONSTRAINT fk_economy_profiles
    FOREIGN KEY (telegram_id)
    REFERENCES profiles (telegram_id)
    ON DELETE CASCADE,

  -- ── Non-negative invariants ─────────────────────────────────────────────────
  -- These are the critical guards. The application always writes these fields
  -- after a local check, but the DB constraint is the final safety net.
  CONSTRAINT chk_economy_coins_non_negative
    CHECK (coins >= 0),

  CONSTRAINT chk_economy_hints_non_negative
    CHECK (hints >= 0),

  CONSTRAINT chk_economy_hearts_non_negative
    CHECK (hearts >= 0),

  CONSTRAINT chk_economy_shards_non_negative
    CHECK (shards >= 0),

  -- ── Upper bounds ─────────────────────────────────────────────────────────────
  -- Prevents integer overflow in SUM queries and limits exploit magnitude.
  CONSTRAINT chk_economy_coins_max
    CHECK (coins <= 10000000),      -- 10 M coin ceiling

  CONSTRAINT chk_economy_hints_max
    CHECK (hints <= 9999),

  CONSTRAINT chk_economy_hearts_max
    CHECK (hearts <= 3),            -- game design: max 3 hearts

  CONSTRAINT chk_economy_shards_max
    CHECK (shards <= 9999)
);

-- ── updated_at trigger ────────────────────────────────────────────────────────
-- moddatetime() was created in migration 001; reuse it here.
DROP TRIGGER IF EXISTS trg_economy_updated_at ON economy;
CREATE TRIGGER trg_economy_updated_at
  BEFORE UPDATE ON economy
  FOR EACH ROW
  EXECUTE FUNCTION moddatetime();

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE economy ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'economy' AND policyname = 'economy_select_own'
  ) THEN
    CREATE POLICY economy_select_own ON economy
      FOR SELECT USING (telegram_id = auth.telegram_id());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'economy' AND policyname = 'economy_insert_own'
  ) THEN
    CREATE POLICY economy_insert_own ON economy
      FOR INSERT WITH CHECK (telegram_id = auth.telegram_id());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'economy' AND policyname = 'economy_update_own'
  ) THEN
    CREATE POLICY economy_update_own ON economy
      FOR UPDATE
      USING (telegram_id = auth.telegram_id())
      WITH CHECK (telegram_id = auth.telegram_id());
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE ON economy TO authenticated;
