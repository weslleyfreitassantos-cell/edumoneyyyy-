#!/usr/bin/env bash
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel)"
migration_file="$repo_root/supabase/migrations/20261025000700_central_estudos_v2_runtime_publication.sql"
[[ -f "$migration_file" ]] || { echo 'Migration 007 is missing' >&2; exit 1; }
classroom_migration_file="$repo_root/supabase/migrations/20261025000800_classroom_activity_authoring_v2.sql"
[[ -f "$classroom_migration_file" ]] || { echo 'Migration 008 is missing' >&2; exit 1; }

db_container="${PROMOTION_TEST_DB_CONTAINER:-$(docker ps --format '{{.Names}}' | awk '/^supabase_db_/{print; exit}')}"
[[ -n "$db_container" ]] || { echo 'Disposable Supabase PostgreSQL container not found' >&2; exit 1; }

status_output="$(npx supabase status -o env)"
raw_db_url="$(printf '%s\n' "$status_output" | sed -n 's/^DB_URL=//p' | head -n 1 | sed -E "s/^[\\\"']//; s/[\\\"']$//")"
[[ -n "$raw_db_url" ]] || { echo 'Local Supabase DB_URL unavailable' >&2; exit 1; }
local_host_check="$(RAW_DB_URL="$raw_db_url" node - <<'NODE'
const url = new URL(process.env.RAW_DB_URL || '');
if (!['postgres:', 'postgresql:'].includes(url.protocol)) process.exit(2);
if (!['127.0.0.1', 'localhost', '::1'].includes(url.hostname)) process.exit(3);
if (url.pathname !== '/postgres') process.exit(4);
process.stdout.write(url.host);
NODE
)" || { echo 'Refusing to run owner proof against a non-local database' >&2; exit 1; }

