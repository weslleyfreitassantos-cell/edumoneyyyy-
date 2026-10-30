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

# Release #399's previously approved alternative recovery proof remains
# isolated from the PR #409 local-only proof below.
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
psychology_409_branch='codex/psychology-gate-ux'
psychology_409_version='20261026000100'
psychology_409_sha256='bf70b07ce66330b13ab35b2da5d524458fbf723258bd1cb5cb3eda847ca613ea'
psychology_409_expected_remote_last='20261025000600'
psychology_409_offsite_status='FAIL'
psychology_409_origin_https='https://github.com/weslleyfreitassantos-cell/edumoneyyyy-.git'
psychology_409_origin_ssh='git@github.com:weslleyfreitassantos-cell/edumoneyyyy-.git'
psychology_411_branch='codex/psychology-school-staff-access'
psychology_411_version='20261026000200'
psychology_411_sha256='da7db8e6ef8d635068ff34a3a1f2ccd4f0c5a4ce6b8a8d753203dc885aa075aa'
psychology_411_expected_remote_last='20261026000100'
psychology_411_origin_https='https://github.com/weslleyfreitassantos-cell/edumoneyyyy-.git'
psychology_411_origin_ssh='git@github.com:weslleyfreitassantos-cell/edumoneyyyy-.git'
tec_english_412_branch='codex/tec-english-v2-adaptive'
tec_english_412_version='20261026000300'
tec_english_412_sha256='6819fc02ecb0897b93b845dcfb2475da75193ff90f06f3de7d373cdd76f3063e'
tec_english_412_expected_remote_last='20261026000200'
tec_english_412_offsite_status='FAIL'
tec_english_412_storage_status='PARTIAL'
tec_english_412_origin_https='https://github.com/weslleyfreitassantos-cell/edumoneyyyy-.git'
tec_english_412_origin_ssh='git@github.com:weslleyfreitassantos-cell/edumoneyyyy-.git'
tec_idiomas_414_branch='codex/tec-idiomas-v3'
tec_idiomas_414_version='20261027000100'
tec_idiomas_414_sha256='905cd1820e0496a3eb4f618f7951f636f93ffa4292c0f3eac68b7a53ec6c9813'
tec_idiomas_414_expected_remote_last='20261026000300'
tec_idiomas_414_origin_https='https://github.com/weslleyfreitassantos-cell/edumoneyyyy-.git'
tec_idiomas_414_origin_ssh='git@github.com:weslleyfreitassantos-cell/edumoneyyyy-.git'
tec_idiomas_418_branch='codex/tec-idiomas-v4-absolute-beginners'
tec_idiomas_418_version='20261029000100'
tec_idiomas_418_sha256='7c50f53b44605f62140abf3be630e9d7697f868dae8d4fd2cbe9d57fd97000e7'
tec_idiomas_418_expected_remote_last='20261027000100'
tec_idiomas_418_placement_version='20261029000200'
tec_idiomas_418_placement_sha256='FDED3483F8A17E652CE7301A2F99A90D5B2C18358DEEEABDF9BAE3AA43C71FB9'
tec_idiomas_418_placement_expected_remote_last='20261029000100'
tec_idiomas_418_origin_https='https://github.com/weslleyfreitassantos-cell/edumoneyyyy-.git'
tec_idiomas_418_origin_ssh='git@github.com:weslleyfreitassantos-cell/edumoneyyyy-.git'
tec_idiomas_424_branch='codex/tec-idiomas-v6-4-release-validation'
tec_idiomas_424_version='20261030000100'
tec_idiomas_424_sha256='39d60fde95d440bcf7c771de36c1a838f750957089db98c3908b093976846780'
tec_idiomas_424_expected_remote_last='20261029000200'
tec_idiomas_424_origin_https='https://github.com/weslleyfreitassantos-cell/edumoneyyyy-.git'
tec_idiomas_424_origin_ssh='git@github.com:weslleyfreitassantos-cell/edumoneyyyy-.git'
tec_idiomas_425_branch='codex/tec-idiomas-explicit-release-gate-v7'
tec_idiomas_425_version='20261030000200'
tec_idiomas_425_sha256='e85d4a1efdf1256144e929ae8daad2a0fd57e9b0b13b3c5f821d13368f00979e'
tec_idiomas_425_expected_remote_last='20261030000100'
tec_idiomas_425_origin_https='https://github.com/weslleyfreitassantos-cell/edumoneyyyy-.git'
tec_idiomas_425_origin_ssh='git@github.com:weslleyfreitassantos-cell/edumoneyyyy-.git'

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
python3_bin="${PYTHON3_BIN:-python3}"

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

backup_exception='NOT_USED'
backup_exception_backup_sha256=''
backup_exception_backup_bytes=''
backup_exception_restore_verified_at=''

