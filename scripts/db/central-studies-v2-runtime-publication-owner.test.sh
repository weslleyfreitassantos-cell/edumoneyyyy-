#!/usr/bin/env bash
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel)"
migration_file="$repo_root/supabase/migrations/20261025000700_central_estudos_v2_runtime_publication.sql"
[[ -f "$migration_file" ]] || { echo 'Migration 007 is missing' >&2; exit 1; }

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

admin_password='ci_owner_reset_probe_only_2026'
admin_db_url="$(BASE_DB_URL="$raw_db_url" ADMIN_PASSWORD="$admin_password" node - <<'NODE'
const url = new URL(process.env.BASE_DB_URL || '');
url.username = 'supabase_admin';
url.password = process.env.ADMIN_PASSWORD || '';
url.searchParams.set('sslmode', 'disable');
process.stdout.write(url.toString());
NODE
)"

work_dir="$(mktemp -d)"
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

psql_in_container -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -c \
  "ALTER ROLE supabase_admin LOGIN SUPERUSER PASSWORD '$admin_password';
   ALTER TABLE public.learning_question_sets OWNER TO supabase_admin;
   ALTER TABLE public.learning_question_set_items OWNER TO supabase_admin;
   ALTER TABLE public.learning_guided_session_events OWNER TO supabase_admin;
   ALTER ROLE postgres NOSUPERUSER;" >/dev/null

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

# Supabase's migration executor applies its after-connect role hook; `db query`
# is a standalone prepared statement and does not run that hook. Reproduce the
# exact executor identity in a disposable psql session, then validate the CLI
# migration path below against the same isolated database.
identity_output="$(psql_in_container -U supabase_admin -d postgres -X -A -t -v ON_ERROR_STOP=1 \
  -c "SET SESSION ROLE postgres; RESET ALL; \
      select json_build_object('session_user', session_user::text, 'current_user', current_user::text, 'current_role', current_role::text, 'role_setting', coalesce(nullif(current_setting('role', true), ''), 'none')) as identity")"
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
    row.current_role !== 'postgres' || row.role_setting !== 'postgres') {
  throw new Error('CLI did not reproduce the hosted owner-reset identity');
}
NODE

dry_run="$(npx supabase --workdir "$repo_root" db push --db-url "$admin_db_url" --yes --dry-run --log-level info 2>&1)"
pending_versions="$(DRY_RUN_OUTPUT="$dry_run" BEFORE_VERSIONS="$before_versions" node - <<'NODE'
const text = process.env.DRY_RUN_OUTPUT || '';
const before = new Set((process.env.BEFORE_VERSIONS || '').split(/\s+/).filter(Boolean));
const versions = [...new Set(text.match(/\b\d{14}\b/g) || [])].filter((version) => !before.has(version));
if (versions.length !== 1 || versions[0] !== '20261025000700') {
  throw new Error(`dry-run did not select only 007; selected=${versions.join(',') || 'none'}`);
}
process.stdout.write(versions.join('\n'));
NODE
)"
[[ "$pending_versions" == '20261025000700' ]] || { echo 'Unexpected dry-run selection' >&2; exit 1; }

# Apply through Supabase CLI once; the migration resets to the authenticated
# owner for protected DDL and returns to postgres before the CLI writes ledger.
npx supabase --workdir "$repo_root" db push --db-url "$admin_db_url" --yes --log-level error

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
       where n.nspname='public' and c.relname in ('learning_question_sets','learning_question_set_items','learning_guided_session_events'));")"
[[ "$security_assertions" == 't|t|t|t' ]] || {
  echo "RLS, tenant-scope policy, trigger, or owner-preservation assertion failed: $security_assertions" >&2
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
