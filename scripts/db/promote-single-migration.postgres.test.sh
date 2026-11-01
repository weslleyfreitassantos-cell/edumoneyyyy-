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
  for database in promoter_historical_ci promoter_chronological_ci promoter_backup_exception_ci promoter_pr411_local_exception_ci promoter_pr412_local_exception_ci promoter_pr414_local_exception_ci promoter_pr418_scoped_risk_acceptance_ci; do
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
DO $roles$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN;
  END IF;
END
$roles$;
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
  printf '%s\n' "${PROMOTION_TEST_ORIGIN:-https://github.com/weslleyfreitassantos-cell/edumoneyyyy-.git}"
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

# Exercise PR #412's local-only recovery exception and exact-ledger checks in a
# disposable PostgreSQL database. Backup artifacts and risk tokens here are
# synthetic fixtures; this does not record owner acceptance or touch production.
pr412_version=20261026000300
pr412_base_version=20261026000200
pr412_database=promoter_pr412_local_exception_ci
pr412_db_url="${test_db_url%/promoter_historical_ci}/${pr412_database}"
pr412_backup="$tmp/pr412-local-backup-fixture.tar.gz"
pr412_receipt="$tmp/pr412-local-restore.receipt"
python3 - "$pr412_backup" "$pr412_receipt" <<'PY'
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
pr412_backup_sha="$(sha256sum "$pr412_backup" | awk '{print $1}')"
pr412_target="$repo_root/supabase/migrations/${pr412_version}_tec_english_adaptive_v2.sql"
pr412_target_sha="$(sed 's/\r$//' "$pr412_target" | sha256sum | awk '{print $1}')"
[[ "$pr412_target_sha" == '6819fc02ecb0897b93b845dcfb2475da75193ff90f06f3de7d373cdd76f3063e' ]]
docker exec "$db_container" psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
  -c "CREATE DATABASE $pr412_database;" >/dev/null
docker exec "$db_container" psql -U postgres -d "$pr412_database" -v ON_ERROR_STOP=1 \
  -c "CREATE SCHEMA supabase_migrations;
      CREATE TABLE supabase_migrations.schema_migrations (
        version text PRIMARY KEY NOT NULL,
        statements text[],
        name text
      );
      INSERT INTO supabase_migrations.schema_migrations (version, statements, name)
        VALUES ('$pr412_base_version', ARRAY[]::text[], 'tec-english-v2-base');" >/dev/null
pr412_seed_ledger="$(docker exec "$db_container" psql -X -A -t -U postgres -d "$pr412_database" \
  -v ON_ERROR_STOP=1 -c 'select current_database() || chr(124) || max(version) from supabase_migrations.schema_migrations;')"
[[ "$pr412_seed_ledger" == "$pr412_database|$pr412_base_version" ]]
pr412_source_commit="$(git -C "$repo_root" rev-parse HEAD)"
mkdir -p "$tmp/pr412-bin"
cat > "$tmp/pr412-bin/git" <<'MOCK'
#!/usr/bin/env bash
if [[ "$#" == 4 && "$1" == '-C' && "$2" == "${PROMOTION_TEST_REPO_ROOT:-}" && "$3" == 'branch' && "$4" == '--show-current' ]]; then
  printf '%s\n' 'codex/tec-english-v2-adaptive'
  exit 0
fi
if [[ "$#" == 5 && "$1" == '-C' && "$2" == "${PROMOTION_TEST_REPO_ROOT:-}" && "$3" == 'remote' && "$4" == 'get-url' && "$5" == 'origin' ]]; then
  printf '%s\n' "${PROMOTION_TEST_ORIGIN:-https://github.com/weslleyfreitassantos-cell/edumoneyyyy-.git}"
  exit 0
fi
exec "${PROMOTION_TEST_REAL_GIT:?}" "$@"
MOCK
cat > "$tmp/pr412-bin/synthetic-supabase" <<'MOCK'
#!/usr/bin/env bash
set -euo pipefail
workdir=''
database_url=''
dry_run=0
while (($#)); do
  case "$1" in
    --workdir) workdir="$2"; shift 2 ;;
    --db-url) database_url="$2"; shift 2 ;;
    --dry-run) dry_run=1; shift ;;
    *) shift ;;
  esac
done
[[ -n "$workdir" && -n "$database_url" ]]
mapfile -t migrations < <(find "$workdir/supabase/migrations" -maxdepth 1 -type f -name '*.sql' -printf '%f\n' | sort)
[[ "${#migrations[@]}" == 2 ]]
printf '%s\n' "${migrations[@]}" | grep -Fxq '20261026000200_psychology_professional_school_staff_gate.sql'
printf '%s\n' "${migrations[@]}" | grep -Fxq '20261026000300_tec_english_adaptive_v2.sql'
! printf '%s\n' "${migrations[@]}" | grep -Eq '^20261025000700_'
if [[ "$dry_run" == 1 ]]; then
  printf 'Would push migration 20261026000300\n'
  exit 0
fi
database_name="${database_url##*/}"
[[ "$database_name" == 'promoter_pr412_local_exception_ci' ]]
docker exec "$PROMOTION_TEST_DB_CONTAINER" psql -U postgres -d "$database_name" -v ON_ERROR_STOP=1 \
  -c "CREATE TABLE public.pr412_synthetic_probe (id integer PRIMARY KEY);
      INSERT INTO public.pr412_synthetic_probe VALUES (1);
      INSERT INTO supabase_migrations.schema_migrations (version, statements, name)
        VALUES ('20261026000300', ARRAY[]::text[], 'synthetic-pr412-promoter-test');" >/dev/null
