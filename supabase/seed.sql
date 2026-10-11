-- C5: synthetic fixtures for a local/disposable demo database. Run after all migrations.
-- No passwords or identities are created: these are leaderboard/friendship fixtures,
-- not login accounts. The demo walkthrough starts with a separate real sign-up.
-- Fixed ids and per-user refs make re-running the seed harmless.
begin;
do $$
declare
  v_user uuid;
  v_event_day date;
  v_ref text;
  v_pillars text[] := array['budget', 'save', 'invest', 'safety'];
  v_usernames text[] := array['demo_asha', 'demo_ravi', 'demo_meera', 'demo_kiran',
                            'demo_zoya', 'demo_arjun', 'demo_tara', 'demo_dev'];
begin
  for student in 1..8 loop
    v_user := ('00000000-0000-0000-0000-' || lpad((100 + student)::text, 12, '0'))::uuid;
    insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
      values (v_user, 'authenticated', 'authenticated', v_usernames[student] || '@example.test',
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('username', v_usernames[student]), now(), now())
      on conflict (id) do nothing;
    update public.profiles set language = 'en', grade = case when student % 2 = 0 then 12 else 11 end,
      onboarded_at = coalesce(onboarded_at, now()),
      persona = '{"answers":{"budget":"learning","save":"new","invest":"new","safety":"learning"},"pillarNeed":{"budget":0.6,"save":1,"invest":1,"safety":0.6}}'::jsonb
      where id = v_user;
    for days_ago in 0..7 loop
      v_event_day := (now() at time zone 'Asia/Kolkata')::date - days_ago;
      for question in 1..student loop
        v_ref := 'demo:quiz:' || v_event_day::text || ':' || question::text;
        perform public.core_record_activity(v_user, 'play', 'quiz_answer_correct',
          v_pillars[1 + (question + days_ago - 1) % 4], 10, 3, 2, v_ref);
        -- Only synthetic rows are dated; user-written ledgers remain immutable.
        update public.xp_events set created_at =
          least((v_event_day + time '12:00') at time zone 'Asia/Kolkata', now())
          where user_id = v_user and ref = v_ref;
      end loop;
    end loop;
  end loop;
end;
$$;

insert into public.forum_friends (user_id, friend_id, status)
select '00000000-0000-0000-0000-000000000101'::uuid,
       ('00000000-0000-0000-0000-' || lpad(student::text, 12, '0'))::uuid,
       'accepted'
from generate_series(102, 105) as student
on conflict do nothing;
insert into public.forum_friends (user_id, friend_id, status)
values ('00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000103', 'accepted'),
       ('00000000-0000-0000-0000-000000000104', '00000000-0000-0000-0000-000000000106', 'pending')
on conflict do nothing;
commit;
