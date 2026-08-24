-- VamOs backend schema
-- =====================
-- Run this once against a fresh Supabase project (SQL Editor → paste → Run).
-- It is idempotent, so re-running after an edit is safe.
--
-- The shape of the security model, which is the part worth understanding:
--
--   * A profile is PUBLICLY readable, but it only ever holds safe, low-stakes fields —
--     username, display name, avatar, and a country count. That is what makes
--     "add someone by username" possible without exposing anything private.
--   * Trips are the private data (dates, notes, photos) and are readable ONLY by their
--     owner and by accepted friends. This split is the whole point: searching for
--     someone must never reveal where they have been.
--   * Every rule below is enforced by Postgres itself via row-level security, not by
--     the app. A malicious client holding a valid token still cannot read what these
--     policies do not allow.

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
create extension if not exists citext with schema extensions;


-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
-- One row per auth user. `username` is citext, so uniqueness is case-insensitive:
-- "Dan" and "dan" cannot both exist. The unique constraint is what makes claiming a
-- username atomic — two people racing for the same handle in the same millisecond,
-- and the database rejects one of them. Never do this check in application code.
create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  username      extensions.citext not null unique,
  display_name  text not null default 'Traveller',
  avatar_emoji  text not null default '🧭',
  avatar_color  text not null default '#DDA83F',
  bio           text,
  -- Denormalised so a search result can show "42 countries" without granting the
  -- searcher any read access to the trips themselves. Maintained by trigger below.
  country_count integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint username_format check (
    username ~ '^[a-zA-Z0-9_]{3,20}$'
  ),
  constraint display_name_length check (char_length(display_name) between 1 and 40),
  constraint bio_length check (bio is null or char_length(bio) <= 160)
);

-- Reserved handles, so nobody can register as @admin or @vamos and impersonate us.
create table if not exists public.reserved_usernames (
  username extensions.citext primary key
);

insert into public.reserved_usernames (username) values
  ('admin'), ('administrator'), ('vamos'), ('vamosapp'), ('support'), ('help'),
  ('root'), ('system'), ('moderator'), ('mod'), ('staff'), ('team'), ('official'),
  ('security'), ('api'), ('www'), ('me'), ('you'), ('null'), ('undefined')
on conflict do nothing;

create or replace function public.reject_reserved_username()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if exists (select 1 from public.reserved_usernames r where r.username = new.username) then
    raise exception 'username_reserved' using errcode = '23514';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_guard_username on public.profiles;
create trigger profiles_guard_username
  before insert or update of username on public.profiles
  for each row execute function public.reject_reserved_username();