MOCK
chmod +x "$tmp/pr412-bin/git" "$tmp/pr412-bin/synthetic-supabase"
if ! pr412_output="$(PATH="$tmp/pr412-bin:$tmp/bin:$PATH" \
  PROMOTION_TEST_REAL_GIT="$(command -v git)" \
  PROMOTION_TEST_REPO_ROOT="$repo_root" \
  PROMOTION_TEST_DB_CONTAINER="$db_container" \
  PROMOTION_TEST_DATABASE_NAME="$pr412_database" \
  PROMOTION_TEST_CLI_LOG_DIR="$tmp/cli-logs" \
  PROMOTE_SINGLE_MIGRATION_CLI_BINARY="$tmp/pr412-bin/synthetic-supabase" \
  SOURCE_ROOT="$repo_root" TARGET_VERSION="$pr412_version" \
  EXPECTED_REMOTE_LAST="$pr412_base_version" EXPECTED_SOURCE_COMMIT="$pr412_source_commit" \
  EXPECTED_TARGET_SHA256="$pr412_target_sha" PRODUCTION_DB_URL="$pr412_db_url" \
  APPLY=1 BACKUP_GATE=FAIL BACKUP_EXCEPTION_PR=412 \
  BACKUP_EXCEPTION_BACKUP_FILE="$pr412_backup" \
  BACKUP_EXCEPTION_RESTORE_RECEIPT_FILE="$pr412_receipt" \
  BACKUP_EXCEPTION_BACKUP_SHA256="$pr412_backup_sha" \
  BACKUP_EXCEPTION_OFFSITE_STATUS=FAIL BACKUP_EXCEPTION_STORAGE_STATUS=PARTIAL \
  ACCEPT_INCOMPLETE_RECOVERY_RISK=I_ACCEPT_LOCAL_ONLY_RECOVERY_RISK_FOR_PR_412 \
  CONFIRM_PRODUCTION_WRITE=I_CONFIRM_PR412_SINGLE_MIGRATION_20261026000300 \
  TMPDIR="$tmp" "$promoter")"; then
  printf '%s\n' "$pr412_output" >&2
  emit_cli_diagnostics
  printf 'PROMOTE_SINGLE_MIGRATION_CASE=pr412_local_only_exception FAIL\n' >&2
  exit 1
fi
printf '%s\n' "$pr412_output"
grep -Fxq 'BACKUP_GATE=FAIL' <<< "$pr412_output"
grep -Fxq 'BACKUP_EXCEPTION=PR412_LOCAL_ONLY' <<< "$pr412_output"
grep -Fxq 'BACKUP_EXCEPTION_PR=412' <<< "$pr412_output"
grep -Fxq 'BACKUP_EXCEPTION_SCOPE=20261026000300' <<< "$pr412_output"
grep -Fxq "BACKUP_EXCEPTION_LOCAL_SHA256=$pr412_backup_sha" <<< "$pr412_output"
grep -Fxq 'BACKUP_EXCEPTION_RESTORE=PASS' <<< "$pr412_output"
grep -Fxq 'BACKUP_EXCEPTION_STORAGE=PARTIAL' <<< "$pr412_output"
grep -Fxq 'BACKUP_EXCEPTION_OFFSITE=FAIL' <<< "$pr412_output"
grep -Fxq 'BACKUP_EXCEPTION_OFFSITE_COPY=NONE' <<< "$pr412_output"
grep -Fxq 'BACKUP_EXCEPTION_RISK_ACCEPTANCE=ACCEPTED' <<< "$pr412_output"
grep -Fxq 'DRY_RUN_PENDING_COUNT=1' <<< "$pr412_output"
grep -Fxq 'DRY_RUN_PENDING_VERSION=20261026000300' <<< "$pr412_output"
grep -Fxq 'PROMOTION=APPLIED' <<< "$pr412_output"
grep -Fxq 'REMOTE_AFTER_COUNT=2' <<< "$pr412_output"
grep -Fxq 'REMOTE_AFTER_LAST=20261026000300' <<< "$pr412_output"
! grep -q '20261025000700\|20261026000100' <<< "$pr412_output"
pr412_versions="$(docker exec "$db_container" psql -U postgres -d "$pr412_database" \
  -X -A -t -v ON_ERROR_STOP=1 -c \
  'select version from supabase_migrations.schema_migrations order by version;')"
[[ "$(printf '%s\n' "$pr412_versions" | sort)" == \
  "$(printf '%s\n' "$pr412_base_version" "$pr412_version" | sort)" ]]
pr412_probe="$(docker exec "$db_container" psql -U postgres -d "$pr412_database" \
  -X -A -t -v ON_ERROR_STOP=1 -c 'select count(*) from public.pr412_synthetic_probe;')"
[[ "$pr412_probe" == '1' ]]
echo 'PROMOTE_SINGLE_MIGRATION_POSTGRES_PR412_LOCAL_ONLY_SYNTHETIC=PASS'

