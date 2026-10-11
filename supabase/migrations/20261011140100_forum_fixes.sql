-- Forum and friends fixes after the Wave 1 review. Owned by Sashwat Balaji.

-- 1. Votes are toggled by insert/delete only. forum_vote_sync doesn't fire on update,
--    so an update policy let a student change vote_type and inflate the count.
drop policy "users update their votes" on forum_votes;
revoke update on forum_votes from authenticated;

-- 2. Authors may only write content columns. upvotes, reply_count, reports_count,
--    is_hidden and is_accepted are maintained by security definer triggers (or, for
--    is_accepted, a future server-side accept that checks the thread author).
revoke insert, update on forum_threads from authenticated;
grant insert (author_id, title, content, pillar, tags) on forum_threads to authenticated;
grant update (title, content, pillar, tags, updated_at) on forum_threads to authenticated;

revoke insert, update on forum_replies from authenticated;
grant insert (thread_id, author_id, content, parent_reply_id) on forum_replies to authenticated;
grant update (content, updated_at) on forum_replies to authenticated;

-- 3. Only the recipient answers a pending request; the requester can only cancel (delete).
drop policy "users update request status" on forum_friends;
create policy "recipients answer friend requests" on forum_friends
  for update to authenticated
  using (auth.uid() = friend_id and status = 'pending')
  with check (auth.uid() = friend_id and status in ('accepted', 'declined'));
revoke update on forum_friends from authenticated;
grant update (status, updated_at) on forum_friends to authenticated;

-- One relationship per pair, whoever asked first. Keep an accepted row over a pending
-- one, otherwise the oldest.
delete from forum_friends where id in (
  select id from (
    select id, row_number() over (
      partition by least(user_id, friend_id), greatest(user_id, friend_id)
      order by (status = 'accepted') desc, created_at, id
    ) as n
    from forum_friends
  ) ranked
  where n > 1
);
create unique index forum_friends_pair_unique
  on forum_friends (least(user_id, friend_id), greatest(user_id, friend_id));

-- 4. Phone numbers, same rule as src/features/forum/safety.ts: drop spaces, dots and
--    hyphens, then look for an Indian mobile number (optional +91/91/0 prefix, 10 digits
--    starting 6-9). The old check used \b, which is a backspace in Postgres regex.
create function forum_has_phone(t text)
returns boolean
language sql immutable set search_path = '' as $$
  select regexp_replace(t, '[[:space:].-]', '', 'g') ~ '(^|[^0-9])(\+?91|0)?[6-9][0-9]{9}([^0-9]|$)';
$$;

-- not valid: existing rows aren't rechecked (a violating row would block the deploy);
-- every new insert and edit is.
alter table forum_threads drop constraint forum_threads_no_phone;
alter table forum_threads add constraint forum_threads_no_phone
  check (not forum_has_phone(title) and not forum_has_phone(content)) not valid;

alter table forum_replies drop constraint forum_replies_no_phone;
alter table forum_replies add constraint forum_replies_no_phone
  check (not forum_has_phone(content)) not valid;
