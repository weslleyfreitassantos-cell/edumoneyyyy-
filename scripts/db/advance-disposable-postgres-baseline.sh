#!/usr/bin/env bash
set -euo pipefail

from_version="${1:-}"
through_version="${2:-}"
if [[ ! "$from_version" =~ ^[0-9]{14}$ || ! "$through_version" =~ ^[0-9]{14}$ || "$from_version" -ge "$through_version" ]]; then
  echo 'Usage: advance-disposable-postgres-baseline.sh <current-ledger-version> <target-ledger-version>' >&2
  exit 2
fi

repo_root="$(git rev-parse --show-toplevel)"
migrations_dir="$repo_root/supabase/migrations"
db_container="${PROMOTION_TEST_DB_CONTAINER:-$(docker ps --format '{{.Names}}' | awk '/^supabase_db_/ { print; exit }')}"
[[ "$db_container" =~ ^supabase_db_ ]] || {
  echo 'Refusing to use a non-disposable or unrecognized PostgreSQL container' >&2
  exit 1
}

status_output="$(npx supabase status -o env)"
raw_db_url="$(printf '%s\n' "$status_output" | sed -n 's/^DB_URL=//p' | head -n 1 | sed -E "s/^[\\\"']//; s/[\\\"']$//")"
[[ -n "$raw_db_url" ]] || { echo 'Local Supabase DB_URL unavailable' >&2; exit 1; }
node - "$raw_db_url" <<'NODE'
const url = new URL(process.argv[2] || '');
if (!['postgres:', 'postgresql:'].includes(url.protocol) ||
    !['127.0.0.1', 'localhost', '::1'].includes(url.hostname) ||
    url.pathname !== '/postgres') {
  throw new Error('Refusing to advance a database URL that is not the local disposable Supabase database.');
}
NODE

migration_manifest="$(node - "$migrations_dir" "$from_version" "$through_version" <<'NODE'
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const [directory, from, through] = process.argv.slice(2);
const rows = fs.readdirSync(directory)
  .filter((name) => /^\d{14}_.+\.sql$/.test(name))
  .sort()
  .map((name) => ({ name, version: name.slice(0, 14), fullPath: path.join(directory, name) }));
const versions = new Set();
for (const row of rows) {
  if (versions.has(row.version)) throw new Error(`Duplicate migration version ${row.version}`);
  versions.add(row.version);
}
const included = rows.filter((row) => row.version <= through);
if (!included.some((row) => row.version === from) || !included.some((row) => row.version === through)) {
  throw new Error('The baseline and target must both identify migrations present in the repository.');
}
const hashThrough = (limit) => {
  const hash = createHash('sha256');
  for (const row of included.filter(({ version }) => version <= limit)) {
    hash.update(row.name).update('\0').update(fs.readFileSync(row.fullPath)).update('\0');
  }
  return hash.digest('hex');
};
const appliedAtBaseline = included.filter(({ version }) => version <= from).map(({ version }) => version);
const appliedAtTarget = included.map(({ version }) => version);
process.stdout.write(JSON.stringify({
  baselineHash: hashThrough(from),
  targetHash: hashThrough(through),
  baselineVersions: appliedAtBaseline,
  targetVersions: appliedAtTarget,
  migrations: included.map(({ name }) => name),
}));
NODE
)"

expected_baseline_versions="$(node -e 'process.stdout.write(JSON.parse(process.argv[1]).baselineVersions.join("\n"))' "$migration_manifest")"
expected_target_versions="$(node -e 'process.stdout.write(JSON.parse(process.argv[1]).targetVersions.join("\n"))' "$migration_manifest")"
baseline_hash="$(node -e 'process.stdout.write(JSON.parse(process.argv[1]).baselineHash)' "$migration_manifest")"
target_hash="$(node -e 'process.stdout.write(JSON.parse(process.argv[1]).targetHash)' "$migration_manifest")"
current_versions="$(docker exec "$db_container" psql -X -U postgres -d postgres -A -t -v ON_ERROR_STOP=1 \
  -c 'select version from supabase_migrations.schema_migrations order by version;')"
[[ "$current_versions" == "$expected_baseline_versions" ]] || {
  echo "Disposable PostgreSQL ledger does not exactly match baseline $from_version; refusing to guess or reset." >&2
  exit 1
}

printf 'DISPOSABLE_POSTGRES_BASELINE version=%s migration_sha256=%s\n' "$from_version" "$baseline_hash"
printf 'DISPOSABLE_POSTGRES_TARGET version=%s migration_sha256=%s\n' "$through_version" "$target_hash"

staged_project="$(mktemp -d)"
trap 'rm -rf -- "$staged_project"' EXIT
mkdir -p "$staged_project/supabase/migrations"
cp "$repo_root/supabase/config.toml" "$staged_project/supabase/config.toml"
while IFS= read -r migration; do
  [[ -n "$migration" ]] && cp "$migrations_dir/$migration" "$staged_project/supabase/migrations/$migration"
done < <(node -e 'for (const migration of JSON.parse(process.argv[1]).migrations) console.log(migration)' "$migration_manifest")

npx supabase --workdir "$staged_project" db push --db-url "$raw_db_url" --yes --log-level error

result_versions="$(docker exec "$db_container" psql -X -U postgres -d postgres -A -t -v ON_ERROR_STOP=1 \
  -c 'select version from supabase_migrations.schema_migrations order by version;')"
[[ "$result_versions" == "$expected_target_versions" ]] || {
  echo "Disposable PostgreSQL did not reach the exact target ledger $through_version." >&2
  exit 1
}
printf 'DISPOSABLE_POSTGRES_TARGET_VALIDATED version=%s migration_sha256=%s\n' "$through_version" "$target_hash"
