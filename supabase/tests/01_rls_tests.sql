-- Does the security model actually hold?
--
-- Every check below runs as `authenticated` with auth.uid() set to a specific user,
-- which is exactly how a real client hits the database. A policy that looks right and
-- is wrong shows up here.

\set ON_ERROR_STOP on
\pset pager off

create or replace function public.check(label text, actual anyelement, expected anyelement)
returns void language plpgsql as $$
begin
  if actual is not distinct from expected then
    raise notice 'PASS  %  (got %)', label, actual;
  else
    raise exception 'FAIL  %  expected %, got %', label, expected, actual;
  end if;
end $$;

-- --------------------------------------------------------------------------
-- Three users: alice and bob become friends; mallory is a stranger.
-- --------------------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'alice@test.com',
     '{"username":"alice","display_name":"Alice"}'),
  ('22222222-2222-2222-2222-222222222222', 'bob@test.com',
     '{"username":"bob","display_name":"Bob"}'),
  ('33333333-3333-3333-3333-333333333333', 'mallory@test.com',
     '{"username":"mallory","display_name":"Mallory"}');

-- The bootstrap trigger should have created all three profiles.
select public.check('profiles auto-created by trigger',
  (select count(*)::int from public.profiles), 3);

select public.check('username taken from sign-up metadata',
  (select display_name from public.profiles where username = 'alice'), 'Alice');

-- --------------------------------------------------------------------------
-- Username rules
-- --------------------------------------------------------------------------
do $$ begin
  begin
    insert into auth.users (email, raw_user_meta_data)
    values ('x@test.com', '{"username":"ALICE"}');
    raise exception 'FAIL  citext uniqueness — ALICE was allowed alongside alice';
  exception when unique_violation then
    raise notice 'PASS  usernames are case-insensitively unique';
  end;
end $$;

do $$ begin
  begin
    insert into auth.users (email, raw_user_meta_data)
    values ('y@test.com', '{"username":"admin"}');
    raise exception 'FAIL  reserved username @admin was allowed';
  exception when check_violation then
    raise notice 'PASS  reserved usernames are rejected';
  end;
end $$;

do $$ begin
  begin
    insert into auth.users (email, raw_user_meta_data)
    values ('z@test.com', '{"username":"no"}');
    raise exception 'FAIL  2-character username was allowed';
  exception when check_violation then
    raise notice 'PASS  username format constraint holds';
  end;
end $$;

-- --------------------------------------------------------------------------
-- Alice records two trips
-- --------------------------------------------------------------------------
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

insert into public.trips (user_id, client_id, country_id, title, start_date, notes)
values
  ('11111111-1111-1111-1111-111111111111', 'trip-1', '392', 'Japan', '2024-04-01', 'Kyoto in blossom'),
  ('11111111-1111-1111-1111-111111111111', 'trip-2', '380', 'Italy', '2022-05-01', 'Amalfi');

select public.check('alice sees her own trips',
  (select count(*)::int from public.trips), 2);

reset role;
select public.check('country_count denormalised by trigger',
  (select country_count from public.profiles where username = 'alice'), 2);

-- --------------------------------------------------------------------------
-- THE CRITICAL CHECK: a stranger must not read Alice's trips
-- --------------------------------------------------------------------------
set role authenticated;
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';

select public.check('*** stranger reads ZERO of alice''s trips ***',
  (select count(*)::int from public.trips
    where user_id = '11111111-1111-1111-1111-111111111111'), 0);

-- ...but the public profile, and only the public profile, is visible.
select public.check('stranger CAN see alice''s public profile',
  (select username::text from public.profiles where username = 'alice'), 'alice');

select public.check('stranger sees alice''s country count without her trips',
  (select country_count from public.profiles where username = 'alice'), 2);

-- --------------------------------------------------------------------------
-- A pending request must NOT grant read access
-- --------------------------------------------------------------------------
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select public.check('bob''s request returns pending',
  public.send_friend_request('alice'), 'pending');

select public.check('*** PENDING friend still reads ZERO trips ***',
  (select count(*)::int from public.trips
    where user_id = '11111111-1111-1111-1111-111111111111'), 0);