-- ---------------------------------------------------------------------------
-- friendships
-- ---------------------------------------------------------------------------
-- One row per relationship, not two. `least`/`greatest` on the pair gives a canonical
-- ordering, so the unique index makes a duplicate request impossible in either
-- direction — A→B and B→A are the same row.
--
-- `requested_by` is kept separately because the pair is ordered by uuid, which says
-- nothing about who actually asked. The UI needs that to know whether to show
-- "Accept" or "Requested".
create table if not exists public.friendships (
  user_a       uuid not null references public.profiles (id) on delete cascade,
  user_b       uuid not null references public.profiles (id) on delete cascade,
  requested_by uuid not null references public.profiles (id) on delete cascade,
  status       text not null default 'pending'
                 check (status in ('pending', 'accepted', 'blocked')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  primary key (user_a, user_b),
  constraint ordered_pair check (user_a < user_b),
  constraint no_self_friendship check (user_a <> user_b)
);

create index if not exists friendships_user_b_idx on public.friendships (user_b);
create index if not exists friendships_status_idx on public.friendships (status);

-- True when the two users have an ACCEPTED friendship. Used by the trip policies.
-- security definer so it can read friendships without recursing through the very
-- policies that call it.
create or replace function public.are_friends(a uuid, b uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and f.user_a = least(a, b)
      and f.user_b = greatest(a, b)
  );
$$;

-- True when either user has blocked the other. Blocking must beat every other rule.
create or replace function public.is_blocked(a uuid, b uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.friendships f
    where f.status = 'blocked'
      and f.user_a = least(a, b)
      and f.user_b = greatest(a, b)
  );
$$;


-- ---------------------------------------------------------------------------
-- trips
-- ---------------------------------------------------------------------------
-- The private data. `client_id` is the id the device generated, kept so an offline
-- device can sync the same trip repeatedly without creating duplicates — the upsert
-- keys on (user_id, client_id) rather than on the server's uuid.
create table if not exists public.trips (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  client_id   text not null,
  country_id  text not null,
  title       text,
  start_date  date,
  end_date    date,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  unique (user_id, client_id),
  constraint title_length check (title is null or char_length(title) <= 80),
  constraint notes_length check (notes is null or char_length(notes) <= 2000),
  constraint sane_dates check (end_date is null or start_date is null or end_date >= start_date)
);

create index if not exists trips_user_idx on public.trips (user_id);
create index if not exists trips_country_idx on public.trips (user_id, country_id);

-- trip_photos rows point at objects in the `trip-photos` storage bucket. Photos are
-- the expensive part of this system, so they sync last and are entirely optional.
create table if not exists public.trip_photos (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid not null references public.trips (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  client_id   text not null,
  storage_path text not null,
  caption     text,
  taken_at    date,
  created_at  timestamptz not null default now(),

  unique (user_id, client_id),
  constraint caption_length check (caption is null or char_length(caption) <= 200)
);

create index if not exists trip_photos_trip_idx on public.trip_photos (trip_id);

-- Reports: created only by block_user() below, never directly by clients. This is
-- what makes "Blocking also reports them to us for review" (FriendsScreen copy)
-- true rather than aspirational — Apple Guideline 1.2 requires this mechanism to
-- actually reach the developer, not just hide the blocked person from the blocker.
create table if not exists public.reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  reported_id uuid not null references public.profiles (id) on delete cascade,
  reason      text not null default 'blocked',
  created_at  timestamptz not null default now(),
  reviewed_at timestamptz
);

create index if not exists reports_reported_idx on public.reports (reported_id);
create index if not exists reports_unreviewed_idx on public.reports (created_at) where reviewed_at is null;

alter table public.reports enable row level security;

-- No policies and no grants to anon/authenticated: this table is written only from
-- inside block_user() (SECURITY DEFINER, runs as the function owner) and read only
-- from the SQL editor / service role. A client can neither see nor forge reports.


-- ---------------------------------------------------------------------------
-- country_count maintenance
-- ---------------------------------------------------------------------------
-- Recount distinct countries whenever a user's trips change, so the public profile
-- can show a number without the searcher reading any trip rows.
create or replace function public.refresh_country_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target uuid := coalesce(new.user_id, old.user_id);
begin
  update public.profiles p
     set country_count = (
           select count(distinct t.country_id) from public.trips t where t.user_id = target
         ),
         updated_at = now()
   where p.id = target;
  return coalesce(new, old);
end;
$$;

drop trigger if exists trips_refresh_count on public.trips;
create trigger trips_refresh_count
  after insert or update or delete on public.trips
  for each row execute function public.refresh_country_count();


-- ---------------------------------------------------------------------------
-- New-user bootstrap
-- ---------------------------------------------------------------------------
-- Creates the profile row the moment an auth user is created, taking the username
-- from the sign-up metadata. Doing it in a trigger rather than from the client means
-- there is no window in which an authenticated user exists without a profile.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  desired extensions.citext := coalesce(new.raw_user_meta_data ->> 'username', '');
begin
  if desired = '' then
    -- Fall back to a generated handle; the user renames it later in the app.
    desired := 'traveller_' || substr(replace(new.id::text, '-', ''), 1, 8);
  end if;

  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    desired,
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), 'Traveller')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ---------------------------------------------------------------------------
-- Table privileges
-- ---------------------------------------------------------------------------
-- Supabase sets default privileges that would grant these automatically, but relying
-- on that makes the schema silently dependent on project setup — a self-hosted or
-- reconfigured project would install cleanly and then fail with "permission denied"
-- at runtime. Granting explicitly costs nothing and makes this file stand alone.
--
-- These grants are deliberately broad; row-level security below is what actually
-- restricts access. A GRANT says "you may query this table", the policies decide
-- which rows you get back.
grant select, insert, update, delete
  on public.profiles, public.friendships, public.trips, public.trip_photos
  to authenticated;
grant select on public.reserved_usernames to authenticated;


-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------
alter table public.profiles     enable row level security;
alter table public.friendships  enable row level security;
alter table public.trips        enable row level security;
alter table public.trip_photos  enable row level security;
alter table public.reserved_usernames enable row level security;

-- profiles ------------------------------------------------------------------
-- Publicly readable BY DESIGN — this is what makes username search work. Everything
-- on this table is deliberately non-sensitive. Anything private belongs on `trips`.
-- Blocked users are hidden from each other entirely.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or not public.is_blocked(auth.uid(), id));

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- No insert policy: profiles are created only by the on_auth_user_created trigger.
-- No delete policy: deleting the auth user cascades.

-- reserved_usernames --------------------------------------------------------
-- Readable so the client can warn before submitting; never writable.
drop policy if exists reserved_select on public.reserved_usernames;
create policy reserved_select on public.reserved_usernames
  for select to authenticated using (true);

