-- Platform Wave 1: private profiles, immutable activity ledger and server-only RPCs.
alter table public.profiles
  add column onboarded_at timestamptz,
  add column persona jsonb not null default '{}'::jsonb,
  add constraint profiles_language_check check (language in ('en', 'te', 'hi')),
  add constraint profiles_grade_check check (grade in (11, 12)),
  add constraint profiles_persona_check check (jsonb_typeof(persona) = 'object');

-- A username/title is public; language, grade and persona are not.
-- Public profile projections are returned by server-only feature helpers.
drop policy "profiles are readable by signed-in users" on public.profiles;
drop policy "users manage their own profile" on public.profiles;
create policy "users read own profile" on public.profiles for select to authenticated
  using (auth.uid() = id);
create policy "users update own profile" on public.profiles for update to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);
revoke insert, delete on public.profiles from anon, authenticated;
revoke update on public.profiles from authenticated;
grant update (language, grade, persona, onboarded_at) on public.profiles to authenticated;

create function public.core_create_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_username text;
begin
  v_username := lower(trim(new.raw_user_meta_data ->> 'username'));
  if v_username is null or v_username !~ '^[a-z0-9_]{3,24}$' then
    raise exception 'Invalid username';
  end if;
  insert into public.profiles (id, username) values (new.id, v_username);
  return new;
end;
$$;
revoke all on function public.core_create_profile() from public, anon, authenticated;
create trigger core_auth_user_created after insert on auth.users
  for each row execute function public.core_create_profile();

alter table public.xp_events
  add column coins integer not null default 0,
  add column rating_delta integer not null default 0,
  add column ref text;
update public.xp_events set ref = 'legacy:' || id::text;
alter table public.xp_events alter column ref set not null;
alter table public.xp_events add constraint xp_events_user_ref_key unique (user_id, ref);
drop policy "users log their own xp" on public.xp_events;
drop policy "xp is readable by signed-in users" on public.xp_events;
create policy "users read own activity" on public.xp_events for select to authenticated
  using (auth.uid() = user_id);
revoke insert, update, delete on public.xp_events from anon, authenticated;

create function public.core_record_activity(
  p_user uuid, p_source text, p_kind text, p_pillar text,
  p_xp integer, p_coins integer, p_rating_delta integer, p_ref text
) returns void language plpgsql security definer set search_path = '' as $$
declare v_coins bigint; v_rating bigint;
begin
  perform 1 from public.profiles where id = p_user for update;
  if not found then raise exception 'Profile not found'; end if;
  if exists (select 1 from public.xp_events where user_id = p_user and ref = p_ref) then
    return;
  end if;
  if p_source is null or p_source not in ('auth', 'play', 'learn', 'reels', 'forum')
    or p_kind is null or length(trim(p_kind)) = 0
    or p_ref is null or length(trim(p_ref)) = 0
    or p_xp is null or p_xp < 0 or p_coins is null or p_rating_delta is null
    or (p_kind <> 'daily_login' and (p_pillar is null or p_pillar not in ('budget', 'save', 'invest', 'safety')))
    or (p_kind = 'daily_login' and (p_source <> 'auth' or p_pillar is not null or p_xp <> 0 or p_coins <> 10 or p_rating_delta <> 0)) then
    raise exception 'Invalid activity';
  end if;
  select coalesce(sum(coins), 0), 800 + coalesce(sum(rating_delta), 0)
    into v_coins, v_rating from public.xp_events where user_id = p_user;
  if p_coins < 0 and v_coins + p_coins < 0 then raise exception 'Insufficient coins'; end if;
  insert into public.xp_events (user_id, source, kind, pillar, xp, coins, rating_delta, ref)
    values (p_user, p_source, p_kind, p_pillar, p_xp, p_coins,
      greatest(p_rating_delta::bigint, 100 - v_rating)::integer, p_ref);
end;
$$;
revoke all on function public.core_record_activity(uuid,text,text,text,integer,integer,integer,text) from public, anon, authenticated;
grant execute on function public.core_record_activity(uuid,text,text,text,integer,integer,integer,text) to service_role;

-- Aggregate in Postgres so PostgREST's row limit never truncates totals/ranks.
create function public.core_xp_summary(p_user uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  with events as (select * from public.xp_events where user_id = p_user),
  days as (select distinct (created_at at time zone 'Asia/Kolkata')::date as day from events),
  numbered as (select day, row_number() over (order by day desc) as n from days),
  streak as (
    select count(*) as value from numbered
    where (select max(day) from days) >= (now() at time zone 'Asia/Kolkata')::date - 1
      and day = (select max(day) from days) - (n::integer - 1)
  )
  select jsonb_build_object(
    'totalXp', coalesce(sum(xp), 0), 'coins', coalesce(sum(coins), 0),
    'rating', 800 + coalesce(sum(rating_delta), 0),
    'weeklyXp', coalesce(sum(xp) filter (where created_at >= now() - interval '7 days'), 0),
    'streakDays', (select value from streak),
    'pillarXp', jsonb_build_object(
      'budget', coalesce(sum(xp) filter (where pillar = 'budget'), 0),
      'save', coalesce(sum(xp) filter (where pillar = 'save'), 0),
      'invest', coalesce(sum(xp) filter (where pillar = 'invest'), 0),
      'safety', coalesce(sum(xp) filter (where pillar = 'safety'), 0))) from events;
$$;
revoke all on function public.core_xp_summary(uuid) from public, anon, authenticated;
grant execute on function public.core_xp_summary(uuid) to service_role;

create function public.core_leaderboard(p_user uuid, p_ids uuid[] default null)
returns table (user_id uuid, username text, total_xp bigint, rank bigint)
language sql stable security definer set search_path = '' as $$
  with totals as (
    select p.id, p.username, coalesce(sum(e.xp), 0)::bigint as total_xp,
      coalesce(sum(e.xp) filter (where e.created_at >= now() - interval '7 days'), 0) as weekly_xp
    from public.profiles p left join public.xp_events e on e.user_id = p.id
    where p_ids is null or p.id = any(p_ids) or p.id = p_user
    group by p.id, p.username
  ), ranked as (
    select id, username, total_xp, rank() over (order by weekly_xp desc) as rank,
      row_number() over (order by weekly_xp desc, username, id) as position from totals
  )
  select id, username, total_xp, rank from ranked
  where position <= 50 or id = p_user order by position;
$$;
revoke all on function public.core_leaderboard(uuid,uuid[]) from public, anon, authenticated;
grant execute on function public.core_leaderboard(uuid,uuid[]) to service_role;

-- Completing onboarding closes placement eligibility permanently. Direct
-- PostgREST profile updates must not be able to reopen it by clearing the date.
create function public.core_guard_onboarding() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.onboarded_at is not null and new.onboarded_at is distinct from old.onboarded_at then
    raise exception 'Onboarding is already complete';
  end if;
  if old.onboarded_at is null and new.onboarded_at is not null then
    new.onboarded_at := now();
  end if;
  return new;
end;
$$;
revoke all on function public.core_guard_onboarding() from public, anon, authenticated;
create trigger core_guard_onboarding before update on public.profiles
  for each row execute function public.core_guard_onboarding();