# Exercise the PR #414 exception and the storage-proof requirement against a
# disposable PostgreSQL database. All backup receipts and risk tokens here are
# synthetic fixtures and do not represent production authorization.
pr414_version=20261027000100
pr414_base_version=20261026000300
pr414_database=promoter_pr414_local_exception_ci
pr414_db_url="${test_db_url%/promoter_historical_ci}/${pr414_database}"
pr414_backup="$tmp/pr414-local-backup-fixture.tar.gz"
pr414_receipt="$tmp/pr414-local-restore.receipt"
pr414_storage_receipt="$tmp/pr414-storage-restore.receipt"
python3 - "$pr414_backup" "$pr414_receipt" "$pr414_storage_receipt" <<'PY'
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
Path(sys.argv[3]).write_text("\n".join([
    "format=tec-school-local-storage-restore-proof-v1",
    "status=PASS",
    f"backup_sha256={hashlib.sha256(bundle).hexdigest()}",
    f"backup_bytes={len(bundle)}",
    "restore_mode=isolated-storage-copy",
    "storage_objects=12249",
    "storage_bytes=352379320",
    "copy_integrity=PASS",
    "temporary_copy_cleanup=COMPLETED",
    "production_storage_status=PARTIAL",
    "offsite_status=FAIL",
    "evidence_source=synthetic-test-fixture",
    f"recorded_at_utc={created}",
]) + "\n", encoding="utf-8")
PY
pr414_backup_sha="$(sha256sum "$pr414_backup" | awk '{print $1}')"
pr414_target="$repo_root/supabase/migrations/${pr414_version}_tec_idiomas_v3_runtime.sql"
pr414_target_sha="$(sed 's/\r$//' "$pr414_target" | sha256sum | awk '{print $1}')"
[[ "$pr414_target_sha" == '905cd1820e0496a3eb4f618f7951f636f93ffa4292c0f3eac68b7a53ec6c9813' ]]
docker exec "$db_container" psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
  -c "CREATE DATABASE $pr414_database;" >/dev/null
docker exec "$db_container" psql -U postgres -d "$pr414_database" -v ON_ERROR_STOP=1 \
  -c "CREATE SCHEMA supabase_migrations;
      CREATE TABLE supabase_migrations.schema_migrations (
        version text PRIMARY KEY NOT NULL,
        statements text[],
        name text
      );
      INSERT INTO supabase_migrations.schema_migrations (version, statements, name)
        VALUES ('$pr414_base_version', ARRAY[]::text[], 'tec-idiomas-v3-base');" >/dev/null
pr414_seed_ledger="$(docker exec "$db_container" psql -X -A -t -U postgres -d "$pr414_database" \
  -v ON_ERROR_STOP=1 -c 'select current_database() || chr(124) || max(version) from supabase_migrations.schema_migrations;')"
[[ "$pr414_seed_ledger" == "$pr414_database|$pr414_base_version" ]]
pr414_source_commit="$(git -C "$repo_root" rev-parse HEAD)"
mkdir -p "$tmp/pr414-bin"
cat > "$tmp/pr414-bin/git" <<'MOCK'
#!/usr/bin/env bash
if [[ "$#" == 4 && "$1" == '-C' && "$2" == "${PROMOTION_TEST_REPO_ROOT:-}" && "$3" == 'branch' && "$4" == '--show-current' ]]; then
  printf '%s\n' 'codex/tec-idiomas-v3'
  exit 0
fi
if [[ "$#" == 5 && "$1" == '-C' && "$2" == "${PROMOTION_TEST_REPO_ROOT:-}" && "$3" == 'remote' && "$4" == 'get-url' && "$5" == 'origin' ]]; then
  printf '%s\n' "${PROMOTION_TEST_ORIGIN:-https://github.com/weslleyfreitassantos-cell/edumoneyyyy-.git}"
  exit 0
fi
exec "${PROMOTION_TEST_REAL_GIT:?}" "$@"
MOCK
cat > "$tmp/pr414-bin/synthetic-supabase" <<'MOCK'
#!/usr/bin/env bash
set -euo pipefail
workdir=''
database_url=''
dry_run=0
while (($#)); do
  case "$1" in
    --workdir) workdir="$2"; shift 2 ;;
    --db-url) database_url="$2"; shift 2 ;;
    --dry-run) dry_run=1; shift ;;
    *) shift ;;
  esac
done
[[ -n "$workdir" && -n "$database_url" ]]
mapfile -t migrations < <(find "$workdir/supabase/migrations" -maxdepth 1 -type f -name '*.sql' -printf '%f\n' | sort)
[[ "${#migrations[@]}" == 2 ]]
printf '%s\n' "${migrations[@]}" | grep -Fxq '20261026000300_tec_english_adaptive_v2.sql'
printf '%s\n' "${migrations[@]}" | grep -Fxq '20261027000100_tec_idiomas_v3_runtime.sql'
! printf '%s\n' "${migrations[@]}" | grep -Eq '^20261025000700_'
if [[ "$dry_run" == 1 ]]; then
  printf 'Would push migration 20261027000100\n'
  exit 0
fi
database_name="${database_url##*/}"
[[ "$database_name" == 'promoter_pr414_local_exception_ci' ]]
docker exec "$PROMOTION_TEST_DB_CONTAINER" psql -U postgres -d "$database_name" -v ON_ERROR_STOP=1 \
  -c "CREATE TABLE public.pr414_synthetic_probe (id integer PRIMARY KEY);
      INSERT INTO public.pr414_synthetic_probe VALUES (1);
      INSERT INTO supabase_migrations.schema_migrations (version, statements, name)
        VALUES ('20261027000100', ARRAY[]::text[], 'synthetic-pr414-promoter-test');" >/dev/null
