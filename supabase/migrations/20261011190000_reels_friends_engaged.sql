-- Wave 3b: per reel, how many of the caller's friends liked, saved or completed it in the
-- last 14 days (RECOMMENDATION.md §3 "friends"). Counts only, never who, and only for the
-- signed-in student's own accepted friends.
create function reels_friends_engaged()
returns table (reel_id text, friends bigint)
language sql stable security definer set search_path = public as $$
  with friends as (
    select case when f.user_id = auth.uid() then f.friend_id else f.user_id end as id
    from forum_friends f
    where f.status = 'accepted' and auth.uid() in (f.user_id, f.friend_id)
  ), engaged as (
    select r.reel_id, r.user_id from reels_reactions r
    where r.created_at >= now() - interval '14 days'
    union
    select e.reel_id, e.user_id from reels_events e
    where e.kind = 'complete' and e.created_at >= now() - interval '14 days'
  )
  select e.reel_id, count(distinct e.user_id)
  from engaged e join friends f on f.id = e.user_id
  group by e.reel_id;
$$;

revoke execute on function reels_friends_engaged() from public, anon;
grant execute on function reels_friends_engaged() to authenticated;
