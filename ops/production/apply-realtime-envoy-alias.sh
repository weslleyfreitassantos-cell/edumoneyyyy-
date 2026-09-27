#!/usr/bin/env bash
set -euo pipefail
umask 077

usage() {
  printf 'Usage: %s [--check] <cds.yaml>\n' "$0" >&2
  exit 2
}

check_only=false
if [[ "${1:-}" == '--check' ]]; then
  check_only=true
  shift
fi
[[ $# == 1 ]] || usage

target="$1"
[[ -f "$target" && ! -L "$target" ]] || { printf 'BLOCKED: target must be an existing regular file, not a symlink.\n' >&2; exit 2; }
target="$(realpath -e -- "$target")"
old_count="$(grep -Ec '^[[:space:]]*address:[[:space:]]*realtime-dev[.]supabase-realtime[[:space:]]*$' "$target" || true)"
new_count="$(grep -Ec '^[[:space:]]*address:[[:space:]]*realtime[[:space:]]*$' "$target" || true)"

if [[ "$old_count" == 1 && "$new_count" == 0 ]]; then
  state='NEEDS_PATCH'
elif [[ "$old_count" == 0 && "$new_count" == 1 ]]; then
  state='ALREADY_PATCHED'
else
  printf 'BLOCKED: expected exactly one old or corrected realtime address; found old=%s corrected=%s.\n' "$old_count" "$new_count" >&2
  exit 2
fi

if [[ "$check_only" == true || "$state" == 'ALREADY_PATCHED' ]]; then
  printf 'ENVOY_ALIAS_CHECK=PASS\nstate=%s\n' "$state"
  exit 0
fi

backup_dir="${ENVOY_PATCH_BACKUP_DIR:-/var/backups/tecescola-envoy}"
if [[ ! -e "$backup_dir" ]]; then
  install -d -m 700 -- "$backup_dir"
elif [[ ! -d "$backup_dir" || -L "$backup_dir" ]]; then
  printf 'BLOCKED: backup destination must be a real directory.\n' >&2
  exit 2
else
  backup_mode="$(stat -c '%a' -- "$backup_dir")"
  (( (8#$backup_mode & 077) == 0 )) || { printf 'BLOCKED: backup destination must not grant group/other access.\n' >&2; exit 2; }
fi
target_id="$(printf '%s' "$target" | sha256sum | cut -c1-12)"
backup="$backup_dir/cds.yaml.$target_id.$(date -u +%Y%m%dT%H%M%SZ).bak"
[[ ! -e "$backup" ]] || { printf 'BLOCKED: backup already exists; inspect before retrying.\n' >&2; exit 2; }
temporary="$(mktemp "$(dirname -- "$target")/.cds.yaml.realtime.XXXXXXXX")"
trap 'rm -f -- "$temporary"' EXIT
sed -E 's/^([[:space:]]*address:[[:space:]]*)realtime-dev[.]supabase-realtime([[:space:]]*)$/\1realtime\2/' "$target" > "$temporary"
[[ "$(grep -Ec '^[[:space:]]*address:[[:space:]]*realtime-dev[.]supabase-realtime[[:space:]]*$' "$temporary" || true)" == 0 ]]
[[ "$(grep -Ec '^[[:space:]]*address:[[:space:]]*realtime[[:space:]]*$' "$temporary" || true)" == 1 ]]
chown --reference="$target" "$temporary"
chmod --reference="$target" "$temporary"
cp -p -- "$target" "$backup"
mv -f -- "$temporary" "$target"
trap - EXIT
printf 'ENVOY_ALIAS_PATCH=PASS\nbackup=%s\n' "$backup"
