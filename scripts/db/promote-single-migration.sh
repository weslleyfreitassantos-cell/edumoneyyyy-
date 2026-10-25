#!/usr/bin/env bash
set -euo pipefail
set +x

abort() {
  printf 'PROMOTION_ABORTED=%s\n' "${1}" >&2
  exit 1
}

abort_after_apply() {
  printf 'PROMOTION_OUTCOME=UNKNOWN_DO_NOT_RETRY\n' >&2
  printf 'PROMOTION_ABORTED=%s\n' "${1}" >&2
  printf 'Inspect the migration ledger read-only before considering another promotion.\n' >&2
  exit 1
}

safe_cli_failure_class() {
  local output="${1,,}"
  case "${output}" in
    *"password authentication failed"*|*"failed sasl auth"*|*"invalid password"*|*"no password supplied"*|*"password is required"*) printf 'database_authentication' ;;
    *"no matching supabase cli binary"*|*"unsupported platform"*|*"command not found"*) printf 'cli_unavailable' ;;
    *"no pg_hba.conf entry"*|*"no encryption"*) printf 'database_access_policy' ;;
    *"actively refused"*|*"connection refused"*|*"econnrefused"*) printf 'database_connection_refused' ;;
    *"i/o timeout"*|*"context deadline exceeded"*|*"connect timeout"*|*"timed out"*) printf 'database_connection_timeout' ;;
    *"no route to host"*|*"network is unreachable"*|*"no such host"*) printf 'database_route_failure' ;;
    *"tls"*|*"ssl"*|*"certificate"*) printf 'database_tls' ;;
    *"dial error"*|*"dial tcp"*|*"connectex"*|*"failed to connect to postgres"*) printf 'database_connectivity' ;;
    *"v9_expansion_"*|*"v9_start_journey_"*|*"v9_fresh_question_set_"*|*"v9_pool_exhaustion_"*) printf 'database_migration_invariant' ;;
    *"sqlstate"*|*"error:"*|*"failed to apply migration"*) printf 'database_migration_error' ;;
    *"unknown flag"*|*"unknown command"*|*"unknown option"*) printf 'cli_invocation' ;;
    *) printf 'unclassified' ;;
  esac
}

repo_root="${SOURCE_ROOT:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
target_version="${TARGET_VERSION:?TARGET_VERSION is required}"
expected_remote_last="${EXPECTED_REMOTE_LAST:?EXPECTED_REMOTE_LAST is required}"
expected_source_commit="${EXPECTED_SOURCE_COMMIT:?EXPECTED_SOURCE_COMMIT is required}"
expected_target_sha256="${EXPECTED_TARGET_SHA256:?EXPECTED_TARGET_SHA256 is required}"
production_db_url="${PRODUCTION_DB_URL:?PRODUCTION_DB_URL is required}"