validate_backup_gate() {
  local backup_file="${BACKUP_EXCEPTION_BACKUP_FILE:-}"
  local expected_release_migration_sha=""
  local actual_backup_sha=""
  local current_branch=""
  local origin_url=""
  local receipt_file=""
  local storage_receipt_file=""
  local proof_output=""
  local storage_proof_output=""

  case "${BACKUP_GATE:-}" in
    PASS)
      backup_exception='NOT_USED'
      ;;
    FAIL)
      case "${BACKUP_EXCEPTION_PR:-}" in
        399)
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
          backup_exception='RELEASE_399_ACCEPTED'
          backup_exception_backup_sha256="${actual_backup_sha}"
          ;;
        409)
          [[ "${target_version}" == "${psychology_409_version}" && \
            "${expected_remote_last}" == "${psychology_409_expected_remote_last}" ]] || \
            abort "PR #409 exception is restricted to migration 20261026000100 after 20261025000600"
          [[ "${expected_target_sha256}" == "${psychology_409_sha256}" && \
            "${actual_target_sha256}" == "${psychology_409_sha256}" ]] || \
            abort "PR #409 exception target hash does not match the approved Psychology migration"
          current_branch="$(git -C "${repo_root}" branch --show-current 2>/dev/null)" || \
            abort "cannot verify the PR #409 source branch"
          [[ "${current_branch}" == "${psychology_409_branch}" ]] || \
            abort "PR #409 exception is restricted to branch ${psychology_409_branch}"
          origin_url="$(git -C "${repo_root}" remote get-url origin 2>/dev/null)" || \
            abort "cannot verify the PR #409 repository"
          [[ "${origin_url}" == "${psychology_409_origin_https}" || \
            "${origin_url}" == "${psychology_409_origin_ssh}" ]] || \
            abort "PR #409 exception is restricted to the canonical Tec Escola repository"
          [[ "${BACKUP_EXCEPTION_OFFSITE_STATUS:-}" == "${psychology_409_offsite_status}" ]] || \
            abort "PR #409 local-only exception must record OFFSITE as FAIL"
          [[ -n "${backup_file}" && -f "${backup_file}" ]] || \
            abort "recent local backup file is unavailable"
          receipt_file="${BACKUP_EXCEPTION_RESTORE_RECEIPT_FILE:-}"
          [[ -n "${receipt_file}" && -f "${receipt_file}" ]] || \
            abort "isolated PostgreSQL restore proof receipt is unavailable"
          command -v "${python3_bin}" >/dev/null 2>&1 || abort "python3 is required to validate the local recovery proof"
          proof_output="$("${python3_bin}" "${repo_root}/ops/backup/verify-local-recovery-proof.py" \
            --backup-file "${backup_file}" \
            --receipt-file "${receipt_file}" \
            --expected-sha256 "${BACKUP_EXCEPTION_BACKUP_SHA256:-}" \
            --repo-root "${repo_root}" \
            --bundle-verifier "${repo_root}/ops/backup/verify-edumoney-bundle-stream.py" 2>&1)" || \
            abort "local backup or isolated restore proof is invalid"
          grep -Fxq 'LOCAL_RECOVERY_PROOF=PASS' <<< "${proof_output}" || \
            abort "local recovery proof did not report PASS"
          backup_exception_backup_sha256="$(awk -F= '$1 == "BACKUP_SHA256" {print substr($0, index($0, "=") + 1)}' <<< "${proof_output}")"
          backup_exception_backup_bytes="$(awk -F= '$1 == "BACKUP_BYTES" {print substr($0, index($0, "=") + 1)}' <<< "${proof_output}")"
          backup_exception_restore_verified_at="$(awk -F= '$1 == "RESTORE_VERIFIED_AT_UTC" {print substr($0, index($0, "=") + 1)}' <<< "${proof_output}")"
          [[ -n "${backup_exception_backup_sha256}" && -n "${backup_exception_backup_bytes}" && \
            -n "${backup_exception_restore_verified_at}" ]] || \
            abort "local recovery proof returned incomplete evidence"
          backup_exception='PR409_LOCAL_ONLY'
          ;;
        411)
          [[ "${target_version}" == "${psychology_411_version}" && \
            "${expected_remote_last}" == "${psychology_411_expected_remote_last}" ]] || \
            abort "PR #411 exception is restricted to migration 20261026000200 after 20261026000100"
          [[ "${expected_target_sha256,,}" == "${psychology_411_sha256}" && \
            "${actual_target_sha256,,}" == "${psychology_411_sha256}" ]] || \
            abort "PR #411 exception target hash does not match the approved Psychology migration"
          current_branch="$(git -C "${repo_root}" branch --show-current 2>/dev/null)" || \
            abort "cannot verify the PR #411 source branch"
          [[ "${current_branch}" == "${psychology_411_branch}" ]] || \
            abort "PR #411 exception is restricted to branch ${psychology_411_branch}"
          origin_url="$(git -C "${repo_root}" remote get-url origin 2>/dev/null)" || \
            abort "cannot verify the PR #411 repository"
          [[ "${origin_url}" == "${psychology_411_origin_https}" || \
            "${origin_url}" == "${psychology_411_origin_ssh}" ]] || \
            abort "PR #411 exception is restricted to the canonical Tec Escola repository"
          [[ "${BACKUP_EXCEPTION_OFFSITE_STATUS:-}" == 'FAIL' ]] || \
            abort "PR #411 local-only exception must record OFFSITE as FAIL"
          [[ "${BACKUP_EXCEPTION_STORAGE_STATUS:-}" == 'PARTIAL' ]] || \
            abort "PR #411 local-only exception must record Storage recovery as PARTIAL"
          [[ "${ACCEPT_INCOMPLETE_RECOVERY_RISK:-}" == 'I_ACCEPT_LOCAL_ONLY_RECOVERY_RISK_FOR_PR_411' ]] || \
            abort "explicit PR #411 local-only recovery risk acceptance is missing"
          [[ -n "${backup_file}" && -f "${backup_file}" ]] || \
            abort "recent local backup file is unavailable"
          receipt_file="${BACKUP_EXCEPTION_RESTORE_RECEIPT_FILE:-}"
          [[ -n "${receipt_file}" && -f "${receipt_file}" ]] || \
            abort "isolated PostgreSQL restore proof receipt is unavailable"
          command -v "${python3_bin}" >/dev/null 2>&1 || abort "python3 is required to validate the local recovery proof"
          proof_output="$("${python3_bin}" "${repo_root}/ops/backup/verify-local-recovery-proof.py" \
            --backup-file "${backup_file}" \
            --receipt-file "${receipt_file}" \
            --expected-sha256 "${BACKUP_EXCEPTION_BACKUP_SHA256:-}" \
            --repo-root "${repo_root}" \
            --bundle-verifier "${repo_root}/ops/backup/verify-edumoney-bundle-stream.py" 2>&1)" || \
            abort "PR #411 local backup or isolated restore proof is invalid"
          grep -Fxq 'LOCAL_RECOVERY_PROOF=PASS' <<< "${proof_output}" || \
            abort "PR #411 local recovery proof did not report PASS"
          backup_exception_backup_sha256="$(awk -F= '$1 == "BACKUP_SHA256" {print substr($0, index($0, "=") + 1)}' <<< "${proof_output}")"
          backup_exception_backup_bytes="$(awk -F= '$1 == "BACKUP_BYTES" {print substr($0, index($0, "=") + 1)}' <<< "${proof_output}")"
          backup_exception_restore_verified_at="$(awk -F= '$1 == "RESTORE_VERIFIED_AT_UTC" {print substr($0, index($0, "=") + 1)}' <<< "${proof_output}")"
          [[ -n "${backup_exception_backup_sha256}" && -n "${backup_exception_backup_bytes}" && \
            -n "${backup_exception_restore_verified_at}" ]] || \
            abort "PR #411 local recovery proof returned incomplete evidence"
          backup_exception='PR411_LOCAL_ONLY'
          ;;
        412)
          [[ "${target_version}" == "${tec_english_412_version}" && \
            "${expected_remote_last}" == "${tec_english_412_expected_remote_last}" ]] || \
            abort "PR #412 exception is restricted to migration 20261026000300 after 20261026000200"
          [[ "${expected_target_sha256,,}" == "${tec_english_412_sha256}" && \
            "${actual_target_sha256,,}" == "${tec_english_412_sha256}" ]] || \
            abort "PR #412 exception target hash does not match the approved Tec Inglês V2 migration"
          current_branch="$(git -C "${repo_root}" branch --show-current 2>/dev/null)" || \
            abort "cannot verify the PR #412 source branch"
          [[ "${current_branch}" == "${tec_english_412_branch}" ]] || \
            abort "PR #412 exception is restricted to branch ${tec_english_412_branch}"
          origin_url="$(git -C "${repo_root}" remote get-url origin 2>/dev/null)" || \
            abort "cannot verify the PR #412 repository"
          [[ "${origin_url}" == "${tec_english_412_origin_https}" || \
            "${origin_url}" == "${tec_english_412_origin_ssh}" ]] || \
            abort "PR #412 exception is restricted to the canonical Tec Escola repository"
          [[ "${BACKUP_EXCEPTION_OFFSITE_STATUS:-}" == "${tec_english_412_offsite_status}" ]] || \
            abort "PR #412 local-only exception must record OFFSITE as FAIL"
          [[ "${BACKUP_EXCEPTION_STORAGE_STATUS:-}" == "${tec_english_412_storage_status}" ]] || \
            abort "PR #412 local-only exception must record Storage recovery as PARTIAL"
          [[ "${ACCEPT_INCOMPLETE_RECOVERY_RISK:-}" == 'I_ACCEPT_LOCAL_ONLY_RECOVERY_RISK_FOR_PR_412' ]] || \
            abort "explicit PR #412 local-only recovery risk acceptance is missing"
          [[ -n "${backup_file}" && -f "${backup_file}" ]] || \
            abort "PR #412 recent local backup file is unavailable"
          receipt_file="${BACKUP_EXCEPTION_RESTORE_RECEIPT_FILE:-}"
          [[ -n "${receipt_file}" && -f "${receipt_file}" ]] || \
            abort "PR #412 isolated PostgreSQL restore proof receipt is unavailable"
          command -v "${python3_bin}" >/dev/null 2>&1 || abort "python3 is required to validate the PR #412 local recovery proof"
          proof_output="$("${python3_bin}" "${repo_root}/ops/backup/verify-local-recovery-proof.py" \
            --backup-file "${backup_file}" \
            --receipt-file "${receipt_file}" \
            --expected-sha256 "${BACKUP_EXCEPTION_BACKUP_SHA256:-}" \
            --repo-root "${repo_root}" \
            --bundle-verifier "${repo_root}/ops/backup/verify-edumoney-bundle-stream.py" 2>&1)" || \
            abort "PR #412 local backup or isolated restore proof is invalid"
          grep -Fxq 'LOCAL_RECOVERY_PROOF=PASS' <<< "${proof_output}" || \
            abort "PR #412 local recovery proof did not report PASS"
          backup_exception_backup_sha256="$(awk -F= '$1 == "BACKUP_SHA256" {print substr($0, index($0, "=") + 1)}' <<< "${proof_output}")"
          backup_exception_backup_bytes="$(awk -F= '$1 == "BACKUP_BYTES" {print substr($0, index($0, "=") + 1)}' <<< "${proof_output}")"
          backup_exception_restore_verified_at="$(awk -F= '$1 == "RESTORE_VERIFIED_AT_UTC" {print substr($0, index($0, "=") + 1)}' <<< "${proof_output}")"
          [[ -n "${backup_exception_backup_sha256}" && -n "${backup_exception_backup_bytes}" && \
            -n "${backup_exception_restore_verified_at}" ]] || \
            abort "PR #412 local recovery proof returned incomplete evidence"
          backup_exception='PR412_LOCAL_ONLY'
          ;;
        414)
          [[ "${target_version}" == "${tec_idiomas_414_version}" && \
            "${expected_remote_last}" == "${tec_idiomas_414_expected_remote_last}" ]] || \
            abort "PR #414 exception is restricted to migration 20261027000100 after 20261026000300"
          [[ "${expected_target_sha256,,}" == "${tec_idiomas_414_sha256}" && \
            "${actual_target_sha256,,}" == "${tec_idiomas_414_sha256}" ]] || \
            abort "PR #414 exception target hash does not match the approved Tec Idiomas V3 migration"
          [[ "${BACKUP_EXCEPTION_SOURCE_SHA:-}" == "${expected_source_commit}" && \
            "${actual_source_commit}" == "${expected_source_commit}" ]] || \
            abort "PR #414 exception requires the exact source commit supplied to the promoter"
          current_branch="$(git -C "${repo_root}" branch --show-current 2>/dev/null)" || \
            abort "cannot verify the PR #414 source branch"
          [[ "${current_branch}" == "${tec_idiomas_414_branch}" ]] || \
            abort "PR #414 exception is restricted to branch ${tec_idiomas_414_branch}"
          origin_url="$(git -C "${repo_root}" remote get-url origin 2>/dev/null)" || \
            abort "cannot verify the PR #414 repository"
          [[ "${origin_url}" == "${tec_idiomas_414_origin_https}" || \
            "${origin_url}" == "${tec_idiomas_414_origin_ssh}" ]] || \
            abort "PR #414 exception is restricted to the canonical Tec Escola repository"
          [[ "${BACKUP_EXCEPTION_OFFSITE_STATUS:-}" == 'FAIL' ]] || \
            abort "PR #414 local-only exception must preserve OFFSITE as FAIL"
          [[ "${BACKUP_EXCEPTION_STORAGE_STATUS:-}" == 'PARTIAL' ]] || \
            abort "PR #414 local-only exception must preserve production Storage as PARTIAL"
          [[ "${ACCEPT_INCOMPLETE_RECOVERY_RISK:-}" == 'ACCEPT_LOCAL_ONLY_RECOVERY_RISK_FOR_PR_414' ]] || \
            abort "explicit PR #414 local-only recovery risk acceptance is missing"
          [[ -n "${backup_file}" && -f "${backup_file}" ]] || \
            abort "PR #414 local backup file is unavailable"
          receipt_file="${BACKUP_EXCEPTION_RESTORE_RECEIPT_FILE:-}"
          [[ -n "${receipt_file}" && -f "${receipt_file}" ]] || \
            abort "PR #414 isolated PostgreSQL restore proof receipt is unavailable"
          storage_receipt_file="${BACKUP_EXCEPTION_STORAGE_RECEIPT_FILE:-}"
          [[ -n "${storage_receipt_file}" && -f "${storage_receipt_file}" ]] || \
            abort "PR #414 isolated Storage restore proof receipt is unavailable"
          command -v "${python3_bin}" >/dev/null 2>&1 || abort "python3 is required to validate PR #414 local recovery proofs"
          proof_output="$("${python3_bin}" "${repo_root}/ops/backup/verify-local-recovery-proof.py" \
            --backup-file "${backup_file}" \
            --receipt-file "${receipt_file}" \
            --expected-sha256 "${BACKUP_EXCEPTION_BACKUP_SHA256:-}" \
            --repo-root "${repo_root}" \
            --bundle-verifier "${repo_root}/ops/backup/verify-edumoney-bundle-stream.py" 2>&1)" || \
            abort "PR #414 local backup or isolated PostgreSQL restore proof is invalid"
          grep -Fxq 'LOCAL_RECOVERY_PROOF=PASS' <<< "${proof_output}" || \
            abort "PR #414 PostgreSQL recovery proof did not report PASS"
          storage_proof_output="$("${python3_bin}" "${repo_root}/ops/backup/verify-local-storage-recovery-proof.py" \
            --backup-file "${backup_file}" \
            --receipt-file "${storage_receipt_file}" \
            --expected-sha256 "${BACKUP_EXCEPTION_BACKUP_SHA256:-}" \
            --repo-root "${repo_root}" 2>&1)" || \
            abort "PR #414 local isolated Storage restore proof is invalid"
          grep -Fxq 'LOCAL_STORAGE_RECOVERY_PROOF=PASS' <<< "${storage_proof_output}" || \
            abort "PR #414 Storage recovery proof did not report PASS"
          backup_exception_backup_sha256="$(awk -F= '$1 == "BACKUP_SHA256" {print substr($0, index($0, "=") + 1)}' <<< "${proof_output}")"
          backup_exception_backup_bytes="$(awk -F= '$1 == "BACKUP_BYTES" {print substr($0, index($0, "=") + 1)}' <<< "${proof_output}")"
          backup_exception_restore_verified_at="$(awk -F= '$1 == "RESTORE_VERIFIED_AT_UTC" {print substr($0, index($0, "=") + 1)}' <<< "${proof_output}")"
          [[ -n "${backup_exception_backup_sha256}" && -n "${backup_exception_backup_bytes}" && \
            -n "${backup_exception_restore_verified_at}" ]] || \
            abort "PR #414 local recovery proof returned incomplete evidence"
          backup_exception='PR414_LOCAL_ONLY'
          ;;
        418)
          case "${target_version}" in
            "${tec_idiomas_418_version}")
              [[ "${expected_remote_last}" == "${tec_idiomas_418_expected_remote_last}" ]] || \
                abort "PR #418 V4 migration must follow 20261027000100"
              [[ "${expected_target_sha256,,}" == "${tec_idiomas_418_sha256}" && \
                "${actual_target_sha256,,}" == "${tec_idiomas_418_sha256}" ]] || \
                abort "PR #418 V4 migration hash does not match the approved artifact"
              ;;
            "${tec_idiomas_418_placement_version}")
              [[ "${expected_remote_last}" == "${tec_idiomas_418_placement_expected_remote_last}" ]] || \
                abort "PR #418 placement migration must follow 20261029000100"
              [[ "${expected_target_sha256,,}" == "${tec_idiomas_418_placement_sha256,,}" && \
                "${actual_target_sha256,,}" == "${tec_idiomas_418_placement_sha256,,}" ]] || \
                abort "PR #418 placement migration hash does not match the approved artifact"
              ;;
            *)
              abort "PR #418 exception does not authorize this migration"
              ;;
          esac
          [[ "${BACKUP_EXCEPTION_SOURCE_SHA:-}" == "${expected_source_commit}" && \
            "${actual_source_commit}" == "${expected_source_commit}" ]] || \
            abort "PR #418 exception requires the exact source commit supplied to the promoter"
          current_branch="$(git -C "${repo_root}" branch --show-current 2>/dev/null)" || \
            abort "cannot verify the PR #418 source branch"
          [[ "${current_branch}" == "${tec_idiomas_418_branch}" ]] || \
            abort "PR #418 exception is restricted to branch ${tec_idiomas_418_branch}"
          origin_url="$(git -C "${repo_root}" remote get-url origin 2>/dev/null)" || \
            abort "cannot verify the PR #418 repository"
          [[ "${origin_url}" == "${tec_idiomas_418_origin_https}" || \
            "${origin_url}" == "${tec_idiomas_418_origin_ssh}" ]] || \
            abort "PR #418 exception is restricted to the canonical Tec Escola repository"
          [[ "${BACKUP_EXCEPTION_OFFSITE_STATUS:-}" == 'FAIL' ]] || \
            abort "PR #418 risk exception must preserve OFFSITE as FAIL"
          [[ "${BACKUP_EXCEPTION_STORAGE_STATUS:-}" == 'PARTIAL' ]] || \
            abort "PR #418 risk exception must preserve Storage recovery as PARTIAL"
          [[ "${ACCEPT_INCOMPLETE_RECOVERY_RISK:-}" == 'I_ACCEPT_INCOMPLETE_RECOVERY_RISK_FOR_PR_418' ]] || \
            abort "explicit PR #418 incomplete-recovery risk acceptance is missing"
          backup_exception='PR418_SCOPED_RISK_ACCEPTANCE'
          ;;
        424)
          [[ "${target_version}" == "${tec_idiomas_424_version}" && \
            "${expected_remote_last}" == "${tec_idiomas_424_expected_remote_last}" ]] || \
            abort "PR #424 exception is restricted to migration 20261030000100 after 20261029000200"
          [[ "${expected_target_sha256,,}" == "${tec_idiomas_424_sha256}" && \
            "${actual_target_sha256,,}" == "${tec_idiomas_424_sha256}" ]] || \
            abort "PR #424 exception target hash does not match the authorized Tec Idiomas V6.3 migration"
          [[ "${BACKUP_EXCEPTION_SOURCE_SHA:-}" == "${expected_source_commit}" && \
            "${actual_source_commit}" == "${expected_source_commit}" ]] || \
            abort "PR #424 exception requires the exact source commit supplied to the promoter"
          current_branch="$(git -C "${repo_root}" branch --show-current 2>/dev/null)" || \
            abort "cannot verify the PR #424 source branch"
          [[ "${current_branch}" == "${tec_idiomas_424_branch}" ]] || \
            abort "PR #424 exception is restricted to branch ${tec_idiomas_424_branch}"
          origin_url="$(git -C "${repo_root}" remote get-url origin 2>/dev/null)" || \
            abort "cannot verify the PR #424 repository"
          [[ "${origin_url}" == "${tec_idiomas_424_origin_https}" || \
            "${origin_url}" == "${tec_idiomas_424_origin_ssh}" ]] || \
            abort "PR #424 exception is restricted to the canonical Tec Escola repository"
          [[ "${BACKUP_EXCEPTION_OFFSITE_STATUS:-}" == 'FAIL' ]] || \
            abort "PR #424 scoped authorization must preserve OFFSITE as FAIL"
          [[ "${BACKUP_EXCEPTION_STORAGE_STATUS:-}" == 'PARTIAL' ]] || \
            abort "PR #424 scoped authorization must preserve Storage recovery as PARTIAL"
          [[ "${BACKUP_EXCEPTION_AUTHORIZATION:-}" == 'TECESCOLA_V65_PR424_20261030000100' ]] || \
            abort "PR #424 exact migration authorization is missing"
          backup_exception='PR424_SCOPED_MIGRATION_AUTHORIZATION'
          ;;
        425)
          [[ "${target_version}" == "${tec_idiomas_425_version}" && \
            "${expected_remote_last}" == "${tec_idiomas_425_expected_remote_last}" ]] || \
            abort "PR #425 exception is restricted to migration 20261030000200 after 20261030000100"
          [[ "${expected_target_sha256,,}" == "${tec_idiomas_425_sha256}" && \
            "${actual_target_sha256,,}" == "${tec_idiomas_425_sha256}" ]] || \
            abort "PR #425 exception target hash does not match the authorized V8 technical publication migration"
          [[ "${BACKUP_EXCEPTION_SOURCE_SHA:-}" == "${expected_source_commit}" && \
            "${actual_source_commit}" == "${expected_source_commit}" ]] || \
            abort "PR #425 exception requires the exact source commit supplied to the promoter"
          current_branch="$(git -C "${repo_root}" branch --show-current 2>/dev/null)" || \
            abort "cannot verify the PR #425 source branch"
          [[ "${current_branch}" == "${tec_idiomas_425_branch}" ]] || \
            abort "PR #425 exception is restricted to branch ${tec_idiomas_425_branch}"
          origin_url="$(git -C "${repo_root}" remote get-url origin 2>/dev/null)" || \
            abort "cannot verify the PR #425 repository"
          [[ "${origin_url}" == "${tec_idiomas_425_origin_https}" || \
            "${origin_url}" == "${tec_idiomas_425_origin_ssh}" ]] || \
            abort "PR #425 exception is restricted to the canonical Tec Escola repository"
          [[ "${BACKUP_EXCEPTION_OFFSITE_STATUS:-}" == 'FAIL' ]] || \
            abort "PR #425 scoped authorization must preserve OFFSITE as FAIL"
          [[ "${BACKUP_EXCEPTION_STORAGE_STATUS:-}" == 'PARTIAL' ]] || \
            abort "PR #425 scoped authorization must preserve Storage recovery as PARTIAL"
          [[ "${BACKUP_EXCEPTION_AUTHORIZATION:-}" == 'TECESCOLA_V8_PR425_20261030000200' ]] || \
            abort "PR #425 exact migration authorization is missing"
          backup_exception='PR425_SCOPED_MIGRATION_AUTHORIZATION'
          ;;
        *)
          abort "backup gate is FAIL and no narrowly scoped exception was selected"
          ;;
      esac
      ;;
    *)
      abort "backup gate must be PASS or the release-scoped FAIL exception"
      ;;
  esac
}

