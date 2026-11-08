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

reenrollment_450_version='20261105013857'
reenrollment_450_sha256='73cea4d1f0aa06fdbb5c1c59244727aa2881698e6f07b7e226673cd0e6ee7f3c'
reenrollment_450_expected_remote_last='20261104003628'
reenrollment_450_branch='codex/reenrollment-calendar-unification'
reenrollment_450_database_identity='7687199237633114148|postgres'
reenrollment_450_authorization='TECESCOLA_V22_PR450_20261105013857'
reenrollment_450_write_confirmation='I_CONFIRM_PR450_SINGLE_MIGRATION_20261105013857'
reenrollment_450_no_offsite_acceptance='I_ACCEPT_NO_OFFSITE_COPY_FOR_PR450'
reenrollment_450_recovery_risk_acceptance='I_ACCEPT_INCOMPLETE_RECOVERY_RISK_FOR_PR450'

reenrollment_453_version='20261106001430'
reenrollment_453_sha256='fe67858819deea7209878aa86ef2d5461568c965d9c34c441ddd31d50d46215c'
reenrollment_453_expected_remote_last='20261105013857'
reenrollment_453_reviewed_parent_sha='4a98c4db356296e1b765ce18ccebc409f79db721'
reenrollment_453_branch='codex/reenrollment-v23-flow-correction'
reenrollment_453_database_identity='7687199237633114148|postgres'
reenrollment_453_authorization='TECESCOLA_REENROLLMENT_V23_PR453_20261106001430'
reenrollment_453_write_confirmation='I_CONFIRM_PR453_SINGLE_MIGRATION_20261106001430'
reenrollment_453_no_offsite_acceptance='I_ACCEPT_NO_OFFSITE_COPY_FOR_PR453'
reenrollment_453_recovery_risk_acceptance='I_ACCEPT_INCOMPLETE_RECOVERY_RISK_FOR_PR453'

tec_quiz_455_version='20261106001500'
tec_quiz_455_sha256='7c55c05eef84ad48bc28dee0b65f9e0f2b676a2ba99cd00a72593c92e819beb6'
tec_quiz_455_expected_remote_last='20261106001430'
tec_quiz_455_migration_source_sha='0a2c76fdec5555c2b7b9e99e711151074551f3f3'
tec_quiz_455_branch='codex/production-release-all-2026-11-06'
tec_quiz_455_database_identity='7687199237633114148|postgres'
tec_quiz_455_backup_sha256='2a8c3532503b7d270a86e0ffc311c78a3d13b55c060294a621a1f030ec15ea82'
tec_quiz_455_backup_bytes='372936054'
tec_quiz_455_authorization='TECESCOLA_QUIZ_LIVE_PR455_20261106001500'
tec_quiz_455_write_confirmation='I_CONFIRM_PR455_SINGLE_MIGRATION_20261106001500'
tec_quiz_455_no_offsite_acceptance='I_ACCEPT_NO_OFFSITE_COPY_FOR_PR_455'
tec_quiz_455_recovery_risk_acceptance='I_ACCEPT_LOCAL_ONLY_RECOVERY_RISK_FOR_PR_455'

tec_quiz_auto_456_version='20261107212235'
tec_quiz_auto_456_sha256='e2af6ed1dfd0c2127aeee75cf7b7f473985fdeac4fb63b7948ecbf36727a93db'
tec_quiz_auto_456_expected_remote_last='20261106001500'
tec_quiz_auto_456_migration_source_sha='27ea9ca3b45b0b8cff38c427cc89b89d566a04d1'
tec_quiz_auto_456_branch='codex/quiz-live-auto-reveal-advance'
tec_quiz_auto_456_database_identity='7687199237633114148|postgres'
tec_quiz_auto_456_authorization='TECESCOLA_QUIZ_LIVE_AUTO_PROGRESS_PR456_20261107212235'
tec_quiz_auto_456_write_confirmation='I_CONFIRM_PR456_SINGLE_MIGRATION_20261107212235'
tec_quiz_auto_456_no_backup_acceptance='I_ACCEPT_NO_BACKUP_FOR_PR456'
tec_quiz_auto_456_recovery_risk_acceptance='I_ACCEPT_INCOMPLETE_RECOVERY_RISK_FOR_PR456'