# One release-scoped alternative recovery proof. This never changes the normal
# offsite backup gate and cannot authorize migrations outside release #399.
release_399_sha='36979b8adc4408bf9eaccdf77f742904fba152fc'
release_399_backup_sha256='b8818e0b97a2152d60b1405f90d089a1ab4b43ba87d2739f234afb038b28d5c0'
release_399_backup_windows_path='C:\Users\samue\Backups\TecEscola\edumoney-2026-10-24T07-41-52Z.tar.gz'
declare -A release_399_migration_hashes=(
  [20261013003200]=a74980197b1aabbc1f3dce88b4c2719fd3621eaa33e7c3c7e1cc36f00d541083
  [20261015000700]=07ee09d493878cff41b2e347c8626874f2b0d4b1b6f0781a7ac4949372fab420
  [20261015000800]=eadd8c05e8046b8498228918dea75ff4e14e9905093928fccb87c78ad7ee81fe
  [20261015004100]=5e7d9a9eddea72ebb5cdd5a155cdf96d32f28fc4d1b1a5f4ad4e6a10d45851e3
  [20261016000400]=274dc0acbca22eff5e63566193965d90102a8a5edf8d57b4962eab1436f3a226
  [20261022000200]=656de511d5d302a46a3c82fcfafdc3aab538027ac85c8fc2e365e05e929d5a59
  [20261023000100]=d51ac811cac838124531d6d0eab25d8a6aa9bf1492129c8b7138828eb00ece7e
  [20261023000200]=4ed582c3b19f5da409b7e087e4bce5b8af07b7b98c5c2829fda52a3f1c414e97
  [20261023000300]=051e2572e799b8ea6687e129b2b0da270d9bb7d2bbdbfad87a98238959392f71
  [20261023000400]=7e6fa831d9ce0a713a92aec28a799268dc5ffe291b6f5e3ee7c03846aebe3c1e
  [20261023000500]=bb2d3f4e307b7bcd1c922327044837b5e15caff50a773102ce976ce0aeace8ec
  [20261023000700]=c4a15cc02db1eec389cadf31eafec739c01faec2887169c476c55a28c91c6f86
  [20261023000800]=e7e803d42c14009a8c6a04ac8e514ef773928e1e6551e13534f6d1d12edf82fb
  [20261023000900]=f4cf38b01c1ee74cd00d45e7eaaf55a1f5b12566c259027703a1e8bbc852fa1b
  [20261024000100]=9d0028276ad1798d64ab204810cae40cb1d862452c2ad8c89f06a5e6861fb71c
)
declare -A fast_delivery_migration_windows_hashes=(
  [20261025000100]=bea4c981901f75bef1b1be9fa1306f813db4b19cb781472468f7049b58ebcb39
  [20261025000200]=e256a57d27aaff7c0e357ddcc65a3a5b781b0ce57eb814558f1cb9835b839851
  [20261025000300]=83f19a3fb29e1aea549b7ae0cc0246b71936d9206cfd0cd631570fae1ef6fb6f
  [20261025000400]=30cee4e8dcaf955fc67122f4205689619494c67d656d19537077cf001b5ec11c
  [20261025000500]=84afdcd082ad4033d8ac6c04919e8c6660e1ffe1bb3754905e04f17ee191ac91
)
declare -A fast_delivery_migration_canonical_hashes=(
  [20261025000100]=6e3a281516461a4a1dbf88d5f1650a78dd286e60cb587062a8dd94cdd0c8ac5d
  [20261025000200]=be1df1fa18887d5f86022093cb390f93c6ecaded5cefb601162fc2d3bd5ea765
  [20261025000300]=f42598723f895c44a261ca750797aa3642b4ba082be3fa193da381e696172fd1
  [20261025000400]=366790d205e49993aa8194537e1e436ef5320d956695405da197e9d6dd374d79
  [20261025000500]=3c75cf066198c368a7639dec997e832f73b5261035580d338c2513a94ec9d6f6
)

connection_fields=()
while IFS= read -r -d '' field; do
  connection_fields+=("${field}")