MOCK
chmod +x "$tmp/pr414-bin/git" "$tmp/pr414-bin/synthetic-supabase"
if ! pr414_output="$(PATH="$tmp/pr414-bin:$tmp/bin:$PATH" \
  PROMOTION_TEST_REAL_GIT="$(command -v git)" \
  PROMOTION_TEST_REPO_ROOT="$repo_root" \
  PROMOTION_TEST_DB_CONTAINER="$db_container" \
  PROMOTION_TEST_DATABASE_NAME="$pr414_database" \
  PROMOTION_TEST_CLI_LOG_DIR="$tmp/cli-logs" \
  PROMOTE_SINGLE_MIGRATION_CLI_BINARY="$tmp/pr414-bin/synthetic-supabase" \
  SOURCE_ROOT="$repo_root" TARGET_VERSION="$pr414_version" \
  EXPECTED_REMOTE_LAST="$pr414_base_version" EXPECTED_SOURCE_COMMIT="$pr414_source_commit" \
  EXPECTED_TARGET_SHA256="$pr414_target_sha" PRODUCTION_DB_URL="$pr414_db_url" \
  APPLY=1 BACKUP_GATE=FAIL BACKUP_EXCEPTION_PR=414 \
  BACKUP_EXCEPTION_SOURCE_SHA="$pr414_source_commit" \
  BACKUP_EXCEPTION_BACKUP_FILE="$pr414_backup" \
  BACKUP_EXCEPTION_RESTORE_RECEIPT_FILE="$pr414_receipt" \
  BACKUP_EXCEPTION_STORAGE_RECEIPT_FILE="$pr414_storage_receipt" \
  BACKUP_EXCEPTION_BACKUP_SHA256="$pr414_backup_sha" \
  BACKUP_EXCEPTION_OFFSITE_STATUS=FAIL BACKUP_EXCEPTION_STORAGE_STATUS=PARTIAL \
  ACCEPT_INCOMPLETE_RECOVERY_RISK=ACCEPT_LOCAL_ONLY_RECOVERY_RISK_FOR_PR_414 \
  CONFIRM_PRODUCTION_WRITE=I_CONFIRM_PR414_SINGLE_MIGRATION_20261027000100 \
  TMPDIR="$tmp" "$promoter")"; then
  printf '%s\n' "$pr414_output" >&2
  emit_cli_diagnostics
  printf 'PROMOTE_SINGLE_MIGRATION_CASE=pr414_local_only_exception FAIL\n' >&2
  exit 1
fi
printf '%s\n' "$pr414_output"
grep -Fxq 'BACKUP_GATE=FAIL' <<< "$pr414_output"
grep -Fxq 'BACKUP_EXCEPTION=PR414_LOCAL_ONLY' <<< "$pr414_output"
grep -Fxq 'BACKUP_EXCEPTION_PR=414' <<< "$pr414_output"
grep -Fxq 'BACKUP_EXCEPTION_SCOPE=20261027000100' <<< "$pr414_output"
grep -Fxq 'BACKUP_EXCEPTION_PREDECESSOR=20261026000300' <<< "$pr414_output"
grep -Fxq "BACKUP_EXCEPTION_SOURCE_SHA=$pr414_source_commit" <<< "$pr414_output"
grep -Fxq "BACKUP_EXCEPTION_LOCAL_SHA256=$pr414_backup_sha" <<< "$pr414_output"
grep -Fxq 'BACKUP_EXCEPTION_POSTGRES_RESTORE=PASS' <<< "$pr414_output"
grep -Fxq 'BACKUP_EXCEPTION_STORAGE_RESTORE=PASS' <<< "$pr414_output"
grep -Fxq 'BACKUP_EXCEPTION_STORAGE=PARTIAL' <<< "$pr414_output"
grep -Fxq 'BACKUP_EXCEPTION_OFFSITE=FAIL' <<< "$pr414_output"
grep -Fxq 'BACKUP_EXCEPTION_OFFSITE_COPY=NONE' <<< "$pr414_output"
grep -Fxq 'BACKUP_EXCEPTION_RISK_ACCEPTANCE=ACCEPTED' <<< "$pr414_output"
grep -Fxq 'DRY_RUN_PENDING_COUNT=1' <<< "$pr414_output"
grep -Fxq 'DRY_RUN_PENDING_VERSION=20261027000100' <<< "$pr414_output"
grep -Fxq 'PROMOTION=APPLIED' <<< "$pr414_output"
grep -Fxq 'REMOTE_AFTER_COUNT=2' <<< "$pr414_output"
grep -Fxq 'REMOTE_AFTER_LAST=20261027000100' <<< "$pr414_output"
! grep -q '20261025000700\|20261027000700' <<< "$pr414_output"
pr414_versions="$(docker exec "$db_container" psql -X -A -t -U postgres -d "$pr414_database" \
  -v ON_ERROR_STOP=1 -c 'select version from supabase_migrations.schema_migrations order by version;')"