guided_study_v11_458_version='20261108000100'
guided_study_v11_458_sha256='7214dbc5c43e102d2aeabd36b1a98e4de7f852c1f07a7754868d1d0666f578aa'
guided_study_v11_458_expected_remote_last='20261107212235'
guided_study_v11_458_reviewed_head='31d2ccac56c70395a662f594033633aba2b400ea'
guided_study_v11_458_branch='codex/guided-study-v11-autonomous'
guided_study_v11_458_database_identity='7687199237633114148|postgres'
guided_study_v11_458_authorization='TECESCOLA_GUIDED_STUDY_V11_PR458_20261108000100'
guided_study_v11_458_write_confirmation='I_CONFIRM_PR458_SINGLE_MIGRATION_20261108000100'
guided_study_v11_458_no_backup_acceptance='I_ACCEPT_NO_BACKUP_FOR_PR458'
guided_study_v11_458_recovery_risk_acceptance='I_ACCEPT_INCOMPLETE_RECOVERY_RISK_FOR_PR458'

guided_study_v12_459_version='20261108173911'
guided_study_v12_459_sha256='83956978bd6e6d49a70d2523bff2b0126abf1435df7c875d9e3ec6269d18fef6'
guided_study_v12_459_expected_remote_last='20261108000100'
guided_study_v12_459_reviewed_head='42d89ccd91203f707be7b581b15cd19ed42eda1f'
guided_study_v12_459_branch='codex/guided-study-v12'
guided_study_v12_459_database_identity='7687199237633114148|postgres'
guided_study_v12_459_authorization='TECESCOLA_GUIDED_STUDY_V12_PR459_20261108173911'
guided_study_v12_459_write_confirmation='I_CONFIRM_PR459_SINGLE_MIGRATION_20261108173911'
guided_study_v12_459_no_backup_acceptance='I_ACCEPT_NO_BACKUP_FOR_PR459_V12'
guided_study_v12_459_recovery_risk_acceptance='I_ACCEPT_INCOMPLETE_RECOVERY_RISK_FOR_PR459_V12'

study_materials_447_version='20261104000100'
study_materials_447_sha256='706754de1aa460a9bda3f13db0ba1794bec1a7ac1de239c37d73694c174055c9'
study_materials_447_expected_remote_last='20261104003628'
study_materials_447_branch='codex/study-center-materials-release'
study_materials_447_authorization='TECESCOLA_STUDY_MATERIALS_PR447_20261104000100'
study_materials_447_write_confirmation='I_CONFIRM_PR447_SINGLE_MIGRATION_20261104000100'
study_materials_447_bundle_path='/srv/grupotec/backups/edumoney/edumoney-2026-11-04T07-35-26Z.tar.gz'
study_materials_447_bundle_sha256='b3dc3ff658cfd769760574665e597aeecea0fd8bb3e30216a4100b9d2cf36b94'
study_materials_447_bundle_bytes='372888453'

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