done < <(PRODUCTION_DB_URL="${production_db_url}" node -e '
try {
  const url = new URL(process.env.PRODUCTION_DB_URL);
  if (!new Set(["postgres:", "postgresql:"]).has(url.protocol) || !url.hostname) throw new Error();

  const queryValues = new Map();
  for (const [key, value] of url.searchParams) {
    const normalized = key.toLowerCase();
    if (["user", "username", "password", "sslmode"].includes(normalized)) {
      const values = queryValues.get(normalized) || [];
      values.push(value);
      queryValues.set(normalized, values);
    } else if (["passfile", "sslpassword"].includes(normalized)) {
      throw new Error();
    }
  }

  const decoded = (value) => value ? decodeURIComponent(value) : "";
  const urlUser = decoded(url.username);
  const queryUser = [...(queryValues.get("user") || []), ...(queryValues.get("username") || [])];
  const queryPassword = queryValues.get("password") || [];
  const querySslModes = queryValues.get("sslmode") || [];
  if (queryUser.length > 1 || queryPassword.length > 1 || querySslModes.length > 1 || (url.password && queryPassword.length)) throw new Error();
  const user = urlUser || queryUser[0] || "";
  const password = decoded(url.password) || queryPassword[0] || "";
  const sslmode = querySslModes[0] || "prefer";
  if (!new Set(["disable", "allow", "prefer", "require", "verify-ca", "verify-full"]).has(sslmode)) throw new Error();
  if (!user || !password || (urlUser && queryUser.length && urlUser !== queryUser[0])) throw new Error();
  if (url.hash) throw new Error();

  url.username = "";
  url.password = "";
  for (const key of [...url.searchParams.keys()]) {
    if (["user", "username", "password"].includes(key.toLowerCase())) url.searchParams.delete(key);
  }
  if (url.username || url.password || [...url.searchParams.keys()].some((key) => /pass(word)?|sslpassword/i.test(key))) throw new Error();

  for (const value of [user, password, url.href, sslmode]) {
    if (value.includes("\0")) throw new Error();
    process.stdout.write(value + "\0");
  }
} catch {
  process.stderr.write("PRODUCTION_DB_URL is invalid or contains unsupported credential parameters\n");
  process.exitCode = 1;
}
')
[[ "${#connection_fields[@]}" -eq 4 ]] || abort "production database connection could not be parsed safely"
database_user="${connection_fields[0]}"
database_password="${connection_fields[1]}"
database_url="${connection_fields[2]}"
database_sslmode="${connection_fields[3]}"
unset connection_fields field production_db_url PRODUCTION_DB_URL

[[ "${target_version}" =~ ^[0-9]{14}$ ]] || abort "invalid target version"
[[ "${expected_remote_last}" =~ ^[0-9]{14}$ ]] || abort "invalid expected remote version"

actual_source_commit="$(git -C "${repo_root}" rev-parse HEAD 2>/dev/null)" || abort "source is not a git checkout"
[[ "${actual_source_commit}" == "${expected_source_commit}" ]] || abort "source commit mismatch"

sha256_file() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "${1}" | awk '{print $1}'
  else
    shasum -a 256 "${1}" | awk '{print $1}'
  fi
}

sha256_migration_file() {
  # Git's autocrlf may materialize SQL with CRLF on Windows. Hash canonical
  # LF text so release allowlists are stable across Windows and Linux.
  if command -v sha256sum >/dev/null 2>&1; then
    sed 's/\r$//' "${1}" | sha256sum | awk '{print $1}'
  else
    sed 's/\r$//' "${1}" | shasum -a 256 | awk '{print $1}'
  fi
}

