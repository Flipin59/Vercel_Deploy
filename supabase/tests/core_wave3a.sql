-- W3-S1 regression: run after all migrations in a disposable Supabase database.
-- Requires an administrative connection; every fixture is rolled back.
begin;
do $$
declare
  v_thread_author uuid := gen_random_uuid();
  v_reply_author uuid := gen_random_uuid();
  v_thread uuid;
  v_reply uuid;
  v_changed integer;
  v_result jsonb;
begin
  insert into auth.users(id, raw_user_meta_data) values
    (v_thread_author, jsonb_build_object('username', 'w3_' || substr(replace(v_thread_author::text, '-', ''), 1, 20))),
    (v_reply_author, jsonb_build_object('username', 'w3_' || substr(replace(v_reply_author::text, '-', ''), 1, 20)));
  insert into public.forum_threads(author_id, title, content, pillar)
    values(v_thread_author, 'Saving safely', 'How can I plan a small savings goal?', 'save') returning id into v_thread;
  insert into public.forum_replies(thread_id, author_id, content)
    values(v_thread, v_reply_author, 'Start by setting a realistic weekly savings goal.') returning id into v_reply;

  perform set_config('request.jwt.claim.sub', v_thread_author::text, true);
  set local role authenticated;
  update public.forum_replies set content = 'The thread author replaced this answer.' where id = v_reply;
  get diagnostics v_changed = row_count;
  if v_changed <> 0 then raise exception 'A thread author rewrote another student''s answer'; end if;
  reset role;

  perform set_config('request.jwt.claim.sub', v_reply_author::text, true);
  set local role authenticated;
  update public.forum_replies set content = 'Set a realistic savings goal and track your progress.' where id = v_reply;
  get diagnostics v_changed = row_count;
  if v_changed <> 1 then raise exception 'A reply author cannot edit their own content'; end if;
  reset role;

  perform set_config('request.jwt.claim.sub', v_thread_author::text, true);
  set local role authenticated;
  v_result := public.forum_accept_reply(v_reply);
  if (v_result->>'success')::boolean is not true then raise exception 'Accept RPC stopped working: %', v_result; end if;
  reset role;
end;
$$;
rollback;

-- core_record_activity keeps its input checks when a feature redefines it (it lost them
-- once, in 20261011170000; restored by 20261011180000).
begin;
do $$
declare v_user uuid := gen_random_uuid();
begin
  insert into auth.users(id, raw_user_meta_data) values
    (v_user, jsonb_build_object('username', 'w3_' || substr(replace(v_user::text, '-', ''), 1, 20)));
  begin
    perform public.core_record_activity(v_user, 'play', 'x', 'save', -1, 0, 0, 'w3a:negative');
    raise exception 'core_record_activity accepted negative XP';
  exception when raise_exception then
    if sqlerrm <> 'Invalid activity' then raise; end if;
  end;
  begin
    perform public.core_record_activity(v_user, 'play', 'x', null, 1, 0, 0, 'w3a:nopillar');
    raise exception 'core_record_activity accepted an event without a pillar';
  exception when raise_exception then
    if sqlerrm <> 'Invalid activity' then raise; end if;
  end;
end;
$$;
rollback;
