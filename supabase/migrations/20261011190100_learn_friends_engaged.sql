-- Wave 3b: per chapter, how many of the caller's friends finished it in the last 14 days
-- (RECOMMENDATION.md §3 "friends"). Counts only, never who.
create function learn_friends_engaged()
returns table (chapter_slug text, friends bigint)
language sql stable security definer set search_path = public as $$
  select p.chapter_slug, count(distinct p.user_id)
  from learn_progress p
  join forum_friends f on f.status = 'accepted'
    and ((f.user_id = auth.uid() and f.friend_id = p.user_id) or (f.friend_id = auth.uid() and f.user_id = p.user_id))
  where p.finished_at >= now() - interval '14 days'
  group by p.chapter_slug;
$$;

revoke execute on function learn_friends_engaged() from public, anon;
grant execute on function learn_friends_engaged() to authenticated;
