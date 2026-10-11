-- Forum and Dashboard Wave 3a fixes (W3-S1, W3-F1, W3-F2, W3-F3, W3-F4)
-- Owned by Sashwat Balaji.

-- 1. [W3-S1] Ensure thread authors cannot rewrite other students' replies.
drop policy if exists "thread authors accept replies" on public.forum_replies;

-- 2. [W3-F1] Restrict votes to upvotes only (vote_type = 1); downvotes are forbidden.
alter table public.forum_votes drop constraint if exists forum_votes_vote_type_check;
alter table public.forum_votes add constraint forum_votes_vote_type_check check (vote_type = 1);

-- 3. [W3-F1] Track whether a thread has already awarded accepted answer XP.
alter table public.forum_threads add column if not exists has_accepted_answer boolean not null default false;

-- 4. [W3-F1] Update forum_accept_reply to:
--    - Reject accepting hidden replies or replies in hidden threads.
--    - Award XP only once per thread (award_xp = true only on the first accept).
--    - Moving accept between replies updates is_accepted but sets award_xp = false.
create or replace function public.forum_accept_reply(p_reply_id uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_thread_id uuid;
  v_thread_author uuid;
  v_reply_author uuid;
  v_pillar text;
  v_reply_hidden boolean;
  v_thread_hidden boolean;
  v_has_accepted boolean;
  v_award_xp boolean := false;
begin
  select r.thread_id, r.author_id, t.author_id, t.pillar, r.is_hidden, t.is_hidden, t.has_accepted_answer
    into v_thread_id, v_reply_author, v_thread_author, v_pillar, v_reply_hidden, v_thread_hidden, v_has_accepted
    from public.forum_replies r
    join public.forum_threads t on t.id = r.thread_id
    where r.id = p_reply_id;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Reply not found');
  end if;

  if v_reply_hidden or v_thread_hidden then
    return jsonb_build_object('success', false, 'error', 'Cannot accept a hidden reply');
  end if;

  if v_thread_author <> auth.uid() then
    return jsonb_build_object('success', false, 'error', 'Only thread author can accept an answer');
  end if;

  if v_reply_author = auth.uid() then
    return jsonb_build_object('success', false, 'error', 'Cannot accept your own reply');
  end if;

  if not v_has_accepted then
    v_award_xp := true;
    update public.forum_threads
      set has_accepted_answer = true
      where id = v_thread_id;
  end if;

  -- Reset any previous accepted reply on this thread
  update public.forum_replies
    set is_accepted = false
    where thread_id = v_thread_id and is_accepted = true;

  -- Mark this reply as accepted
  update public.forum_replies
    set is_accepted = true
    where id = p_reply_id;

  return jsonb_build_object(
    'success', true,
    'thread_id', v_thread_id,
    'reply_author_id', v_reply_author,
    'thread_author_id', v_thread_author,
    'pillar', v_pillar,
    'award_xp', v_award_xp
  );
end;
$$;

revoke all on function public.forum_accept_reply(uuid) from public, anon;
grant execute on function public.forum_accept_reply(uuid) to authenticated;

-- 5. [W3-F4] Disallow replying to hidden threads, disallow cross-thread or hidden parent reply,
--    and disallow editing accepted replies.
drop policy if exists "users create forum replies" on public.forum_replies;
create policy "users create forum replies" on public.forum_replies
  for insert to authenticated with check (
    auth.uid() = author_id and
    exists (
      select 1 from public.forum_threads t
      where t.id = forum_replies.thread_id and not t.is_hidden
    ) and
    (
      parent_reply_id is null or
      exists (
        select 1 from public.forum_replies p
        where p.id = forum_replies.parent_reply_id
          and p.thread_id = forum_replies.thread_id
          and not p.is_hidden
      )
    )
  );

drop policy if exists "authors edit their replies" on public.forum_replies;
create policy "authors edit their replies" on public.forum_replies
  for update to authenticated
  using (auth.uid() = author_id and not is_accepted)
  with check (auth.uid() = author_id and not is_accepted);

-- 6. [W3-F2] Atomic 5-per-IST-day cap for post_created inside core_record_activity
create or replace function public.core_record_activity(
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
  if p_kind = 'daily_login' and p_pillar is not null then
    raise exception 'daily_login cannot have a pillar';
  end if;
  if p_kind <> 'daily_login' and p_pillar not in ('budget', 'save', 'invest', 'safety') then
    raise exception 'Invalid activity';
  end if;

  -- Enforce 5 posts per IST day cap under profile row lock
  if p_kind = 'post_created' then
    if (
      select count(*) from public.xp_events
      where user_id = p_user
        and kind = 'post_created'
        and (created_at at time zone 'Asia/Kolkata')::date = (now() at time zone 'Asia/Kolkata')::date
    ) >= 5 then
      return;
    end if;
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

-- 7. [W3-F3] Filter un-onboarded students and 0-XP students from Global leaderboard
create or replace function public.core_leaderboard(p_user uuid, p_ids uuid[] default null)
returns table (user_id uuid, username text, total_xp bigint, rank bigint)
language sql stable security definer set search_path = '' as $$
  with totals as (
    select p.id, p.username, coalesce(sum(e.xp), 0)::bigint as total_xp,
      coalesce(sum(e.xp) filter (where e.created_at >= now() - interval '7 days'), 0) as weekly_xp
    from public.profiles p left join public.xp_events e on e.user_id = p.id
    where p.onboarded_at is not null
      and (p_ids is null or p.id = any(p_ids) or p.id = p_user)
    group by p.id, p.username
    having (p_ids is not null or p.id = p_user or coalesce(sum(e.xp), 0) > 0)
  ), ranked as (
    select id, username, total_xp, rank() over (order by weekly_xp desc) as rank,
      row_number() over (order by weekly_xp desc, username, id) as position from totals
  )
  select id, username, total_xp, rank from ranked
  where position <= 50 or id = p_user order by position;
$$;

revoke all on function public.core_leaderboard(uuid,uuid[]) from public, anon, authenticated;
grant execute on function public.core_leaderboard(uuid,uuid[]) to service_role;
