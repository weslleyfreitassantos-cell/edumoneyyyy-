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

safe_cli_sqlstate() {
  local output="${1^^}"
  if [[ "${output}" =~ SQLSTATE[^[:alnum:]]+([0-9A-Z]{5}) ]]; then
    printf '%s' "${BASH_REMATCH[1]}"
  elif [[ "${output}" =~ (ERROR|FATAL|PANIC):[[:space:]]*([0-9A-Z]{5}): ]]; then
    printf '%s' "${BASH_REMATCH[2]}"
  else
    printf 'UNKNOWN'
  fi
}

safe_cli_failure_message() {
  local output="${1^^}"
  local sqlstate
  sqlstate="$(safe_cli_sqlstate "${1}")"
  case "${sqlstate}" in
    23502) printf 'not_null_constraint_violation' ;;
    23503) printf 'foreign_key_constraint_violation' ;;
    23505) printf 'unique_constraint_violation' ;;
    23514) printf 'check_constraint_violation' ;;
    2BP01) printf 'dependent_objects_still_exist' ;;
    40001) printf 'serialization_failure' ;;
    40P01) printf 'deadlock_detected' ;;
    42P01) printf 'undefined_table' ;;
    42P07) printf 'duplicate_table' ;;
    42701) printf 'duplicate_column' ;;
    42703) printf 'undefined_column' ;;
    42710) printf 'duplicate_object' ;;
    42804) printf 'datatype_mismatch' ;;
    42883) printf 'undefined_function' ;;
    42501) printf 'insufficient_privilege' ;;
    22P02) printf 'invalid_text_representation' ;;
    57014) printf 'statement_timeout_or_query_canceled' ;;
    P0001)
      if [[ "${output}" =~ ERROR:[[:space:]]*P0001:[[:space:]]*([A-Z][A-Z0-9]*_[A-Z0-9_]{2,}) ]]; then
        printf '%s' "${BASH_REMATCH[1]}"
      else
        printf 'user_defined_exception'
      fi
      ;;
    *)
      if [[ "${output}" =~ ERROR:[[:space:]]*([A-Z][A-Z0-9]*_[A-Z0-9_]{2,})(:[^[:space:]]+)? ]]; then
        printf '%s' "${BASH_REMATCH[1]}"
      else
        safe_cli_failure_class "${1}"
      fi
      ;;
  esac
}

