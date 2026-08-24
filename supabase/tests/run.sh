#!/usr/bin/env bash
# Run the schema and its security tests against a throwaway local Postgres.
#
# This exists because the security model is the whole point of the backend, and
# "it looked right" is not the same as "a stranger gets zero rows". Run it after any
# edit to schema.sql, before pasting that schema into Supabase.
#
# Needs postgresql installed locally. Nothing here touches your Supabase project.
set -euo pipefail

PORT="${PORT:-5433}"
PGDATA="${PGDATA:-/tmp/vamos-pgdata}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PGBIN="${PGBIN:-$(dirname "$(command -v initdb 2>/dev/null || echo /usr/lib/postgresql/16/bin/initdb)")}"

# Postgres refuses to run as root. When this is invoked as root (containers, CI), drop
# to the `postgres` user for every database command — and copy the SQL somewhere that
# user can actually read, since a root-owned home directory usually isn't.
if [[ "${EUID:-$(id -u)}" -eq 0 ]]; then
  if ! id postgres >/dev/null 2>&1; then
    echo "Running as root and there is no 'postgres' user. Re-run as a normal user." >&2
    exit 1
  fi
  WORK="$(mktemp -d)"
  cp "$HERE"/*.sql "$HERE/../schema.sql" "$WORK/"
  chmod -R a+rX "$WORK"
  run_pg() { su postgres -c "$1"; }
else
  WORK="$HERE"
  cp "$HERE/../schema.sql" "$WORK/schema.sql" 2>/dev/null || true
  run_pg() { bash -c "$1"; }
fi

rm -rf "$PGDATA"
mkdir -p "$PGDATA"
if [[ "${EUID:-$(id -u)}" -eq 0 ]]; then chown postgres:postgres "$PGDATA"; fi

run_pg "$PGBIN/initdb -D $PGDATA -A trust" >/dev/null
run_pg "$PGBIN/pg_ctl -D $PGDATA -l /tmp/vamos-pg.log -o '-k /tmp -p $PORT' start" >/dev/null
trap 'run_pg "$PGBIN/pg_ctl -D $PGDATA stop" >/dev/null 2>&1 || true' EXIT
sleep 2

run_pg "psql -h /tmp -p $PORT -d postgres -c 'create database vamos;'" >/dev/null

# The harness stands in for the parts of Supabase the schema leans on: auth.users,
# auth.uid(), the storage schema, and the anon/authenticated/service_role roles.
run_pg "psql -h /tmp -p $PORT -d vamos -v ON_ERROR_STOP=1 -f $WORK/00_supabase_harness.sql" >/dev/null
run_pg "psql -h /tmp -p $PORT -d vamos -v ON_ERROR_STOP=1 -f $WORK/schema.sql" >/dev/null
echo "schema applied cleanly"
echo

run_pg "psql -h /tmp -p $PORT -d vamos -v ON_ERROR_STOP=1 -f $WORK/01_rls_tests.sql" 2>&1 \
  | grep -E 'PASS|FAIL|ERROR' \
  | sed -E 's/^psql:[^ ]+ //; s/NOTICE:  //'

echo
echo "All checks passed."
