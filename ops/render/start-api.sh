#!/bin/sh
set -eu

: "${MIGRATOR_DATABASE_URL:?MIGRATOR_DATABASE_URL must be set to the dedicated Supabase migration connection string}"
: "${CYBERSANDBOX_APP_PASSWORD:?CYBERSANDBOX_APP_PASSWORD must be a generated 32+ character secret}"
: "${APP_ORIGIN:?APP_ORIGIN must be the exact public frontend origin}"

if [ "${#CYBERSANDBOX_APP_PASSWORD}" -lt 32 ]; then
  echo 'CYBERSANDBOX_APP_PASSWORD must contain at least 32 characters.' >&2
  exit 1
fi

# Run schema changes with the migration owner before the API process exists.
# Remove sslmode from the URL so node-postgres uses the explicit certificate-verifying
# DATABASE_SSL configuration in server/database.ts.
DATABASE_URL="$(node --input-type=module -e '
  const url = new URL(process.env.MIGRATOR_DATABASE_URL);
  url.searchParams.delete("sslmode");
  url.searchParams.delete("sslrootcert");
  process.stdout.write(url.toString());
')"
export DATABASE_URL
export DATABASE_SSL=true
npm run db:migrate

# Provision/rotate the least-privilege runtime role using the migration owner.
sh ops/postgres/apply-runtime-role.sh

# Supabase session-pooler usernames are postgres.<project-ref>; preserve that suffix
# when switching to the restricted database role.
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
export DATABASE_SSL=true

# The API process must never inherit migration-owner credentials or the role password.
unset MIGRATOR_DATABASE_URL CYBERSANDBOX_APP_PASSWORD

exec node dist-server/server/index.js
