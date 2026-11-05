#!/bin/sh
set -eu

: "${MIGRATOR_DATABASE_URL:?MIGRATOR_DATABASE_URL must be set to the dedicated Supabase migration connection string}"
: "${CYBERSANDBOX_APP_PASSWORD:?CYBERSANDBOX_APP_PASSWORD must be a generated 32+ character secret}"

if [ "${#CYBERSANDBOX_APP_PASSWORD}" -lt 32 ]; then
  echo 'CYBERSANDBOX_APP_PASSWORD must contain at least 32 characters.' >&2
  exit 1
fi

# For Supabase, verify both the CA chain and hostname for migrations and psql role setup.
# Local Compose leaves DATABASE_SSL unset and uses its private Docker network without TLS.
DATABASE_SSL="${DATABASE_SSL:-false}"
if [ "$DATABASE_SSL" = "true" ]; then
  : "${DATABASE_SSL_CA_BASE64:?DATABASE_SSL_CA_BASE64 is required for verified production database TLS}"
  CA_FILE=/tmp/cybersandbox-supabase-ca.crt
  printf '%s' "$DATABASE_SSL_CA_BASE64" | base64 -d > "$CA_FILE"
  test -s "$CA_FILE"
  export PGSSLROOTCERT="$CA_FILE"
  export PGSSLMODE=verify-full
else
  DATABASE_SSL=false
fi
export DATABASE_SSL

# Normalize the migration URL so node-postgres/libpq use the explicit verified TLS settings.
MIGRATOR_DATABASE_URL="$(node --input-type=module -e '
  const url = new URL(process.env.MIGRATOR_DATABASE_URL);
  url.searchParams.delete("sslmode");
  url.searchParams.delete("sslrootcert");
  process.stdout.write(url.toString());
')"
export MIGRATOR_DATABASE_URL
DATABASE_URL="$MIGRATOR_DATABASE_URL"
export DATABASE_URL

# Run schema changes with the migration owner before the API process exists.
npm run db:migrate

# Provision/rotate the least-privilege runtime role using the migration owner.
sh ops/postgres/apply-runtime-role.sh

# Supabase session-pooler usernames are postgres.<project-ref>; preserve that suffix
# when switching to the restricted runtime role.
DATABASE_URL="$(node --input-type=module -e '
  const url = new URL(process.env.MIGRATOR_DATABASE_URL);
  const suffix = url.username.includes(".") ? url.username.slice(url.username.indexOf(".")) : "";
  url.username = "cybersandbox_app" + suffix;
  url.password = process.env.CYBERSANDBOX_APP_PASSWORD;
  url.searchParams.delete("sslmode");
  url.searchParams.delete("sslrootcert");
  process.stdout.write(url.toString());
')"
export DATABASE_URL

# The API process must never inherit migration-owner credentials or the role password.
unset MIGRATOR_DATABASE_URL CYBERSANDBOX_APP_PASSWORD PGSSLROOTCERT PGSSLMODE
if [ "${DATABASE_SSL}" = "true" ]; then rm -f /tmp/cybersandbox-supabase-ca.crt; fi

exec node dist-server/server/index.js