authorize_production_write() {
  if [[ "${backup_exception}" == 'PR409_LOCAL_ONLY' ]]; then
    [[ "${CONFIRM_PRODUCTION_WRITE:-}" == 'I_CONFIRM_PR409_SELECTIVE_PRODUCTION_MIGRATION' ]] || \
      abort "PR #409 production write requires its specific migration authorization"
    [[ "${ACCEPT_NO_OFFSITE_COPY:-}" == 'I_ACCEPT_NO_OFFSITE_COPY_FOR_PR_409' ]] || \
      abort "PR #409 production write requires explicit acceptance of the missing offsite copy"
  elif [[ "${backup_exception}" == 'PR411_LOCAL_ONLY' ]]; then
    [[ "${CONFIRM_PRODUCTION_WRITE:-}" == 'I_CONFIRM_PR411_SINGLE_MIGRATION_20261026000200' ]] || \
      abort "PR #411 production write requires its single-migration confirmation"
    [[ "${ACCEPT_NO_OFFSITE_COPY:-}" == 'I_ACCEPT_NO_OFFSITE_COPY_FOR_PR_411' ]] || \
      abort "PR #411 production write requires explicit acceptance of the missing offsite copy"
    [[ "${ACCEPT_INCOMPLETE_RECOVERY_RISK:-}" == 'I_ACCEPT_LOCAL_ONLY_RECOVERY_RISK_FOR_PR_411' ]] || \
      abort "PR #411 production write requires explicit acceptance of local-only recovery risk"
  elif [[ "${backup_exception}" == 'PR412_LOCAL_ONLY' ]]; then
    [[ "${CONFIRM_PRODUCTION_WRITE:-}" == 'I_CONFIRM_PR412_SINGLE_MIGRATION_20261026000300' ]] || \
      abort "PR #412 production write requires its separate single-migration authorization"
    [[ "${ACCEPT_INCOMPLETE_RECOVERY_RISK:-}" == 'I_ACCEPT_LOCAL_ONLY_RECOVERY_RISK_FOR_PR_412' ]] || \
      abort "PR #412 production write requires explicit acceptance of local-only recovery risk"
  elif [[ "${backup_exception}" == 'PR414_LOCAL_ONLY' ]]; then
    [[ "${CONFIRM_PRODUCTION_WRITE:-}" == 'I_CONFIRM_PR414_SINGLE_MIGRATION_20261027000100' ]] || \
      abort "PR #414 production write requires its separate single-migration authorization"
    [[ "${ACCEPT_INCOMPLETE_RECOVERY_RISK:-}" == 'ACCEPT_LOCAL_ONLY_RECOVERY_RISK_FOR_PR_414' ]] || \
      abort "PR #414 production write requires explicit acceptance of local-only recovery risk"
  elif [[ "${backup_exception}" == 'PR418_SCOPED_RISK_ACCEPTANCE' ]]; then
    local expected_confirmation=''
    case "${target_version}" in
      "${tec_idiomas_418_version}") expected_confirmation='I_CONFIRM_PR418_SINGLE_MIGRATION_20261029000100' ;;
      "${tec_idiomas_418_placement_version}") expected_confirmation='I_CONFIRM_PR418_SINGLE_MIGRATION_20261029000200' ;;
      *) abort "PR #418 production write is not authorized for this migration" ;;
    esac
    [[ "${CONFIRM_PRODUCTION_WRITE:-}" == "${expected_confirmation}" ]] || \
      abort "PR #418 production write requires its separate single-migration authorization"
    [[ "${ACCEPT_INCOMPLETE_RECOVERY_RISK:-}" == 'I_ACCEPT_INCOMPLETE_RECOVERY_RISK_FOR_PR_418' ]] || \
      abort "PR #418 production write requires explicit acceptance of incomplete-recovery risk"
  elif [[ "${backup_exception}" == 'PR424_SCOPED_MIGRATION_AUTHORIZATION' ]]; then
    [[ "${CONFIRM_PRODUCTION_WRITE:-}" == 'I_CONFIRM_PR424_SINGLE_MIGRATION_20261030000100' ]] || \
      abort "PR #424 production write requires its single-migration confirmation"
    [[ "${BACKUP_EXCEPTION_AUTHORIZATION:-}" == 'TECESCOLA_V65_PR424_20261030000100' ]] || \
      abort "PR #424 scoped migration authorization is missing"
  elif [[ "${backup_exception}" == 'PR425_SCOPED_MIGRATION_AUTHORIZATION' ]]; then
    [[ "${CONFIRM_PRODUCTION_WRITE:-}" == 'I_CONFIRM_PR425_SINGLE_MIGRATION_20261030000200' ]] || \
      abort "PR #425 production write requires its single-migration confirmation"
    [[ "${BACKUP_EXCEPTION_AUTHORIZATION:-}" == 'TECESCOLA_V8_PR425_20261030000200' ]] || \
      abort "PR #425 scoped migration authorization is missing"
  else
    [[ "${CONFIRM_PRODUCTION_WRITE:-}" == 'I_CONFIRM_SELECTIVE_PRODUCTION_MIGRATION' ]] || \
      abort "production write confirmation is missing"
  fi
  printf 'PRODUCTION_WRITE_AUTHORIZATION=APPROVED\n'
}

