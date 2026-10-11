-- Play duels (IMPLEMENTATION.md P7, RECOMMENDATION.md §6, SCORE.md §4). Only Play's
-- server code touches these, through the service-role client: RLS is on with no policies.

create table play_duels (
  id uuid primary key default gen_random_uuid(),
  mode text not null check (mode in ('bot', 'quick', 'friend')),
  player_a uuid not null references profiles (id) on delete cascade, -- challenger / matcher
  player_b uuid references profiles (id) on delete cascade, -- null = Paisa Bot
  status text not null check (status in ('invited', 'active', 'done', 'cancelled', 'declined', 'expired')),
  question_ids text[] not null default '{}', -- picked when the duel starts
  bot jsonb, -- [{ correct, ms }] per round, rolled at the start, never sent to phones
  rating_a integer not null, -- skill ratings when the duel started
  rating_b integer,
  lang_a text not null,
  lang_b text,
  started_at timestamptz, -- round 1 is revealed 3 s later
  seen_a timestamptz, -- last poll; 15 s without one = left
  seen_b timestamptz,
  forfeit uuid, -- the player who left
  created_at timestamptz not null default now(),
  check ((mode = 'bot') = (player_b is null))
);

create index play_duels_a_idx on play_duels (player_a, created_at);
create index play_duels_b_idx on play_duels (player_b, created_at);

-- Humans' answers; the bot's are in play_duels.bot. Times are the server's receive time.
create table play_duel_answers (
  duel_id uuid not null references play_duels (id) on delete cascade,
  round smallint not null check (round between 1 and 5),
  user_id uuid not null references profiles (id) on delete cascade,
  question_id text not null references play_questions (id),
  answer text not null check (answer in ('A', 'B', 'C', 'D')),
  correct boolean not null,
  answered_at timestamptz not null,
  primary key (duel_id, round, user_id) -- one answer per round: a wrong one freezes
);

-- Fastest finger: only the first correct answer of a round can be stored.
create unique index play_duel_answers_first_correct on play_duel_answers (duel_id, round) where correct;
create index play_duel_answers_user_idx on play_duel_answers (user_id, answered_at);

-- Quick-match queue. seen_at is refreshed by the waiting phone's polls; duel_id is set
-- on both rows when they are matched.
create table play_queue (
  user_id uuid primary key references profiles (id) on delete cascade,
  rating integer not null,
  language text not null,
  joined_at timestamptz not null default now(),
  seen_at timestamptz not null default now(),
  duel_id uuid
);

create table play_blocks (
  user_id uuid not null references profiles (id) on delete cascade,
  blocked_id uuid not null references profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, blocked_id)
);

create table play_reports (
  id bigint generated always as identity primary key,
  reporter uuid not null references profiles (id) on delete cascade,
  reported uuid not null references profiles (id) on delete cascade,
  duel_id uuid references play_duels (id) on delete set null,
  created_at timestamptz not null default now()
);

-- Matches p_user with a waiting student (RECOMMENDATION.md §6 quick match): the rating
-- window widens with p_user's wait (±50 / 100 / 150 / 250 at 0 / 5 / 10 / 20 s), any
-- language from 10 s, smallest gap first, then longest wait. Skips blocks either way and
-- p_user's last 2 quick-match opponents. Row locks with skip locked mean two searchers
-- can't claim the same opponent. Returns nothing while there's no match.
create function play_find_match(p_user uuid) returns table (duel_id uuid, opponent uuid)
language plpgsql security definer set search_path = public as $$
declare
  me play_queue;
  them play_queue;
  wait_s double precision;
  v_duel uuid;
begin
  select * into me from play_queue q where q.user_id = p_user for update;
  if not found or me.duel_id is not null then return; end if;
  wait_s := extract(epoch from now() - me.joined_at);
  select q.* into them from play_queue q
   where q.user_id <> p_user and q.duel_id is null
     and q.seen_at > now() - interval '6 seconds'
     and abs(q.rating - me.rating) <= case when wait_s < 5 then 50 when wait_s < 10 then 100
                                          when wait_s < 20 then 150 else 250 end
     and (wait_s >= 10 or q.language = me.language)
     and not exists (select 1 from play_blocks b
                      where (b.user_id = p_user and b.blocked_id = q.user_id)
                         or (b.user_id = q.user_id and b.blocked_id = p_user))
     and q.user_id not in (select case when d.player_a = p_user then d.player_b else d.player_a end
                             from play_duels d
                            where d.mode = 'quick' and p_user in (d.player_a, d.player_b)
                            order by d.created_at desc limit 2)
   order by abs(q.rating - me.rating), q.joined_at
   limit 1
   for update skip locked;
  if not found then return; end if;
  v_duel := gen_random_uuid();
  update play_queue q set duel_id = v_duel where q.user_id in (p_user, them.user_id);
  return query select v_duel, them.user_id;
end $$;

revoke all on function play_find_match(uuid) from public, anon, authenticated;
grant execute on function play_find_match(uuid) to service_role;

alter table play_duels enable row level security;
alter table play_duel_answers enable row level security;
alter table play_queue enable row level security;
alter table play_blocks enable row level security;
alter table play_reports enable row level security;
