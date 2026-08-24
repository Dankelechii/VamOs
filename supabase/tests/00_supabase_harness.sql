-- Minimal stand-in for the parts of a Supabase project that schema.sql depends on.
-- Enough to actually execute the schema and exercise the policies locally, so syntax
-- and logic errors surface here rather than in the user's SQL editor.

create schema if not exists auth;
create schema if not exists storage;
create schema if not exists extensions;

create extension if not exists citext with schema extensions;
create extension if not exists pgcrypto with schema extensions;

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;

grant usage on schema public, auth, storage, extensions to anon, authenticated, service_role;

-- auth.users, trimmed to the columns the schema reads.
create table if not exists auth.users (
  id uuid primary key default extensions.gen_random_uuid(),
  email text unique,
  raw_user_meta_data jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- auth.uid() reads a session GUC, which is how we impersonate users in the tests.
create or replace function auth.uid()
returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

-- storage, enough for the bucket + object policies.
create table if not exists storage.buckets (
  id text primary key, name text not null, public boolean default false
);

create table if not exists storage.objects (
  id uuid primary key default extensions.gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name text not null,
  owner uuid
);

create or replace function storage.foldername(name text)
returns text[] language sql immutable as $$
  select string_to_array(name, '/');
$$;

grant all on all tables in schema storage to authenticated;

-- gen_random_uuid() unqualified, as Supabase provides it.
create or replace function public.gen_random_uuid()
returns uuid language sql volatile as $$ select extensions.gen_random_uuid(); $$;
