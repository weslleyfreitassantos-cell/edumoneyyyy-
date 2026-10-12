#!/usr/bin/env bash
set -euo pipefail
set +x

abort() {
  printf 'PROMOTION_ABORTED=%s\n' "${1}" >&2
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

mapfile -t target_files < <(find "${repo_root}/supabase/migrations" -maxdepth 1 -type f -name "${target_version}_*.sql" -print)
[[ "${#target_files[@]}" -eq 1 ]] || abort "target migration must resolve to exactly one file"
target_file="${target_files[0]}"
actual_target_sha256="$(sha256_file "${target_file}")"
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

cli_binary_override="${SUPABASE_CLI_BINARY_OVERRIDE:-}"
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
  if ! dry_run_output="$(run_supabase_cli --workdir "${cli_workdir_arg}" db push --db-url "${database_url}" --dry-run --log-level error 2>&1)"; then
    abort "supabase dry-run failed: $(safe_cli_failure_class "${dry_run_output}")"
  fi
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

[[ "${BACKUP_GATE:-}" == 'PASS' ]] || abort "backup gate is not PASS"
[[ "${CONFIRM_PRODUCTION_WRITE:-}" == 'I_CONFIRM_SELECTIVE_PRODUCTION_MIGRATION' ]] || \
  abort "production write confirmation is missing"

apply_output="$(run_supabase_cli --workdir "${cli_workdir_arg}" db push --db-url "${database_url}" --yes --log-level error 2>&1)" \
  || abort "selective migration push failed: $(safe_cli_failure_class "${apply_output}")"

after_output="$(PGUSER="${database_user}" PGPASSFILE="${pgpass_file}" psql "${database_url}" -X -A -t -v ON_ERROR_STOP=1 -c \
  "select count(*) || '|' || max(version) from supabase_migrations.schema_migrations;")" \
  || abort "post-promotion ledger inspection failed"
expected_after_count=$(( ${#remote_versions[@]} + 1 ))
expected_after="${expected_after_count}|${target_version}"
[[ "${after_output}" == "${expected_after}" ]] || abort "post-promotion ledger does not match target"
unset database_password
printf 'PROMOTION=APPLIED\n'
printf 'REMOTE_AFTER_COUNT=%s\n' "${expected_after_count}"
printf 'REMOTE_AFTER_LAST=%s\n' "${target_version}"