authorize_production_write() {
  local backup_file="${BACKUP_EXCEPTION_BACKUP_FILE:-}"
  local exception_scope="${BACKUP_EXCEPTION_SCOPE:-RELEASE_399}"
  local expected_exception_migration_sha=""
  local expected_exception_migration_windows_sha=""
  local actual_backup_sha=""

  [[ "${CONFIRM_PRODUCTION_WRITE:-}" == 'I_CONFIRM_SELECTIVE_PRODUCTION_MIGRATION' ]] || \
    abort "production write confirmation is missing"

  case "${BACKUP_GATE:-}" in
    PASS)
      printf 'BACKUP_GATE=PASS\n'
      printf 'BACKUP_EXCEPTION=NOT_USED\n'
      printf 'PRODUCTION_WRITE_AUTHORIZATION=APPROVED\n'
      ;;
    FAIL)
      case "${exception_scope}" in
        RELEASE_399)
          [[ "${BACKUP_EXCEPTION_RELEASE_SHA:-}" == "${release_399_sha}" ]] || \
            abort "backup exception is restricted to the approved release #399 SHA"
          [[ "${BACKUP_EXCEPTION_WINDOWS_PATH:-}" == "${release_399_backup_windows_path}" ]] || \
            abort "backup exception does not identify the verified Windows copy"
          [[ "${BACKUP_EXCEPTION_BACKUP_SHA256:-}" == "${release_399_backup_sha256}" ]] || \
            abort "backup exception SHA-256 does not match the verified Windows copy"
          [[ "${BACKUP_EXCEPTION_RESTORE_STATUS:-}" == 'PARTIAL' ]] || \
            abort "backup exception must record the verified restore status PARTIAL"
          [[ "${BACKUP_EXCEPTION_STORAGE_STATUS:-}" == 'PARTIAL' ]] || \
            abort "backup exception must record the verified storage status PARTIAL"
          [[ "${BACKUP_EXCEPTION_OFFSITE_GATE:-}" == 'FAIL' ]] || \
            abort "backup exception must preserve the offsite gate as FAIL"
          [[ "${ACCEPT_INCOMPLETE_RECOVERY_RISK:-}" == 'I_ACCEPT_INCOMPLETE_RECOVERY_RISK_FOR_RELEASE_399' ]] || \
            abort "explicit incomplete-recovery risk acceptance is missing"
          expected_exception_migration_sha="${release_399_migration_hashes[${target_version}]:-}"
          [[ -n "${expected_exception_migration_sha}" ]] || \
            abort "backup exception does not authorize a migration outside release #399"
          ;;
        TECESCOLA_FAST_DELIVERY)
          [[ "${BACKUP_EXCEPTION_WINDOWS_PATH:-}" == "${release_399_backup_windows_path}" ]] || \
            abort "fast-delivery exception does not identify the verified Windows copy"
          [[ "${BACKUP_EXCEPTION_BACKUP_SHA256:-}" == "${release_399_backup_sha256}" ]] || \
            abort "fast-delivery exception backup SHA-256 does not match the verified Windows copy"
          [[ "${BACKUP_EXCEPTION_RESTORE_STATUS:-}" == 'PARTIAL' ]] || \
            abort "fast-delivery exception must record restore status PARTIAL"
          [[ "${BACKUP_EXCEPTION_STORAGE_STATUS:-}" == 'PARTIAL' ]] || \
            abort "fast-delivery exception must record storage status PARTIAL"
          [[ "${BACKUP_EXCEPTION_OFFSITE_GATE:-}" == 'FAIL' ]] || \
            abort "fast-delivery exception must preserve offsite gate as FAIL"
          [[ "${ACCEPT_INCOMPLETE_RECOVERY_RISK:-}" == 'I_ACCEPT_INCOMPLETE_RECOVERY_RISK_FOR_TECESCOLA_FAST_DELIVERY' ]] || \
            abort "fast-delivery incomplete-recovery risk acceptance is missing"
          expected_exception_migration_sha="${fast_delivery_migration_canonical_hashes[${target_version}]:-}"
          expected_exception_migration_windows_sha="${fast_delivery_migration_windows_hashes[${target_version}]:-}"
          [[ -n "${expected_exception_migration_sha}" && -n "${expected_exception_migration_windows_sha}" ]] || \
            abort "fast-delivery exception does not authorize this migration version"
          [[ "${actual_target_sha256_raw}" == "${expected_exception_migration_windows_sha}" || \
            "${actual_target_sha256_raw}" == "${expected_exception_migration_sha}" ]] || \
            abort "target migration raw bytes do not match the approved Windows or LF artifact"
          ;;
        *)
          abort "backup exception scope is not recognized"
          ;;
      esac
      [[ "${expected_target_sha256}" == "${expected_exception_migration_sha}" && \
        "${actual_target_sha256}" == "${expected_exception_migration_sha}" ]] || \
        abort "target migration is not the exact approved artifact for this backup exception"
      [[ -n "${backup_file}" && -f "${backup_file}" ]] || \
        abort "verified Windows backup copy is not accessible"
      actual_backup_sha="$(sha256_file "${backup_file}")" || \
        abort "verified Windows backup copy could not be hashed"
      [[ "${actual_backup_sha}" == "${release_399_backup_sha256}" ]] || \
        abort "accessible backup copy SHA-256 does not match the verified Windows copy"
      printf 'BACKUP_GATE=FAIL\n'
      printf 'BACKUP_EXCEPTION=USED\n'
      printf 'BACKUP_EXCEPTION_SCOPE=%s\n' "${exception_scope}"
      if [[ "${exception_scope}" == 'RELEASE_399' ]]; then
        printf 'BACKUP_EXCEPTION_RELEASE_SHA=%s\n' "${release_399_sha}"
      else
        printf 'BACKUP_EXCEPTION_MIGRATION_VERSION=%s\n' "${target_version}"
        printf 'BACKUP_EXCEPTION_MIGRATION_SHA256=%s\n' "${actual_target_sha256}"
        printf 'BACKUP_EXCEPTION_MIGRATION_SHA256_WINDOWS_APPROVED=%s\n' "${expected_exception_migration_windows_sha}"
        printf 'BACKUP_EXCEPTION_MIGRATION_SHA256_ON_DISK=%s\n' "${actual_target_sha256_raw}"
      fi
      printf 'BACKUP_EXCEPTION_WINDOWS_SHA256=%s\n' "${actual_backup_sha}"
      printf 'BACKUP_EXCEPTION_RESTORE=PARTIAL\n'
      printf 'BACKUP_EXCEPTION_STORAGE=PARTIAL\n'
      printf 'BACKUP_EXCEPTION_OFFSITE_GATE=FAIL\n'
      printf 'BACKUP_EXCEPTION_RISK_ACCEPTANCE=ACCEPTED\n'
      printf 'PRODUCTION_WRITE_AUTHORIZATION=APPROVED\n'
      ;;
    *)
      abort "backup gate must be PASS or the release-scoped FAIL exception"
      ;;
  esac
}