validate_study_materials_447_scoped_authorization() {
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
  local worktree_status="${13:-}"

  [[ "${target_version}" == "${study_materials_447_version}" ]] || abort 'PR #447 is restricted to migration 20261104000100'
  [[ "${expected_remote_last}" == "${study_materials_447_expected_remote_last}" ]] || abort 'PR #447 predecessor does not match the observed production ledger'
  [[ "${expected_target_sha256,,}" == "${study_materials_447_sha256}" && \
    "${actual_target_sha256,,}" == "${study_materials_447_sha256}" ]] || abort 'PR #447 migration SHA-256 does not match the reviewed artifact'
  [[ -n "${expected_source_commit}" && "${actual_source_commit}" == "${expected_source_commit}" && \
    "${source_sha}" == "${expected_source_commit}" ]] || abort 'PR #447 source SHA must match the exact promoter checkout'
  [[ "${current_branch}" == "${study_materials_447_branch}" ]] || abort "PR #447 is restricted to branch ${study_materials_447_branch}"
  [[ -z "${worktree_status}" ]] || abort 'PR #447 promotion requires a clean committed checkout'
  [[ "${origin_url}" == "${tecescola_v4_origin_https}" || \
    "${origin_url}" == "${tecescola_v4_origin_ssh}" ]] || abort 'PR #447 is restricted to the canonical Tec Escola repository'
  [[ "${offsite_status}" == 'FAIL' ]] || abort 'PR #447 authorization must preserve OFFSITE as FAIL'
  [[ "${storage_status}" == 'PARTIAL' ]] || abort 'PR #447 authorization must preserve Storage recovery as PARTIAL'
  [[ "${authorization}" == "${study_materials_447_authorization}" ]] || abort 'PR #447 exact migration authorization is missing'
}

validate_study_materials_447_write_confirmation() {
  local target_version="${1:-}"
  local authorization="${2:-}"
  local confirmation="${3:-}"
  local accept_no_offsite="${4:-}"
  local accept_recovery_risk="${5:-}"

  [[ "${target_version}" == "${study_materials_447_version}" ]] || abort 'PR #447 write is restricted to migration 20261104000100'
  [[ "${authorization}" == "${study_materials_447_authorization}" ]] || abort 'PR #447 scoped migration authorization is missing'
  [[ "${confirmation}" == "${study_materials_447_write_confirmation}" ]] || abort 'PR #447 requires a separate single-migration production confirmation'
  [[ "${accept_no_offsite}" == 'I_ACCEPT_NO_OFFSITE_COPY_FOR_PR_447' ]] || abort 'PR #447 requires explicit acceptance that no offsite copy exists'
  [[ "${accept_recovery_risk}" == 'I_ACCEPT_LOCAL_ONLY_RECOVERY_RISK_FOR_PR_447' ]] || abort 'PR #447 requires explicit acceptance of local-only recovery risk'
}

validate_reenrollment_450_scoped_authorization() {
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

  [[ "${target_version}" == "${reenrollment_450_version}" ]] || abort 'PR #450 is restricted to migration 20261105013857'
  [[ "${expected_remote_last}" == "${reenrollment_450_expected_remote_last}" ]] || abort 'PR #450 predecessor does not match the reviewed production ledger'
  [[ "${expected_target_sha256,,}" == "${reenrollment_450_sha256}" && \
    "${actual_target_sha256,,}" == "${reenrollment_450_sha256}" ]] || abort 'PR #450 migration SHA-256 does not match the reviewed artifact'
  [[ "${expected_source_commit}" =~ ^[0-9a-f]{40}$ && \
    "${actual_source_commit}" == "${expected_source_commit}" && \
    "${source_sha}" == "${expected_source_commit}" ]] || abort 'PR #450 source HEAD does not match the promoter checkout'
  [[ "${current_branch}" == "${reenrollment_450_branch}" ]] || abort "PR #450 is restricted to branch ${reenrollment_450_branch}"
  [[ "${origin_url}" == "${tecescola_v4_origin_https}" || \
    "${origin_url}" == "${tecescola_v4_origin_ssh}" ]] || abort 'PR #450 is restricted to the canonical Tec Escola repository'
  [[ "${offsite_status}" == 'FAIL' ]] || abort 'PR #450 authorization must preserve OFFSITE as FAIL'
  [[ "${storage_status}" == 'PARTIAL' ]] || abort 'PR #450 authorization must preserve Storage recovery as PARTIAL'
  [[ "${authorization}" == "${reenrollment_450_authorization}" ]] || abort 'PR #450 exact migration authorization is missing'
}

validate_reenrollment_450_database_identity() {
  local actual_identity="${1:-}"
  [[ "${actual_identity}" == "${reenrollment_450_database_identity}" ]] || \
    abort 'PR #450 target database identity does not match the approved Tec Escola production cluster'
}

