#!/usr/bin/env bash

# Exact, release-scoped metadata for the V4 integration campaign. These values
# authorize only the migration artifact at the reviewed source commit.
declare -Ag tecescola_v4_scope_version=(
  [373]='20261026000400'
  [427]='20261031000200'
  [406]='20261025000700'
  [407]='20261025000800'
  [408]='20261025000900'
  [431]='20261101000100'
)
declare -Ag tecescola_v4_scope_sha256=(
  [373]='3070a9d697d9fccf835da6d8730c1e9a67c238c80af7768779dafe4ae2f5feae'
  [427]='89ee768a05e84bab9920e9ad2c2d9dd4aefbf296f153e71e494e800e4dc15bfe'
  [406]='ca3702de721c460ad494d5e11d56b0c4b027b039db9d6a21840755d8630f8123'
  [407]='beb162661bcf6b35fd00b8cbb4a2c0e724eeb33bbcba88f4eb9e29dca33abee0'
  [408]='9b5163999f83663f8bd424a3e8b0cac515709a19359966b1981471837c46e96e'
  [431]='b31ea446260c7d0085652c601811754afed446b14e3726b1e262fd02a2bb8251'
)
declare -Ag tecescola_v4_scope_remote_last=(
  [373]='20261031000100'
  [427]='20261031000100'
  [406]='20261031000200'
  [407]='20261101000100'
  [408]='20261101000100'
  [431]='20261031000200'
)
declare -Ag tecescola_v4_scope_branch=(
  [373]='codex/teacher-workload-three-shifts-v1'
  [427]='codex/psychology-expired-appointment-removal'
  [406]='feat/central-estudos-pedagogia-v2'
  [407]='codex/classroom-activity-builder'
  [408]='codex/tec-quiz-live-v1'
  [431]='codex/bncc-v5-guided-hints'
)
declare -Ag tecescola_v4_scope_source_sha=(
  [373]='9f57052b4912aabbed03f3f1a86e763e9f49613a'
  [427]='b87c113eeedef5000db96cd45c1d0f5f84a020a6'
  [406]='139c3a669943648c2e3fb8522590d6487e109cad'
  [407]='f2f719638334c3a589067237cea5b81f3fbc40b5'
  [408]='a28686e9a8004ae2677ad1b871939acf3ccebe90'
  [431]='309dfa198812cc1064f67fbe27e00142ecd27264'
)
declare -Ag tecescola_v4_scope_authorization=(
  [373]='TECESCOLA_V4_PR373_20261026000400'
  [427]='TECESCOLA_V4_PR427_20261031000200'
  [406]='TECESCOLA_V4_PR406_20261025000700'
  [407]='TECESCOLA_V4_PR407_20261025000800'
  [408]='TECESCOLA_V4_PR408_20261025000900'
  [431]='TECESCOLA_V4_PR431_20261101000100'
)
declare -Ag tecescola_v4_write_confirmation=(
  [373]='I_CONFIRM_PR373_SINGLE_MIGRATION_20261026000400'
  [427]='I_CONFIRM_PR427_SINGLE_MIGRATION_20261031000200'
  [406]='I_CONFIRM_PR406_SINGLE_MIGRATION_20261025000700'
  [407]='I_CONFIRM_PR407_SINGLE_MIGRATION_20261025000800'
  [408]='I_CONFIRM_PR408_SINGLE_MIGRATION_20261025000900'
  [431]='I_CONFIRM_PR431_SINGLE_MIGRATION_20261101000100'
)
tecescola_v4_origin_https='https://github.com/weslleyfreitassantos-cell/edumoneyyyy-.git'
tecescola_v4_origin_ssh='git@github.com:weslleyfreitassantos-cell/edumoneyyyy-.git'

