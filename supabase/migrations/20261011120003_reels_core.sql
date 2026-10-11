-- Reels: catalogue, engagement log, likes/saves, and the public video bucket. Owner: Reels.
-- Cross-feature references (chapter slugs) are plain text, never foreign keys.

-- One row per reel per language (RECOMMENDATION.md §1). Seeded from
-- src/features/reels/data/reels.json; keep the two in step.
create table reels_items (
  id text not null,
  language text not null check (language in ('en', 'te', 'hi')),
  file text not null, -- object name in the `reels` Storage bucket
  title text not null,
  captions text not null default '',
  pillar text not null check (pillar in ('budget', 'save', 'invest', 'safety')),
  tags text[] not null check (cardinality(tags) between 1 and 3),
  level smallint not null check (level between 1 and 99),
  chapter text, -- learn slug
  created_at timestamptz not null default now(),
  primary key (id, language)
);

-- Append-only engagement log. `view` = watched ≥ 3 s, `skip` = left before 3 s,
-- `complete` = ≥ 80% watched. `quiz_opened` resets the 5-reel quiz count.
create table reels_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references profiles (id) on delete cascade,
  reel_id text,
  kind text not null check (kind in ('view', 'complete', 'skip', 'like', 'unlike', 'save', 'unsave', 'share', 'quiz_opened')),
  created_at timestamptz not null default now(),
  check ((kind = 'quiz_opened') = (reel_id is null))
);

create index reels_events_user_created_idx on reels_events (user_id, created_at);
create index reels_events_reel_created_idx on reels_events (reel_id, created_at);

-- Current like/save state per student.
create table reels_reactions (
  user_id uuid not null references profiles (id) on delete cascade,
  reel_id text not null,
  kind text not null check (kind in ('like', 'save')),
  created_at timestamptz not null default now(),
  primary key (user_id, reel_id, kind)
);

alter table reels_items enable row level security;
alter table reels_events enable row level security;
alter table reels_reactions enable row level security;

create policy "reels are readable by signed-in users" on reels_items
  for select to authenticated using (true);

create policy "users read their own reel events" on reels_events
  for select to authenticated using (auth.uid() = user_id);
create policy "users log their own reel events" on reels_events
  for insert to authenticated with check (auth.uid() = user_id);

create policy "users read their own reactions" on reels_reactions
  for select to authenticated using (auth.uid() = user_id);
create policy "users add their own reactions" on reels_reactions
  for insert to authenticated with check (auth.uid() = user_id);
create policy "users remove their own reactions" on reels_reactions
  for delete to authenticated using (auth.uid() = user_id);

-- Per-reel totals for the like counter and the recommendation popularity score.
-- Counts only, never who: students can't read each other's events.
create function reels_item_stats(p_since timestamptz)
returns table (reel_id text, views bigint, completions bigint, likes bigint, saves bigint)
language sql stable security definer set search_path = public as $$
  select ids.reel_id,
    (select count(distinct e.user_id) from reels_events e where e.reel_id = ids.reel_id and e.kind = 'view' and e.created_at >= p_since),
    (select count(distinct e.user_id) from reels_events e where e.reel_id = ids.reel_id and e.kind = 'complete' and e.created_at >= p_since),
    (select count(*) from reels_reactions r where r.reel_id = ids.reel_id and r.kind = 'like'),
    (select count(*) from reels_reactions r where r.reel_id = ids.reel_id and r.kind = 'save')
  from (select distinct id as reel_id from reels_items) ids;
$$;

revoke execute on function reels_item_stats(timestamptz) from public, anon;
grant execute on function reels_item_stats(timestamptz) to authenticated;

-- Public bucket for the clips: files are named as in reels_items.file and uploaded by
-- the Reels owner from the dashboard. Public objects are readable without a policy.
insert into storage.buckets (id, name, public)
values ('reels', 'reels', true)
on conflict (id) do nothing;

insert into reels_items (id, language, file, title, captions, pillar, tags, level, chapter, created_at) values
  ('budget-needs-vs-wants', 'en', 'budget-needs-vs-wants.en.mp4', 'Peter Learns Needs vs Wants', 'Needs first. Wants get the leftovers.', 'budget', array['needs-vs-wants', 'pocket-money'], 2, 'budget-needs-vs-wants', '2026-10-11T00:00:00Z'),
  ('budget-50-30-20', 'en', 'budget-50-30-20.en.mp4', 'Stewie Explains the 50-30-20 Rule', 'A budget isn''t a cage. It''s a plan for what you actually want.', 'budget', array['50-30-20', 'pocket-money'], 14, 'budget-pocket-money-plan', '2026-10-11T00:00:00Z'),
  ('budget-no-cost-emi', 'en', 'budget-no-cost-emi.en.mp4', 'Peter Falls for "No-Cost EMI"', 'If you can''t afford it twice, you can''t afford it on EMI.', 'budget', array['bills-and-emi'], 18, null, '2026-10-11T00:00:00Z'),
  ('budget-chai-math', 'en', 'budget-chai-math.en.mp4', 'Peter''s Chai Math', 'Small leaks sink big ships. Save first, spend what''s left.', 'budget', array['tracking-spending'], 8, 'budget-pocket-money-plan', '2026-10-11T00:00:00Z'),
  ('save-emergency-fund', 'en', 'save-emergency-fund.en.mp4', 'Peter Breaks His Phone', 'You can''t predict emergencies. You can be ready for them.', 'save', array['emergency-fund'], 6, 'save-emergency-fund', '2026-10-11T00:00:00Z'),
  ('budget-minimum-due', 'en', 'budget-minimum-due.en.mp4', 'Peter Pays the "Minimum Due"', 'Minimum due = maximum pain. Pay in full.', 'budget', array['bills-and-emi', 'compound-interest'], 26, null, '2026-10-11T00:00:00Z'),
  ('save-compounding', 'en', 'save-compounding.en.mp4', 'Rick Explains Compounding', 'Time in > timing. Start early.', 'save', array['compound-interest', 'time-horizon'], 30, 'save-magic-of-compounding', '2026-10-11T00:00:00Z'),
  ('invest-risk-and-diversification', 'en', 'invest-risk-and-diversification.en.mp4', 'Rick Explains Risk & Diversification', 'Don''t put all your eggs in one basket.', 'invest', array['risk-and-return', 'diversification'], 50, 'invest-risk-and-return', '2026-10-11T00:00:00Z'),
  ('save-inflation', 'en', 'save-inflation.en.mp4', 'Rick Explains Inflation', 'Money that sits still slowly loses value.', 'save', array['inflation'], 34, 'save-magic-of-compounding', '2026-10-11T00:00:00Z'),
  ('safety-never-share-otp', 'en', 'safety-never-share-otp.en.mp4', 'Morty Almost Shares His OTP', 'Your OTP is your house key. Never hand it over.', 'safety', array['otp-and-pin', 'upi-fraud'], 1, 'safety-upi-and-otp', '2026-10-11T00:00:00Z'),
  ('safety-spot-the-scam', 'en', 'safety-spot-the-scam.en.mp4', 'Spot the Scam with Rick', 'Urgency + guarantee + pay first = SCAM.', 'safety', array['phishing', 'fake-loan-apps', 'ponzi-and-chit-scams'], 12, 'safety-spot-the-scam', '2026-10-11T00:00:00Z'),
  ('safety-money-mule', 'en', 'safety-money-mule.en.mp4', 'Morty Becomes a Money Mule', 'If they pay you to use your account, YOU are the one who gets caught.', 'safety', array['upi-fraud'], 22, 'safety-spot-the-scam', '2026-10-11T00:00:00Z');