mapfile -t target_files < <(find "${repo_root}/supabase/migrations" -maxdepth 1 -type f -name "${target_version}_*.sql" -print)
[[ "${#target_files[@]}" -eq 1 ]] || abort "target migration must resolve to exactly one file"
target_file="${target_files[0]}"
actual_target_sha256="$(sha256_migration_file "${target_file}")"
actual_target_sha256_raw="$(sha256_file "${target_file}")"
[[ "${actual_target_sha256}" == "${expected_target_sha256}" ]] || abort "target migration hash mismatch"

umask 077
temp_root="$(mktemp -d "${TMPDIR:-/tmp}/tecescola-promote.XXXXXX")"
chmod 700 "${temp_root}"
cli_workdir="${temp_root}"
cleanup() {
  rm -rf -- "${temp_root}"
  if [[ "${cli_workdir}" != "${temp_root}" ]]; then
    rm -rf -- "${cli_workdir}"
  fi
}
trap cleanup EXIT
pgpass_file="${temp_root}/.pgpass"
pgpass_escape() {
  local value="${1//\\/\\\\}"
  value="${value//:/\\:}"
  printf '%s' "${value}"
}
printf '*:*:*:%s:%s\n' "$(pgpass_escape "${database_user}")" "$(pgpass_escape "${database_password}")" > "${pgpass_file}"
chmod 600 "${pgpass_file}"