[[ "$(printf '%s\n' "$pr414_versions" | sort)" == \
  "$(printf '%s\n' "$pr414_base_version" "$pr414_version" | sort)" ]]
pr414_probe="$(docker exec "$db_container" psql -X -A -t -U postgres -d "$pr414_database" \
  -v ON_ERROR_STOP=1 -c 'select count(*) from public.pr414_synthetic_probe;')"
[[ "$pr414_probe" == '1' ]]
echo 'PROMOTE_SINGLE_MIGRATION_POSTGRES_PR414_LOCAL_ONLY_SYNTHETIC=PASS'

# PR #418's accepted-risk path is validated as a selective dry-run only. The
# database, ledger, branch and source commit below are disposable CI fixtures;
# this does not claim a local recovery proof or touch production.
pr418_version=20261029000100
pr418_base_version=20261027000100
pr418_database=promoter_pr418_scoped_risk_acceptance_ci
pr418_db_url="${test_db_url%/promoter_historical_ci}/${pr418_database}"
pr418_fixture="$tmp/pr418-fixture"
pr418_migration="$repo_root/supabase/migrations/${pr418_version}_tec_idiomas_v4_absolute_beginners.sql"
pr418_target_sha="$(sed 's/\r$//' "$pr418_migration" | "$real_sha256sum" | awk '{print $1}')"
[[ "$pr418_target_sha" == '7c50f53b44605f62140abf3be630e9d7697f868dae8d4fd2cbe9d57fd97000e7' ]]
mkdir -p "$pr418_fixture/supabase/migrations"
printf 'project_id = "pr418-dry-run-ci"\n' > "$pr418_fixture/supabase/config.toml"
printf 'select 1;\n' > "$pr418_fixture/supabase/migrations/${pr418_base_version}_baseline.sql"
cp "$pr418_migration" "$pr418_fixture/supabase/migrations/"
git -C "$pr418_fixture" init -q
git -C "$pr418_fixture" config user.name 'Migration promoter CI'
git -C "$pr418_fixture" config user.email 'migration-promoter-ci@example.invalid'
git -C "$pr418_fixture" add supabase/config.toml supabase/migrations
git -C "$pr418_fixture" commit -q -m 'Disposable PR 418 selective dry-run fixture'
git -C "$pr418_fixture" checkout -q -b codex/tec-idiomas-v4-absolute-beginners
git -C "$pr418_fixture" remote add origin https://github.com/weslleyfreitassantos-cell/edumoneyyyy-.git
pr418_source_commit="$(git -C "$pr418_fixture" rev-parse HEAD)"
docker exec "$db_container" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE $pr418_database;" >/dev/null
docker exec "$db_container" psql -U postgres -d "$pr418_database" -v ON_ERROR_STOP=1 -c "CREATE SCHEMA supabase_migrations; CREATE TABLE supabase_migrations.schema_migrations (version text PRIMARY KEY NOT NULL, statements text[], name text); INSERT INTO supabase_migrations.schema_migrations (version, statements, name) VALUES ('$pr418_base_version', ARRAY[]::text[], 'pr418-v4-base');" >/dev/null
pr418_env=(
  "PATH=$tmp/bin:$PATH"
  "PROMOTION_TEST_DB_CONTAINER=$db_container"
  "PROMOTION_TEST_DATABASE_NAME=$pr418_database"
  "PROMOTION_TEST_CLI_LOG_DIR=$tmp/cli-logs"
  "PROMOTION_TEST_SUPABASE_BIN=$promotion_test_supabase_bin"
  "PROMOTE_SINGLE_MIGRATION_CLI_BINARY=$tmp/bin/supabase-with-timeout"
  "SOURCE_ROOT=$pr418_fixture"
  "TARGET_VERSION=$pr418_version"
  "EXPECTED_REMOTE_LAST=$pr418_base_version"
  "EXPECTED_SOURCE_COMMIT=$pr418_source_commit"
  "EXPECTED_TARGET_SHA256=$pr418_target_sha"
  "PRODUCTION_DB_URL=$pr418_db_url"
  "APPLY=0"
  "BACKUP_GATE=FAIL"
  "BACKUP_EXCEPTION_PR=418"
  "BACKUP_EXCEPTION_SOURCE_SHA=$pr418_source_commit"
  "BACKUP_EXCEPTION_OFFSITE_STATUS=FAIL"
  "BACKUP_EXCEPTION_STORAGE_STATUS=PARTIAL"
  "ACCEPT_INCOMPLETE_RECOVERY_RISK=I_ACCEPT_INCOMPLETE_RECOVERY_RISK_FOR_PR_418"
  "TMPDIR=$tmp"
)
if ! pr418_output="$(env "${pr418_env[@]}" "$promoter" 2>&1)"; then
  printf '%s\n' "$pr418_output" >&2
  emit_cli_diagnostics
  printf 'PROMOTE_SINGLE_MIGRATION_CASE=pr418_scoped_risk_dry_run FAIL\n' >&2
  exit 1