validate_reenrollment_450_write_confirmation() {
  local target_version="${1:-}"
  local authorization="${2:-}"
  local confirmation="${3:-}"
  local accept_no_offsite="${4:-}"
  local accept_recovery_risk="${5:-}"

  [[ "${target_version}" == "${reenrollment_450_version}" ]] || abort 'PR #450 production write is restricted to migration 20261105013857'
  [[ "${authorization}" == "${reenrollment_450_authorization}" ]] || abort 'PR #450 scoped migration authorization is missing'
  [[ "${confirmation}" == "${reenrollment_450_write_confirmation}" ]] || abort 'PR #450 requires its single-migration production confirmation'
  [[ "${accept_no_offsite}" == "${reenrollment_450_no_offsite_acceptance}" ]] || abort 'PR #450 requires explicit acceptance that no offsite copy exists'
  [[ "${accept_recovery_risk}" == "${reenrollment_450_recovery_risk_acceptance}" ]] || abort 'PR #450 requires explicit acceptance of incomplete recovery risk'
}

validate_reenrollment_453_scoped_authorization() {
  local target_version="${1:-}"
  local expected_remote_last="${2:-}"
  local expected_source_commit="${3:-}"
  local actual_source_commit="${4:-}"
  local expected_target_sha256="${5:-}"
  local actual_target_sha256="${6:-}"
  local current_branch="${7:-}"
  local origin_url="${8:-}"
  local offsite_status="${9:-}"
  local source_sha="${10:-}"
  local authorization="${11:-}"
  local source_parent_sha="${12:-}"

  [[ "${target_version}" == "${reenrollment_453_version}" ]] || abort 'PR #453 is restricted to migration 20261106001430'
  [[ "${expected_remote_last}" == "${reenrollment_453_expected_remote_last}" ]] || abort 'PR #453 predecessor does not match the verified production ledger'
  [[ "${expected_target_sha256,,}" == "${reenrollment_453_sha256}" && \
    "${actual_target_sha256,,}" == "${reenrollment_453_sha256}" ]] || abort 'PR #453 migration SHA-256 does not match the reviewed V2.3 artifact'
  [[ "${expected_source_commit}" =~ ^[0-9a-f]{40}$ && \
    "${actual_source_commit}" == "${expected_source_commit}" && \
    "${source_sha}" == "${expected_source_commit}" ]] || abort 'PR #453 source commit does not match the reviewed promoter checkout'
  [[ "${source_parent_sha}" == "${reenrollment_453_reviewed_parent_sha}" ]] || abort 'PR #453 release authorization must be the single commit directly on the reviewed application head'
  [[ "${current_branch}" == "${reenrollment_453_branch}" ]] || abort "PR #453 is restricted to branch ${reenrollment_453_branch}"
  [[ "${origin_url}" == "${tecescola_v4_origin_https}" || \
    "${origin_url}" == "${tecescola_v4_origin_ssh}" ]] || abort 'PR #453 is restricted to the canonical Tec Escola repository'
  [[ "${offsite_status}" == 'FAIL' ]] || abort 'PR #453 authorization must preserve OFFSITE as FAIL'
  [[ "${authorization}" == "${reenrollment_453_authorization}" ]] || abort 'PR #453 exact V2.3 migration authorization is missing'
}

validate_reenrollment_453_database_identity() {
  local actual_identity="${1:-}"
  [[ "${actual_identity}" == "${reenrollment_453_database_identity}" ]] || \
    abort 'PR #453 target database identity does not match the verified TecEscola production database'
}

