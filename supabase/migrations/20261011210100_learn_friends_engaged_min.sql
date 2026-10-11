-- Privacy fix for learn_friends_engaged (Wave 3b review), same rule as Reels': counts only
-- when the caller has at least 3 accepted friends and at least 2 of them finished the chapter.
create or replace function learn_friends_engaged()
returns table (chapter_slug text, friends bigint)
language sql stable security definer set search_path = public as $$
  select p.chapter_slug, count(distinct p.user_id)
  from learn_progress p
  join forum_friends f on f.status = 'accepted'
    and ((f.user_id = auth.uid() and f.friend_id = p.user_id) or (f.friend_id = auth.uid() and f.user_id = p.user_id))
  where p.finished_at >= now() - interval '14 days'
    and (select count(*) from forum_friends g where g.status = 'accepted' and auth.uid() in (g.user_id, g.friend_id)) >= 3
  group by p.chapter_slug
  having count(distinct p.user_id) >= 2;
$$;

revoke execute on function learn_friends_engaged() from public, anon;
grant execute on function learn_friends_engaged() to authenticated;
