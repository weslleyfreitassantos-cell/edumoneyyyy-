#!/usr/bin/env bash
set -euo pipefail
set +x

repo_root="$(git rev-parse --show-toplevel 2>/dev/null)" || {
  printf 'PROMOTION_ABORTED=repository_checkout_required\n' >&2
  exit 1
}
: "${TARGET_VERSION:?TARGET_VERSION is required}"
: "${EXPECTED_REMOTE_LAST:?EXPECTED_REMOTE_LAST is required}"
: "${EXPECTED_SOURCE_COMMIT:?EXPECTED_SOURCE_COMMIT is required}"
: "${EXPECTED_TARGET_SHA256:?EXPECTED_TARGET_SHA256 is required}"
bash "$repo_root/scripts/db/production-connection.sh" run -- \
  bash "$repo_root/scripts/db/promote-single-migration.sh"