admin_password="$(BASE_DB_URL="$raw_db_url" node - <<'NODE'
const url = new URL(process.env.BASE_DB_URL || '');
process.stdout.write(decodeURIComponent(url.password));
NODE
)"
[[ -n "$admin_password" ]] || { echo 'Local Supabase database password unavailable' >&2; exit 1; }
admin_db_url="$(BASE_DB_URL="$raw_db_url" ADMIN_PASSWORD="$admin_password" node - <<'NODE'
const url = new URL(process.env.BASE_DB_URL || '');
url.username = 'supabase_admin';
url.password = process.env.ADMIN_PASSWORD || '';
url.searchParams.set('sslmode', 'disable');
// Match the hosted migration executor's connection-startup role hook: the
// authenticated session remains supabase_admin while DDL runs as postgres.
url.searchParams.set('options', '-c role=postgres');
// libpq/PostgreSQL connection URIs require spaces in option values as %20;
// URLSearchParams emits `+`, which PostgreSQL interprets literally here.
const connectionString = url.toString().replace(/([?&]options=)([^&#]*)/, (_, key, value) => key + value.replace(/\+/g, '%20'));
process.stdout.write(connectionString);
NODE
)"

work_dir="$(mktemp -d)"
isolated_work_dir="$work_dir/isolated-project"
isolated_migrations_dir="$isolated_work_dir/supabase/migrations"
mkdir -p "$isolated_migrations_dir"
cp "$repo_root/supabase/config.toml" "$isolated_work_dir/supabase/config.toml"
# Keep the applied history and migration 007, excluding newer migrations that
# may be present on the reconciled PR branch but are outside this proof.
node - "$repo_root/supabase/migrations" "$isolated_migrations_dir" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');
const [source, destination] = process.argv.slice(2);
const target = '20261025000700';
let targetCopied = false;
for (const name of fs.readdirSync(source).sort()) {
  const version = name.match(/^(\d{14})_/)?.[1];
  if (!version || version > target || !name.endsWith('.sql')) continue;
  fs.copyFileSync(path.join(source, name), path.join(destination, name));
  if (version === target) targetCopied = true;
}
if (!targetCopied) throw new Error('isolated project is missing migration 007');
NODE
cleanup() {
  docker exec "$db_container" psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 \
    -c 'ALTER ROLE postgres SUPERUSER;' >/dev/null 2>&1 || true
  rm -rf -- "$work_dir"
}
trap cleanup EXIT

psql_in_container() {
  docker exec "$db_container" psql "$@"
}

before_versions="$(psql_in_container -U postgres -d postgres -X -A -t -v ON_ERROR_STOP=1 \
  -c 'select version from supabase_migrations.schema_migrations order by version;')"
[[ "$(printf '%s\n' "$before_versions" | tail -n 1)" == '20261025000600' ]] || {
  echo 'Disposable database is not at the expected 00600 baseline' >&2
  exit 1
}
if grep -Fxq '20261025000700' <<< "$before_versions"; then
  echo 'Migration 007 is already in the disposable ledger' >&2
  exit 1
fi
before_count="$(printf '%s\n' "$before_versions" | sed '/^$/d' | wc -l | tr -d ' ')"

policy_names_before="$(psql_in_container -U postgres -d postgres -X -A -t -v ON_ERROR_STOP=1 -c \
  "select schemaname || '|' || tablename || '|' || policyname
     from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename in ('learning_skill_lessons','learning_curriculum_skills','learning_question_bank',
                        'learning_question_sets','learning_question_set_items','learning_guided_session_events')
    order by 1;")"
policy_defs_before="$(psql_in_container -U postgres -d postgres -X -A -t -v ON_ERROR_STOP=1 -c \
  "select schemaname || '|' || tablename || '|' || policyname || '|' || cmd || '|' || permissive || '|' || roles::text || '|' || coalesce(qual, '') || '|' || coalesce(with_check, '')
     from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename in ('learning_skill_lessons','learning_curriculum_skills','learning_question_bank',
                        'learning_question_sets','learning_question_set_items','learning_guided_session_events')
      and not (tablename = 'learning_skill_lessons' and policyname = 'learning_skill_lessons_select')
      and not (tablename = 'learning_curriculum_skills' and policyname = 'learning_curriculum_skills_select')
      and not (tablename = 'learning_question_bank' and policyname = 'learning_question_bank_select')
      and not (tablename = 'learning_question_sets' and policyname = 'learning_question_sets_select')
      and not (tablename = 'learning_question_set_items' and policyname = 'learning_question_set_items_select')
    order by 1;")"

docker exec -i "$db_container" psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 \
  -v "owner_password=$admin_password" >/dev/null <<'SQL'
ALTER ROLE supabase_admin LOGIN SUPERUSER PASSWORD :'owner_password';
ALTER TABLE public.learning_question_sets OWNER TO supabase_admin;
ALTER TABLE public.learning_question_set_items OWNER TO supabase_admin;
ALTER TABLE public.learning_guided_session_events OWNER TO supabase_admin;
ALTER ROLE postgres NOSUPERUSER;
SQL

# Execute the exact policy DDL that failed in production as the non-owner.
set +e
denied_output="$(psql_in_container -U postgres -d postgres -X -v ON_ERROR_STOP=1 -v VERBOSITY=verbose \
  -c 'DROP POLICY IF EXISTS learning_question_sets_select ON public.learning_question_sets;' 2>&1)"
denied_status=$?
set -e
[[ "$denied_status" -ne 0 ]] && grep -q '42501' <<< "$denied_output" && \
  grep -q 'learning_question_sets' <<< "$denied_output" || {
    echo 'PostgreSQL did not reproduce policy-owner SQLSTATE 42501' >&2
    printf '%s\n' "$denied_output" >&2
    exit 1
  }
policy_count_after_denial="$(psql_in_container -U supabase_admin -d postgres -X -A -t -v ON_ERROR_STOP=1 \
  -c "select count(*) from pg_catalog.pg_policies where schemaname='public' and tablename='learning_question_sets' and policyname='learning_question_sets_select';")"
[[ "$policy_count_after_denial" == '1' ]] || {
  echo 'Denied policy DDL unexpectedly removed the existing policy' >&2
  exit 1
}
denied_ledger_count="$(psql_in_container -U postgres -d postgres -X -A -t -v ON_ERROR_STOP=1 \
  -c "select count(*) from supabase_migrations.schema_migrations where version='20261025000700';")"
[[ "$denied_ledger_count" == '0' ]] || {
  echo 'Rejected non-owner DDL unexpectedly recorded migration 007 in the ledger' >&2
  exit 1
}
echo 'CENTRAL_STUDIES_V2_007_NON_OWNER_POLICY_DDL_42501=PASS'

# The candidate source table is postgres-owned. Reproduce the production
# SQLSTATE 42501 on the migration's first exact operation using an isolated,
# non-owner identity; this proves why candidate DDL must enter its owner role
# before touching the relation.
candidate_owner="$(psql_in_container -U postgres -d postgres -X -A -t -v ON_ERROR_STOP=1 \
  -c "select pg_catalog.pg_get_userbyid(relowner) from pg_catalog.pg_class where oid='public.learning_central_studies_v2_candidates'::regclass;")"
candidate_constraint_before="$(psql_in_container -U postgres -d postgres -X -A -t -v ON_ERROR_STOP=1 \
  -c "select count(*) from pg_catalog.pg_constraint where conrelid='public.learning_central_studies_v2_candidates'::regclass and conname='learning_central_studies_v2_candidates_publication_status_check';")"
[[ "$candidate_owner" == 'postgres' && "$candidate_constraint_before" == '1' ]] || {
  echo 'Disposable fixture does not match the production candidate-table owner/constraint' >&2
  exit 1
}
psql_in_container -U supabase_admin -d postgres -X -v ON_ERROR_STOP=1 \
  -c 'RESET ROLE; DROP ROLE IF EXISTS central_studies_v2_non_owner_probe; CREATE ROLE central_studies_v2_non_owner_probe NOLOGIN NOSUPERUSER;' >/dev/null
set +e
candidate_denied_output="$(psql_in_container -U supabase_admin -d postgres -X -v ON_ERROR_STOP=1 -v VERBOSITY=verbose \
  -c "RESET ROLE; SET SESSION AUTHORIZATION central_studies_v2_non_owner_probe; ALTER TABLE public.learning_central_studies_v2_candidates DROP CONSTRAINT learning_central_studies_v2_candidates_publication_status_check;" 2>&1)"
candidate_denied_status=$?
set -e
psql_in_container -U supabase_admin -d postgres -X -v ON_ERROR_STOP=1 \
  -c 'RESET ROLE; DROP ROLE central_studies_v2_non_owner_probe;' >/dev/null
[[ "$candidate_denied_status" -ne 0 ]] && grep -q '42501' <<< "$candidate_denied_output" && \
  grep -q 'learning_central_studies_v2_candidates' <<< "$candidate_denied_output" || {
    echo 'PostgreSQL did not reproduce candidate-table owner SQLSTATE 42501' >&2
    printf '%s\n' "$candidate_denied_output" >&2
    exit 1
  }
candidate_constraint_after_denial="$(psql_in_container -U postgres -d postgres -X -A -t -v ON_ERROR_STOP=1 \
  -c "select count(*) from pg_catalog.pg_constraint where conrelid='public.learning_central_studies_v2_candidates'::regclass and conname='learning_central_studies_v2_candidates_publication_status_check';")"
[[ "$candidate_constraint_after_denial" == '1' ]] || {
  echo 'Denied candidate DDL unexpectedly changed the relation' >&2
  exit 1
}
echo 'CENTRAL_STUDIES_V2_007_CANDIDATE_NON_OWNER_DDL_42501=PASS'

# Verify the same startup role hook used by the hosted migration executor
# through the connection URI supplied to the Supabase CLI. Keep session_user as
# the authenticated owner but run the migration as postgres.
identity_db_url="$(ADMIN_DB_URL="$admin_db_url" node - <<'NODE'
const url = new URL(process.env.ADMIN_DB_URL || '');
// The probe runs inside the database container, where PostgreSQL listens on
// its internal port rather than the host-mapped port from `supabase status`.
url.hostname = '127.0.0.1';
url.port = '5432';
process.stdout.write(url.toString());
NODE
)"
identity_output="$(psql_in_container "$identity_db_url" -X -A -t -v ON_ERROR_STOP=1 \
  -c "select json_build_object(
        'session_user', session_user::text,
        'current_user', current_user::text,
        'current_role', current_role::text,
        'role_setting', coalesce(nullif(current_setting('role', true), ''), 'none'),
        'session_is_superuser', coalesce((select rolsuper from pg_catalog.pg_roles where rolname=session_user), false)
      ) as identity")"
IDENTITY_OUTPUT="$identity_output" node - <<'NODE'
const raw = process.env.IDENTITY_OUTPUT || '';
const documents = [];
for (let i = 0; i < raw.length; i += 1) {
  if (raw[i] !== '{' && raw[i] !== '[') continue;
  try {
    const parsed = JSON.parse(raw.slice(i));
    documents.push(parsed);
    break;
  } catch { /* Continue past CLI prefix text. */ }
}
function find(value, rows = []) {
  if (!value || typeof value !== 'object') return rows;
  if (value.session_user && value.current_user) rows.push(value);
  for (const child of Object.values(value)) {
    if (typeof child === 'string' && /^[{[]/.test(child)) {
      try { find(JSON.parse(child), rows); } catch { /* Ignore non-JSON fields. */ }
    } else find(child, rows);
  }
  return rows;
}
const rows = documents.flatMap((document) => find(document));
if (rows.length !== 1) throw new Error('CLI did not return one effective identity');
const row = rows[0];
if (row.session_user !== 'supabase_admin' || row.current_user !== 'postgres' ||
    row.current_role !== 'postgres' || row.role_setting !== 'postgres' ||
    row.session_is_superuser !== true) {
  throw new Error('CLI did not reproduce the hosted owner-reset identity');
}
NODE

dry_run="$(npx supabase --workdir "$isolated_work_dir" db push --db-url "$admin_db_url" --yes --dry-run --log-level info 2>&1)"
pending_versions="$(DRY_RUN_OUTPUT="$dry_run" BEFORE_VERSIONS="$before_versions" node - <<'NODE'
const text = process.env.DRY_RUN_OUTPUT || '';
const before = new Set((process.env.BEFORE_VERSIONS || '').split(/\s+/).filter(Boolean));
const versions = [...new Set(text.match(/\d{14}/g) || [])].filter((version) => !before.has(version));
if (versions.length !== 1 || versions[0] !== '20261025000700') {
  throw new Error(`dry-run did not select only 007; selected=${versions.join(',') || 'none'}`);
}
process.stdout.write(versions.join('\n'));
NODE
)"
[[ "$pending_versions" == '20261025000700' ]] || { echo 'Unexpected dry-run selection' >&2; exit 1; }

# Apply through Supabase CLI once; the migration resets to the authenticated
# owner for protected DDL and returns to postgres before the CLI writes ledger.
npx supabase --workdir "$isolated_work_dir" db push --db-url "$admin_db_url" --yes --log-level error

after_versions="$(psql_in_container -U postgres -d postgres -X -A -t -v ON_ERROR_STOP=1 \
  -c 'select version from supabase_migrations.schema_migrations order by version;')"
after_count="$(printf '%s\n' "$after_versions" | sed '/^$/d' | wc -l | tr -d ' ')"
new_versions="$(comm -13 <(printf '%s\n' "$before_versions" | sort) <(printf '%s\n' "$after_versions" | sort))"
[[ "$after_count" -eq $((before_count + 1)) && "$new_versions" == '20261025000700' && \
  "$(printf '%s\n' "$after_versions" | tail -n 1)" == '20261025000700' ]] || {
  echo 'Migration 007 did not add exactly one ledger version' >&2
  exit 1
}

policy_names_after="$(psql_in_container -U postgres -d postgres -X -A -t -v ON_ERROR_STOP=1 -c \
  "select schemaname || '|' || tablename || '|' || policyname
     from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename in ('learning_skill_lessons','learning_curriculum_skills','learning_question_bank',
                        'learning_question_sets','learning_question_set_items','learning_guided_session_events')
    order by 1;")"
policy_defs_after="$(psql_in_container -U postgres -d postgres -X -A -t -v ON_ERROR_STOP=1 -c \
  "select schemaname || '|' || tablename || '|' || policyname || '|' || cmd || '|' || permissive || '|' || roles::text || '|' || coalesce(qual, '') || '|' || coalesce(with_check, '')
     from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename in ('learning_skill_lessons','learning_curriculum_skills','learning_question_bank',
                        'learning_question_sets','learning_question_set_items','learning_guided_session_events')
      and not (tablename = 'learning_skill_lessons' and policyname = 'learning_skill_lessons_select')
      and not (tablename = 'learning_curriculum_skills' and policyname = 'learning_curriculum_skills_select')
      and not (tablename = 'learning_question_bank' and policyname = 'learning_question_bank_select')
      and not (tablename = 'learning_question_sets' and policyname = 'learning_question_sets_select')
      and not (tablename = 'learning_question_set_items' and policyname = 'learning_question_set_items_select')
    order by 1;")"
[[ "$policy_names_before" == "$policy_names_after" && "$policy_defs_before" == "$policy_defs_after" ]] || {
  echo 'Migration changed an unrelated protected RLS policy' >&2
  exit 1
}

security_assertions="$(psql_in_container -U postgres -d postgres -X -A -t -F '|' -v ON_ERROR_STOP=1 -c \
  "select
     (select count(*) = 6 and bool_and(relrowsecurity)
        from pg_class c join pg_namespace n on n.oid=c.relnamespace
       where n.nspname='public' and c.relname in ('learning_skill_lessons','learning_curriculum_skills','learning_question_bank',
         'learning_question_sets','learning_question_set_items','learning_guided_session_events')),
     (select count(*) = 2 and bool_and(
          pg_get_expr(polqual, polrelid) like '%central_studies_v2_student_can_read%'
          and pg_get_expr(polqual, polrelid) like '%can_access_institution%')
        from pg_policy p join pg_class c on c.oid=p.polrelid join pg_namespace n on n.oid=c.relnamespace
       where n.nspname='public' and ((c.relname='learning_question_sets' and p.polname='learning_question_sets_select')
         or (c.relname='learning_question_set_items' and p.polname='learning_question_set_items_select'))),
     (select count(*) = 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
       where n.nspname='public' and c.relname='learning_guided_session_events'
         and t.tgname='central_studies_v2_active_step_write_guard' and not t.tgisinternal),
     (select count(*) = 3 and bool_and(pg_get_userbyid(c.relowner)='supabase_admin')
        from pg_class c join pg_namespace n on n.oid=c.relnamespace
       where n.nspname='public' and c.relname in ('learning_question_sets','learning_question_set_items','learning_guided_session_events')),
     (select count(*) = 3 and bool_and(pg_get_userbyid(c.relowner)='supabase_admin')
        from pg_class c join pg_namespace n on n.oid=c.relnamespace
       where n.nspname='public' and c.relname in ('learning_central_studies_v2_runtime',
         'learning_central_studies_v2_institution_targets','learning_central_studies_v2_release_events')),
     (select count(*) = 3 and bool_and(
          has_table_privilege('service_role', c.oid, 'select')
          and has_table_privilege('service_role', c.oid, 'insert')
          and has_table_privilege('service_role', c.oid, 'update')
          and has_table_privilege('service_role', c.oid, 'delete'))
        from pg_class c join pg_namespace n on n.oid=c.relnamespace
       where n.nspname='public' and c.relname in ('learning_central_studies_v2_runtime',
         'learning_central_studies_v2_institution_targets','learning_central_studies_v2_release_events')),
     (select pg_get_userbyid(p.proowner)='postgres' from pg_proc p
       where p.oid='private.central_studies_v2_journey_allowed(uuid,uuid,uuid,uuid)'::regprocedure);")"
[[ "$security_assertions" == 't|t|t|t|t|t|t' ]] || {
  echo "RLS, tenant-scope policy, trigger, or ownership assertion failed: $security_assertions" >&2
  exit 1
}

tenant_scope_assertions="$(psql_in_container -U postgres -d postgres -X -A -t -F '|' -v ON_ERROR_STOP=1 -c \
  "select
     (select count(*) = 5 and bool_and(pg_get_expr(policy_row.polqual, policy_row.polrelid)
          like '%central_studies_v2_student_can_read%')
        from pg_policy policy_row
        join pg_class relation_row on relation_row.oid = policy_row.polrelid
        join pg_namespace schema_row on schema_row.oid = relation_row.relnamespace
       where schema_row.nspname = 'public'
         and (relation_row.relname, policy_row.polname) in (
           ('learning_skill_lessons','learning_skill_lessons_select'),
           ('learning_curriculum_skills','learning_curriculum_skills_select'),
           ('learning_question_bank','learning_question_bank_select'),
           ('learning_question_sets','learning_question_sets_select'),
           ('learning_question_set_items','learning_question_set_items_select'))),
     (select count(*) = 3 and bool_and(pg_get_expr(policy_row.polqual, policy_row.polrelid)
          like '%can_access_institution%')
        from pg_policy policy_row
        join pg_class relation_row on relation_row.oid = policy_row.polrelid
        join pg_namespace schema_row on schema_row.oid = relation_row.relnamespace
       where schema_row.nspname = 'public'
         and (relation_row.relname, policy_row.polname) in (
           ('learning_question_bank','learning_question_bank_select'),
           ('learning_question_sets','learning_question_sets_select'),
           ('learning_question_set_items','learning_question_set_items_select'))),
     (select pg_get_functiondef('private.central_studies_v2_student_can_read(text)'::regprocedure)
          like '%student.institution_id = target.institution_id%'
          and pg_get_functiondef('private.central_studies_v2_student_can_read(text)'::regprocedure)
          like '%student.profile_id = auth.uid()%'
          and pg_get_functiondef('private.central_studies_v2_student_can_read(text)'::regprocedure)
          like '%upper(enrollment.status::text) = ''ACTIVE''%'
          and pg_get_functiondef('private.central_studies_v2_student_can_read(text)'::regprocedure)
          like '%class.institution_id = target.institution_id%')")"
[[ "$tenant_scope_assertions" == 't|t|t' ]] || {
  echo "Student-to-institution policy scope assertion failed: $tenant_scope_assertions" >&2
  exit 1
}

echo 'CENTRAL_STUDIES_V2_007_POSTGRES_OWNER_RESET_EXECUTION=PASS'
echo 'CENTRAL_STUDIES_V2_007_UNRELATED_RLS_POLICIES_PRESERVED=PASS'
echo 'CENTRAL_STUDIES_V2_007_INSTITUTION_SCOPE_POLICY=PASS'
echo 'CENTRAL_STUDIES_V2_007_STUDENT_INSTITUTION_BOUNDARY=PASS'
echo 'CENTRAL_STUDIES_V2_007_SINGLE_MIGRATION_LEDGER=PASS'

# Reproduce the production ownership mismatch for the one legacy question-bank
# function, prove postgres alone cannot replace it, then apply migration 008
# through Supabase's authenticated-owner/postgres-role migration connection.
cp "$classroom_migration_file" "$isolated_migrations_dir/"
function_owner_before="$(psql_in_container -U postgres -d postgres -X -A -t -v ON_ERROR_STOP=1 \
  -c "select pg_catalog.pg_get_userbyid(proowner) from pg_catalog.pg_proc where oid='public.list_teacher_learning_question_bank(uuid)'::regprocedure;")"
[[ "$function_owner_before" == 'postgres' ]] || {
  echo 'Disposable target function does not start as postgres-owned before the mismatch fixture' >&2
  exit 1
}
psql_in_container -U supabase_admin -d postgres -X -v ON_ERROR_STOP=1 \
  -c 'ALTER FUNCTION public.list_teacher_learning_question_bank(uuid) OWNER TO supabase_admin;' >/dev/null
[[ "$(psql_in_container -U postgres -d postgres -X -A -t -v ON_ERROR_STOP=1 \
  -c "select pg_catalog.pg_get_userbyid(proowner) from pg_catalog.pg_proc where oid='public.list_teacher_learning_question_bank(uuid)'::regprocedure;")" == 'supabase_admin' ]] || {
  echo 'Could not establish the production-like function owner fixture' >&2
  exit 1
}

columns_before_denied_migration="$(psql_in_container -U postgres -d postgres -X -A -t -v ON_ERROR_STOP=1 \
  -c "select count(*) from information_schema.columns where table_schema='public' and table_name='learning_assignments' and column_name in ('available_at','max_attempts');")"
[[ "$columns_before_denied_migration" == '0' ]] || {
  echo 'Disposable fixture already contains migration 008 assignment columns' >&2
  exit 1
}
set +e
denied_migration="$(docker exec -i "$db_container" psql -U postgres -d postgres -X \
  -v ON_ERROR_STOP=1 -v VERBOSITY=verbose < "$classroom_migration_file" 2>&1)"
denied_migration_status=$?
set -e
[[ "$denied_migration_status" -ne 0 ]] && grep -q '42501' <<< "$denied_migration" && \
  grep -q 'LEARNING_QUESTION_BANK_OWNER_EXECUTOR_REQUIRED' <<< "$denied_migration" || {
    echo 'The full migration did not stop at the owner guard for the wrong executor' >&2
    printf '%s\n' "$denied_migration" >&2
    exit 1
  }
columns_after_denied_migration="$(psql_in_container -U postgres -d postgres -X -A -t -v ON_ERROR_STOP=1 \
  -c "select count(*) from information_schema.columns where table_schema='public' and table_name='learning_assignments' and column_name in ('available_at','max_attempts');")"
[[ "$columns_after_denied_migration" == '0' ]] || {
  echo 'Rejected migration 008 partially changed the disposable schema' >&2
  exit 1
}
echo 'CLASSROOM_ACTIVITY_008_WRONG_EXECUTOR_FULL_MIGRATION_ROLLED_BACK=PASS'

owner_guard_sql="$(CLASSROOM_MIGRATION_FILE="$classroom_migration_file" node - <<'NODE'
const fs = require('node:fs');
const sql = fs.readFileSync(process.env.CLASSROOM_MIGRATION_FILE, 'utf8');
const startMarker = 'do $classroom_activity_question_bank_owner_guard$';
const endMarker = '$classroom_activity_question_bank_owner_guard$;';
const start = sql.indexOf(startMarker);
const end = sql.indexOf(endMarker, start);
if (start < 0 || end < 0) throw new Error('migration owner guard is missing');
process.stdout.write(sql.slice(start, end + endMarker.length));
NODE
)"
set +e
denied_owner_guard="$(psql_in_container -U postgres -d postgres -X -v ON_ERROR_STOP=1 -v VERBOSITY=verbose \
  -c "$owner_guard_sql" 2>&1)"
denied_owner_guard_status=$?
set -e
[[ "$denied_owner_guard_status" -ne 0 ]] && grep -q '42501' <<< "$denied_owner_guard" && \
  grep -q 'LEARNING_QUESTION_BANK_OWNER_EXECUTOR_REQUIRED' <<< "$denied_owner_guard" || {
    echo 'Migration 008 owner guard accepted the wrong executor context' >&2
    printf '%s\n' "$denied_owner_guard" >&2
    exit 1
  }
echo 'CLASSROOM_ACTIVITY_008_WRONG_EXECUTOR_GUARD_42501=PASS'

set +e
denied_function_replace="$(psql_in_container -U postgres -d postgres -X -v ON_ERROR_STOP=1 -v VERBOSITY=verbose \
  -c "begin; create or replace function public.list_teacher_learning_question_bank(uuid) returns void language sql as 'select'; rollback;" 2>&1)"
denied_function_replace_status=$?
set -e
[[ "$denied_function_replace_status" -ne 0 ]] && grep -q '42501' <<< "$denied_function_replace" && \
  grep -q 'list_teacher_learning_question_bank' <<< "$denied_function_replace" || {
    echo 'PostgreSQL did not reject replacement by the non-owner migration role' >&2
    printf '%s\n' "$denied_function_replace" >&2
    exit 1
  }
echo 'CLASSROOM_ACTIVITY_008_NON_OWNER_FUNCTION_REPLACEMENT_42501=PASS'

function_owner_after_denial="$(psql_in_container -U supabase_admin -d postgres -X -A -t -v ON_ERROR_STOP=1 \
  -c "select pg_catalog.pg_get_userbyid(proowner) from pg_catalog.pg_proc where oid='public.list_teacher_learning_question_bank(uuid)'::regprocedure;")"
[[ "$function_owner_after_denial" == 'supabase_admin' ]] || {
  echo 'Denied non-owner probe changed the function owner' >&2
  exit 1
}
before_008_versions="$(psql_in_container -U postgres -d postgres -X -A -t -v ON_ERROR_STOP=1 \
  -c 'select version from supabase_migrations.schema_migrations order by version;')"
before_008_count="$(printf '%s\n' "$before_008_versions" | sed '/^$/d' | wc -l | tr -d ' ')"
[[ "$(printf '%s\n' "$before_008_versions" | tail -n 1)" == '20261025000700' ]] || {
  echo 'Disposable ledger is not at the 007 predecessor before testing migration 008' >&2
  exit 1
}

dry_run_008="$(npx supabase --workdir "$isolated_work_dir" db push --db-url "$admin_db_url" --yes --dry-run --log-level info 2>&1)"
pending_008="$(DRY_RUN_OUTPUT="$dry_run_008" BEFORE_VERSIONS="$before_008_versions" node - <<'NODE'
const text = process.env.DRY_RUN_OUTPUT || '';
const before = new Set((process.env.BEFORE_VERSIONS || '').split(/\s+/).filter(Boolean));
const versions = [...new Set(text.match(/\d{14}/g) || [])].filter((version) => !before.has(version));
if (versions.length !== 1 || versions[0] !== '20261025000800') {
  throw new Error(`dry-run did not select only 008; selected=${versions.join(',') || 'none'}`);
}
process.stdout.write(versions.join('\n'));
NODE
)"
[[ "$pending_008" == '20261025000800' ]] || { echo 'Unexpected migration 008 dry-run selection' >&2; exit 1; }

