-- Play quiz engine schema (QUESTIONS.md §2, IMPLEMENTATION.md P1 and §6).
-- Only Play's server code touches these tables, through the service-role client:
-- RLS is on with no policies, so students can't read answers or write results.

create table play_questions (
  id text primary key, -- e.g. save-compound-007
  pillar text not null check (pillar in ('budget', 'save', 'invest', 'safety')),
  tags text[] not null check (cardinality(tags) between 1 and 3), -- QUESTIONS.md §3
  tier text not null check (tier in ('bronze', 'silver', 'gold', 'platinum', 'diamond')),
  type text not null check (type in ('mcq', 'true_false')),
  -- { "en": { "prompt", "options", "answer", "explanation" }, "te": {...}, "hi": {...} }
  content jsonb not null,
  reel_id text, -- cross-feature refs are plain text, no FK
  chapter_slug text,
  status text not null default 'draft' check (status in ('draft', 'live', 'retired')),
  source text not null check (source in ('human', 'ai')),
  answers_count integer not null default 0, -- first tries, kept by play_count_answer()
  correct_count integer not null default 0,
  created_at timestamptz not null default now()
);

-- One quiz run. question_ids is what was served, in order: submitAnswer rejects
-- anything else, and selection reads it for "shown in the last 24 hours".
create table play_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  context text not null check (context in ('practice', 'duel', 'reel', 'chapter', 'placement')),
  question_ids text[] not null,
  chapter_slug text, -- lets Learn's chapter bonus check the attempt was for that chapter
  created_at timestamptz not null default now()
);

create table play_answers (
  id bigint generated always as identity primary key,
  attempt_id uuid not null references play_attempts (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  question_id text not null references play_questions (id),
  context text not null check (context in ('practice', 'duel', 'reel', 'chapter', 'placement')),
  try smallint not null check (try in (1, 2)), -- 2 = the coin reattempt (QUIZ.md §3)
  answer text not null, -- '' when the timer ran out
  correct boolean not null,
  time_ms integer not null,
  xp integer not null default 0,
  coins integer not null default 0,
  rating_delta integer not null default 0,
  answered_at timestamptz not null default now(),
  unique (attempt_id, question_id, try)
);

create index play_answers_user_answered_idx on play_answers (user_id, answered_at);

-- Calibration totals (QUESTIONS.md §7) count first tries only.
create function play_count_answer() returns trigger
language plpgsql set search_path = public as $$
begin
  update play_questions
     set answers_count = answers_count + 1,
         correct_count = correct_count + new.correct::int
   where id = new.question_id;
  return new;
end $$;

create trigger play_answers_count after insert on play_answers
  for each row when (new.try = 1) execute function play_count_answer();

alter table play_questions enable row level security;
alter table play_attempts enable row level security;
alter table play_answers enable row level security;
