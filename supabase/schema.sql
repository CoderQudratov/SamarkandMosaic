-- ─────────────────────────────────────────────────────────────────────────────
-- Samarkand Mosaic — Supabase Schema
-- Run this in the Supabase SQL editor to create all tables.
-- All tables use telegram_id (bigint) as the primary identifier.
-- Row-Level Security is enabled on every table; the anon role can only
-- INSERT/UPDATE/SELECT rows where telegram_id matches a claim in the JWT.
-- For a Telegram Mini App using initData validation, set up a custom JWT or
-- use the service-role key only on a trusted backend — never in client code.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── profiles ─────────────────────────────────────────────────────────────────
-- One row per Telegram user. Upserted on every app open.

create table if not exists profiles (
  telegram_id   bigint primary key,
  username      text,
  first_name    text        not null default '',
  last_name     text,
  display_name  text        not null default '',
  language_code text        not null default 'en',
  is_premium    boolean     not null default false,
  photo_url     text,
  last_seen_at  timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "profiles: own row read"
  on profiles for select using (telegram_id = (current_setting('request.jwt.claims', true)::json->>'telegram_id')::bigint);

create policy "profiles: own row upsert"
  on profiles for insert with check (telegram_id = (current_setting('request.jwt.claims', true)::json->>'telegram_id')::bigint);

create policy "profiles: own row update"
  on profiles for update using (telegram_id = (current_setting('request.jwt.claims', true)::json->>'telegram_id')::bigint);

-- ── progress ──────────────────────────────────────────────────────────────────
-- Level completion, stars, and snap statistics.

create table if not exists progress (
  telegram_id      bigint primary key references profiles(telegram_id) on delete cascade,
  completed_levels integer[]   not null default '{}',
  highest_level    integer     not null default 0,
  total_snaps      integer     not null default 0,
  stars            jsonb       not null default '{}', -- { "1": 3, "2": 2, ... }
  updated_at       timestamptz not null default now()
);

alter table progress enable row level security;

create policy "progress: own row read"
  on progress for select using (telegram_id = (current_setting('request.jwt.claims', true)::json->>'telegram_id')::bigint);

create policy "progress: own row upsert"
  on progress for insert with check (telegram_id = (current_setting('request.jwt.claims', true)::json->>'telegram_id')::bigint);

create policy "progress: own row update"
  on progress for update using (telegram_id = (current_setting('request.jwt.claims', true)::json->>'telegram_id')::bigint);

-- ── leaderboard ───────────────────────────────────────────────────────────────
-- Global leaderboard: total stars + completed level count per player.

create table if not exists leaderboard (
  telegram_id      bigint primary key references profiles(telegram_id) on delete cascade,
  display_name     text        not null default '',
  total_stars      integer     not null default 0,
  completed_levels integer     not null default 0,
  updated_at       timestamptz not null default now()
);

create index if not exists leaderboard_rank_idx
  on leaderboard (total_stars desc, completed_levels desc);

alter table leaderboard enable row level security;

-- Everyone can read the leaderboard (public).
create policy "leaderboard: public read"
  on leaderboard for select using (true);

create policy "leaderboard: own row upsert"
  on leaderboard for insert with check (telegram_id = (current_setting('request.jwt.claims', true)::json->>'telegram_id')::bigint);

create policy "leaderboard: own row update"
  on leaderboard for update using (telegram_id = (current_setting('request.jwt.claims', true)::json->>'telegram_id')::bigint);

-- ── leaderboard_levels ────────────────────────────────────────────────────────
-- Per-level best scores.

create table if not exists leaderboard_levels (
  telegram_id  bigint      not null references profiles(telegram_id) on delete cascade,
  level_id     integer     not null,
  display_name text        not null default '',
  stars        integer     not null default 0 check (stars between 0 and 3),
  completed_at timestamptz not null default now(),
  primary key (telegram_id, level_id)
);

create index if not exists leaderboard_levels_rank_idx
  on leaderboard_levels (level_id, stars desc, completed_at asc);

alter table leaderboard_levels enable row level security;

create policy "leaderboard_levels: public read"
  on leaderboard_levels for select using (true);

create policy "leaderboard_levels: own row upsert"
  on leaderboard_levels for insert with check (telegram_id = (current_setting('request.jwt.claims', true)::json->>'telegram_id')::bigint);

create policy "leaderboard_levels: own row update"
  on leaderboard_levels for update using (telegram_id = (current_setting('request.jwt.claims', true)::json->>'telegram_id')::bigint);

-- ── economy ───────────────────────────────────────────────────────────────────
-- Coin balance, hints, shards.

create table if not exists economy (
  telegram_id bigint primary key references profiles(telegram_id) on delete cascade,
  coins       integer     not null default 0 check (coins >= 0),
  hints       integer     not null default 0 check (hints >= 0),
  shards      integer     not null default 0 check (shards >= 0),
  updated_at  timestamptz not null default now()
);

alter table economy enable row level security;

create policy "economy: own row read"
  on economy for select using (telegram_id = (current_setting('request.jwt.claims', true)::json->>'telegram_id')::bigint);

create policy "economy: own row upsert"
  on economy for insert with check (telegram_id = (current_setting('request.jwt.claims', true)::json->>'telegram_id')::bigint);

create policy "economy: own row update"
  on economy for update using (telegram_id = (current_setting('request.jwt.claims', true)::json->>'telegram_id')::bigint);

-- ── daily_rewards ─────────────────────────────────────────────────────────────
-- Login streak tracking.

create table if not exists daily_rewards (
  telegram_id   bigint primary key references profiles(telegram_id) on delete cascade,
  streak_day    integer     not null default 1 check (streak_day between 1 and 7),
  last_claim_at timestamptz,
  updated_at    timestamptz not null default now()
);

alter table daily_rewards enable row level security;

create policy "daily_rewards: own row read"
  on daily_rewards for select using (telegram_id = (current_setting('request.jwt.claims', true)::json->>'telegram_id')::bigint);

create policy "daily_rewards: own row upsert"
  on daily_rewards for insert with check (telegram_id = (current_setting('request.jwt.claims', true)::json->>'telegram_id')::bigint);

create policy "daily_rewards: own row update"
  on daily_rewards for update using (telegram_id = (current_setting('request.jwt.claims', true)::json->>'telegram_id')::bigint);

-- ── updated_at trigger ────────────────────────────────────────────────────────
-- Auto-bump updated_at on every row modification.

create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  tbl text;
begin
  foreach tbl in array array['profiles','progress','leaderboard','leaderboard_levels','economy','daily_rewards']
  loop
    execute format($f$
      create or replace trigger trg_%s_updated_at
        before update on %s
        for each row execute function touch_updated_at();
    $f$, tbl, tbl);
  end loop;
end;
$$;