mapfile -t target_files < <(find "${repo_root}/supabase/migrations" -maxdepth 1 -type f -name "${target_version}_*.sql" -print)
[[ "${#target_files[@]}" -eq 1 ]] || abort "target migration must resolve to exactly one file"
target_file="${target_files[0]}"
actual_target_sha256="$(sha256_migration_file "${target_file}")"
[[ "${actual_target_sha256}" == "${expected_target_sha256}" ]] || abort "target migration hash mismatch"
validate_backup_gate

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
printf 'BACKUP_GATE=%s\n' "${BACKUP_GATE:-UNSET}"
printf 'BACKUP_EXCEPTION=%s\n' "${backup_exception}"
if [[ "${backup_exception}" == 'PR409_LOCAL_ONLY' ]]; then
  printf 'BACKUP_EXCEPTION_PR=409\n'
  printf 'BACKUP_EXCEPTION_SCOPE=%s\n' "${psychology_409_version}"
  printf 'BACKUP_EXCEPTION_LOCAL_SHA256=%s\n' "${backup_exception_backup_sha256}"
  printf 'BACKUP_EXCEPTION_LOCAL_BYTES=%s\n' "${backup_exception_backup_bytes}"
  printf 'BACKUP_EXCEPTION_RESTORE=PASS\n'
  printf 'BACKUP_EXCEPTION_OFFSITE=FAIL\n'
  printf 'BACKUP_EXCEPTION_OFFSITE_COPY=NONE\n'
  printf 'BACKUP_EXCEPTION_RECOVERY_RISK=LOCAL_ONLY_NO_OFFSITE_COPY\n'
