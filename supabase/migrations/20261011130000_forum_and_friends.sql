-- Forum, friends, and safety schema. Owned by Sashwat Balaji.
--
-- Tables:
--   * forum_friends: social graph (requests + accepted)
--   * forum_threads: student questions and discussion posts
--   * forum_replies: answers and comments (supports tree structure)
--   * forum_votes: upvotes on threads and replies
--   * forum_reports: safety reports with auto-moderation

-- 1. Friends graph
create table forum_friends (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  friend_id uuid not null references profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint forum_friends_no_self check (user_id <> friend_id),
  constraint forum_friends_unique_pair unique (user_id, friend_id)
);

create index forum_friends_user_idx on forum_friends (user_id, status);
create index forum_friends_friend_idx on forum_friends (friend_id, status);

alter table forum_friends enable row level security;

create policy "users read their friend relationships" on forum_friends
  for select to authenticated using (auth.uid() = user_id or auth.uid() = friend_id);

create policy "users send friend requests" on forum_friends
  for insert to authenticated with check (auth.uid() = user_id and status = 'pending');

create policy "users update request status" on forum_friends
  for update to authenticated using (auth.uid() = friend_id or auth.uid() = user_id)
  with check (auth.uid() = friend_id or auth.uid() = user_id);

create policy "users delete friendships" on forum_friends
  for delete to authenticated using (auth.uid() = user_id or auth.uid() = friend_id);

-- 2. Forum threads
create table forum_threads (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references profiles (id) on delete cascade,
  title text not null check (char_length(title) >= 5 and char_length(title) <= 200),
  content text not null check (char_length(content) >= 10 and char_length(content) <= 5000),
  pillar text not null check (pillar in ('budget', 'save', 'invest', 'safety')),
  tags text[] not null default '{}',
  upvotes integer not null default 0,
  reply_count integer not null default 0,
  reports_count integer not null default 0,
  is_hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Safety (F3): reject phone numbers and email addresses at database level
  constraint forum_threads_no_email check (
    title !~* '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}' and
    content !~* '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}'
  ),
  constraint forum_threads_no_phone check (
    title !~ '(\+?91[\s-]?)?[6-9]\d{9}|\b\d{10}\b' and
    content !~ '(\+?91[\s-]?)?[6-9]\d{9}|\b\d{10}\b'
  )
);

create index forum_threads_pillar_created_idx on forum_threads (pillar, created_at desc);
create index forum_threads_author_idx on forum_threads (author_id);

alter table forum_threads enable row level security;

create policy "forum threads are readable by signed-in users" on forum_threads
  for select to authenticated using (not is_hidden or auth.uid() = author_id);

create policy "users create forum threads" on forum_threads
  for insert to authenticated with check (auth.uid() = author_id);

create policy "authors edit their threads" on forum_threads
  for update to authenticated using (auth.uid() = author_id) with check (auth.uid() = author_id);

create policy "authors delete their threads" on forum_threads
  for delete to authenticated using (auth.uid() = author_id);

-- 3. Forum replies
create table forum_replies (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references forum_threads (id) on delete cascade,
  author_id uuid not null references profiles (id) on delete cascade,
  content text not null check (char_length(content) >= 2 and char_length(content) <= 3000),
  parent_reply_id uuid references forum_replies (id) on delete cascade,
  is_accepted boolean not null default false,
  upvotes integer not null default 0,
  reports_count integer not null default 0,
  is_hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Safety (F3): reject phone numbers and email addresses at database level
  constraint forum_replies_no_email check (
    content !~* '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}'
  ),
  constraint forum_replies_no_phone check (
    content !~ '(\+?91[\s-]?)?[6-9]\d{9}|\b\d{10}\b'
  )
);

create index forum_replies_thread_created_idx on forum_replies (thread_id, created_at asc);
create index forum_replies_author_idx on forum_replies (author_id);

alter table forum_replies enable row level security;

create policy "forum replies are readable by signed-in users" on forum_replies
  for select to authenticated using (not is_hidden or auth.uid() = author_id);