npx supabase --workdir "$isolated_work_dir" db push --db-url "$admin_db_url" --yes --log-level error

after_008_versions="$(psql_in_container -U postgres -d postgres -X -A -t -v ON_ERROR_STOP=1 \
  -c 'select version from supabase_migrations.schema_migrations order by version;')"
after_008_count="$(printf '%s\n' "$after_008_versions" | sed '/^$/d' | wc -l | tr -d ' ')"
new_008_versions="$(comm -13 <(printf '%s\n' "$before_008_versions" | sort) <(printf '%s\n' "$after_008_versions" | sort))"
[[ "$after_008_count" -eq $((before_008_count + 1)) && "$new_008_versions" == '20261025000800' && \
  "$(printf '%s\n' "$after_008_versions" | tail -n 1)" == '20261025000800' ]] || {
  echo 'Migration 008 did not add exactly one ledger version' >&2
  exit 1
}

ownership_assertions="$(psql_in_container -U postgres -d postgres -X -A -t -F '|' -v ON_ERROR_STOP=1 -c \
  "select
     (select pg_catalog.pg_get_userbyid(proowner)='supabase_admin'
        and prosecdef
        and coalesce(proconfig, '{}'::text[]) @> array['search_path=""']
        and has_function_privilege('authenticated', oid, 'execute')
        and not has_function_privilege('anon', oid, 'execute')
        from pg_catalog.pg_proc where oid='public.list_teacher_learning_question_bank(uuid)'::regprocedure),
     (select count(*)=5 and bool_and(pg_catalog.pg_get_userbyid(function_row.proowner)='postgres')
        from pg_catalog.pg_proc function_row
       where function_row.oid in (
         'public.search_teacher_learning_question_bank_v1(uuid,text,text,text,text,text,uuid,integer,integer)'::regprocedure,
         'public.publish_learning_activity_to_classes_v1(uuid,uuid[],timestamp with time zone,timestamp with time zone,integer)'::regprocedure,
         'public.archive_learning_activity_v1(uuid)'::regprocedure,
         'public.list_student_learning_activities(uuid)'::regprocedure,
         'private.enforce_learning_assignment_attempt_policy()'::regprocedure
       ))")"
[[ "$ownership_assertions" == 't|t' ]] || {
  echo "Migration 008 ownership, SECURITY DEFINER, search_path, or grants assertion failed: $ownership_assertions" >&2
  exit 1
}
echo 'CLASSROOM_ACTIVITY_008_OWNER_PRESERVED=PASS'
echo 'CLASSROOM_ACTIVITY_008_SECURITY_DEFINER_AND_ACL=PASS'
echo 'CLASSROOM_ACTIVITY_008_OTHER_FUNCTIONS_REMAIN_POSTGRES_OWNED=PASS'
echo 'CLASSROOM_ACTIVITY_008_SINGLE_MIGRATION_LEDGER=PASS'
