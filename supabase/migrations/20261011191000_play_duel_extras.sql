-- Wave 3b duel extras (RECOMMENDATION.md §6): classroom codes, the 4 preset reactions and
-- rematch. Like the other duel tables, only Play's server code touches these (service role).

-- Classroom-code duels are their own mode.
alter table play_duels drop constraint play_duels_mode_check;
alter table play_duels add constraint play_duels_mode_check check (mode in ('bot', 'quick', 'friend', 'code'));

alter table play_duels
  add column react_a jsonb,   -- each player's latest reaction: { r, at }
  add column react_b jsonb,
  add column rematch_a jsonb, -- each player's rematch tap: { at, rating, language }
  add column rematch_b jsonb,
  add column rematch_id uuid; -- the duel the rematch started

-- A 6-character code a student shows a classmate, valid for 10 minutes. One per student.
-- duel_id is set by the classmate who joins; the owner's phone polls for it.
create table play_codes (
  code text primary key check (code ~ '^[A-HJ-NP-Z2-9]{6}$'),
  user_id uuid not null unique references profiles (id) on delete cascade,
  rating integer not null,
  language text not null,
  created_at timestamptz not null default now(),
  duel_id uuid
);

alter table play_codes enable row level security;
