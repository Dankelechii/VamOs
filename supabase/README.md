# VamOs backend

Accounts, usernames, friend requests and map sync, on Supabase. About fifteen minutes
to set up.

The app works without any of this — no credentials means no accounts, everything stays
on the device, and the Friends tab says so plainly. Nothing here is required to ship.

## 1. Create the project

1. [supabase.com](https://supabase.com) → **New project**. The free tier is plenty to
   start; note the database password somewhere safe.
2. Wait for it to finish provisioning (a minute or two).

## 2. Run the schema

**SQL Editor** → **New query** → paste all of [`schema.sql`](./schema.sql) → **Run**.

It's idempotent, so you can edit and re-run it without dropping anything. It creates:

| | |
|---|---|
| `profiles` | Public, safe fields only. Username is case-insensitive and unique. |
| `friendships` | One row per pair, with pending / accepted / blocked. |
| `trips`, `trip_photos` | The private data. |
| Row-level security | Every rule above, enforced by Postgres rather than the app. |
| RPCs | `send_friend_request`, `accept_friend_request`, `block_user`, `search_profiles`, `delete_my_account`. |
| `trip-photos` bucket | Private storage, keyed by user id. |

## 3. Point the app at it

**Project Settings → API**, then copy `.env.example` to `.env` and fill in the project
URL and the **anon public** key.

```bash
cp .env.example .env
# edit .env
npx expo start -c        # -c clears the cache so the new env vars are picked up
```

The anon key belongs in the app bundle — it grants nothing by itself, because the
policies decide what its holder can read. The **service_role** key must never go near
the client; nothing in this project uses it.

## 4. Email settings

**Authentication → Providers → Email** is on by default with confirmations enabled,
which is what the sign-up flow expects.

While testing on your own device, turning **Confirm email** off saves a round trip.
Turn it back on before you ship — without it, anyone can register an address they don't
own.

For real sending, set up SMTP under **Authentication → Emails**. Supabase's built-in
sender is rate-limited and only intended for development.

## Verified locally before you paste it

The schema and its policies are tested against a real Postgres, not just eyeballed:

```bash
./supabase/tests/run.sh    # needs postgresql installed locally
```

That spins up a throwaway database, stands in for the Supabase pieces the schema needs
(`auth.users`, `auth.uid()`, the storage schema, the role names), applies `schema.sql`,
then runs 27 checks as three different users. The ones that matter:

- a stranger reads **zero** of your trips — but *can* see your public profile
- a **pending** friend still reads zero; only accepting opens it up
- an accepted friend can read your trips and **cannot write** to them
- a requester **cannot accept their own request**
- blocking hides you both ways, including from search
- duplicate requests in either direction can't create a second friendship row
- re-syncing the same trip updates it rather than duplicating
- deleting an account cascades to profile, trips and friendships

Run it after any edit to `schema.sql`. Nothing in it touches your Supabase project.

## Checking it against your real project

Worth doing before you trust it, because the security model is the whole point:

1. Register two accounts on two devices (or a device and a simulator).
2. Search for the second username from the first. You should see the display name and
   country count — **and nothing else**.
3. Send a request. The second account sees it under **Requests**; the first sees
   *Requested*.
4. Accept. Now open the friend from the list — their map loads.
5. Now the real test: in the **SQL Editor**, run
   `select * from trips where user_id = '<the other account>';` while impersonating a
   third user (Dashboard → **Authentication → Users → impersonate**). You should get
   **zero rows**. If you get data back, a policy is wrong — stop and fix it before
   shipping.

## What this costs

Free tier covers 50,000 monthly active users, 500 MB of database and 1 GB of storage.
Trips are tiny — text and dates — so the database will not be what you outgrow.

Photos are the expensive part, which is why they sync last and are optional. A typical
phone photo is 2–4 MB, so 1 GB is roughly 300 photos across all users. Compress before
upload and consider a per-user cap before you turn photo sync on.

## Notes for later

- **Sign in with Apple** becomes mandatory the moment you add Google or Facebook login.
  Email and password alone doesn't trigger it.
- **Account deletion** is already wired up (`delete_my_account`, exposed on the Profile
  screen). Apple requires it once accounts exist.
- **Blocking and reporting** is in the Friends tab, which Guideline 1.2 requires for a
  social app. Blocking writes a row to `reports` (reporter, reported, timestamp) —
  query `select * from reports where reviewed_at is null order by created_at` in the
  SQL editor to see what's outstanding. There's no admin UI or notification yet, so
  someone has to remember to look; wire up an email/Slack alert on insert before you
  have real volume.
- **Photo sync** is scaffolded (`trip_photos`, the storage bucket and its policies) but
  not switched on in the app. Trips sync; photos stay local.