create policy "users create forum replies" on forum_replies
  for insert to authenticated with check (auth.uid() = author_id);

create policy "authors edit their replies" on forum_replies
  for update to authenticated using (auth.uid() = author_id) with check (auth.uid() = author_id);

create policy "authors delete their replies" on forum_replies
  for delete to authenticated using (auth.uid() = author_id);

-- 4. Votes
create table forum_votes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  thread_id uuid references forum_threads (id) on delete cascade,
  reply_id uuid references forum_replies (id) on delete cascade,
  vote_type smallint not null default 1 check (vote_type in (1, -1)),
  created_at timestamptz not null default now(),
  constraint forum_votes_target check (
    (thread_id is not null and reply_id is null) or
    (thread_id is null and reply_id is not null)
  )
);

create unique index forum_votes_thread_user_unique on forum_votes (user_id, thread_id) where thread_id is not null;
create unique index forum_votes_reply_user_unique on forum_votes (user_id, reply_id) where reply_id is not null;

alter table forum_votes enable row level security;

create policy "users read their own votes" on forum_votes
  for select to authenticated using (auth.uid() = user_id);

create policy "users cast votes" on forum_votes
  for insert to authenticated with check (auth.uid() = user_id);

create policy "users update their votes" on forum_votes
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "users remove their votes" on forum_votes
  for delete to authenticated using (auth.uid() = user_id);

-- 5. Reports
create table forum_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  thread_id uuid references forum_threads (id) on delete cascade,
  reply_id uuid references forum_replies (id) on delete cascade,
  reason text not null,
  created_at timestamptz not null default now(),
  constraint forum_reports_target check (
    (thread_id is not null and reply_id is null) or
    (thread_id is null and reply_id is not null)
  )
);

create unique index forum_reports_thread_user_unique on forum_reports (user_id, thread_id) where thread_id is not null;
create unique index forum_reports_reply_user_unique on forum_reports (user_id, reply_id) where reply_id is not null;

alter table forum_reports enable row level security;

create policy "users read their reports" on forum_reports
  for select to authenticated using (auth.uid() = user_id);

create policy "users submit reports" on forum_reports
  for insert to authenticated with check (auth.uid() = user_id);

-- 6. Trigger: Auto-moderation (hide on >= 3 reports)
create or replace function forum_handle_report()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.thread_id is not null then
    update forum_threads
    set reports_count = reports_count + 1,
        is_hidden = case when reports_count + 1 >= 3 then true else is_hidden end
    where id = new.thread_id;
  elsif new.reply_id is not null then
    update forum_replies
    set reports_count = reports_count + 1,
        is_hidden = case when reports_count + 1 >= 3 then true else is_hidden end
    where id = new.reply_id;
  end if;
  return new;
end;
$$;

create trigger forum_report_inserted
  after insert on forum_reports
  for each row execute function forum_handle_report();

-- 7. Trigger: Update thread reply_count
create or replace function forum_handle_reply_count()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update forum_threads set reply_count = reply_count + 1 where id = new.thread_id;
  elsif tg_op = 'DELETE' then
    update forum_threads set reply_count = greatest(0, reply_count - 1) where id = old.thread_id;
  end if;
  return null;
end;
$$;

create trigger forum_reply_count_sync
  after insert or delete on forum_replies
  for each row execute function forum_handle_reply_count();

-- 8. Trigger: Sync upvotes
create or replace function forum_handle_vote()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.thread_id is not null then
      update forum_threads set upvotes = upvotes + new.vote_type where id = new.thread_id;
    elsif new.reply_id is not null then
      update forum_replies set upvotes = upvotes + new.vote_type where id = new.reply_id;
    end if;
  elsif tg_op = 'DELETE' then
    if old.thread_id is not null then
      update forum_threads set upvotes = upvotes - old.vote_type where id = old.thread_id;
    elsif old.reply_id is not null then
      update forum_replies set upvotes = upvotes - old.vote_type where id = old.reply_id;
    end if;
  end if;
  return null;
end;
$$;

create trigger forum_vote_sync
  after insert or delete on forum_votes
  for each row execute function forum_handle_vote();