-- friendships ---------------------------------------------------------------
drop policy if exists friendships_select on public.friendships;
create policy friendships_select on public.friendships
  for select to authenticated
  using (auth.uid() in (user_a, user_b));

-- You may only create a row you are part of, you must be the requester, and it must
-- start as pending or blocked — you cannot insert yourself as an accepted friend.
drop policy if exists friendships_insert on public.friendships;
create policy friendships_insert on public.friendships
  for insert to authenticated
  with check (
    auth.uid() in (user_a, user_b)
    and requested_by = auth.uid()
    and status in ('pending', 'blocked')
  );

-- Either party may update, which covers accept, block and unblock. The check that
-- you cannot accept your OWN request lives in the accept_friend_request() function
-- below, because a policy cannot see the row's prior state cleanly here.
drop policy if exists friendships_update on public.friendships;
create policy friendships_update on public.friendships
  for update to authenticated
  using (auth.uid() in (user_a, user_b))
  with check (auth.uid() in (user_a, user_b));

drop policy if exists friendships_delete on public.friendships;
create policy friendships_delete on public.friendships
  for delete to authenticated
  using (auth.uid() in (user_a, user_b));

-- trips ---------------------------------------------------------------------
-- The important one. Read access is yours, or an accepted friend's — never the
-- public's, and never a pending requester's.
drop policy if exists trips_select on public.trips;
create policy trips_select on public.trips
  for select to authenticated
  using (user_id = auth.uid() or public.are_friends(auth.uid(), user_id));

drop policy if exists trips_write_own on public.trips;
create policy trips_write_own on public.trips
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- trip_photos ---------------------------------------------------------------
drop policy if exists trip_photos_select on public.trip_photos;
create policy trip_photos_select on public.trip_photos
  for select to authenticated
  using (user_id = auth.uid() or public.are_friends(auth.uid(), user_id));

drop policy if exists trip_photos_write_own on public.trip_photos;
create policy trip_photos_write_own on public.trip_photos
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());


-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

-- Send a friend request by username. Returns the resulting status.
-- Written as a function so the client never needs to know the target's uuid — it
-- passes a username and the server resolves it, which keeps enumeration to a single
-- deliberate call rather than a table scan.
create or replace function public.send_friend_request(target_username extensions.citext)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  target uuid;
  me uuid := auth.uid();
  pair_a uuid;
  pair_b uuid;
  existing public.friendships;
begin
  if me is null then raise exception 'not_authenticated'; end if;

  select id into target from public.profiles where username = target_username;
  if target is null then raise exception 'user_not_found'; end if;
  if target = me then raise exception 'cannot_friend_self'; end if;
  if public.is_blocked(me, target) then raise exception 'blocked'; end if;

  pair_a := least(me, target);
  pair_b := greatest(me, target);

  select * into existing from public.friendships
   where user_a = pair_a and user_b = pair_b;

  if existing is null then
    insert into public.friendships (user_a, user_b, requested_by, status)
    values (pair_a, pair_b, me, 'pending');
    return 'pending';
  end if;

  if existing.status = 'accepted' then
    return 'accepted';
  end if;

  -- They already asked us: treat a second request from our side as accepting.
  if existing.status = 'pending' and existing.requested_by <> me then
    update public.friendships set status = 'accepted', updated_at = now()
     where user_a = pair_a and user_b = pair_b;
    return 'accepted';
  end if;

  return existing.status;
end;
$$;