declare -Ag reenrollment_442_scope_sha256=(
  [20261103224726]='0edfc0f94639fc7976543c0bc3985db5cb1694171cbe9e1c7cd6db1adaa3f841'
  [20261104003628]='bebd8be334da138fb58fec84901ff90e0bb2dc7a46922e6acac795ee89335ee1'
)
declare -Ag reenrollment_442_scope_remote_last=(
  [20261103224726]='20261103000300'
  [20261104003628]='20261103224726'
)
declare -Ag reenrollment_442_scope_authorization=(
  [20261103224726]='TECESCOLA_REENROLLMENT_PR442_20261103224726'
  [20261104003628]='TECESCOLA_REENROLLMENT_PR442_20261104003628'
)
declare -Ag reenrollment_442_write_confirmation=(
  [20261103224726]='I_CONFIRM_PR442_SINGLE_MIGRATION_20261103224726'
  [20261104003628]='I_CONFIRM_PR442_SINGLE_MIGRATION_20261104003628'
)
reenrollment_442_source_sha='9855b1ecedc9f1fd08414ac91678a17b281f77e1'
reenrollment_442_branch='codex/reenrollment-automatic-v1'

validate_reenrollment_442_scoped_authorization() {
  local target_version="${1:-}"
  local expected_remote_last="${2:-}"
  local expected_source_commit="${3:-}"
  local actual_source_commit="${4:-}"
  local expected_target_sha256="${5:-}"
  local actual_target_sha256="${6:-}"
  local current_branch="${7:-}"
  local origin_url="${8:-}"
  local offsite_status="${9:-}"
  local storage_status="${10:-}"
  local source_sha="${11:-}"
  local authorization="${12:-}"

  [[ -n "${reenrollment_442_scope_sha256[$target_version]:-}" ]] || abort 'PR #442 migration version is not allowlisted'
  [[ "${expected_remote_last}" == "${reenrollment_442_scope_remote_last[$target_version]}" ]] || abort 'PR #442 migration predecessor does not match the reviewed sequence'
  [[ "${expected_target_sha256,,}" == "${reenrollment_442_scope_sha256[$target_version]}" && \
    "${actual_target_sha256,,}" == "${reenrollment_442_scope_sha256[$target_version]}" ]] || abort 'PR #442 migration SHA-256 does not match the reviewed artifact'
  [[ "${expected_source_commit}" == "${reenrollment_442_source_sha}" && \
    "${actual_source_commit}" == "${reenrollment_442_source_sha}" && \
    "${source_sha}" == "${reenrollment_442_source_sha}" ]] || abort 'PR #442 source HEAD does not match the reviewed commit'
  [[ "${current_branch}" == "${reenrollment_442_branch}" ]] || abort 'PR #442 is restricted to the reviewed source branch'
  [[ "${origin_url}" == "${tecescola_v4_origin_https}" || \
    "${origin_url}" == "${tecescola_v4_origin_ssh}" ]] || abort 'PR #442 is restricted to the canonical Tec Escola repository'
  [[ "${offsite_status}" == 'FAIL' ]] || abort 'PR #442 authorization must preserve OFFSITE as FAIL'
  [[ "${storage_status}" == 'PARTIAL' ]] || abort 'PR #442 authorization must preserve Storage recovery as PARTIAL'
  [[ "${authorization}" == "${reenrollment_442_scope_authorization[$target_version]}" ]] || abort 'PR #442 exact migration authorization is missing'
}

validate_reenrollment_442_write_confirmation() {
  local target_version="${1:-}"
  local authorization="${2:-}"
  local confirmation="${3:-}"
  local accept_no_offsite="${4:-}"
  local accept_recovery_risk="${5:-}"

  [[ -n "${reenrollment_442_write_confirmation[$target_version]:-}" ]] || abort 'PR #442 production write scope is not allowlisted'
  [[ "${authorization}" == "${reenrollment_442_scope_authorization[$target_version]}" ]] || abort 'PR #442 scoped migration authorization is missing'
  [[ "${confirmation}" == "${reenrollment_442_write_confirmation[$target_version]}" ]] || abort 'PR #442 requires a separate confirmation for each migration'
  [[ "${accept_no_offsite}" == 'I_ACCEPT_NO_OFFSITE_COPY_FOR_PR_442' ]] || abort 'PR #442 requires explicit acceptance that no offsite copy exists'
  [[ "${accept_recovery_risk}" == 'I_ACCEPT_INCOMPLETE_RECOVERY_RISK_FOR_PR_442' ]] || abort 'PR #442 requires explicit acceptance of incomplete recovery risk'
}

