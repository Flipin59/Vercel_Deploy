-- Reading progress for manga chapters. Owned by learn (Saikiran S).
--
-- Chapters themselves live in src/features/learn/data/chapters.json (versioned with the
-- code), so there is no learn_chapters table; chapter_slug refers to that manifest.

create table learn_progress (
  user_id uuid not null references profiles (id) on delete cascade,
  chapter_slug text not null,
  last_page smallint not null default 1 check (last_page >= 1),
  opened_at timestamptz not null default now(),   -- first open
  updated_at timestamptz not null default now(),  -- last open or page turn
  finished_at timestamptz,                        -- reached the last page
  primary key (user_id, chapter_slug)
);

create index learn_progress_slug_idx on learn_progress (chapter_slug, opened_at);

alter table learn_progress enable row level security;

-- Students see and write only their own progress. Progress is not XP: the chapter bonus
-- is awarded on the server after the chapter check (IMPLEMENTATION.md §6).
create policy "students read their own progress" on learn_progress
  for select to authenticated using (auth.uid() = user_id);
create policy "students start their own progress" on learn_progress
  for insert to authenticated with check (auth.uid() = user_id);
create policy "students update their own progress" on learn_progress
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Per-chapter counts over the last 30 days for the popularity signal
-- (RECOMMENDATION.md §3). Returns no user ids, so it can bypass RLS safely.
create function learn_chapter_stats()
returns table (chapter_slug text, opened bigint, finished bigint)
language sql stable security definer set search_path = public
as $$
  select
    chapter_slug,
    count(*) filter (where opened_at > now() - interval '30 days'),
    count(*) filter (where finished_at > now() - interval '30 days')
  from learn_progress
  group by chapter_slug
$$;

revoke execute on function learn_chapter_stats() from public, anon;
grant execute on function learn_chapter_stats() to authenticated;
