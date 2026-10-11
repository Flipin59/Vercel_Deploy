-- Forum Wave 2: Answer Acceptance and XP support.
-- Owned by Sashwat Balaji.

-- 1. RLS policy to allow thread authors to accept replies on their threads
create policy "thread authors accept replies" on public.forum_replies
  for update to authenticated
  using (
    exists (
      select 1 from public.forum_threads
      where public.forum_threads.id = public.forum_replies.thread_id
        and public.forum_threads.author_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.forum_threads
      where public.forum_threads.id = public.forum_replies.thread_id
        and public.forum_threads.author_id = auth.uid()
    )
  );

-- 2. Secure RPC to atomically mark a reply as accepted by the thread author
-- Enforces:
--   * Only thread author can accept an answer
--   * Author cannot accept their own reply
--   * Resets any previously accepted answer on the same thread
create or replace function public.forum_accept_reply(p_reply_id uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_thread_id uuid;
  v_thread_author uuid;
  v_reply_author uuid;
  v_pillar text;
begin
  select r.thread_id, r.author_id, t.author_id, t.pillar
    into v_thread_id, v_reply_author, v_thread_author, v_pillar
    from public.forum_replies r
    join public.forum_threads t on t.id = r.thread_id
    where r.id = p_reply_id;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Reply not found');
  end if;

  if v_thread_author <> auth.uid() then
    return jsonb_build_object('success', false, 'error', 'Only thread author can accept an answer');
  end if;

  if v_reply_author = auth.uid() then
    return jsonb_build_object('success', false, 'error', 'Cannot accept your own reply');
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
    'pillar', v_pillar
  );
end;
$$;

revoke all on function public.forum_accept_reply(uuid) from public, anon;
grant execute on function public.forum_accept_reply(uuid) to authenticated;
