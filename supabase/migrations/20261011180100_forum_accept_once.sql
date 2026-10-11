-- Wave 3a integrity fix (forum, W3-F1/W3-S4). Two problems in forum_accept_reply:
-- * has_accepted_answer was read without a lock, so two accepts sent at once both paid 10 XP;
-- * the flag was committed before the server action awarded XP with a separate call whose
--   errors were ignored, so a failed award was lost for good.
-- Now the flag is claimed with a guarded update and the 10 XP (SCORE.md answer_accepted) is
-- recorded in the same transaction: either both happen or neither does.
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
  v_award_xp boolean;
begin
  select r.thread_id, r.author_id, t.author_id, t.pillar, r.is_hidden, t.is_hidden
    into v_thread_id, v_reply_author, v_thread_author, v_pillar, v_reply_hidden, v_thread_hidden
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

  -- Only the first accept on a thread pays; the row lock makes concurrent accepts queue.
  update public.forum_threads set has_accepted_answer = true
    where id = v_thread_id and not has_accepted_answer;
  v_award_xp := found;
  if v_award_xp then
    perform public.core_record_activity(v_reply_author, 'forum', 'answer_accepted', v_pillar, 10, 0, 0,
      'accepted:' || v_thread_id::text);
  end if;

  update public.forum_replies set is_accepted = false
    where thread_id = v_thread_id and is_accepted = true;
  update public.forum_replies set is_accepted = true where id = p_reply_id;

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