elif [[ "${backup_exception}" == 'RELEASE_399_ACCEPTED' ]]; then
  printf 'BACKUP_EXCEPTION_RELEASE_SHA=%s\n' "${release_399_sha}"
  printf 'BACKUP_EXCEPTION_WINDOWS_SHA256=%s\n' "${backup_exception_backup_sha256}"
  printf 'BACKUP_EXCEPTION_RESTORE=PARTIAL\n'
  printf 'BACKUP_EXCEPTION_STORAGE=PARTIAL\n'
  printf 'BACKUP_EXCEPTION_OFFSITE_GATE=FAIL\n'
  printf 'BACKUP_EXCEPTION_RISK_ACCEPTANCE=ACCEPTED\n'
elif [[ "${backup_exception}" == 'PR411_LOCAL_ONLY' ]]; then
  printf 'BACKUP_EXCEPTION_PR=411\n'
  printf 'BACKUP_EXCEPTION_SCOPE=%s\n' "${psychology_411_version}"
  printf 'BACKUP_EXCEPTION_LOCAL_SHA256=%s\n' "${backup_exception_backup_sha256}"
  printf 'BACKUP_EXCEPTION_LOCAL_BYTES=%s\n' "${backup_exception_backup_bytes}"
  printf 'BACKUP_EXCEPTION_RESTORE=PASS\n'
  printf 'BACKUP_EXCEPTION_STORAGE=PARTIAL\n'
  printf 'BACKUP_EXCEPTION_OFFSITE=FAIL\n'
  printf 'BACKUP_EXCEPTION_OFFSITE_COPY=NONE\n'
  printf 'BACKUP_EXCEPTION_RECOVERY_RISK=LOCAL_ONLY_NO_OFFSITE_COPY_STORAGE_PARTIAL\n'
  printf 'BACKUP_EXCEPTION_RISK_ACCEPTANCE=ACCEPTED\n'
