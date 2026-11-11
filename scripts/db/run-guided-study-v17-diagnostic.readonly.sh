#!/usr/bin/env bash
set -euo pipefail
set +x

expected_identity='7687199237633114148|postgres'
if [[ "${TECESCOLA_VERIFIED_DATABASE_IDENTITY:-}" != "$expected_identity" ]]; then
  printf 'DIAGNOSTIC_ABORTED=production_identity_not_verified\n' >&2
  exit 1
fi
if [[ -z "${PRODUCTION_DB_URL:-}" ]]; then
  printf 'DIAGNOSTIC_ABORTED=verified_database_connection_unavailable\n' >&2
  exit 1
fi

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
exec psql "$PRODUCTION_DB_URL" -X -A -t -v ON_ERROR_STOP=1 \
  -f "$script_dir/guided-study-v17-diagnostic.readonly.sql"