validate_reenrollment_453_write_confirmation() {
  local target_version="${1:-}"
  local authorization="${2:-}"
  local confirmation="${3:-}"
  local accept_no_offsite="${4:-}"
  local accept_recovery_risk="${5:-}"

  [[ "${target_version}" == "${reenrollment_453_version}" ]] || abort 'PR #453 production write is restricted to migration 20261106001430'
  [[ "${authorization}" == "${reenrollment_453_authorization}" ]] || abort 'PR #453 scoped V2.3 migration authorization is missing'
  [[ "${confirmation}" == "${reenrollment_453_write_confirmation}" ]] || abort 'PR #453 requires its separate single-migration production confirmation'
  [[ "${accept_no_offsite}" == "${reenrollment_453_no_offsite_acceptance}" ]] || abort 'PR #453 requires explicit acceptance that no offsite copy exists'
  [[ "${accept_recovery_risk}" == "${reenrollment_453_recovery_risk_acceptance}" ]] || abort 'PR #453 requires explicit acceptance of incomplete-recovery risk'
}

validate_tec_quiz_455_scoped_authorization() {
  local target_version="${1:-}"
  local expected_remote_last="${2:-}"
  local expected_target_sha256="${3:-}"
  local actual_target_sha256="${4:-}"
  local expected_source_commit="${5:-}"
  local actual_source_commit="${6:-}"
  local current_branch="${7:-}"
  local origin_url="${8:-}"
  local offsite_status="${9:-}"
  local storage_status="${10:-}"
  local source_sha="${11:-}"
  local authorization="${12:-}"
  local worktree_status="${13:-}"

  [[ "${target_version}" == "${tec_quiz_455_version}" ]] || abort 'PR #455 is restricted to Quiz Live migration 20261106001500'
  [[ "${expected_remote_last}" == "${tec_quiz_455_expected_remote_last}" ]] || abort 'PR #455 predecessor does not match the verified production ledger'
  [[ "${expected_target_sha256,,}" == "${tec_quiz_455_sha256}" && \
    "${actual_target_sha256,,}" == "${tec_quiz_455_sha256}" ]] || abort 'PR #455 migration SHA-256 does not match the reviewed Quiz Live artifact'
  [[ "${expected_source_commit}" =~ ^[0-9a-f]{40}$ && \
    "${actual_source_commit}" == "${expected_source_commit}" && \
    "${source_sha}" == "${tec_quiz_455_migration_source_sha}" ]] || abort 'PR #455 source does not contain the reviewed Quiz Live migration commit'
  [[ "${current_branch}" == "${tec_quiz_455_branch}" ]] || abort "PR #455 is restricted to branch ${tec_quiz_455_branch}"
  [[ "${origin_url}" == "${tecescola_v4_origin_https}" || \
    "${origin_url}" == "${tecescola_v4_origin_ssh}" ]] || abort 'PR #455 is restricted to the canonical Tec Escola repository'
  [[ "${offsite_status}" == 'FAIL' ]] || abort 'PR #455 local-only authorization must preserve OFFSITE as FAIL'
  [[ "${storage_status}" == 'PARTIAL' ]] || abort 'PR #455 local-only authorization must preserve Storage recovery as PARTIAL'
  [[ "${authorization}" == "${tec_quiz_455_authorization}" ]] || abort 'PR #455 exact Quiz Live migration authorization is missing'
  [[ -z "${worktree_status}" ]] || abort 'PR #455 promotion requires a clean committed source checkout'
}

validate_tec_quiz_455_database_identity() {
  local actual_identity="${1:-}"
  [[ "${actual_identity}" == "${tec_quiz_455_database_identity}" ]] || \
    abort 'PR #455 target database identity does not match the verified TecEscola production database'
}

validate_tec_quiz_455_write_confirmation() {
  local target_version="${1:-}"
  local authorization="${2:-}"
  local confirmation="${3:-}"
  local accept_no_offsite="${4:-}"
  local accept_recovery_risk="${5:-}"

  [[ "${target_version}" == "${tec_quiz_455_version}" ]] || abort 'PR #455 production write is restricted to migration 20261106001500'
  [[ "${authorization}" == "${tec_quiz_455_authorization}" ]] || abort 'PR #455 scoped Quiz Live authorization is missing'
  [[ "${confirmation}" == "${tec_quiz_455_write_confirmation}" ]] || abort 'PR #455 requires its single-migration production confirmation'
  [[ "${accept_no_offsite}" == "${tec_quiz_455_no_offsite_acceptance}" ]] || abort 'PR #455 requires explicit acceptance that no offsite copy exists'
  [[ "${accept_recovery_risk}" == "${tec_quiz_455_recovery_risk_acceptance}" ]] || abort 'PR #455 requires explicit acceptance of local-only recovery risk'
}