elif [[ "${backup_exception}" == 'PR412_LOCAL_ONLY' ]]; then
  printf 'BACKUP_EXCEPTION_PR=412\n'
  printf 'BACKUP_EXCEPTION_SCOPE=%s\n' "${tec_english_412_version}"
  printf 'BACKUP_EXCEPTION_PREDECESSOR=%s\n' "${tec_english_412_expected_remote_last}"
  printf 'BACKUP_EXCEPTION_LOCAL_SHA256=%s\n' "${backup_exception_backup_sha256}"
  printf 'BACKUP_EXCEPTION_LOCAL_BYTES=%s\n' "${backup_exception_backup_bytes}"
  printf 'BACKUP_EXCEPTION_RESTORE=PASS\n'
  printf 'BACKUP_EXCEPTION_STORAGE=PARTIAL\n'
  printf 'BACKUP_EXCEPTION_OFFSITE=FAIL\n'
  printf 'BACKUP_EXCEPTION_OFFSITE_COPY=NONE\n'
  printf 'BACKUP_EXCEPTION_RECOVERY_RISK=LOCAL_ONLY_NO_OFFSITE_COPY_STORAGE_PARTIAL\n'
  printf 'BACKUP_EXCEPTION_RISK_ACCEPTANCE=ACCEPTED\n'