fi
printf '%s\n' "$pr418_output"
grep -Fxq 'REMOTE_MIGRATION_COUNT=1' <<< "$pr418_output"
grep -Fxq "REMOTE_LAST=$pr418_base_version" <<< "$pr418_output"
grep -Fxq 'BACKUP_GATE=FAIL' <<< "$pr418_output"
grep -Fxq 'BACKUP_EXCEPTION=PR418_SCOPED_RISK_ACCEPTANCE' <<< "$pr418_output"
grep -Fxq "BACKUP_EXCEPTION_SOURCE_SHA=$pr418_source_commit" <<< "$pr418_output"
grep -Fxq "BACKUP_EXCEPTION_MIGRATION_SHA256=$pr418_target_sha" <<< "$pr418_output"
grep -Fxq 'BACKUP_EXCEPTION_RECOVERY_PROOF=NONE' <<< "$pr418_output"
grep -Fxq 'BACKUP_EXCEPTION_OFFSITE=FAIL' <<< "$pr418_output"
grep -Fxq 'BACKUP_EXCEPTION_STORAGE=PARTIAL' <<< "$pr418_output"
grep -Fxq 'DRY_RUN_PENDING_COUNT=1' <<< "$pr418_output"
grep -Fxq "DRY_RUN_PENDING_VERSION=$pr418_version" <<< "$pr418_output"
grep -Fxq 'PROMOTION=DRY_RUN_ONLY' <<< "$pr418_output"
grep -Fxq 'PRODUCTION_WRITE_AUTHORIZATION=PENDING' <<< "$pr418_output"
! grep -q '20261025000700\|20261026000100\|20261029000200' <<< "$pr418_output"
pr418_versions="$(docker exec "$db_container" psql -X -A -t -U postgres -d "$pr418_database" -v ON_ERROR_STOP=1 -c 'select version from supabase_migrations.schema_migrations order by version;')"
[[ "$pr418_versions" == "$pr418_base_version" ]]
echo 'PROMOTE_SINGLE_MIGRATION_POSTGRES_PR418_SCOPED_RISK_DRY_RUN=PASS'

# The placement-sync exception is separately limited to 20261029000200 after
# its base migration 20261029000100. Verify only the selective dry-run against
# a disposable PostgreSQL ledger; no apply occurs in this fixture.
pr418_placement_version=20261029000200
pr418_placement_base_version=20261029000100
pr418_placement_database=promoter_pr418_placement_scoped_risk_ci
pr418_placement_db_url="${test_db_url%/promoter_historical_ci}/${pr418_placement_database}"
pr418_placement_fixture="$tmp/pr418-placement-fixture"
pr418_placement_migration="$repo_root/supabase/migrations/${pr418_placement_version}_tec_idiomas_placement_sync.sql"
pr418_placement_target_sha="$(sed 's/\r$//' "$pr418_placement_migration" | "$real_sha256sum" | awk '{print $1}')"
[[ "$pr418_placement_target_sha" == 'fded3483f8a17e652ce7301a2f99a90d5b2c18358deeeabdf9bae3aa43c71fb9' ]]
mkdir -p "$pr418_placement_fixture/supabase/migrations"
printf 'project_id = "pr418-placement-dry-run-ci"\n' > "$pr418_placement_fixture/supabase/config.toml"
printf 'select 1;\n' > "$pr418_placement_fixture/supabase/migrations/${pr418_placement_base_version}_tec_idiomas_v4_absolute_beginners.sql"
cp "$pr418_placement_migration" "$pr418_placement_fixture/supabase/migrations/"
git -C "$pr418_placement_fixture" init -q
git -C "$pr418_placement_fixture" config user.name 'Migration promoter CI'
git -C "$pr418_placement_fixture" config user.email 'migration-promoter-ci@example.invalid'
git -C "$pr418_placement_fixture" add supabase/config.toml supabase/migrations
git -C "$pr418_placement_fixture" commit -q -m 'Disposable PR 418 placement dry-run fixture'
git -C "$pr418_placement_fixture" checkout -q -b codex/tec-idiomas-v4-absolute-beginners
git -C "$pr418_placement_fixture" remote add origin https://github.com/weslleyfreitassantos-cell/edumoneyyyy-.git
pr418_placement_source_commit="$(git -C "$pr418_placement_fixture" rev-parse HEAD)"
docker exec "$db_container" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE $pr418_placement_database;" >/dev/null
docker exec "$db_container" psql -U postgres -d "$pr418_placement_database" -v ON_ERROR_STOP=1 -c "CREATE SCHEMA supabase_migrations; CREATE TABLE supabase_migrations.schema_migrations (version text PRIMARY KEY NOT NULL, statements text[], name text); INSERT INTO supabase_migrations.schema_migrations (version, statements, name) VALUES ('$pr418_placement_base_version', ARRAY[]::text[], 'pr418-placement-base');" >/dev/null
pr418_placement_env=(
  "PATH=$tmp/bin:$PATH"
  "PROMOTION_TEST_DB_CONTAINER=$db_container"
  "PROMOTION_TEST_DATABASE_NAME=$pr418_placement_database"
  "PROMOTION_TEST_CLI_LOG_DIR=$tmp/cli-logs"
  "PROMOTION_TEST_SUPABASE_BIN=$promotion_test_supabase_bin"
  "PROMOTE_SINGLE_MIGRATION_CLI_BINARY=$tmp/bin/supabase-with-timeout"
  "SOURCE_ROOT=$pr418_placement_fixture"
  "TARGET_VERSION=$pr418_placement_version"
  "EXPECTED_REMOTE_LAST=$pr418_placement_base_version"
  "EXPECTED_SOURCE_COMMIT=$pr418_placement_source_commit"
  "EXPECTED_TARGET_SHA256=$pr418_placement_target_sha"
  "PRODUCTION_DB_URL=$pr418_placement_db_url"
  "APPLY=0"
  "BACKUP_GATE=FAIL"
  "BACKUP_EXCEPTION_PR=418"
  "BACKUP_EXCEPTION_SOURCE_SHA=$pr418_placement_source_commit"
  "BACKUP_EXCEPTION_OFFSITE_STATUS=FAIL"
  "BACKUP_EXCEPTION_STORAGE_STATUS=PARTIAL"
  "ACCEPT_INCOMPLETE_RECOVERY_RISK=I_ACCEPT_INCOMPLETE_RECOVERY_RISK_FOR_PR_418"
  "TMPDIR=$tmp"
)
if ! pr418_placement_output="$(env "${pr418_placement_env[@]}" "$promoter" 2>&1)"; then
  printf '%s\n' "$pr418_placement_output" >&2
  emit_cli_diagnostics
  printf 'PROMOTE_SINGLE_MIGRATION_CASE=pr418_placement_scoped_risk_dry_run FAIL\n' >&2
  exit 1