validate_tec_quiz_auto_456_scoped_authorization() {
  local target_version="${1:-}"
  local expected_remote_last="${2:-}"
  local expected_target_sha256="${3:-}"
  local actual_target_sha256="${4:-}"
  local expected_source_commit="${5:-}"
  local actual_source_commit="${6:-}"
  local current_branch="${7:-}"
  local origin_url="${8:-}"
  local offsite_status="${9:-}"
  local storage_status="${10:-}"
  local source_sha="${11:-}"
  local authorization="${12:-}"
  local worktree_status="${13:-}"

  [[ "${target_version}" == "${tec_quiz_auto_456_version}" ]] || abort 'PR #456 is restricted to Quiz Live auto-progress migration 20261107212235'
  [[ "${expected_remote_last}" == "${tec_quiz_auto_456_expected_remote_last}" ]] || abort 'PR #456 predecessor does not match the verified production ledger'
  [[ "${expected_target_sha256,,}" == "${tec_quiz_auto_456_sha256}" && \
    "${actual_target_sha256,,}" == "${tec_quiz_auto_456_sha256}" ]] || abort 'PR #456 migration SHA-256 does not match the reviewed Quiz Live auto-progress artifact'
  [[ "${expected_source_commit}" =~ ^[0-9a-f]{40}$ && \
    "${actual_source_commit}" == "${expected_source_commit}" && \
    "${source_sha}" == "${tec_quiz_auto_456_migration_source_sha}" ]] || abort 'PR #456 source does not contain the reviewed Quiz Live auto-progress migration commit'
  [[ "${current_branch}" == "${tec_quiz_auto_456_branch}" ]] || abort "PR #456 is restricted to branch ${tec_quiz_auto_456_branch}"
  [[ "${origin_url}" == "${tecescola_v4_origin_https}" || \
    "${origin_url}" == "${tecescola_v4_origin_ssh}" ]] || abort 'PR #456 is restricted to the canonical Tec Escola repository'
  [[ "${offsite_status}" == 'FAIL' ]] || abort 'PR #456 no-backup authorization must preserve OFFSITE as FAIL'
  [[ "${storage_status}" == 'PARTIAL' ]] || abort 'PR #456 no-backup authorization must preserve Storage recovery as PARTIAL'
  [[ "${authorization}" == "${tec_quiz_auto_456_authorization}" ]] || abort 'PR #456 exact Quiz Live auto-progress migration authorization is missing'
  [[ -z "${worktree_status}" ]] || abort 'PR #456 promotion requires a clean committed source checkout'
}

validate_tec_quiz_auto_456_database_identity() {
  local actual_identity="${1:-}"
  [[ "${actual_identity}" == "${tec_quiz_auto_456_database_identity}" ]] || \
    abort 'PR #456 target database identity does not match the verified TecEscola production database'
}

validate_tec_quiz_auto_456_write_confirmation() {
  local target_version="${1:-}"
  local authorization="${2:-}"
  local confirmation="${3:-}"
  local no_backup_acceptance="${4:-}"
  local recovery_risk_acceptance="${5:-}"

  [[ "${target_version}" == "${tec_quiz_auto_456_version}" ]] || abort 'PR #456 production write is restricted to migration 20261107212235'
  [[ "${authorization}" == "${tec_quiz_auto_456_authorization}" ]] || abort 'PR #456 scoped Quiz Live auto-progress migration authorization is missing'
  [[ "${confirmation}" == "${tec_quiz_auto_456_write_confirmation}" ]] || abort 'PR #456 requires its single-migration production confirmation'
  [[ "${no_backup_acceptance}" == "${tec_quiz_auto_456_no_backup_acceptance}" ]] || abort 'PR #456 requires explicit acceptance that no backup will be created'
  [[ "${recovery_risk_acceptance}" == "${tec_quiz_auto_456_recovery_risk_acceptance}" ]] || abort 'PR #456 requires explicit acceptance of incomplete-recovery risk'
}