elif [[ "${backup_exception}" == 'PR414_LOCAL_ONLY' ]]; then
  printf 'BACKUP_EXCEPTION_PR=414\n'
  printf 'BACKUP_EXCEPTION_SCOPE=%s\n' "${tec_idiomas_414_version}"
  printf 'BACKUP_EXCEPTION_PREDECESSOR=%s\n' "${tec_idiomas_414_expected_remote_last}"
  printf 'BACKUP_EXCEPTION_SOURCE_SHA=%s\n' "${expected_source_commit}"
  printf 'BACKUP_EXCEPTION_MIGRATION_SHA256=%s\n' "${actual_target_sha256}"
  printf 'BACKUP_EXCEPTION_LOCAL_SHA256=%s\n' "${backup_exception_backup_sha256}"
  printf 'BACKUP_EXCEPTION_LOCAL_BYTES=%s\n' "${backup_exception_backup_bytes}"
  printf 'BACKUP_EXCEPTION_POSTGRES_RESTORE=PASS\n'
  printf 'BACKUP_EXCEPTION_STORAGE_RESTORE=PASS\n'
  printf 'BACKUP_EXCEPTION_STORAGE=PARTIAL\n'
  printf 'BACKUP_EXCEPTION_OFFSITE=FAIL\n'
  printf 'BACKUP_EXCEPTION_OFFSITE_COPY=NONE\n'
  printf 'BACKUP_EXCEPTION_RECOVERY_RISK=LOCAL_ONLY_NO_OFFSITE_COPY_STORAGE_PARTIAL\n'
  printf 'BACKUP_EXCEPTION_RISK_ACCEPTANCE=ACCEPTED\n'
