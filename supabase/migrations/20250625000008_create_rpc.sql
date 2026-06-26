-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 0008 — RPCs (callable via supabase.rpc())
-- ─────────────────────────────────────────────────────────────────────────────

-- ── update_leaderboard ────────────────────────────────────────────────────────
-- Atomically recomputes a player's global leaderboard row from their progress.
--
-- Why SECURITY DEFINER:
--   The function needs to UPDATE the leaderboard table as a privileged operation
--   (bypassing the RLS that would otherwise require the caller to be the row
--   owner). By using SECURITY DEFINER the function runs as the DB role that
--   owns it (postgres/supabase_admin), which can bypass RLS.
--   The body enforces that only the authenticated user's own row is touched,
--   so privilege is not leaked.
--
-- Usage (from frontend):
--   await supabase.rpc('update_leaderboard', {
--     p_telegram_id: telegramId,
--     p_display_name: displayName,
--   });
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_leaderboard(
  p_telegram_id  bigint,
  p_display_name text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_stars     integer;
  v_completed_count integer;
BEGIN
  -- ── Security check ────────────────────────────────────────────────────────
  -- Prevent a player from writing another player's leaderboard row.
  IF p_telegram_id IS DISTINCT FROM auth.telegram_id() THEN
    RAISE EXCEPTION 'update_leaderboard: caller may only update their own row'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- ── Compute totals from progress ──────────────────────────────────────────
  SELECT
    COALESCE(
      (SELECT SUM(val::integer)
       FROM jsonb_each_text(p.stars) AS kv(key, val)),
      0
    ),
    COALESCE(array_length(p.completed_levels, 1), 0)
  INTO v_total_stars, v_completed_count
  FROM progress p
  WHERE p.telegram_id = p_telegram_id;

  -- No progress row yet → use zeros (profile may exist before first level clear)
  IF NOT FOUND THEN
    v_total_stars     := 0;
    v_completed_count := 0;
  END IF;

  -- ── Upsert global leaderboard row ─────────────────────────────────────────
  INSERT INTO leaderboard
    (telegram_id, display_name, total_stars, completed_levels)
  VALUES
    (p_telegram_id, p_display_name, v_total_stars, v_completed_count)
  ON CONFLICT (telegram_id) DO UPDATE
    SET display_name     = EXCLUDED.display_name,
        total_stars      = EXCLUDED.total_stars,
        completed_levels = EXCLUDED.completed_levels,
        updated_at       = now();
END;
$$;

REVOKE EXECUTE ON FUNCTION update_leaderboard(bigint, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION update_leaderboard(bigint, text) TO authenticated;

-- ── upsert_level_score ────────────────────────────────────────────────────────
-- Insert or improve a per-level score. Only overwrites when the new stars are
-- strictly better than the existing record (prevents regressions).
--
-- Usage:
--   await supabase.rpc('upsert_level_score', {
--     p_telegram_id: telegramId,
--     p_display_name: displayName,
--     p_level_id: 3,
--     p_stars: 2,
--   });
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION upsert_level_score(
  p_telegram_id  bigint,
  p_display_name text,
  p_level_id     integer,
  p_stars        integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Security check
  IF p_telegram_id IS DISTINCT FROM auth.telegram_id() THEN
    RAISE EXCEPTION 'upsert_level_score: caller may only update their own row'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Star range guard (belt-and-suspenders on top of the CHECK constraint)
  IF p_stars NOT BETWEEN 0 AND 3 THEN
    RAISE EXCEPTION 'upsert_level_score: stars must be 0–3, got %', p_stars
      USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO leaderboard_levels
    (telegram_id, level_id, display_name, stars)
  VALUES
    (p_telegram_id, p_level_id, p_display_name, p_stars)
  ON CONFLICT (telegram_id, level_id) DO UPDATE
    -- Only overwrite when the new score is strictly better.
    SET display_name = EXCLUDED.display_name,
        stars        = GREATEST(leaderboard_levels.stars, EXCLUDED.stars),
        updated_at   = CASE
                         WHEN EXCLUDED.stars > leaderboard_levels.stars THEN now()
                         ELSE leaderboard_levels.updated_at
                       END;
END;
$$;

REVOKE EXECUTE ON FUNCTION upsert_level_score(bigint, text, integer, integer) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION upsert_level_score(bigint, text, integer, integer) TO authenticated;

-- ── get_player_rank ───────────────────────────────────────────────────────────
-- Returns a player's rank (1-based) in the global leaderboard.
-- Clients can call this to show "You are #42 globally."

CREATE OR REPLACE FUNCTION get_player_rank(p_telegram_id bigint)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT rank::integer
  FROM (
    SELECT
      telegram_id,
      RANK() OVER (ORDER BY total_stars DESC, completed_levels DESC, updated_at ASC) AS rank
    FROM leaderboard
  ) ranked
  WHERE telegram_id = p_telegram_id;
$$;

REVOKE EXECUTE ON FUNCTION get_player_rank(bigint) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION get_player_rank(bigint) TO authenticated, anon;