fi
printf '%s\n' "$pr418_placement_output"
grep -Fxq 'REMOTE_MIGRATION_COUNT=1' <<< "$pr418_placement_output"
grep -Fxq "REMOTE_LAST=$pr418_placement_base_version" <<< "$pr418_placement_output"
grep -Fxq 'BACKUP_GATE=FAIL' <<< "$pr418_placement_output"
grep -Fxq 'BACKUP_EXCEPTION=PR418_SCOPED_RISK_ACCEPTANCE' <<< "$pr418_placement_output"
grep -Fxq 'BACKUP_EXCEPTION_SCOPE=20261029000200' <<< "$pr418_placement_output"
grep -Fxq 'BACKUP_EXCEPTION_PREDECESSOR=20261029000100' <<< "$pr418_placement_output"
grep -Fxq "BACKUP_EXCEPTION_MIGRATION_SHA256=$pr418_placement_target_sha" <<< "$pr418_placement_output"
grep -Fxq 'BACKUP_EXCEPTION_RECOVERY_PROOF=NONE' <<< "$pr418_placement_output"
grep -Fxq 'BACKUP_EXCEPTION_OFFSITE=FAIL' <<< "$pr418_placement_output"
grep -Fxq 'BACKUP_EXCEPTION_STORAGE=PARTIAL' <<< "$pr418_placement_output"
grep -Fxq 'DRY_RUN_PENDING_COUNT=1' <<< "$pr418_placement_output"
grep -Fxq "DRY_RUN_PENDING_VERSION=$pr418_placement_version" <<< "$pr418_placement_output"
grep -Fxq 'PROMOTION=DRY_RUN_ONLY' <<< "$pr418_placement_output"
grep -Fxq 'PRODUCTION_WRITE_AUTHORIZATION=PENDING' <<< "$pr418_placement_output"
! grep -q '20261025000700\|20261027000100' <<< "$pr418_placement_output"
pr418_placement_versions="$(docker exec "$db_container" psql -X -A -t -U postgres -d "$pr418_placement_database" -v ON_ERROR_STOP=1 -c 'select version from supabase_migrations.schema_migrations order by version;')"
[[ "$pr418_placement_versions" == "$pr418_placement_base_version" ]]
echo 'PROMOTE_SINGLE_MIGRATION_POSTGRES_PR418_PLACEMENT_SCOPED_RISK_DRY_RUN=PASS'