-- Accept a request. Deliberately refuses to let the requester accept their own —
-- otherwise anyone could add themselves to your friend list unilaterally.
create or replace function public.accept_friend_request(other_user uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  pair_a uuid := least(auth.uid(), other_user);
  pair_b uuid := greatest(auth.uid(), other_user);
  existing public.friendships;
begin
  if me is null then raise exception 'not_authenticated'; end if;

  select * into existing from public.friendships
   where user_a = pair_a and user_b = pair_b;

  if existing is null then raise exception 'no_request'; end if;
  if existing.status <> 'pending' then return existing.status; end if;
  if existing.requested_by = me then raise exception 'cannot_accept_own_request'; end if;

  update public.friendships set status = 'accepted', updated_at = now()
   where user_a = pair_a and user_b = pair_b;
  return 'accepted';
end;
$$;

-- Block someone. Creates the row if there was no prior relationship, so you can block
-- a stranger. `requested_by` records who did the blocking.
create or replace function public.block_user(other_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  pair_a uuid := least(auth.uid(), other_user);
  pair_b uuid := greatest(auth.uid(), other_user);
begin
  if me is null then raise exception 'not_authenticated'; end if;
  if other_user = me then raise exception 'cannot_block_self'; end if;

  insert into public.friendships (user_a, user_b, requested_by, status)
  values (pair_a, pair_b, me, 'blocked')
  on conflict (user_a, user_b)
  do update set status = 'blocked', requested_by = me, updated_at = now();

  insert into public.reports (reporter_id, reported_id) values (me, other_user);
end;
$$;

-- Search by username prefix. Excludes yourself and anyone in a block relationship.
create or replace function public.search_profiles(q text, max_results integer default 20)
returns table (
  id uuid,
  username extensions.citext,
  display_name text,
  avatar_emoji text,
  avatar_color text,
  country_count integer,
  friendship_status text,
  requested_by uuid
)
language sql
security definer
stable
set search_path = public, extensions
as $$
  select p.id,
         p.username,
         p.display_name,
         p.avatar_emoji,
         p.avatar_color,
         p.country_count,
         f.status,
         f.requested_by
    from public.profiles p
    left join public.friendships f
      on f.user_a = least(auth.uid(), p.id)
     and f.user_b = greatest(auth.uid(), p.id)
   where p.id <> auth.uid()
     and coalesce(f.status, '') <> 'blocked'
     and (p.username operator(extensions.~~*) (q || '%')
          or p.display_name ilike (q || '%'))
   order by p.username
   limit least(coalesce(max_results, 20), 50);
$$;

-- Delete your own account, in full. App Store Guideline 5.1.1(v) requires this to be
-- doable from inside the app once accounts exist — it is not optional.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then raise exception 'not_authenticated'; end if;
  -- Everything else cascades from auth.users via profiles.
  delete from auth.users where id = me;
end;
$$;

-- Postgres grants EXECUTE on new functions to PUBLIC by default, and PostgREST
-- exposes everything in `public` — so without these revokes every function here is
-- callable by ANONYMOUS users at /rest/v1/rpc/<name>. Most would fail on the
-- auth.uid() null check, but relying on that is luck rather than design, and
-- `are_friends`/`is_blocked` would happily answer questions about arbitrary uuids.
-- Supabase's own security linter flags this; these lines are the fix.
revoke execute on function public.send_friend_request(extensions.citext) from public, anon;
revoke execute on function public.accept_friend_request(uuid)            from public, anon;
revoke execute on function public.block_user(uuid)                       from public, anon;
revoke execute on function public.search_profiles(text, integer)         from public, anon;
revoke execute on function public.delete_my_account()                    from public, anon;
revoke execute on function public.are_friends(uuid, uuid)                from public, anon;
revoke execute on function public.is_blocked(uuid, uuid)                 from public, anon;

-- Trigger functions are invoked by the trigger itself, never by a client, so nobody
-- needs EXECUTE on them. Postgres checks that privilege when the trigger is CREATED,
-- not on each firing, so revoking here does not stop them running.
revoke execute on function public.handle_new_user()            from public, anon, authenticated;
revoke execute on function public.refresh_country_count()      from public, anon, authenticated;
revoke execute on function public.reject_reserved_username()   from public, anon, authenticated;

-- The four the app actually calls, plus the two helpers that RLS policies invoke as
-- the querying user (a policy calling are_friends() runs it as `authenticated`, so
-- that grant is load-bearing — revoke it and every trip read fails).
grant execute on function public.send_friend_request(extensions.citext) to authenticated;
grant execute on function public.accept_friend_request(uuid)            to authenticated;
grant execute on function public.block_user(uuid)                       to authenticated;
grant execute on function public.search_profiles(text, integer)         to authenticated;
grant execute on function public.delete_my_account()                    to authenticated;
grant execute on function public.are_friends(uuid, uuid)                to authenticated;
grant execute on function public.is_blocked(uuid, uuid)                 to authenticated;


-- ---------------------------------------------------------------------------
-- Storage: trip photos
-- ---------------------------------------------------------------------------
-- Private bucket. Objects are keyed <user_id>/<filename>, and the policies read that
-- first path segment to decide access — which is how a friend can view your photo
-- without being able to write to your folder.
insert into storage.buckets (id, name, public)
values ('trip-photos', 'trip-photos', false)
on conflict (id) do nothing;

drop policy if exists trip_photos_read on storage.objects;
create policy trip_photos_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'trip-photos'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.are_friends(auth.uid(), ((storage.foldername(name))[1])::uuid)
    )
  );

drop policy if exists trip_photos_write on storage.objects;
create policy trip_photos_write on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'trip-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists trip_photos_delete on storage.objects;
create policy trip_photos_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'trip-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
