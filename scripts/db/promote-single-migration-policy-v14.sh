#!/usr/bin/env bash

RELEASE_BACKUP_POLICY='NOT_REQUIRED'
backup_exception='NOT_REQUIRED'

apply_release_backup_policy() {
  backup_exception='NOT_REQUIRED'
}

validate_release_source() {
  local origin_url worktree_status
  origin_url="$(git -C "${repo_root}" remote get-url origin 2>/dev/null)" || \
    abort 'cannot verify canonical repository origin'
  [[ "${origin_url}" == 'https://github.com/weslleyfreitassantos-cell/edumoneyyyy-.git' || \
    "${origin_url}" == 'git@github.com:weslleyfreitassantos-cell/edumoneyyyy-.git' ]] || \
    abort 'promotion is restricted to the canonical TecEscola repository'
  worktree_status="$(git -C "${repo_root}" status --porcelain=v1 --untracked-files=all 2>/dev/null)" || \
    abort 'cannot verify source checkout status'
  [[ -z "${worktree_status}" ]] || abort 'promotion requires a clean committed source checkout'
  [[ "$(git -C "${repo_root}" rev-parse HEAD 2>/dev/null)" == "${expected_source_commit}" ]] || \
    abort 'source commit mismatch'
}

validate_target_database_identity() {
  local expected_identity="${TECESCOLA_VERIFIED_DATABASE_IDENTITY:-}"
  [[ "${expected_identity}" =~ ^[0-9]+\|[A-Za-z0-9_]+$ ]] || \
    abort 'verified database identity from production preflight is missing'
  [[ "${database_identity}" == "${expected_identity}" ]] || \
    abort 'target database identity differs from the verified preflight identity'
}

validate_destructive_sql_review() {
  local risk_status
  risk_status="$("${python3_bin}" "${promoter_dir}/migration-release-risk.py" "${target_file}")" || \
    abort 'migration SQL risk analysis failed'
  case "${risk_status}" in
    SAFE)
      ;;
    REVIEW_REQUIRED)
      [[ "${DESTRUCTIVE_SQL_REVIEW_SHA256:-}" == "${actual_target_sha256}" ]] || \
        abort 'destructive or non-transactional SQL requires review bound to the exact migration SHA-256'
      printf 'DESTRUCTIVE_SQL_REVIEW=APPROVED_FOR_TARGET_SHA256\n'
      ;;
    *)
      abort 'migration SQL risk analysis returned an invalid result'
      ;;
  esac
}

authorize_production_write() {
  [[ "${CONFIRM_PRODUCTION_WRITE:-}" == 'I_CONFIRM_SELECTIVE_PRODUCTION_MIGRATION' ]] || \
    abort 'production write confirmation is missing'
  validate_destructive_sql_review
  printf 'PRODUCTION_WRITE_AUTHORIZATION=APPROVED\n'
}