-- A requester cannot accept their own request.
do $$ begin
  begin
    perform public.accept_friend_request('11111111-1111-1111-1111-111111111111');
    raise exception 'FAIL  bob accepted his OWN request';
  exception when others then
    if sqlerrm like '%cannot_accept_own_request%' then
      raise notice 'PASS  requester cannot accept their own request';
    else raise; end if;
  end;
end $$;

-- --------------------------------------------------------------------------
-- Once accepted, and only then, the map is shared
-- --------------------------------------------------------------------------
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select public.check('alice accepts',
  public.accept_friend_request('22222222-2222-2222-2222-222222222222'), 'accepted');

set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select public.check('*** ACCEPTED friend reads both trips ***',
  (select count(*)::int from public.trips
    where user_id = '11111111-1111-1111-1111-111111111111'), 2);

-- ...and still cannot write to them.
do $$ begin
  begin
    update public.trips set notes = 'tampered'
     where user_id = '11111111-1111-1111-1111-111111111111';
    if found then raise exception 'FAIL  friend WROTE to alice''s trip'; end if;
    raise notice 'PASS  friend cannot write to alice''s trips';
  exception when insufficient_privilege then
    raise notice 'PASS  friend cannot write to alice''s trips';
  end;
end $$;

-- Mallory is unaffected by someone else's friendship.
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
select public.check('*** stranger STILL reads zero after they befriend ***',
  (select count(*)::int from public.trips
    where user_id = '11111111-1111-1111-1111-111111111111'), 0);

-- --------------------------------------------------------------------------
-- Duplicate requests, in either direction, cannot create a second row
-- --------------------------------------------------------------------------
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
select public.send_friend_request('alice');
select public.send_friend_request('alice');
reset role;
select public.check('one friendship row per pair, not two',
  (select count(*)::int from public.friendships
    where user_a = least('11111111-1111-1111-1111-111111111111'::uuid,
                         '33333333-3333-3333-3333-333333333333'::uuid)
      and user_b = greatest('11111111-1111-1111-1111-111111111111'::uuid,
                            '33333333-3333-3333-3333-333333333333'::uuid)), 1);

-- --------------------------------------------------------------------------
-- Blocking hides both ways
-- --------------------------------------------------------------------------
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select public.block_user('33333333-3333-3333-3333-333333333333');

set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
select public.check('*** blocked user cannot see the blocker''s profile ***',
  (select count(*)::int from public.profiles where username = 'alice'), 0);

select public.check('blocked user finds nothing in search',
  (select count(*)::int from public.search_profiles('alice')), 0);

-- --------------------------------------------------------------------------
-- Search returns friendship state, and never yourself
-- --------------------------------------------------------------------------
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select public.check('search finds alice with accepted status',
  (select friendship_status from public.search_profiles('ali')), 'accepted');

select public.check('search never returns yourself',
  (select count(*)::int from public.search_profiles('bob')), 0);

-- --------------------------------------------------------------------------
-- Sync upsert: same client_id twice updates rather than duplicating
-- --------------------------------------------------------------------------
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
insert into public.trips (user_id, client_id, country_id, title)
values ('11111111-1111-1111-1111-111111111111', 'trip-1', '392', 'Japan again')
on conflict (user_id, client_id) do update set title = excluded.title;

select public.check('re-syncing a trip updates, never duplicates',
  (select count(*)::int from public.trips where client_id = 'trip-1'), 1);
select public.check('...and the update landed',
  (select title from public.trips where client_id = 'trip-1'), 'Japan again');

-- --------------------------------------------------------------------------
-- Cascade on account deletion
-- --------------------------------------------------------------------------
reset role;
delete from auth.users where id = '11111111-1111-1111-1111-111111111111';
select public.check('deleting the account removes the profile',
  (select count(*)::int from public.profiles
    where id = '11111111-1111-1111-1111-111111111111'), 0);
select public.check('deleting the account removes the trips',
  (select count(*)::int from public.trips
    where user_id = '11111111-1111-1111-1111-111111111111'), 0);
select public.check('deleting the account removes the friendships',
  (select count(*)::int from public.friendships
    where user_a = '11111111-1111-1111-1111-111111111111'
       or user_b = '11111111-1111-1111-1111-111111111111'), 0);