validate_guided_study_v11_458_scoped_authorization() {
  local target_version="${1:-}"
  local expected_remote_last="${2:-}"
  local expected_target_sha256="${3:-}"
  local actual_target_sha256="${4:-}"
  local expected_source_commit="${5:-}"
  local actual_source_commit="${6:-}"
  local current_branch="${7:-}"
  local origin_url="${8:-}"
  local offsite_status="${9:-}"
  local storage_status="${10:-}"
  local source_sha="${11:-}"
  local authorization="${12:-}"
  local worktree_status="${13:-}"

  [[ "${target_version}" == "${guided_study_v11_458_version}" ]] || abort 'PR #458 is restricted to Guided Study V11 migration 20261108000100'
  [[ "${expected_remote_last}" == "${guided_study_v11_458_expected_remote_last}" ]] || abort 'PR #458 predecessor does not match the verified production ledger'
  [[ "${expected_target_sha256,,}" == "${guided_study_v11_458_sha256}" && \
    "${actual_target_sha256,,}" == "${guided_study_v11_458_sha256}" ]] || abort 'PR #458 migration SHA-256 does not match the reviewed Guided Study V11 artifact'
  [[ "${expected_source_commit}" =~ ^[0-9a-f]{40}$ && \
    "${actual_source_commit}" == "${expected_source_commit}" && \
    "${source_sha}" == "${guided_study_v11_458_reviewed_head}" ]] || abort 'PR #458 source does not contain the reviewed Guided Study V11 commit'
  [[ "${current_branch}" == "${guided_study_v11_458_branch}" ]] || abort "PR #458 is restricted to branch ${guided_study_v11_458_branch}"
  [[ "${origin_url}" == "${tecescola_v4_origin_https}" || \
    "${origin_url}" == "${tecescola_v4_origin_ssh}" ]] || abort 'PR #458 is restricted to the canonical Tec Escola repository'
  [[ "${offsite_status}" == 'FAIL' ]] || abort 'PR #458 risk acceptance must preserve the known offsite backup status as FAIL'
  [[ "${storage_status}" == 'NOT_ASSESSED' ]] || abort 'PR #458 must not claim an unverified storage recovery status'
  [[ "${authorization}" == "${guided_study_v11_458_authorization}" ]] || abort 'PR #458 exact Guided Study V11 migration authorization is missing'
  [[ -z "${worktree_status}" ]] || abort 'PR #458 promotion requires a clean committed source checkout'
}

validate_guided_study_v11_458_database_identity() {
  local actual_identity="${1:-}"
  [[ "${actual_identity}" == "${guided_study_v11_458_database_identity}" ]] || \
    abort 'PR #458 target database identity does not match the verified TecEscola production database'
}

validate_guided_study_v11_458_write_confirmation() {
  local target_version="${1:-}"
  local authorization="${2:-}"
  local confirmation="${3:-}"
  local no_backup_acceptance="${4:-}"
  local recovery_risk_acceptance="${5:-}"

  [[ "${target_version}" == "${guided_study_v11_458_version}" ]] || abort 'PR #458 production write is restricted to migration 20261108000100'
  [[ "${authorization}" == "${guided_study_v11_458_authorization}" ]] || abort 'PR #458 scoped Guided Study V11 authorization is missing'
  [[ "${confirmation}" == "${guided_study_v11_458_write_confirmation}" ]] || abort 'PR #458 requires its single-migration production confirmation'
  [[ "${no_backup_acceptance}" == "${guided_study_v11_458_no_backup_acceptance}" ]] || abort 'PR #458 requires explicit acceptance that no backup will be created'
  [[ "${recovery_risk_acceptance}" == "${guided_study_v11_458_recovery_risk_acceptance}" ]] || abort 'PR #458 requires explicit acceptance of incomplete-recovery risk'
}

