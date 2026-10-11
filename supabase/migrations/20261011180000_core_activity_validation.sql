-- Wave 3a integrity fix (platform). 20261011170000_forum_dashboard_wave3a replaced
-- core_record_activity to add the post_created cap (W3-F2) and dropped the Wave 1 input
-- checks: source allowlist, non-empty kind/ref, xp >= 0, non-null coins/rating, a pillar
-- on every non-login event (`not in` passes on null) and the fixed daily_login shape.
-- This restores them unchanged and keeps the cap.
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
  if p_source is null or p_source not in ('auth', 'play', 'learn', 'reels', 'forum')
    or p_kind is null or length(trim(p_kind)) = 0
    or p_ref is null or length(trim(p_ref)) = 0
    or p_xp is null or p_xp < 0 or p_coins is null or p_rating_delta is null
    or (p_kind <> 'daily_login' and (p_pillar is null or p_pillar not in ('budget', 'save', 'invest', 'safety')))
    or (p_kind = 'daily_login' and (p_source <> 'auth' or p_pillar is not null or p_xp <> 0 or p_coins <> 10 or p_rating_delta <> 0)) then
    raise exception 'Invalid activity';
  end if;
  -- W3-F2: at most 5 post_created per IST day, counted under the profile row lock.
  if p_kind = 'post_created' and (
    select count(*) from public.xp_events
     where user_id = p_user and kind = 'post_created'
       and (created_at at time zone 'Asia/Kolkata')::date = (now() at time zone 'Asia/Kolkata')::date
  ) >= 5 then
    return;
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
