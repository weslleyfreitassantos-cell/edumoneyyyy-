#!/usr/bin/env bash
set -euo pipefail

script="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)/apply-realtime-envoy-alias.sh"
work="$(mktemp -d "${TMPDIR:-/tmp}/tecescola-envoy-alias-test.XXXXXXXX")"
trap 'rm -rf -- "$work"' EXIT
export ENVOY_PATCH_BACKUP_DIR="$work/backups"

cat > "$work/cds.yaml" <<'EOF'
static_resources:
  clusters:
  - name: realtime
    load_assignment:
      endpoints:
      - lb_endpoints:
        - endpoint:
          address: realtime-dev.supabase-realtime
  - name: unrelated
    load_assignment:
      endpoints:
      - lb_endpoints:
        - endpoint:
          address: keep-this-value
EOF
chmod 640 "$work/cds.yaml"

"$script" --check "$work/cds.yaml" | grep -qx 'ENVOY_ALIAS_CHECK=PASS'
"$script" "$work/cds.yaml" | grep -qx 'ENVOY_ALIAS_PATCH=PASS'
[[ "$(stat -c '%a' "$work/cds.yaml")" == 640 ]]
backup_files=("$work"/backups/cds.yaml.*.bak)
[[ ${#backup_files[@]} == 1 && -f "${backup_files[0]}" ]]
grep -qx '          address: realtime' "$work/cds.yaml"
grep -qx '          address: keep-this-value' "$work/cds.yaml"
"$script" "$work/cds.yaml" | grep -qx 'ENVOY_ALIAS_CHECK=PASS'
"$script" --check "$work/cds.yaml" | grep -qx 'ENVOY_ALIAS_CHECK=PASS'

cat > "$work/ambiguous.yaml" <<'EOF'
clusters:
  address: realtime-dev.supabase-realtime
  address: realtime-dev.supabase-realtime
EOF
cp -p "$work/ambiguous.yaml" "$work/ambiguous.before"
if "$script" "$work/ambiguous.yaml" >/dev/null 2>&1; then
  printf 'FAIL: ambiguous config was accepted.\n' >&2
  exit 1
fi
cmp -s "$work/ambiguous.before" "$work/ambiguous.yaml"
printf 'REALTIME_ENVOY_PATCH_TEST=PASS\n'