validate_guided_study_v12_459_scoped_authorization() {
  local target_version="${1:-}"
  local expected_remote_last="${2:-}"
  local expected_target_sha256="${3:-}"
  local actual_target_sha256="${4:-}"
  local expected_source_commit="${5:-}"
  local actual_source_commit="${6:-}"
  local current_branch="${7:-}"
  local origin_url="${8:-}"
  local offsite_status="${9:-}"
  local storage_status="${10:-}"
  local source_sha="${11:-}"
  local authorization="${12:-}"
  local worktree_status="${13:-}"

  [[ "${target_version}" == "${guided_study_v12_459_version}" ]] || abort 'PR #459 is restricted to Guided Study V12 migration 20261108173911'
  [[ "${expected_remote_last}" == "${guided_study_v12_459_expected_remote_last}" ]] || abort 'PR #459 predecessor does not match the verified production ledger'
  [[ "${expected_target_sha256,,}" == "${guided_study_v12_459_sha256}" && \
    "${actual_target_sha256,,}" == "${guided_study_v12_459_sha256}" ]] || abort 'PR #459 migration SHA-256 does not match the reviewed Guided Study V12 artifact'
  [[ "${expected_source_commit}" =~ ^[0-9a-f]{40}$ && \
    "${actual_source_commit}" == "${expected_source_commit}" && \
    "${source_sha}" == "${guided_study_v12_459_reviewed_head}" ]] || abort 'PR #459 source does not contain the reviewed Guided Study V12 commit'
  [[ "${current_branch}" == "${guided_study_v12_459_branch}" ]] || abort "PR #459 is restricted to branch ${guided_study_v12_459_branch}"
  [[ "${origin_url}" == "${tecescola_v4_origin_https}" || \
    "${origin_url}" == "${tecescola_v4_origin_ssh}" ]] || abort 'PR #459 is restricted to the canonical Tec Escola repository'
  [[ "${offsite_status}" == 'FAIL' ]] || abort 'PR #459 risk acceptance must preserve the known offsite backup status as FAIL'
  [[ "${storage_status}" == 'NOT_ASSESSED' ]] || abort 'PR #459 must not claim an unverified storage recovery status'
  [[ "${authorization}" == "${guided_study_v12_459_authorization}" ]] || abort 'PR #459 exact Guided Study V12 migration authorization is missing'
  [[ -z "${worktree_status}" ]] || abort 'PR #459 promotion requires a clean committed source checkout'
}

validate_guided_study_v12_459_database_identity() {
  local actual_identity="${1:-}"
  [[ "${actual_identity}" == "${guided_study_v12_459_database_identity}" ]] || \
    abort 'PR #459 target database identity does not match the verified TecEscola production database'
}

validate_guided_study_v12_459_write_confirmation() {
  local target_version="${1:-}"
  local authorization="${2:-}"
  local confirmation="${3:-}"
  local no_backup_acceptance="${4:-}"
  local recovery_risk_acceptance="${5:-}"

  [[ "${target_version}" == "${guided_study_v12_459_version}" ]] || abort 'PR #459 production write is restricted to migration 20261108173911'
  [[ "${authorization}" == "${guided_study_v12_459_authorization}" ]] || abort 'PR #459 scoped Guided Study V12 authorization is missing'
  [[ "${confirmation}" == "${guided_study_v12_459_write_confirmation}" ]] || abort 'PR #459 requires its single-migration production confirmation'
  [[ "${no_backup_acceptance}" == "${guided_study_v12_459_no_backup_acceptance}" ]] || abort 'PR #459 requires explicit acceptance that no backup will be created'
  [[ "${recovery_risk_acceptance}" == "${guided_study_v12_459_recovery_risk_acceptance}" ]] || abort 'PR #459 requires explicit acceptance of incomplete-recovery risk'
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