validate_tecescola_v4_scoped_authorization() {
  local pr="${1:-}"
  local target_version="${2:-}"
  local expected_remote_last="${3:-}"
  local expected_source_commit="${4:-}"
  local actual_source_commit="${5:-}"
  local expected_target_sha256="${6:-}"
  local actual_target_sha256="${7:-}"
  local current_branch="${8:-}"
  local origin_url="${9:-}"
  local offsite_status="${10:-}"
  local storage_status="${11:-}"
  local source_sha="${12:-}"
  local authorization="${13:-}"

  [[ -n "${tecescola_v4_scope_version[$pr]:-}" ]] || abort 'V4 migration scope is not allowlisted'
  [[ "${target_version}" == "${tecescola_v4_scope_version[$pr]}" ]] || abort "PR #${pr} is restricted to its allowlisted migration version"
  [[ "${expected_remote_last}" == "${tecescola_v4_scope_remote_last[$pr]}" ]] || abort "PR #${pr} is restricted to the reviewed production ledger predecessor"
  [[ "${expected_target_sha256,,}" == "${tecescola_v4_scope_sha256[$pr]}" && \
    "${actual_target_sha256,,}" == "${tecescola_v4_scope_sha256[$pr]}" ]] || abort "PR #${pr} migration SHA-256 does not match its allowlisted artifact"
  [[ "${expected_source_commit}" == "${tecescola_v4_scope_source_sha[$pr]}" && \
    "${actual_source_commit}" == "${tecescola_v4_scope_source_sha[$pr]}" && \
    "${source_sha}" == "${tecescola_v4_scope_source_sha[$pr]}" ]] || abort "PR #${pr} source HEAD does not match its reviewed commit"
  [[ "${current_branch}" == "${tecescola_v4_scope_branch[$pr]}" ]] || abort "PR #${pr} is restricted to branch ${tecescola_v4_scope_branch[$pr]}"
  [[ "${origin_url}" == "${tecescola_v4_origin_https}" || \
    "${origin_url}" == "${tecescola_v4_origin_ssh}" ]] || abort "PR #${pr} is restricted to the canonical Tec Escola repository"
  [[ "${offsite_status}" == 'FAIL' ]] || abort "PR #${pr} authorization must preserve OFFSITE as FAIL"
  [[ "${storage_status}" == 'PARTIAL' ]] || abort "PR #${pr} authorization must preserve Storage recovery as PARTIAL"
  [[ "${authorization}" == "${tecescola_v4_scope_authorization[$pr]}" ]] || abort "PR #${pr} exact migration authorization is missing"
}

validate_tecescola_v4_write_confirmation() {
  local pr="${1:-}"
  local target_version="${2:-}"
  local authorization="${3:-}"
  local confirmation="${4:-}"

  [[ -n "${tecescola_v4_write_confirmation[$pr]:-}" ]] || abort 'V4 production write scope is not allowlisted'
  [[ "${target_version}" == "${tecescola_v4_scope_version[$pr]}" ]] || abort "PR #${pr} production write is restricted to its single migration"
  [[ "${authorization}" == "${tecescola_v4_scope_authorization[$pr]}" ]] || abort "PR #${pr} scoped migration authorization is missing"
  [[ "${confirmation}" == "${tecescola_v4_write_confirmation[$pr]}" ]] || abort "PR #${pr} production write requires its single-migration confirmation"
}
