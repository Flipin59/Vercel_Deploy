-- W3-R2: popularity counts likes and saves from the last 30 days only (RECOMMENDATION.md §3).
-- `likes` stays all-time for the counter on each reel. Counts only, never who.
drop function reels_item_stats(timestamptz);

create function reels_item_stats(p_since timestamptz)
returns table (reel_id text, views bigint, completions bigint, likes bigint, recent_likes bigint, recent_saves bigint)
language sql stable security definer set search_path = public as $$
  select ids.reel_id,
    (select count(distinct e.user_id) from reels_events e where e.reel_id = ids.reel_id and e.kind = 'view' and e.created_at >= p_since),
    (select count(distinct e.user_id) from reels_events e where e.reel_id = ids.reel_id and e.kind = 'complete' and e.created_at >= p_since),
    (select count(*) from reels_reactions r where r.reel_id = ids.reel_id and r.kind = 'like'),
    (select count(*) from reels_reactions r where r.reel_id = ids.reel_id and r.kind = 'like' and r.created_at >= p_since),
    (select count(*) from reels_reactions r where r.reel_id = ids.reel_id and r.kind = 'save' and r.created_at >= p_since)
  from (select distinct id as reel_id from reels_items) ids;
$$;

revoke execute on function reels_item_stats(timestamptz) from public, anon;
grant execute on function reels_item_stats(timestamptz) to authenticated;
