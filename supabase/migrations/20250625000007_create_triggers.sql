-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 0007 — updated_at triggers
-- ─────────────────────────────────────────────────────────────────────────────
-- Auto-bump updated_at on every UPDATE so consumers can detect stale rows.
-- Note: `CREATE OR REPLACE TRIGGER` requires Postgres 14+.
-- For Postgres 13 and below we DROP + CREATE.
-- Supabase Cloud currently runs Postgres 15, so CREATE OR REPLACE is safe.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Shared trigger function ───────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION moddatetime()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- ── Per-table triggers ────────────────────────────────────────────────────────
-- Using a PL/pgSQL DO block so each trigger is created idempotently.

DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'profiles',
    'progress',
    'economy',
    'daily_rewards',
    'leaderboard',
    'leaderboard_levels'
  ]
  LOOP
    EXECUTE format(
      $sql$
        DROP TRIGGER IF EXISTS trg_%1$s_updated_at ON %1$s;
        CREATE TRIGGER trg_%1$s_updated_at
          BEFORE UPDATE ON %1$s
          FOR EACH ROW
          EXECUTE FUNCTION moddatetime();
      $sql$,
      tbl
    );
  END LOOP;
END;
$$;
