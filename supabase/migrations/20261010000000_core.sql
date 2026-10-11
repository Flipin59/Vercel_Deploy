-- Core tables shared by every feature. Owned by platform.
--
-- Migration rules for everyone:
--   * one file per change, named <YYYYMMDDHHMMSS>_<feature>_<what>.sql
--   * prefix your tables with your feature: reels_*, play_*, learn_*, forum_*
--   * never edit a migration that is already on main; add a new one
--   * reference users as profiles(id)

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique not null,
  language text not null default 'en',
  grade smallint,
  created_at timestamptz not null default now()
);

-- Append-only log written by recordActivity(). XP totals and streaks are derived from it.
create table xp_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references profiles (id) on delete cascade,
  source text not null,
  kind text not null,
  pillar text,
  xp integer not null,
  created_at timestamptz not null default now()
);

create index xp_events_user_created_idx on xp_events (user_id, created_at);

alter table profiles enable row level security;
alter table xp_events enable row level security;

create policy "profiles are readable by signed-in users" on profiles
  for select to authenticated using (true);
create policy "users manage their own profile" on profiles
  for all to authenticated using (auth.uid() = id) with check (auth.uid() = id);

create policy "xp is readable by signed-in users" on xp_events
  for select to authenticated using (true);
create policy "users log their own xp" on xp_events
  for insert to authenticated with check (auth.uid() = user_id);