# PR #424's V6.5 authorization is restricted to exactly the UI/reset migration
# after the V6.1 predecessor. This disposable database proves the selective
# dry-run and confirms that OFFSITE remains FAIL and Storage remains PARTIAL.
pr424_version=20261030000100
pr424_base_version=20261029000200
pr424_database=promoter_pr424_ui_reset_scoped_ci
pr424_db_url="${test_db_url%/promoter_historical_ci}/${pr424_database}"
pr424_fixture="$tmp/pr424-ui-reset-fixture"
pr424_migration="$repo_root/supabase/migrations/${pr424_version}_tec_idiomas_v63_ui_reset_activity.sql"
pr424_target_sha="$(sed 's/\r$//' "$pr424_migration" | "$real_sha256sum" | awk '{print $1}')"
[[ "$pr424_target_sha" == '39d60fde95d440bcf7c771de36c1a838f750957089db98c3908b093976846780' ]]
mkdir -p "$pr424_fixture/supabase/migrations"
printf 'project_id = "pr424-ui-reset-dry-run-ci"\n' > "$pr424_fixture/supabase/config.toml"
printf 'select 1;\n' > "$pr424_fixture/supabase/migrations/${pr424_base_version}_placement.sql"
cp "$pr424_migration" "$pr424_fixture/supabase/migrations/"
git -C "$pr424_fixture" init -q
git -C "$pr424_fixture" config user.name 'Migration promoter CI'
git -C "$pr424_fixture" config user.email 'migration-promoter-ci@example.invalid'
git -C "$pr424_fixture" add supabase/config.toml supabase/migrations
git -C "$pr424_fixture" commit -q -m 'Disposable PR 424 UI reset dry-run fixture'
git -C "$pr424_fixture" checkout -q -b codex/tec-idiomas-v6-4-release-validation
git -C "$pr424_fixture" remote add origin https://github.com/weslleyfreitassantos-cell/edumoneyyyy-.git
pr424_source_commit="$(git -C "$pr424_fixture" rev-parse HEAD)"
docker exec "$db_container" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE $pr424_database;" >/dev/null
docker exec "$db_container" psql -U postgres -d "$pr424_database" -v ON_ERROR_STOP=1 -c "CREATE SCHEMA supabase_migrations; CREATE TABLE supabase_migrations.schema_migrations (version text PRIMARY KEY NOT NULL, statements text[], name text); INSERT INTO supabase_migrations.schema_migrations (version, statements, name) VALUES ('$pr424_base_version', ARRAY[]::text[], 'pr424-base');" >/dev/null
pr424_env=(
  "PATH=$tmp/bin:$PATH"
  "PROMOTION_TEST_DB_CONTAINER=$db_container"
  "PROMOTION_TEST_DATABASE_NAME=$pr424_database"
  "PROMOTION_TEST_CLI_LOG_DIR=$tmp/cli-logs"
  "PROMOTION_TEST_SUPABASE_BIN=$promotion_test_supabase_bin"
  "PROMOTE_SINGLE_MIGRATION_CLI_BINARY=$tmp/bin/supabase-with-timeout"
  "SOURCE_ROOT=$pr424_fixture"
  "TARGET_VERSION=$pr424_version"
  "EXPECTED_REMOTE_LAST=$pr424_base_version"
  "EXPECTED_SOURCE_COMMIT=$pr424_source_commit"
  "EXPECTED_TARGET_SHA256=$pr424_target_sha"
  "PRODUCTION_DB_URL=$pr424_db_url"
  "APPLY=0"
  "BACKUP_GATE=FAIL"
  "BACKUP_EXCEPTION_PR=424"
  "BACKUP_EXCEPTION_SOURCE_SHA=$pr424_source_commit"
  "BACKUP_EXCEPTION_OFFSITE_STATUS=FAIL"
  "BACKUP_EXCEPTION_STORAGE_STATUS=PARTIAL"
  "BACKUP_EXCEPTION_AUTHORIZATION=TECESCOLA_V65_PR424_20261030000100"
  "TMPDIR=$tmp"
)
if ! pr424_output="$(env "${pr424_env[@]}" "$promoter" 2>&1)"; then
  printf '%s\n' "$pr424_output" >&2
  emit_cli_diagnostics
  printf 'PROMOTE_SINGLE_MIGRATION_CASE=pr424_scoped_dry_run FAIL\n' >&2
  exit 1
fi
printf '%s\n' "$pr424_output"
grep -Fxq 'REMOTE_MIGRATION_COUNT=1' <<< "$pr424_output"
grep -Fxq "REMOTE_LAST=$pr424_base_version" <<< "$pr424_output"
grep -Fxq 'BACKUP_GATE=FAIL' <<< "$pr424_output"
grep -Fxq 'BACKUP_EXCEPTION=PR424_SCOPED_MIGRATION_AUTHORIZATION' <<< "$pr424_output"
grep -Fxq 'BACKUP_EXCEPTION_PR=424' <<< "$pr424_output"
grep -Fxq "BACKUP_EXCEPTION_SCOPE=$pr424_version" <<< "$pr424_output"
grep -Fxq "BACKUP_EXCEPTION_PREDECESSOR=$pr424_base_version" <<< "$pr424_output"
grep -Fxq "BACKUP_EXCEPTION_SOURCE_SHA=$pr424_source_commit" <<< "$pr424_output"
grep -Fxq "BACKUP_EXCEPTION_MIGRATION_SHA256=$pr424_target_sha" <<< "$pr424_output"
grep -Fxq 'BACKUP_EXCEPTION_RECOVERY_PROOF=NONE' <<< "$pr424_output"
grep -Fxq 'BACKUP_EXCEPTION_RECOVERY_RISK=OFFSITE_UNAVAILABLE_STORAGE_PARTIAL' <<< "$pr424_output"
grep -Fxq 'BACKUP_EXCEPTION_OFFSITE=FAIL' <<< "$pr424_output"
grep -Fxq 'BACKUP_EXCEPTION_STORAGE=PARTIAL' <<< "$pr424_output"
grep -Fxq 'BACKUP_EXCEPTION_SCOPE_AUTHORIZATION=TECESCOLA_V65_PR424_20261030000100' <<< "$pr424_output"
grep -Fxq 'DRY_RUN_PENDING_COUNT=1' <<< "$pr424_output"
grep -Fxq "DRY_RUN_PENDING_VERSION=$pr424_version" <<< "$pr424_output"
grep -Fxq 'PROMOTION=DRY_RUN_ONLY' <<< "$pr424_output"
grep -Fxq 'PRODUCTION_WRITE_AUTHORIZATION=PENDING' <<< "$pr424_output"
! grep -q '20261025000700\|20261030000200' <<< "$pr424_output"
pr424_versions="$(docker exec "$db_container" psql -X -A -t -U postgres -d "$pr424_database" -v ON_ERROR_STOP=1 -c 'select version from supabase_migrations.schema_migrations order by version;')"
[[ "$pr424_versions" == "$pr424_base_version" ]]
echo 'PROMOTE_SINGLE_MIGRATION_POSTGRES_PR424_SCOPED_DRY_RUN=PASS'
