-- Wave 3b: roles and NGO / teacher cohorts.
--
-- `role` is set only by an admin (SQL editor or service role), e.g.
--   update profiles set role = 'teacher' where username = 'asha_ngo';
-- Students can't change it: `authenticated` has update rights on language, grade, persona
-- and onboarded_at only (core_wave1).
alter table public.profiles
  add column role text not null default 'student' check (role in ('student', 'teacher', 'mentor'));

-- A teacher's class. Students join with the 6-character code; one cohort per student.
-- Server-only (service role): RLS is on with no policies.
create table public.core_cohorts (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  code text not null unique check (code ~ '^[A-HJ-NP-Z2-9]{6}$'),
  created_at timestamptz not null default now()
);
create index core_cohorts_teacher_idx on public.core_cohorts (teacher_id);

create table public.core_cohort_members (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  cohort_id uuid not null references public.core_cohorts (id) on delete cascade,
  joined_at timestamptz not null default now()
);
create index core_cohort_members_cohort_idx on public.core_cohort_members (cohort_id);

alter table public.core_cohorts enable row level security;
alter table public.core_cohort_members enable row level security;

-- What a teacher sees of their own cohorts' members: username and XP totals (overall, last
-- 7 days, per pillar). Nothing else about the student (D13). Returns nothing for cohorts
-- that aren't p_teacher's.
create function public.core_cohort_progress(p_teacher uuid)
returns table (cohort_id uuid, user_id uuid, username text, total_xp bigint, weekly_xp bigint,
               budget_xp bigint, save_xp bigint, invest_xp bigint, safety_xp bigint)
language sql stable security definer set search_path = '' as $$
  select c.id, p.id, p.username,
    coalesce(sum(e.xp), 0)::bigint,
    coalesce(sum(e.xp) filter (where e.created_at >= now() - interval '7 days'), 0)::bigint,
    coalesce(sum(e.xp) filter (where e.pillar = 'budget'), 0)::bigint,
    coalesce(sum(e.xp) filter (where e.pillar = 'save'), 0)::bigint,
    coalesce(sum(e.xp) filter (where e.pillar = 'invest'), 0)::bigint,
    coalesce(sum(e.xp) filter (where e.pillar = 'safety'), 0)::bigint
  from public.core_cohorts c
  join public.core_cohort_members m on m.cohort_id = c.id
  join public.profiles p on p.id = m.user_id
  left join public.xp_events e on e.user_id = p.id
  where c.teacher_id = p_teacher
  group by c.id, p.id, p.username;
$$;
revoke all on function public.core_cohort_progress(uuid) from public, anon, authenticated;
grant execute on function public.core_cohort_progress(uuid) to service_role;

-- Public profiles now carry the role, for the mentor / teacher badge on forum replies.
drop function public.core_public_profiles(uuid[]);
create function public.core_public_profiles(p_ids uuid[])
returns table (id uuid, username text, total_xp bigint, role text)
language sql stable security definer set search_path = '' as $$
  select p.id, p.username, coalesce(sum(e.xp), 0)::bigint, p.role
  from public.profiles p left join public.xp_events e on e.user_id = p.id
  where p.id = any(p_ids)
  group by p.id, p.username, p.role;
$$;
revoke all on function public.core_public_profiles(uuid[]) from public, anon, authenticated;
grant execute on function public.core_public_profiles(uuid[]) to service_role;
