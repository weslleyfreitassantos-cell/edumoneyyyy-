#!/usr/bin/env bash
set -euo pipefail
set +x

repo_root="$(git rev-parse --show-toplevel)"
promoter="$repo_root/scripts/db/promote-single-migration.sh"
tmp="$(mktemp -d "${TMPDIR:-/tmp}/tecescola-promote-postgres.XXXXXX")"
real_sha256sum="$(command -v sha256sum)"
[[ "$real_sha256sum" == /* && -f "$real_sha256sum" && -x "$real_sha256sum" ]] || {
  echo 'Absolute executable sha256sum not found before installing test mocks' >&2
  exit 1
}
db_container="${PROMOTION_TEST_DB_CONTAINER:-$(docker ps --format '{{.Names}}' | awk '/^supabase_db_/{print; exit}')}"
[[ -n "$db_container" ]] || { echo 'Disposable Supabase PostgreSQL container not found' >&2; exit 1; }

cleanup() {
  for database in promoter_historical_ci promoter_chronological_ci promoter_backup_exception_ci promoter_pr411_local_exception_ci; do
    docker exec "$db_container" psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
      -c "DROP DATABASE IF EXISTS $database WITH (FORCE);" >/dev/null 2>&1 || true
  done
  rm -rf -- "$tmp"
}
trap cleanup EXIT

raw_db_url="${PROMOTION_TEST_DB_URL:-}"
if [[ -z "$raw_db_url" ]]; then
  status_output="$(npx supabase status -o env)"
  raw_db_url="$(printf '%s\n' "$status_output" | sed -n 's/^DB_URL=//p' | head -n 1 | sed -E "s/^[\\\"']//; s/[\\\"']$//")"
fi
[[ -n "$raw_db_url" ]] || { echo 'Supabase local DB_URL unavailable' >&2; exit 1; }
test_db_url="$(RAW_DB_URL="$raw_db_url" python3 - <<'PY'
import os
from urllib.parse import urlsplit, urlunsplit

parts = urlsplit(os.environ["RAW_DB_URL"])
if parts.scheme not in ("postgres", "postgresql"):
    raise SystemExit("Unexpected disposable PostgreSQL URL scheme")
if parts.hostname not in ("127.0.0.1", "localhost", "::1"):
    raise SystemExit("Refusing to run disposable migration proof against a non-loopback host")
if not parts.username or not parts.password or not parts.port:
    raise SystemExit("Disposable PostgreSQL URL is missing connection fields")
print(urlunsplit((parts.scheme, parts.netloc, "/promoter_historical_ci", parts.query, "")))
PY
)"
chronological_db_url="${test_db_url%/promoter_historical_ci}/promoter_chronological_ci"
promotion_test_supabase_bin="${PROMOTION_TEST_SUPABASE_BIN:-}"
if [[ -z "${promotion_test_supabase_bin}" ]]; then
  linux_supabase_bin="${repo_root}/node_modules/@supabase/cli-linux-x64/bin/supabase"
  if [[ -x "${linux_supabase_bin}" ]]; then
    promotion_test_supabase_bin="${linux_supabase_bin}"
  else
    promotion_test_supabase_bin="${repo_root}/node_modules/.bin/supabase"
  fi
fi

mkdir -p "$tmp/bin"
cat > "$tmp/bin/supabase-with-timeout" <<'MOCK'
#!/usr/bin/env bash
set -euo pipefail
set +e
output_file="$(mktemp "${PROMOTION_TEST_CLI_LOG_DIR:?}/supabase-cli.XXXXXX")"
supabase_binary="${PROMOTION_TEST_SUPABASE_BIN:-}"
if [[ -n "$supabase_binary" && -x "$supabase_binary" ]]; then
  timeout --kill-after="${PROMOTION_TEST_SUPABASE_KILL_AFTER_SECONDS:-5}s" \
    "${PROMOTION_TEST_SUPABASE_TIMEOUT_SECONDS:-180}s" \
    "$supabase_binary" --debug "$@" >"$output_file" 2>&1
else
  timeout --kill-after="${PROMOTION_TEST_SUPABASE_KILL_AFTER_SECONDS:-5}s" \
    "${PROMOTION_TEST_SUPABASE_TIMEOUT_SECONDS:-180}s" \
    npx supabase --debug "$@" >"$output_file" 2>&1
fi
status=$?
if [[ "$status" -eq 124 ]]; then
  printf 'PROMOTION_TEST_CLI_TIMEOUT=YES\n' >> "$output_file"
fi
printf 'PROMOTION_TEST_CLI_EXIT_STATUS=%s\n' "$status" >> "$output_file"
cat "$output_file"
exit "$status"
MOCK
chmod +x "$tmp/bin/supabase-with-timeout"
mkdir -p "$tmp/cli-logs"

emit_cli_diagnostics() {
  local log_file
  shopt -s nullglob
  local log_files=("$tmp"/cli-logs/supabase-cli.*)
  shopt -u nullglob
  ((${#log_files[@]})) || return 0
  printf 'PROMOTION_TEST_CLI_DIAGNOSTICS_BEGIN\n' >&2
  for log_file in "${log_files[@]}"; do
    tail -n 50 "$log_file" |
      sed -E \
        -e 's#(postgres(ql)?://[^:/@]+:)[^@/]+@#\1<redacted>@#g' \
        -e 's/(password|token|secret|key)=([^[:space:]]+)/\1=<redacted>/Ig' >&2
  done
  printf 'PROMOTION_TEST_CLI_DIAGNOSTICS_END\n' >&2
}

cat > "$tmp/bin/psql" <<'MOCK'
#!/usr/bin/env bash
set -euo pipefail
query=''
connection_url="${1:-}"
database_name="${connection_url##*/}"
database_name="${database_name%%\?*}"
[[ "$database_name" =~ ^[A-Za-z0-9_]+$ ]] || exit 82
while (($#)); do
  if [[ "$1" == '-c' ]]; then
    query="${2:-}"
    break
  fi
  shift
done
[[ "$query" == 'select version from supabase_migrations.schema_migrations order by version;' ]] || exit 81
exec docker exec "$PROMOTION_TEST_DB_CONTAINER" psql -X -A -t -v ON_ERROR_STOP=1 \
  -U postgres -d "$database_name" -c "$query"
MOCK
chmod +x "$tmp/bin/psql"

init_fixture() {
  local fixture="$1" base_version="$2" target_version="$3" target_name="$4" database="$5"
  mkdir -p "$fixture/supabase/migrations"
  printf 'project_id = "migration-promoter-ci"\n' > "$fixture/supabase/config.toml"
  printf 'select 1;\n' > "$fixture/supabase/migrations/${base_version}_baseline.sql"
  cat > "$fixture/supabase/migrations/${target_version}_${target_name}.sql" <<SQL
create table public.${target_name}_probe (id integer primary key);
insert into public.${target_name}_probe (id) values (1);
SQL
  git -C "$fixture" init -q
  git -C "$fixture" config user.name 'Migration promoter CI'
  git -C "$fixture" config user.email 'migration-promoter-ci@example.invalid'
  git -C "$fixture" add supabase/config.toml supabase/migrations
  git -C "$fixture" commit -q -m 'Disposable migration promoter fixture'

  docker exec "$db_container" psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
    -c "CREATE DATABASE $database;" >/dev/null
  docker exec "$db_container" psql -U postgres -d "$database" -v ON_ERROR_STOP=1 \
    -c "CREATE SCHEMA supabase_migrations;
        CREATE TABLE supabase_migrations.schema_migrations (
          version text PRIMARY KEY NOT NULL,
          statements text[],
          name text
        );
        INSERT INTO supabase_migrations.schema_migrations (version, statements, name)
          VALUES ('$base_version', ARRAY[]::text[], 'baseline');" >/dev/null
}

run_promotion() {
  local fixture="$1" base_version="$2" target_version="$3" target_name="$4" database_url="$5" database_name="$6"
  local target_file target_hash source_commit output
  printf 'PROMOTE_SINGLE_MIGRATION_CASE=%s START\n' "$target_name" >&2
  target_file="$(find "$fixture/supabase/migrations" -maxdepth 1 -type f -name "${target_version}_*.sql" -print -quit)"
  target_hash="$(sed 's/\r$//' "$target_file" | sha256sum | awk '{print $1}')"
  source_commit="$(git -C "$fixture" rev-parse HEAD)"
  if ! output="$(PATH="$tmp/bin:$PATH" \
    PROMOTION_TEST_DB_CONTAINER="$db_container" \
    PROMOTION_TEST_DATABASE_NAME="$database_name" \
    PROMOTION_TEST_CLI_LOG_DIR="$tmp/cli-logs" \
    PROMOTION_TEST_SUPABASE_BIN="$promotion_test_supabase_bin" \
    PROMOTE_SINGLE_MIGRATION_CLI_BINARY="$tmp/bin/supabase-with-timeout" \
    SOURCE_ROOT="$fixture" \
    TARGET_VERSION="$target_version" \
    EXPECTED_REMOTE_LAST="$base_version" \
    EXPECTED_SOURCE_COMMIT="$source_commit" \
    EXPECTED_TARGET_SHA256="$target_hash" \
    PRODUCTION_DB_URL="$database_url" \
    APPLY=1 \
    BACKUP_GATE=PASS \
    CONFIRM_PRODUCTION_WRITE=I_CONFIRM_SELECTIVE_PRODUCTION_MIGRATION \
    TMPDIR="$tmp" \
    "$promoter")"; then
    printf '%s\n' "$output" >&2
    emit_cli_diagnostics
    printf 'PROMOTE_SINGLE_MIGRATION_CASE=%s FAIL\n' "$target_name" >&2
    return 1
  fi
  printf '%s\n' "$output"
  grep -q '^PROMOTION=APPLIED$' <<< "$output" || {
    printf 'Expected applied result for %s\n' "$target_name" >&2
    return 1
  }
  grep -Fxq "REMOTE_AFTER_COUNT=2" <<< "$output" || {
    printf 'Expected two ledger versions after %s\n' "$target_name" >&2
    return 1
  }

  local actual_versions actual_probe
  actual_versions="$(docker exec "$db_container" psql -U postgres -d "$database_name" \
    -X -A -t -v ON_ERROR_STOP=1 -c \
    'select version from supabase_migrations.schema_migrations order by version;')" || {
    printf 'Could not inspect the post-promotion ledger for %s\n' "$target_name" >&2
    return 1
  }
  actual_probe="$(docker exec "$db_container" psql -U postgres -d "$database_name" \
    -X -A -t -v ON_ERROR_STOP=1 -c \
    "select count(*) from public.${target_name}_probe;")" || {
    printf 'Expected probe table missing after %s\n' "$target_name" >&2
    return 1
  }
  [[ "$(printf '%s\n' "$actual_versions" | sort)" == "$(printf '%s\n' "$base_version" "$target_version" | sort)" ]] || {
    printf 'Unexpected post-promotion ledger contents for %s\n' "$target_name" >&2
    return 1
  }
  [[ "$actual_probe" == '1' ]] || {
    printf 'Expected one probe row after %s\n' "$target_name" >&2
    return 1
  }
  printf 'PROMOTE_SINGLE_MIGRATION_CASE=%s PASS\n' "$target_name" >&2
}

historical_fixture="$tmp/source-historical"
init_fixture "$historical_fixture" 20261019000500 20261013003200 historical promoter_historical_ci
historical_db_url="$test_db_url"
historical_output="$(run_promotion "$historical_fixture" 20261019000500 20261013003200 historical "$historical_db_url" promoter_historical_ci)"
grep -q '^REMOTE_AFTER_LAST=20261019000500$' <<< "$historical_output"
grep -q '^PROMOTION=APPLIED$' <<< "$historical_output"
echo 'PROMOTE_SINGLE_MIGRATION_POSTGRES_HISTORICAL=PASS'

chronological_fixture="$tmp/source-chronological"
init_fixture "$chronological_fixture" 20261013003200 20261022000200 chronological promoter_chronological_ci
chronological_output="$(run_promotion "$chronological_fixture" 20261013003200 20261022000200 chronological "$chronological_db_url" promoter_chronological_ci)"
grep -q '^REMOTE_AFTER_LAST=20261022000200$' <<< "$chronological_output"
grep -q '^PROMOTION=APPLIED$' <<< "$chronological_output"
echo 'PROMOTE_SINGLE_MIGRATION_POSTGRES_CHRONOLOGICAL=PASS'

# Prove the release-399 exception through the real Supabase CLI against a third,
# disposable PostgreSQL database. CI cannot access the private Windows backup;
# the fixture digest command therefore substitutes only that artifact's
# already-verified SHA. The production path uses the operating system sha256sum.
exception_version=20261023000200
exception_base_version=20261023000100
exception_database=promoter_backup_exception_ci
exception_db_url="${test_db_url%/promoter_historical_ci}/${exception_database}"
exception_backup="$tmp/verified-windows-backup-fixture.tar.gz"
mkdir -p "$tmp/exception-bin"
printf 'CI placeholder for the previously verified Windows backup\n' > "$exception_backup"
cat > "$tmp/exception-bin/sha256sum" <<'MOCK'
#!/usr/bin/env bash
set -euo pipefail
if [[ -n "${PROMOTION_TEST_BACKUP_FILE:-}" && "$#" == '1' && "$1" == "$PROMOTION_TEST_BACKUP_FILE" ]]; then
  printf '%s  %s\n' 'b8818e0b97a2152d60b1405f90d089a1ab4b43ba87d2739f234afb038b28d5c0' "$1"
else
  "$PROMOTION_TEST_REAL_SHA256SUM" "$@"
fi
MOCK
chmod +x "$tmp/exception-bin/sha256sum"
[[ "$real_sha256sum" != "$tmp/exception-bin/sha256sum" ]] || {
  echo 'Resolved sha256sum unexpectedly points to the test mock' >&2
  exit 1
}

docker exec "$db_container" psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
  -c "CREATE DATABASE $exception_database;" >/dev/null
docker exec "$db_container" psql -U postgres -d "$exception_database" -v ON_ERROR_STOP=1 \
  -c "CREATE SCHEMA supabase_migrations;
      CREATE TABLE supabase_migrations.schema_migrations (
        version text PRIMARY KEY NOT NULL,
        statements text[],
        name text
      );
      INSERT INTO supabase_migrations.schema_migrations (version, statements, name)
        VALUES ('$exception_base_version', ARRAY[]::text[], 'release-399-base');" >/dev/null

exception_target_file="$repo_root/supabase/migrations/${exception_version}_guided_study_demo_preview_state.sql"
exception_target_hash="$(sed 's/\r$//' "$exception_target_file" | sha256sum | awk '{print $1}')"
[[ "$exception_target_hash" == '4ed582c3b19f5da409b7e087e4bce5b8af07b7b98c5c2829fda52a3f1c414e97' ]]
exception_source_commit="$(git -C "$repo_root" rev-parse HEAD)"
if ! exception_output="$(PATH="$tmp/exception-bin:$tmp/bin:$PATH" \
  PROMOTION_TEST_DB_CONTAINER="$db_container" \
  PROMOTION_TEST_DATABASE_NAME="$exception_database" \
  PROMOTION_TEST_CLI_LOG_DIR="$tmp/cli-logs" \
  PROMOTION_TEST_SUPABASE_BIN="$promotion_test_supabase_bin" \
  PROMOTE_SINGLE_MIGRATION_CLI_BINARY="$tmp/bin/supabase-with-timeout" \
  PROMOTION_TEST_REAL_SHA256SUM="$real_sha256sum" \
  PROMOTION_TEST_BACKUP_FILE="$exception_backup" \
  SOURCE_ROOT="$repo_root" \
  TARGET_VERSION="$exception_version" \
  EXPECTED_REMOTE_LAST="$exception_base_version" \
  EXPECTED_SOURCE_COMMIT="$exception_source_commit" \
  EXPECTED_TARGET_SHA256="$exception_target_hash" \
  PRODUCTION_DB_URL="$exception_db_url" \
  APPLY=1 \
  BACKUP_GATE=FAIL \
  BACKUP_EXCEPTION_PR=399 \
  BACKUP_EXCEPTION_RELEASE_SHA=36979b8adc4408bf9eaccdf77f742904fba152fc \
  BACKUP_EXCEPTION_WINDOWS_PATH='C:\Users\samue\Backups\TecEscola\edumoney-2026-10-24T07-41-52Z.tar.gz' \
  BACKUP_EXCEPTION_BACKUP_SHA256=b8818e0b97a2152d60b1405f90d089a1ab4b43ba87d2739f234afb038b28d5c0 \
  BACKUP_EXCEPTION_BACKUP_FILE="$exception_backup" \
  BACKUP_EXCEPTION_RESTORE_STATUS=PARTIAL \
  BACKUP_EXCEPTION_STORAGE_STATUS=PARTIAL \
  BACKUP_EXCEPTION_OFFSITE_GATE=FAIL \
  ACCEPT_INCOMPLETE_RECOVERY_RISK=I_ACCEPT_INCOMPLETE_RECOVERY_RISK_FOR_RELEASE_399 \
  CONFIRM_PRODUCTION_WRITE=I_CONFIRM_SELECTIVE_PRODUCTION_MIGRATION \
  TMPDIR="$tmp" \
  "$promoter")"; then
  printf '%s\n' "$exception_output" >&2
  emit_cli_diagnostics
  printf 'PROMOTE_SINGLE_MIGRATION_CASE=release_399_backup_exception FAIL\n' >&2
  exit 1
fi
printf '%s\n' "$exception_output"
grep -q '^BACKUP_GATE=FAIL$' <<< "$exception_output"
grep -q '^BACKUP_EXCEPTION=RELEASE_399_ACCEPTED$' <<< "$exception_output"
grep -q '^BACKUP_EXCEPTION_RESTORE=PARTIAL$' <<< "$exception_output"
grep -q '^BACKUP_EXCEPTION_STORAGE=PARTIAL$' <<< "$exception_output"
grep -q '^BACKUP_EXCEPTION_OFFSITE_GATE=FAIL$' <<< "$exception_output"
grep -q '^PROMOTION=APPLIED$' <<< "$exception_output"
grep -Fxq "REMOTE_AFTER_COUNT=2" <<< "$exception_output"
grep -Fxq "REMOTE_AFTER_LAST=$exception_version" <<< "$exception_output"

exception_versions="$(docker exec "$db_container" psql -U postgres -d "$exception_database" \
  -X -A -t -v ON_ERROR_STOP=1 -c \
  'select version from supabase_migrations.schema_migrations order by version;')"
[[ "$(printf '%s\n' "$exception_versions" | sort)" == \
  "$(printf '%s\n' "$exception_base_version" "$exception_version" | sort)" ]]
exception_function_count="$(docker exec "$db_container" psql -U postgres -d "$exception_database" \
  -X -A -t -v ON_ERROR_STOP=1 -c \
  "select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'get_recommended_guided_study_v10';")"
[[ "$exception_function_count" == '1' ]]
echo 'PROMOTE_SINGLE_MIGRATION_POSTGRES_BACKUP_EXCEPTION_399=PASS'

# Exercise the PR #411 local-only exception and the actual Psychology migration
# against a fourth disposable PostgreSQL database. The restore receipt and
# bundle are synthetic CI fixtures; production must supply its separately
# verified local artifact and restore proof.
pr411_version=20261026000200
pr411_base_version=20261026000100
pr411_database=promoter_pr411_local_exception_ci
pr411_db_url="${test_db_url%/promoter_historical_ci}/${pr411_database}"
pr411_backup="$tmp/pr411-local-backup-fixture.tar.gz"
pr411_receipt="$tmp/pr411-local-restore.receipt"
python3 - "$pr411_backup" "$pr411_receipt" <<'PY'
import datetime, hashlib, io, sys, tarfile
from pathlib import Path

def make_tar(entries):
    output = io.BytesIO()
    with tarfile.open(fileobj=output, mode="w:gz") as archive:
        for name, content in entries.items():
            info = tarfile.TarInfo(name)
            info.size = len(content)
            archive.addfile(info, io.BytesIO(content))
    return output.getvalue()

now = datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0)
storage = make_tar({"bucket/sample.bin": b"fixture"})
components = {
    "globals.sql": b"-- disposable CI fixture\n",
    "postgres.dump": b"disposable PostgreSQL dump fixture",
    "supabase-meta.dump": b"metadata fixture",
    "storage.tar.gz": storage,
    "config.tar.gz": b"configuration fixture",
}
checksums = "".join(f"{hashlib.sha256(value).hexdigest()}  {name}\n" for name, value in components.items())
created = now.isoformat().replace("+00:00", "Z")
bundle = make_tar({
    **components,
    "MANIFEST.txt": f"created_utc={created}\n".encode(),
    "SHA256SUMS": checksums.encode(),
})
backup = Path(sys.argv[1])
backup.write_bytes(bundle)
Path(sys.argv[2]).write_text("\n".join([
    "format=tec-school-local-restore-proof-v1",
    "status=PASS",
    f"backup_sha256={hashlib.sha256(bundle).hexdigest()}",
    f"backup_bytes={len(bundle)}",
    f"verified_at_utc={created}",
    "restore_mode=isolated-postgres",
    "database_cleanup=dropped",
]) + "\n", encoding="utf-8")
PY
pr411_backup_sha="$(sha256sum "$pr411_backup" | awk '{print $1}')"
pr411_target="$repo_root/supabase/migrations/${pr411_version}_psychology_professional_school_staff_gate.sql"
pr411_target_sha="$(sed 's/\r$//' "$pr411_target" | sha256sum | awk '{print $1}')"
[[ "$pr411_target_sha" == 'da7db8e6ef8d635068ff34a3a1f2ccd4f0c5a4ce6b8a8d753203dc885aa075aa' ]]
docker exec "$db_container" psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
  -c "CREATE DATABASE $pr411_database;" >/dev/null
docker exec -i "$db_container" psql -U postgres -d "$pr411_database" -v ON_ERROR_STOP=1 <<'SQL' >/dev/null
CREATE SCHEMA auth;
CREATE SCHEMA private;
CREATE SCHEMA supabase_migrations;
CREATE TYPE public.user_role AS ENUM ('DIRECTOR', 'SECRETARY', 'PSYCHOLOGIST');
CREATE TABLE public.profiles (id uuid PRIMARY KEY, active boolean NOT NULL DEFAULT true);
CREATE TABLE public.memberships (
  profile_id uuid NOT NULL,
  institution_id uuid NOT NULL,
  active boolean NOT NULL DEFAULT true,
  role public.user_role NOT NULL
);
CREATE TABLE public.psychology_professionals (
  profile_id uuid PRIMARY KEY,
  crp_registration text NOT NULL,
  crp_state text NOT NULL,
  verification_status text NOT NULL DEFAULT 'PENDING',
  verified_at timestamptz,
  verified_by uuid,
  active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.psychology_professional_institutions (
  professional_profile_id uuid NOT NULL,
  institution_id uuid NOT NULL,
  active boolean NOT NULL DEFAULT false,
  PRIMARY KEY (professional_profile_id, institution_id)
);
CREATE TABLE public.psychology_audit_events (
  institution_id uuid NOT NULL,
  actor_profile_id uuid NOT NULL,
  action text NOT NULL,
  subject_id uuid NOT NULL
);
CREATE TABLE supabase_migrations.schema_migrations (
  version text PRIMARY KEY NOT NULL,
  statements text[],
  name text
);
INSERT INTO supabase_migrations.schema_migrations (version, statements, name)
  VALUES ('20261026000100', ARRAY[]::text[], 'psychology-foundation');
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULL::uuid $$;
CREATE FUNCTION private.psychology_is_manager(uuid) RETURNS boolean
  LANGUAGE sql STABLE AS $$ SELECT false $$;
SQL
pr411_seed_ledger="$(docker exec "$db_container" psql -X -A -t -U postgres -d "$pr411_database" \
  -v ON_ERROR_STOP=1 -c 'select current_database() || chr(124) || max(version) from supabase_migrations.schema_migrations;')"
[[ "$pr411_seed_ledger" == "$pr411_database|$pr411_base_version" ]]
pr411_source_commit="$(git -C "$repo_root" rev-parse HEAD)"
mkdir -p "$tmp/pr411-bin"
cat > "$tmp/pr411-bin/git" <<'MOCK'
#!/usr/bin/env bash
if [[ "$#" == 4 && "$1" == '-C' && "$2" == "${PROMOTION_TEST_REPO_ROOT:-}" && "$3" == 'branch' && "$4" == '--show-current' ]]; then
  printf '%s\n' 'codex/psychology-school-staff-access'
  exit 0
fi
if [[ "$#" == 5 && "$1" == '-C' && "$2" == "${PROMOTION_TEST_REPO_ROOT:-}" && "$3" == 'remote' && "$4" == 'get-url' && "$5" == 'origin' ]]; then
  printf '%s\n' 'https://github.com/weslleyfreitassantos-cell/edumoneyyyy-.git'
  exit 0
fi
exec "${PROMOTION_TEST_REAL_GIT:?}" "$@"
MOCK
chmod +x "$tmp/pr411-bin/git"
if ! pr411_output="$(PATH="$tmp/pr411-bin:$tmp/bin:$PATH" \
  PROMOTION_TEST_REAL_GIT="$(command -v git)" \
  PROMOTION_TEST_REPO_ROOT="$repo_root" \
  PROMOTION_TEST_DB_CONTAINER="$db_container" \
  PROMOTION_TEST_DATABASE_NAME="$pr411_database" \
  PROMOTION_TEST_CLI_LOG_DIR="$tmp/cli-logs" \
  PROMOTION_TEST_SUPABASE_BIN="$promotion_test_supabase_bin" \
  PROMOTE_SINGLE_MIGRATION_CLI_BINARY="$tmp/bin/supabase-with-timeout" \
  SOURCE_ROOT="$repo_root" TARGET_VERSION="$pr411_version" \
  EXPECTED_REMOTE_LAST="$pr411_base_version" \
  EXPECTED_SOURCE_COMMIT="$pr411_source_commit" \
  EXPECTED_TARGET_SHA256="$pr411_target_sha" PRODUCTION_DB_URL="$pr411_db_url" \
  APPLY=1 BACKUP_GATE=FAIL BACKUP_EXCEPTION_PR=411 \
  BACKUP_EXCEPTION_BACKUP_FILE="$pr411_backup" \
  BACKUP_EXCEPTION_RESTORE_RECEIPT_FILE="$pr411_receipt" \
  BACKUP_EXCEPTION_BACKUP_SHA256="$pr411_backup_sha" \
  BACKUP_EXCEPTION_OFFSITE_STATUS=FAIL BACKUP_EXCEPTION_STORAGE_STATUS=PARTIAL \
  ACCEPT_INCOMPLETE_RECOVERY_RISK=I_ACCEPT_LOCAL_ONLY_RECOVERY_RISK_FOR_PR_411 \
  ACCEPT_NO_OFFSITE_COPY=I_ACCEPT_NO_OFFSITE_COPY_FOR_PR_411 \
  CONFIRM_PRODUCTION_WRITE=I_CONFIRM_PR411_SINGLE_MIGRATION_20261026000200 \
  TMPDIR="$tmp" "$promoter")"; then
  printf '%s\n' "$pr411_output" >&2
  emit_cli_diagnostics
  printf 'PROMOTE_SINGLE_MIGRATION_CASE=pr411_local_only_exception FAIL\n' >&2
  exit 1
fi
printf '%s\n' "$pr411_output"
grep -Fxq 'BACKUP_GATE=FAIL' <<< "$pr411_output"
grep -Fxq 'BACKUP_EXCEPTION=PR411_LOCAL_ONLY' <<< "$pr411_output"
grep -Fxq 'BACKUP_EXCEPTION_PR=411' <<< "$pr411_output"
grep -Fxq 'BACKUP_EXCEPTION_SCOPE=20261026000200' <<< "$pr411_output"
grep -Fxq "BACKUP_EXCEPTION_LOCAL_SHA256=$pr411_backup_sha" <<< "$pr411_output"
grep -Fxq 'BACKUP_EXCEPTION_RESTORE=PASS' <<< "$pr411_output"
grep -Fxq 'BACKUP_EXCEPTION_STORAGE=PARTIAL' <<< "$pr411_output"
grep -Fxq 'BACKUP_EXCEPTION_OFFSITE=FAIL' <<< "$pr411_output"
grep -Fxq 'BACKUP_EXCEPTION_OFFSITE_COPY=NONE' <<< "$pr411_output"
grep -Fxq 'BACKUP_EXCEPTION_RISK_ACCEPTANCE=ACCEPTED' <<< "$pr411_output"
grep -Fxq 'WORKDIR_MIGRATION_COUNT=2' <<< "$pr411_output"
grep -Fxq 'DRY_RUN_PENDING_VERSION=20261026000200' <<< "$pr411_output"
grep -Fxq 'PROMOTION=APPLIED' <<< "$pr411_output"
grep -Fxq 'REMOTE_AFTER_COUNT=2' <<< "$pr411_output"
grep -Fxq 'REMOTE_AFTER_LAST=20261026000200' <<< "$pr411_output"
! grep -q '20261025000700' <<< "$pr411_output"
pr411_versions="$(docker exec "$db_container" psql -U postgres -d "$pr411_database" \
  -X -A -t -v ON_ERROR_STOP=1 -c \
  'select version from supabase_migrations.schema_migrations order by version;')"
[[ "$(printf '%s\n' "$pr411_versions" | sort)" == \
  "$(printf '%s\n' "$pr411_base_version" "$pr411_version" | sort)" ]]
pr411_function_count="$(docker exec "$db_container" psql -U postgres -d "$pr411_database" \
  -X -A -t -v ON_ERROR_STOP=1 -c \
  "select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'private' and p.proname = 'psychology_can_manage_professionals';")"
[[ "$pr411_function_count" == '1' ]]
echo 'PROMOTE_SINGLE_MIGRATION_POSTGRES_PR411_LOCAL_ONLY=PASS'