elif [[ "${backup_exception}" == 'PR418_SCOPED_RISK_ACCEPTANCE' ]]; then
  printf 'BACKUP_EXCEPTION_PR=418\n'
  printf 'BACKUP_EXCEPTION_SCOPE=%s\n' "${target_version}"
  printf 'BACKUP_EXCEPTION_PREDECESSOR=%s\n' "${expected_remote_last}"
  printf 'BACKUP_EXCEPTION_SOURCE_SHA=%s\n' "${expected_source_commit}"
  printf 'BACKUP_EXCEPTION_MIGRATION_SHA256=%s\n' "${actual_target_sha256}"
  printf 'BACKUP_EXCEPTION_RECOVERY_PROOF=NONE\n'
  printf 'BACKUP_EXCEPTION_RECOVERY_RISK=INCOMPLETE_RECOVERY_RISK_ACCEPTED\n'
  printf 'BACKUP_EXCEPTION_OFFSITE=FAIL\n'
  printf 'BACKUP_EXCEPTION_STORAGE=PARTIAL\n'
  printf 'BACKUP_EXCEPTION_RISK_ACCEPTANCE=ACCEPTED\n'
elif [[ "${backup_exception}" == 'PR424_SCOPED_MIGRATION_AUTHORIZATION' ]]; then
  printf 'BACKUP_EXCEPTION_PR=424\n'
  printf 'BACKUP_EXCEPTION_SCOPE=%s\n' "${target_version}"
  printf 'BACKUP_EXCEPTION_PREDECESSOR=%s\n' "${expected_remote_last}"
  printf 'BACKUP_EXCEPTION_SOURCE_SHA=%s\n' "${expected_source_commit}"
  printf 'BACKUP_EXCEPTION_MIGRATION_SHA256=%s\n' "${actual_target_sha256}"
  printf 'BACKUP_EXCEPTION_RECOVERY_PROOF=NONE\n'
  printf 'BACKUP_EXCEPTION_RECOVERY_RISK=OFFSITE_UNAVAILABLE_STORAGE_PARTIAL\n'
  printf 'BACKUP_EXCEPTION_OFFSITE=FAIL\n'
  printf 'BACKUP_EXCEPTION_STORAGE=PARTIAL\n'
  printf 'BACKUP_EXCEPTION_SCOPE_AUTHORIZATION=TECESCOLA_V65_PR424_20261030000100\n'
elif [[ "${backup_exception}" == 'PR425_SCOPED_MIGRATION_AUTHORIZATION' ]]; then
  printf 'BACKUP_EXCEPTION_PR=425\n'
  printf 'BACKUP_EXCEPTION_SCOPE=%s\n' "${target_version}"
  printf 'BACKUP_EXCEPTION_PREDECESSOR=%s\n' "${expected_remote_last}"
  printf 'BACKUP_EXCEPTION_SOURCE_SHA=%s\n' "${expected_source_commit}"
  printf 'BACKUP_EXCEPTION_MIGRATION_SHA256=%s\n' "${actual_target_sha256}"
  printf 'BACKUP_EXCEPTION_RECOVERY_PROOF=NONE\n'
  printf 'BACKUP_EXCEPTION_RECOVERY_RISK=OFFSITE_UNAVAILABLE_STORAGE_PARTIAL\n'
  printf 'BACKUP_EXCEPTION_OFFSITE=FAIL\n'
  printf 'BACKUP_EXCEPTION_STORAGE=PARTIAL\n'
  printf 'BACKUP_EXCEPTION_SCOPE_AUTHORIZATION=TECESCOLA_V8_PR425_20261030000200\n'
fi

if [[ "${APPLY:-0}" != '1' ]]; then
  printf 'PROMOTION=DRY_RUN_ONLY\n'
  printf 'PRODUCTION_WRITE_AUTHORIZATION=PENDING\n'
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
