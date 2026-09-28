#!/usr/bin/env bash
set -euo pipefail

script="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)/backup-offsite-edumoney.sh"
work="$(mktemp -d "${TMPDIR:-/tmp}/tecescola-offsite-test.XXXXXXXX")"
trap 'rm -rf -- "$work"' EXIT
mkdir -p "$work/bin" "$work/backups" "$work/bundle" "$work/remote" "$work/tmp"
printf 'age1testrecipient\n' > "$work/recipient"

cat > "$work/bin/age" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
[[ "${AGE_TEST_FAIL:-0}" != 1 ]] || exit 9
while (($#)); do
  case "$1" in
    --recipient) shift 2 ;;
    --output) output="$2"; shift 2 ;;
    *) input="$1"; shift ;;
  esac
done
cp -- "$input" "$output"
EOF

cat > "$work/bin/rclone" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
remote_path() { printf '%s' "${1#fake:}"; }
case "$1" in
  mkdir) mkdir -p -- "$(remote_path "$2")" ;;
  copyto)
    shift
    while [[ "$1" == --* ]]; do shift 2; done
    mkdir -p -- "$(dirname -- "$(remote_path "$2")")"
    cp -- "$1" "$(remote_path "$2")"
    ;;
  cat) cat -- "$(remote_path "$2")" ;;
  delete) exit 0 ;;
  *) exit 2 ;;
esac
EOF
chmod 700 "$work/bin/age" "$work/bin/rclone"

printf 'fixture database\n' > "$work/bundle/postgres.dump"
printf 'fixture globals\n' > "$work/bundle/globals.sql"
printf 'fixture metadata\n' > "$work/bundle/supabase-meta.dump"
printf 'fixture storage\n' > "$work/bundle/storage.tar.gz"
printf 'fixture config\n' > "$work/bundle/config.tar.gz"
printf 'created_utc=test\n' > "$work/bundle/MANIFEST.txt"
(cd "$work/bundle" && sha256sum globals.sql postgres.dump supabase-meta.dump storage.tar.gz config.tar.gz > SHA256SUMS)
tar -C "$work/bundle" -czf "$work/backups/edumoney-2026-01-01T00-00-00Z.tar.gz" \
  globals.sql postgres.dump supabase-meta.dump storage.tar.gz config.tar.gz SHA256SUMS MANIFEST.txt

export PATH="$work/bin:$PATH"
export BACKUP_ROOT="$work/backups"
export AGE_RECIPIENT_FILE="$work/recipient"
export OFFSITE_REMOTE="fake:$work/remote"
export OFFSITE_STATE_FILE="$work/state/offsite.state"
export OFFSITE_TEMP_ROOT="$work/tmp"
"$script" | grep -q '^OFFSITE_BACKUP=PASS '
grep -qx 'status=SUCCESS' "$OFFSITE_STATE_FILE"
remote_file=("$work/remote"/*.age)
[[ ${#remote_file[@]} == 1 && -s "${remote_file[0]}" ]]

if AGE_TEST_FAIL=1 "$script" >/dev/null 2>&1; then
  printf 'FAIL: simulated encryption failure was accepted.\n' >&2
  exit 1
fi
grep -qx 'status=FAIL' "$OFFSITE_STATE_FILE"
"$script" >/dev/null
grep -qx 'status=SUCCESS' "$OFFSITE_STATE_FILE"
printf 'OFFSITE_BACKUP_TEST=PASS\n'
