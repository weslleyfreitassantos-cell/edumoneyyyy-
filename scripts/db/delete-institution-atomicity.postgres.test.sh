#!/usr/bin/env bash
set -euo pipefail
set +x

repo_root="${DELETE_INSTITUTION_TEST_PROJECT_ROOT:-$(git rev-parse --show-toplevel)}"
db_container="${PROMOTION_TEST_DB_CONTAINER:-}"
test_sql="$repo_root/supabase/tests/delete_institution_atomicity.database.sql"
migration="$repo_root/supabase/migrations/20261120174530_delete_institution_data_atomic_v1.sql"

[[ -n "$db_container" ]] || { echo 'Disposable PostgreSQL container is required' >&2; exit 1; }
[[ -f "$migration" && -f "$test_sql" ]] || { echo 'Atomic deletion test files are missing' >&2; exit 1; }

docker exec -i "$db_container" psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 < "$migration"
docker exec -i "$db_container" psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 < "$test_sql"
