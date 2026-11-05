#!/usr/bin/env sh
set -eu
: "${MIGRATOR_DATABASE_URL:?Set MIGRATOR_DATABASE_URL to the migration-owner connection string}"
: "${CYBERSANDBOX_APP_PASSWORD:?Set CYBERSANDBOX_APP_PASSWORD from your secret manager}"
if [ "${#CYBERSANDBOX_APP_PASSWORD}" -lt 32 ]; then echo 'CYBERSANDBOX_APP_PASSWORD must contain at least 32 characters.' >&2; exit 1; fi
SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
export CYBERSANDBOX_APP_PASSWORD
psql "$MIGRATOR_DATABASE_URL" --no-psqlrc --set=ON_ERROR_STOP=1 --file="$SCRIPT_DIR/runtime-role.sql"
echo 'Restricted cybersandbox_app role created/rotated. Set API DATABASE_URL to its connection string.'
