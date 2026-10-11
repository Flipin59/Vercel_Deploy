-- Run after both core migrations against a disposable Supabase database.
-- All fixtures roll back. Requires an administrative database connection.
begin;
do $$
declare
  v_user uuid := gen_random_uuid();
  v_other uuid := gen_random_uuid();
  v_summary jsonb;
  v_username text := 'test_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 19);
begin
  if has_function_privilege('authenticated', 'public.core_record_activity(uuid,text,text,text,integer,integer,integer,text)', 'EXECUTE')
    or has_function_privilege('anon', 'public.core_record_activity(uuid,text,text,text,integer,integer,integer,text)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.core_xp_summary(uuid)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.core_leaderboard(uuid,uuid[])', 'EXECUTE')
    or has_table_privilege('authenticated', 'public.xp_events', 'INSERT') then
    raise exception 'Client roles can access privileged ledger operations';
  end if;
  insert into auth.users(id, raw_user_meta_data) values
    (v_user, jsonb_build_object('username', v_username)),
    (v_other, jsonb_build_object('username', 'other_' || substr(v_username, 6, 18)));
  perform public.core_record_activity(v_user, 'auth', 'daily_login', null, 0, 10, 0, 'login:test');
  perform public.core_record_activity(v_user, 'auth', 'daily_login', null, 0, 10, 0, 'login:test');
  perform public.core_record_activity(v_user, 'play', 'answer', 'save', 25, -1, -900, 'answer:test');
  v_summary := public.core_xp_summary(v_user);
  if (v_summary->>'coins')::int <> 9 or (v_summary->>'rating')::int <> 100
    or (v_summary->>'totalXp')::int <> 25 or (v_summary->>'streakDays')::int <> 1 then
    raise exception 'Incorrect ledger summary: %', v_summary;
  end if;
  begin
    perform public.core_record_activity(v_user, 'play', 'wager', 'save', 0, -10, 0, 'overdraw');
    raise exception 'Negative balance accepted';
  exception when raise_exception then
    if sqlerrm <> 'Insufficient coins' then raise; end if;
  end;
  -- A duplicate wins before validation or balance checking; retrying is harmless.
  perform public.core_record_activity(v_user, 'play', 'answer', 'save', 500, -100, 500, 'answer:test');
  if (select count(*) from public.xp_events where user_id = v_user) <> 2 then
    raise exception 'Idempotency failed';
  end if;
  update public.profiles set onboarded_at = now() where id = v_user;
  begin
    update public.profiles set onboarded_at = null where id = v_user;
    raise exception 'Placement eligibility was reopened';
  exception when raise_exception then
    if sqlerrm <> 'Onboarding is already complete' then raise; end if;
  end;
  -- SET ROLE makes this exercise RLS, rather than an admin's bypass.
  perform set_config('request.jwt.claim.sub', v_other::text, true);
  set local role authenticated;
  if exists (select 1 from public.xp_events where user_id = v_user)
    or exists (select 1 from public.profiles where id = v_user) then
    raise exception 'Another student can read private data';
  end if;
  reset role;
end;
$$;
rollback;