# Keep this project-specific: the Supabase CLI itself consumes
# SUPABASE_CLI_BINARY_OVERRIDE to select its native executable.
cli_binary_override="${PROMOTE_SINGLE_MIGRATION_CLI_BINARY:-}"
cli_command=()
if [[ -n "${cli_binary_override}" ]]; then
  if [[ "${cli_binary_override}" == */* || "${cli_binary_override}" == *.exe ]]; then
    [[ -f "${cli_binary_override}" ]] || abort "Supabase CLI override is unavailable"
    [[ "${cli_binary_override}" == *.exe || -x "${cli_binary_override}" ]] || abort "Supabase CLI override is not executable"
  else
    command -v "${cli_binary_override}" >/dev/null 2>&1 || abort "Supabase CLI override is unavailable"
  fi
  cli_command=("${cli_binary_override}")
else
  command -v npx >/dev/null 2>&1 || abort "npx is required when no Supabase CLI override is configured"
  cli_command=(npx supabase)
fi

if [[ -n "${SUPABASE_CLI_WORKDIR_ROOT:-}" ]]; then
  cli_workdir_root="${SUPABASE_CLI_WORKDIR_ROOT}"
  [[ -d "${cli_workdir_root}" && -w "${cli_workdir_root}" ]] || abort "Supabase CLI workdir root is unavailable"
  cli_workdir_root="$(realpath -e -- "${cli_workdir_root}")"
  cli_workdir="$(mktemp -d "${cli_workdir_root%/}/tecescola-promote.XXXXXX")"
elif [[ "${cli_binary_override}" == *.exe ]]; then
  abort "Windows Supabase CLI requires a Windows-accessible temporary workdir"
fi

cli_workdir_arg="${cli_workdir}"
cli_wslenv="${WSLENV:-}"
if [[ "${cli_binary_override}" == *.exe ]]; then
  if command -v wslpath >/dev/null 2>&1; then
    cli_workdir_arg="$(wslpath -w "${cli_workdir}")" || abort "Supabase CLI workdir conversion failed"
    for variable in PGUSER PGPASSWORD PGSSLMODE; do
      updated_entries=()
      found_variable=0
      IFS=':' read -r -a wslenv_entries <<< "${cli_wslenv}"
      for entry in "${wslenv_entries[@]}"; do
        [[ -n "${entry}" ]] || continue
        entry_name="${entry%%/*}"
        if [[ "${entry_name}" == "${variable}" ]]; then
          updated_entries+=("${variable}/w")
          found_variable=1
        else
          updated_entries+=("${entry}")
        fi
      done
      [[ "${found_variable}" -eq 1 ]] || updated_entries+=("${variable}/w")
      cli_wslenv="$(IFS=:; printf '%s' "${updated_entries[*]}")"
    done
  elif command -v cygpath >/dev/null 2>&1; then
    cli_workdir_arg="$(cygpath -w "${cli_workdir}")" || abort "Supabase CLI workdir conversion failed"
  else
    abort "wslpath or cygpath is required for the Windows Supabase CLI"
  fi
  [[ "${cli_workdir_arg}" =~ ^[A-Za-z]:\\ ]] || abort "Supabase CLI workdir is not Windows-accessible"
fi

run_supabase_cli() {
  if [[ "${cli_binary_override}" == *.exe && -n "${cli_wslenv}" && "${cli_wslenv}" != "${WSLENV:-}" ]]; then
    WSLENV="${cli_wslenv}" PGUSER="${database_user}" PGPASSWORD="${database_password}" PGSSLMODE="${database_sslmode}" \
      "${cli_command[@]}" "$@"
  else
    PGUSER="${database_user}" PGPASSWORD="${database_password}" PGSSLMODE="${database_sslmode}" \
      "${cli_command[@]}" "$@"
  fi
}

if [[ -n "${REMOTE_LEDGER_FILE:-}" ]]; then
  [[ -f "${REMOTE_LEDGER_FILE}" ]] || abort "remote ledger fixture is missing"
  ledger_output="$(cat "${REMOTE_LEDGER_FILE}")"
else
  command -v psql >/dev/null 2>&1 || abort "psql is required for remote ledger inspection"
  ledger_output="$(PGUSER="${database_user}" PGPASSFILE="${pgpass_file}" psql "${database_url}" -X -A -t -v ON_ERROR_STOP=1 -c \
    "select version from supabase_migrations.schema_migrations order by version;")" \
    || abort "remote ledger inspection failed"
fi

remote_versions=()
while IFS= read -r version; do
  version="${version//[[:space:]]/}"
  [[ -z "${version}" ]] && continue
  [[ "${version}" =~ ^[0-9]{14}$ ]] || abort "remote ledger contains an invalid version"
  remote_versions+=("${version}")
done <<< "${ledger_output}"

[[ "${#remote_versions[@]}" -gt 0 ]] || abort "remote ledger is empty"
sorted_versions="$(printf '%s\n' "${remote_versions[@]}" | sort -u)"
unique_count="$(printf '%s\n' "${sorted_versions}" | sed '/^$/d' | wc -l | tr -d ' ')"
[[ "${unique_count}" -eq "${#remote_versions[@]}" ]] || abort "remote ledger contains duplicate versions"
remote_last="$(printf '%s\n' "${remote_versions[@]}" | sort | tail -n 1)"
[[ "${remote_last}" == "${expected_remote_last}" ]] || abort "remote last migration differs from expected"
printf '%s\n' "${remote_versions[@]}" | grep -Fxq "${target_version}" && abort "target migration is already applied"

# The isolated workdir contains every applied remote migration plus exactly one
# requested target. Supabase skips a target older than the newest remote version
# unless --include-all is set, so enable it only for historical gaps.
include_all_flag=()
if [[ "${target_version}" < "${remote_last}" ]]; then
  include_all_flag=(--include-all)
fi

mkdir -p "${cli_workdir}/supabase/migrations"
cp "${repo_root}/supabase/config.toml" "${cli_workdir}/supabase/config.toml"

for version in "${remote_versions[@]}"; do
  mapfile -t local_files < <(find "${repo_root}/supabase/migrations" -maxdepth 1 -type f -name "${version}_*.sql" -print)
  [[ "${#local_files[@]}" -eq 1 ]] || abort "remote version has no unique local migration: ${version}"
  cp "${local_files[0]}" "${cli_workdir}/supabase/migrations/"
done
cp "${target_file}" "${cli_workdir}/supabase/migrations/"

workdir_migration_count="$(find "${cli_workdir}/supabase/migrations" -maxdepth 1 -type f -name '*.sql' | wc -l | tr -d ' ')"
expected_workdir_count=$(( ${#remote_versions[@]} + 1 ))
[[ "${workdir_migration_count}" -eq "${expected_workdir_count}" ]] || abort "temporary workdir migration count mismatch"
for forbidden in 20261004000100 20261004000200 20261004000300; do
  if find "${cli_workdir}/supabase/migrations" -maxdepth 1 -type f -name "${forbidden}_*.sql" | grep -q .; then
    abort "deferred BNCC migration entered temporary workdir"
  fi
done

if [[ -n "${DRY_RUN_OUTPUT_FILE:-}" ]]; then
  [[ -f "${DRY_RUN_OUTPUT_FILE}" ]] || abort "dry-run fixture is missing"
  dry_run_output="$(cat "${DRY_RUN_OUTPUT_FILE}")"
else
  printf 'PROMOTION_STAGE=DRY_RUN_START\n' >&2
  if ! dry_run_output="$(run_supabase_cli --workdir "${cli_workdir_arg}" db push --db-url "${database_url}" "${include_all_flag[@]}" --yes --dry-run --log-level error 2>&1)"; then
    abort "supabase dry-run failed: $(safe_cli_failure_class "${dry_run_output}")"
  fi
  printf 'PROMOTION_STAGE=DRY_RUN_COMPLETE\n' >&2
fi

pending_versions=()
while IFS= read -r version; do
  [[ -z "${version}" ]] && continue
  if printf '%s\n' "${remote_versions[@]}" | grep -Fxq "${version}"; then
    continue
  fi
  pending_versions+=("${version}")
done < <(printf '%s\n' "${dry_run_output}" | grep -Eo '[0-9]{14}' | sort -u || true)

[[ "${#pending_versions[@]}" -eq 1 ]] || abort "dry-run contains an unexpected number of migrations"
[[ "${pending_versions[0]}" == "${target_version}" ]] || abort "dry-run target differs from requested migration"

printf 'REMOTE_MIGRATION_COUNT=%s\n' "${#remote_versions[@]}"
printf 'REMOTE_LAST=%s\n' "${remote_last}"
printf 'WORKDIR_MIGRATION_COUNT=%s\n' "${workdir_migration_count}"
printf 'DRY_RUN_PENDING_COUNT=1\n'
printf 'DRY_RUN_PENDING_VERSION=%s\n' "${target_version}"
printf 'TARGET_MIGRATION_SHA256=%s\n' "${actual_target_sha256}"
printf 'TARGET_MIGRATION_SHA256_RAW=%s\n' "${actual_target_sha256_raw}"

if [[ "${APPLY:-0}" != '1' ]]; then
  printf 'PROMOTION=DRY_RUN_ONLY\n'
  exit 0
fi

authorize_production_write

printf 'PROMOTION_STAGE=APPLY_START\n' >&2
apply_output="$(run_supabase_cli --workdir "${cli_workdir_arg}" db push --db-url "${database_url}" "${include_all_flag[@]}" --yes --log-level error 2>&1)" \
  || abort "selective migration push failed: $(safe_cli_failure_class "${apply_output}")"
printf 'PROMOTION_STAGE=APPLY_COMPLETE\n' >&2

after_output="$(PGUSER="${database_user}" PGPASSFILE="${pgpass_file}" psql "${database_url}" -X -A -t -v ON_ERROR_STOP=1 -c \
  "select version from supabase_migrations.schema_migrations order by version;")" \
  || abort_after_apply "post-promotion ledger query failed"

after_versions=()
while IFS= read -r version; do
  version="${version//[[:space:]]/}"
  [[ -z "${version}" ]] && continue
  [[ "${version}" =~ ^[0-9]{14}$ ]] || abort_after_apply "post-promotion ledger contains an invalid version"
  after_versions+=("${version}")
done <<< "${after_output}"
[[ "${#after_versions[@]}" -gt 0 ]] || abort_after_apply "post-promotion ledger is empty"

after_sorted_output="$(printf '%s\n' "${after_versions[@]}" | sort)"
after_unique_output="$(printf '%s\n' "${after_versions[@]}" | sort -u)"
mapfile -t after_sorted_versions <<< "${after_sorted_output}"
mapfile -t after_unique_versions <<< "${after_unique_output}"
[[ "${#after_unique_versions[@]}" -eq "${#after_versions[@]}" ]] || \
  abort_after_apply "post-promotion ledger contains duplicate versions"

expected_versions=("${remote_versions[@]}" "${target_version}")
expected_sorted_output="$(printf '%s\n' "${expected_versions[@]}" | sort -u)"
mapfile -t expected_sorted_versions <<< "${expected_sorted_output}"
[[ "${#after_sorted_versions[@]}" -eq "${#expected_sorted_versions[@]}" ]] || \
  abort_after_apply "post-promotion ledger version set has a missing or extra version"
for ((index = 0; index < ${#expected_sorted_versions[@]}; index++)); do
  [[ "${after_sorted_versions[index]}" == "${expected_sorted_versions[index]}" ]] || \
    abort_after_apply "post-promotion ledger version set has a missing or extra version"
done

expected_after_count="${#expected_versions[@]}"
remote_after_last="${after_sorted_versions[$(( ${#after_sorted_versions[@]} - 1 ))]}"
unset database_password
printf 'PROMOTION=APPLIED\n'
printf 'REMOTE_AFTER_COUNT=%s\n' "${expected_after_count}"
printf 'REMOTE_AFTER_LAST=%s\n' "${remote_after_last}"
