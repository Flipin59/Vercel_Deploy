-- Public projections of other students: username and XP total only, from which the
-- server computes title and level (RATING.md §7). Profiles and xp_events are own-rows
-- only, so features can't read these directly. Server-only, like core_leaderboard.

create function public.core_public_profiles(p_ids uuid[])
returns table (id uuid, username text, total_xp bigint)
language sql stable security definer set search_path = '' as $$
  select p.id, p.username, coalesce(sum(e.xp), 0)::bigint
  from public.profiles p left join public.xp_events e on e.user_id = p.id
  where p.id = any(p_ids)
  group by p.id, p.username;
$$;
revoke all on function public.core_public_profiles(uuid[]) from public, anon, authenticated;
grant execute on function public.core_public_profiles(uuid[]) to service_role;

-- Username search for adding friends. `p_query` is matched literally (no wildcards).
create function public.core_search_profiles(p_query text, p_limit integer)
returns table (id uuid, username text, total_xp bigint)
language sql stable security definer set search_path = '' as $$
  select p.id, p.username, coalesce(sum(e.xp), 0)::bigint
  from public.profiles p left join public.xp_events e on e.user_id = p.id
  where strpos(p.username, lower(p_query)) > 0
  group by p.id, p.username
  order by strpos(p.username, lower(p_query)), p.username
  limit least(greatest(p_limit, 1), 20);
$$;
revoke all on function public.core_search_profiles(text, integer) from public, anon, authenticated;
grant execute on function public.core_search_profiles(text, integer) to service_role;