safe_cli_failure_object() {
  local output="${1^^}"
  if [[ "${output}" =~ (RELATION|TABLE|CONSTRAINT|INDEX|COLUMN|FUNCTION)[[:space:]]+\"([A-Z_][A-Z0-9_.$]*)\" ]]; then
    printf '%s:%s' "${BASH_REMATCH[1],,}" "${BASH_REMATCH[2]}"
  else
    printf 'unknown'
  fi
}

secure_diagnostic_directory() {
  local path="${1}"
  local platform="$(uname -s)"
  if [[ "${platform}" == MINGW* || "${platform}" == MSYS* || "${platform}" == CYGWIN* ]]; then
    local windows_path principal
    command -v icacls.exe >/dev/null 2>&1 || return 1
    command -v whoami.exe >/dev/null 2>&1 || return 1
    command -v cygpath >/dev/null 2>&1 || return 1
    windows_path="$(cygpath -w -- "${path}")" || return 1
    principal="$(whoami.exe)" || return 1
    icacls.exe "${windows_path}" /inheritance:r /grant:r \
      "${principal}:(OI)(CI)F" '*S-1-5-18:(OI)(CI)F' '*S-1-5-32-544:(OI)(CI)F' >/dev/null || return 1
    return 0
  fi

  chmod 700 -- "${path}" || return 1
  [[ "$(stat -c '%a' -- "${path}" 2>/dev/null)" == '700' ]]
}

secure_diagnostic_file() {
  local path="${1}"
  local platform="$(uname -s)"
  if [[ "${platform}" == MINGW* || "${platform}" == MSYS* || "${platform}" == CYGWIN* ]]; then
    local windows_path principal
    command -v icacls.exe >/dev/null 2>&1 || return 1
    command -v whoami.exe >/dev/null 2>&1 || return 1
    command -v cygpath >/dev/null 2>&1 || return 1
    windows_path="$(cygpath -w -- "${path}")" || return 1
    principal="$(whoami.exe)" || return 1
    icacls.exe "${windows_path}" /inheritance:r /grant:r \
      "${principal}:F" '*S-1-5-18:F' '*S-1-5-32-544:F' >/dev/null || return 1
    return 0
  fi

  chmod 600 -- "${path}" || return 1
  [[ "$(stat -c '%a' -- "${path}" 2>/dev/null)" == '600' ]]
}

record_cli_failure() {
  local phase="${1}"
  local output="${2}"
  local diagnostic_dir="${PROMOTION_DIAGNOSTIC_DIR:-${XDG_STATE_HOME:-${HOME:-/tmp}/.local/state}/tecescola/migration-diagnostics}"
  local record sqlstate failure_class message object
  sqlstate="$(safe_cli_sqlstate "${output}")"
  failure_class="$(safe_cli_failure_class "${output}")"
  message="$(safe_cli_failure_message "${output}")"
  object="$(safe_cli_failure_object "${output}")"

  (umask 077; mkdir -p -- "${diagnostic_dir}") || {
    printf 'PROMOTION_DIAGNOSTIC_LOG=unavailable\n' >&2
    printf 'PROMOTION_SQLSTATE=%s\n' "${sqlstate}" >&2
    printf 'PROMOTION_ERROR=%s\n' "${message}" >&2
    return 0
  }
  secure_diagnostic_directory "${diagnostic_dir}" || {
    printf 'PROMOTION_DIAGNOSTIC_LOG=unavailable\n' >&2
    printf 'PROMOTION_SQLSTATE=%s\n' "${sqlstate}" >&2
    printf 'PROMOTION_ERROR=%s\n' "${message}" >&2
    return 0
  }
  record="$(mktemp "${diagnostic_dir}/${target_version}-${phase}.XXXXXX")" || {
    printf 'PROMOTION_DIAGNOSTIC_LOG=unavailable\n' >&2
    printf 'PROMOTION_SQLSTATE=%s\n' "${sqlstate}" >&2
    printf 'PROMOTION_ERROR=%s\n' "${message}" >&2
    return 0
  }
  secure_diagnostic_file "${record}" || {
    rm -f -- "${record}"
    printf 'PROMOTION_DIAGNOSTIC_LOG=unavailable\n' >&2
    printf 'PROMOTION_SQLSTATE=%s\n' "${sqlstate}" >&2
    printf 'PROMOTION_ERROR=%s\n' "${message}" >&2
    return 0
  }
  {
    printf 'diagnostic_version=1\n'
    printf 'timestamp_utc=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    printf 'stage=%s\n' "${phase}"
    printf 'migration=%s\n' "${target_version}"
    printf 'source_commit=%s\n' "${expected_source_commit}"
    printf 'sqlstate=%s\n' "${sqlstate}"
    printf 'failure_class=%s\n' "${failure_class}"
    printf 'message=%s\n' "${message}"
    printf 'object=%s\n' "${object}"
    printf 'statement=not-preserved-by-supabase-cli-output\n'
    printf 'raw_output=discarded; only sanitized fields retained\n'
  } > "${record}"

  printf 'PROMOTION_DIAGNOSTIC_LOG=%s\n' "${record}" >&2
  printf 'PROMOTION_SQLSTATE=%s\n' "${sqlstate}" >&2
  printf 'PROMOTION_ERROR=%s\n' "${message}" >&2
  [[ "${object}" == 'unknown' ]] || printf 'PROMOTION_ERROR_OBJECT=%s\n' "${object}" >&2
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

# Release #406 has a separate, one-release recovery-risk acceptance. It is
# bound to the exact PR source lineage, local backup artifact, two migration
# hashes, and the expected ledger immediately before each migration.
release_406_source_anchor='ead793895f325c7b15a244f927219be252958e0d'
release_406_backup_sha256='a9f5a433cd10970cf0a5e5752ea5f71115d27bc91706fdae32265f2b56084841'
release_406_backup_size_bytes='372305133'
release_406_backup_host='tecescola-vps'
release_406_backup_path='/srv/grupotec/backups/edumoney/edumoney-2026-10-25T07-43-25Z.tar.gz'
release_406_backup_filename='edumoney-2026-10-25T07-43-25Z.tar.gz'
declare -A release_406_migration_hashes=(
  [20261025000600]=afc999f01040b1d633d8fe8185ea257729a212a2833d017bb6d27a71b6b473e3
  [20261025000700]=7651ba9d253cb14c10882b370cdf866e87c193594c25493385cbbfe4e90d0bcc
)
declare -A release_406_expected_remote_last=(
  [20261025000600]=20261025000500
  [20261025000700]=20261025000600
)
declare -A release_406_expected_remote_count=(
  [20261025000600]=241
  [20261025000700]=242
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
    } else if (["passfile", "sslpassword", "options", "service", "servicefile", "role"].includes(normalized)) {
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

# This script derives its database identity from the explicit URL. Do not let
# inherited libpq settings silently change the role, service, host, database,
# SSL behavior, or password source used by psql or the Supabase CLI.
while IFS= read -r pg_environment_variable; do
  [[ "${pg_environment_variable}" == PG* ]] && unset "${pg_environment_variable}"
done < <(compgen -e)
unset pg_environment_variable

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
  local expected_release_migration_sha=""
  local actual_backup_sha=""
  local actual_backup_size=""
  local backup_evidence=""
  local backup_reported_path=""
  local -a backup_evidence_lines=()

  [[ "${CONFIRM_PRODUCTION_WRITE:-}" == 'I_CONFIRM_SELECTIVE_PRODUCTION_MIGRATION' ]] || \
    abort "production write confirmation is missing"

  case "${BACKUP_GATE:-}" in
    PASS)
      printf 'BACKUP_GATE=PASS\n'
      printf 'BACKUP_EXCEPTION=NOT_USED\n'
      printf 'PRODUCTION_WRITE_AUTHORIZATION=APPROVED\n'
      ;;
    FAIL)
      if [[ "${BACKUP_EXCEPTION_RELEASE_ID:-}" == '406' ]]; then
        [[ "${BACKUP_EXCEPTION_SOURCE_COMMIT:-}" == "${actual_source_commit}" && \
          "${BACKUP_EXCEPTION_SOURCE_COMMIT:-}" == "${expected_source_commit}" ]] || \
          abort "release #406 exception source commit does not match the verified checkout"
        git -C "${repo_root}" merge-base --is-ancestor \
          "${release_406_source_anchor}" "${actual_source_commit}" 2>/dev/null || \
          abort "release #406 exception source is outside the approved PR lineage"
        [[ "${ACCEPT_INCOMPLETE_RECOVERY_RISK:-}" == 'I_ACCEPT_INCOMPLETE_RECOVERY_RISK_FOR_RELEASE_406' ]] || \
          abort "explicit incomplete-recovery risk acceptance for release #406 is missing"
        [[ "${BACKUP_EXCEPTION_BACKUP_SHA256:-}" == "${release_406_backup_sha256}" ]] || \
          abort "release #406 backup SHA-256 does not match the previously validated VPS-local artifact"
        [[ "${BACKUP_EXCEPTION_BACKUP_HOST:-}" == "${release_406_backup_host}" ]] || \
          abort "release #406 backup host does not identify the validated VPS artifact"
        [[ "${backup_file}" == "${release_406_backup_path}" && \
          "$(basename -- "${backup_file}")" == "${release_406_backup_filename}" ]] || \
          abort "release #406 backup path does not identify the validated VPS artifact"
        command -v ssh >/dev/null 2>&1 || abort "ssh is required to verify the VPS-local release #406 backup"
        backup_evidence="$(ssh -o BatchMode=yes -o ConnectTimeout=15 \
          "${release_406_backup_host}" \
          "stat -c '%s' -- '${release_406_backup_path}' && sha256sum -- '${release_406_backup_path}'")" || \
          abort "previously validated VPS-local release #406 backup could not be verified over SSH"
        mapfile -t backup_evidence_lines <<< "${backup_evidence}"
        [[ "${#backup_evidence_lines[@]}" -eq 2 ]] || \
          abort "release #406 backup verification returned an unexpected result"
        actual_backup_size="${backup_evidence_lines[0]}"
        read -r actual_backup_sha backup_reported_path <<< "${backup_evidence_lines[1]}"
        [[ -n "${backup_reported_path}" && "${backup_reported_path}" == "${release_406_backup_path}" ]] || \
          abort "release #406 backup verification returned a different artifact path"
        [[ "${actual_backup_size}" == "${release_406_backup_size_bytes}" ]] || \
          abort "release #406 backup size differs from the previously validated VPS-local artifact"
        [[ "${actual_backup_sha}" == "${release_406_backup_sha256}" ]] || \
          abort "release #406 backup hash differs from the previously validated VPS-local artifact"
        expected_release_migration_sha="${release_406_migration_hashes[${target_version}]:-}"
        [[ -n "${expected_release_migration_sha}" ]] || \
          abort "backup exception does not authorize a migration outside release #406"
        [[ "${expected_target_sha256}" == "${expected_release_migration_sha}" && \
          "${actual_target_sha256}" == "${expected_release_migration_sha}" ]] || \
          abort "target migration is not the approved release #406 artifact"
        [[ "${expected_remote_last}" == "${release_406_expected_remote_last[${target_version}]}" && \
          "${remote_last}" == "${release_406_expected_remote_last[${target_version}]}" ]] || \
          abort "remote ledger version is not the approved pre-migration state for release #406"
        [[ "${#remote_versions[@]}" -eq "${release_406_expected_remote_count[${target_version}]}" ]] || \
          abort "remote ledger count is not the approved pre-migration state for release #406"

        printf 'BACKUP_GATE=FAIL\n'
        printf 'BACKUP_EXCEPTION=RELEASE_406_ACCEPTED\n'
        printf 'BACKUP_EXCEPTION_RELEASE_ID=406\n'
        printf 'BACKUP_EXCEPTION_SOURCE_COMMIT=%s\n' "${actual_source_commit}"
        printf 'BACKUP_EXCEPTION_BACKUP_HOST=%s\n' "${release_406_backup_host}"
        printf 'BACKUP_EXCEPTION_BACKUP_PATH=%s\n' "${release_406_backup_path}"
        printf 'BACKUP_EXCEPTION_BACKUP_SHA256=%s\n' "${actual_backup_sha}"
        printf 'BACKUP_EXCEPTION_BACKUP_SIZE_BYTES=%s\n' "${actual_backup_size}"
        printf 'BACKUP_EXCEPTION_STORAGE_RECOVERY=PARTIAL\n'
        printf 'BACKUP_EXCEPTION_OFFSITE_GATE=FAIL\n'
        printf 'BACKUP_EXCEPTION_RISK_ACCEPTANCE=ACCEPTED\n'
        printf 'PRODUCTION_WRITE_AUTHORIZATION=APPROVED\n'
        return 0
      fi

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
      expected_release_migration_sha="${release_399_migration_hashes[${target_version}]:-}"
      [[ -n "${expected_release_migration_sha}" ]] || \
        abort "backup exception does not authorize a migration outside release #399"
      [[ "${expected_target_sha256}" == "${expected_release_migration_sha}" && \
        "${actual_target_sha256}" == "${expected_release_migration_sha}" ]] || \
        abort "target migration is not the approved release #399 artifact"
      [[ -n "${backup_file}" && -f "${backup_file}" ]] || \
        abort "verified Windows backup copy is not accessible"
      actual_backup_sha="$(sha256_file "${backup_file}")" || \
        abort "verified Windows backup copy could not be hashed"
      [[ "${actual_backup_sha}" == "${release_399_backup_sha256}" ]] || \
        abort "accessible backup copy SHA-256 does not match the verified Windows copy"
      printf 'BACKUP_GATE=FAIL\n'
      printf 'BACKUP_EXCEPTION=USED\n'
      printf 'BACKUP_EXCEPTION_RELEASE_SHA=%s\n' "${release_399_sha}"
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
  filtered_wslenv_entries=()
  IFS=':' read -r -a wslenv_entries <<< "${cli_wslenv}"
  for entry in "${wslenv_entries[@]}"; do
    [[ -n "${entry}" ]] || continue
    entry_name="${entry%%/*}"
    if [[ "${entry_name}" == PG* && "${entry_name}" != PGUSER && \
      "${entry_name}" != PGPASSWORD && "${entry_name}" != PGSSLMODE ]]; then
      continue
    fi
    filtered_wslenv_entries+=("${entry}")
  done
  cli_wslenv="$(IFS=:; printf '%s' "${filtered_wslenv_entries[*]}")"

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

parse_promotion_context() {
  PROMOTION_CONTEXT_JSON="${1}" node -e '
const raw = process.env.PROMOTION_CONTEXT_JSON || "";
const first = raw.indexOf("{");
const last = raw.lastIndexOf("}");
if (first < 0 || last < first) process.exit(2);
let document;
try { document = JSON.parse(raw.slice(first, last + 1)); } catch { process.exit(2); }
const matches = [];
function visit(value) {
  if (typeof value === "string" && value.startsWith("{")) {
    try { visit(JSON.parse(value)); } catch {}
    return;
  }
  if (!value || typeof value !== "object") return;
  if (value.marker === "PROMOTION_CONTEXT_V1") matches.push(value);
  for (const child of Object.values(value)) visit(child);
}
visit(document);
if (matches.length !== 1) process.exit(3);
const row = matches[0];
const fields = ["session_user", "current_user", "current_role", "role_setting", "candidate_owner"];
if (fields.some((field) => typeof row[field] !== "string")) process.exit(4);
for (const field of ["candidate_owner_access", "relation_ddl_access", "function_ddl_access", "public_create", "private_create", "is_superuser"]) {
  if (typeof row[field] !== "boolean") process.exit(5);
}
const values = [
  row.session_user, row.current_user, row.current_role, row.role_setting,
  row.candidate_owner, String(row.candidate_owner_access),
  String(row.relation_ddl_access), String(row.function_ddl_access),
  String(row.public_create), String(row.private_create), String(row.is_superuser)
];
if (values.some((value) => /[\t\r\n]/.test(value))) process.exit(6);
process.stdout.write(values.join("\t"));
'
}

check_runtime_publication_context() {
  local context_sql psql_context_sql expected_cli_current expected_cli_role_setting
  local cli_context_raw psql_context_raw cli_context_line psql_context_line
  local cli_session cli_current cli_role cli_role_setting cli_owner cli_owner_access cli_relation_access cli_function_access
  local cli_public_create cli_private_create cli_superuser
  local safe_session safe_current safe_owner
  local -a cli_context_fields=() psql_context_fields=()

  # `supabase db query` executes one prepared statement, so the read-only
  # identity probe must be a single SELECT. The migration executor calls
  # RESET ALL before each file; PostgreSQL does not reset the active role with
  # RESET ALL. The CLI connection hook sets SESSION ROLE postgres for
  # supabase_admin and cli_login_* users, which the disposable executor test
  # verifies against the actual `db push` connection.
  context_sql="select json_build_object(
    'marker', 'PROMOTION_CONTEXT_V1',
    'session_user', session_user::text,
    'current_user', current_user::text,
    'current_role', current_role::text,
    'role_setting', coalesce(nullif(current_setting('role', true), ''), 'none'),
    'candidate_owner', pg_get_userbyid(c.relowner)::text,
    'candidate_owner_access', (pg_has_role(current_user, c.relowner, 'USAGE') or r.rolsuper),
    'relation_ddl_access', not exists (
      select 1
        from (values
          ('learning_central_studies_v2_candidates'),
          ('learning_guided_session_events'),
          ('learning_skill_lessons'),
          ('learning_curriculum_skills'),
          ('learning_question_bank'),
          ('learning_question_sets'),
          ('learning_question_set_items')
        ) as target(relname)
        join pg_class object on object.relname = target.relname
        join pg_namespace object_schema on object_schema.oid = object.relnamespace
       where object_schema.nspname = 'public'
         and not (pg_has_role(current_user, object.relowner, 'USAGE') or r.rolsuper)
    ),
    'function_ddl_access', not exists (
      select 1
        from (values
          ('private.prevent_central_studies_v2_source_edits()'),
          ('private.central_studies_v2_student_can_read(text)'),
          ('private.enforce_central_studies_v2_qualified_review()'),
          ('private.enforce_central_studies_v2_active_release()'),
          ('private.central_studies_v2_journey_allowed(uuid,uuid,uuid,uuid)'),
          ('private.assert_bncc_discipline_journey_v9(uuid,uuid,uuid,uuid)'),
          ('public.list_student_central_studies_v2_journeys_v1(uuid,uuid)'),
          ('public.start_central_studies_v2_journey_v1(uuid,uuid,uuid)'),
          ('public.get_central_studies_v2_release_status_v1(text,text)'),
          ('public.get_central_studies_v2_institution_targets_v1(text,text)'),
          ('public.integrate_central_studies_v2_candidate_v1(text,text,text)'),
          ('public.review_central_studies_v2_candidate_v1(text,text,text,text,text,jsonb)'),
          ('public.publish_central_studies_v2_candidate_v1(text,text,text,text)'),
          ('public.unpublish_central_studies_v2_candidate_v1(text,text,text,text)'),
          ('public.set_central_studies_v2_institution_enabled_v1(text,text,text,uuid,uuid,boolean,text)')
        ) as target(signature)
        join pg_proc existing_function
          on existing_function.oid = to_regprocedure(target.signature)::oid
       where not (pg_has_role(current_user, existing_function.proowner, 'USAGE') or r.rolsuper)
    ),
    'public_create', has_schema_privilege(current_user, 'public', 'CREATE'),
    'private_create', has_schema_privilege(current_user, 'private', 'CREATE'),
    'is_superuser', r.rolsuper
  ) as context
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  join pg_roles r on r.rolname = current_user
  where n.nspname = 'public' and c.relname = 'learning_central_studies_v2_candidates';"

  expected_cli_current="${database_user}"
  expected_cli_role_setting='none'
  if [[ "${database_user}" == 'supabase_admin' || "${database_user}" == cli_login_* ]]; then
    expected_cli_current='postgres'
    expected_cli_role_setting='postgres'
    # Replay the CLI's documented AfterConnect role hook, then the migration
    # executor's RESET ALL, in a direct read-only identity probe. This proves
    # role availability and the post-reset context without changing objects.
    psql_context_sql="SET SESSION ROLE postgres; RESET ALL; ${context_sql}"
  else
    psql_context_sql="RESET ALL; ${context_sql}"
  fi

  if ! cli_context_raw="$(run_supabase_cli --workdir "${cli_workdir_arg}" db query \
    --db-url "${database_url}" --agent yes --output-format json --log-level error \
    "${context_sql}" 2>&1)"; then
    record_cli_failure precheck "${cli_context_raw}"
    printf 'DB_SESSION_USER=UNKNOWN\nDB_CURRENT_USER=UNKNOWN\nDDL_PERMISSION=UNKNOWN\n' >&2
    abort "Supabase CLI session precheck failed"
  fi
  if ! cli_context_line="$(parse_promotion_context "${cli_context_raw}" 2>/dev/null)"; then
    printf 'DB_SESSION_USER=UNKNOWN\nDB_CURRENT_USER=UNKNOWN\nDDL_PERMISSION=UNKNOWN\n' >&2
    abort "Supabase CLI session precheck returned an unreadable result"
  fi

  if ! psql_context_raw="$(PGUSER="${database_user}" PGPASSFILE="${pgpass_file}" \
    psql "${database_url}" -X -A -t -v ON_ERROR_STOP=1 -c "${psql_context_sql}")"; then
    printf 'DB_SESSION_USER=UNKNOWN\nDB_CURRENT_USER=UNKNOWN\nDDL_PERMISSION=UNKNOWN\n' >&2
    abort "direct PostgreSQL session precheck failed"
  fi
  if ! psql_context_line="$(parse_promotion_context "${psql_context_raw}" 2>/dev/null)"; then
    printf 'DB_SESSION_USER=UNKNOWN\nDB_CURRENT_USER=UNKNOWN\nDDL_PERMISSION=UNKNOWN\n' >&2
    abort "direct PostgreSQL session precheck returned an unreadable result"
  fi

  IFS=$'\t' read -r -a cli_context_fields <<< "${cli_context_line}"
  IFS=$'\t' read -r -a psql_context_fields <<< "${psql_context_line}"
  if [[ "${#cli_context_fields[@]}" -ne 11 || "${#psql_context_fields[@]}" -ne 11 ]]; then
    printf 'DB_SESSION_USER=UNKNOWN\nDB_CURRENT_USER=UNKNOWN\nDDL_PERMISSION=UNKNOWN\n' >&2
    abort "database session precheck did not return exactly one context row"
  fi

  cli_session="${cli_context_fields[0]}"
  cli_current="${cli_context_fields[1]}"
  cli_role="${cli_context_fields[2]}"
  cli_role_setting="${cli_context_fields[3]}"
  cli_owner="${cli_context_fields[4]}"
  cli_owner_access="${cli_context_fields[5]}"
  cli_relation_access="${cli_context_fields[6]}"
  cli_function_access="${cli_context_fields[7]}"
  cli_public_create="${cli_context_fields[8]}"
  cli_private_create="${cli_context_fields[9]}"
  cli_superuser="${cli_context_fields[10]}"

  safe_session='UNKNOWN'
  safe_current='UNKNOWN'
  safe_owner='UNKNOWN'
  [[ "${cli_session}" =~ ^[A-Za-z0-9_.-]+$ ]] && safe_session="${cli_session}"
  [[ "${cli_current}" =~ ^[A-Za-z0-9_.-]+$ ]] && safe_current="${cli_current}"
  [[ "${cli_owner}" =~ ^[A-Za-z0-9_.-]+$ ]] && safe_owner="${cli_owner}"
  printf 'DB_SESSION_USER=%s\n' "${safe_session}"
  printf 'DB_CURRENT_USER=%s\n' "${safe_current}"
  printf 'DB_CANDIDATE_OWNER=%s\n' "${safe_owner}"

  if [[ "${cli_context_line}" != "${psql_context_line}" ]]; then
    printf 'CLI_PSQL_CONTEXT_MATCH=NO\nDDL_PERMISSION=FAIL\n' >&2
    abort "Supabase CLI and direct PostgreSQL session contexts differ"
  fi
  if [[ "${cli_session}" != "${database_user}" || \
    "${cli_current}" != "${expected_cli_current}" || \
    "${cli_role}" != "${cli_current}" || \
    "${cli_role_setting}" != "${expected_cli_role_setting}" ]]; then
    printf 'CLI_PSQL_CONTEXT_MATCH=YES\nDDL_PERMISSION=FAIL\n' >&2
    abort "Supabase CLI effective role differs from the verified migration role"
  fi
  if [[ "${cli_owner_access}" != 'true' || \
    "${cli_relation_access}" != 'true' || \
    "${cli_function_access}" != 'true' || \
    ( "${cli_public_create}" != 'true' && "${cli_superuser}" != 'true' ) || \
    ( "${cli_private_create}" != 'true' && "${cli_superuser}" != 'true' ) ]]; then
    printf 'CLI_PSQL_CONTEXT_MATCH=YES\nDDL_PERMISSION=FAIL\n' >&2
    abort "database role lacks ownership or schema privileges required by migration 007"
  fi

  printf 'DB_CURRENT_ROLE=%s\n' "${safe_current}"
  printf 'DB_ROLE_SETTING=%s\n' "${cli_role_setting}"
  printf 'DDL_PERMISSION=PASS\n'
  printf 'CLI_PSQL_CONTEXT_MATCH=YES\n'
  printf 'PRECHECK=PASS\n'
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

if [[ "${target_version}" == '20261025000700' ]]; then
  check_runtime_publication_context
fi

if [[ -n "${DRY_RUN_OUTPUT_FILE:-}" ]]; then
  [[ -f "${DRY_RUN_OUTPUT_FILE}" ]] || abort "dry-run fixture is missing"
  dry_run_output="$(cat "${DRY_RUN_OUTPUT_FILE}")"
else
  printf 'PROMOTION_STAGE=DRY_RUN_START\n' >&2
  if ! dry_run_output="$(run_supabase_cli --workdir "${cli_workdir_arg}" db push --db-url "${database_url}" "${include_all_flag[@]}" --yes --dry-run --log-level error 2>&1)"; then
    record_cli_failure dry-run "${dry_run_output}"
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

if [[ "${APPLY:-0}" != '1' ]]; then
  printf 'PROMOTION=DRY_RUN_ONLY\n'
  exit 0
fi

authorize_production_write

printf 'PROMOTION_STAGE=APPLY_START\n' >&2
if ! apply_output="$(run_supabase_cli --workdir "${cli_workdir_arg}" db push --db-url "${database_url}" "${include_all_flag[@]}" --yes --log-level error 2>&1)"; then
  record_cli_failure apply "${apply_output}"
  abort_after_apply "selective migration push failed: $(safe_cli_failure_class "${apply_output}")"
fi
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
