-- READ-ONLY AUDIT SCRIPT
-- Execute manualmente no Supabase SQL Editor.
-- Nao altera dados.
-- Revise antes de executar.

-- 1. Schemas relevantes.
select
  'schemas_relevantes' as audit_section,
  schema_name
from information_schema.schemata
where schema_name in (
  'public',
  'auth',
  'storage',
  'realtime',
  'supabase_migrations'
)
order by schema_name;

-- 2. Possiveis tabelas de historico de migrations.
select
  'migration_history_candidates' as audit_section,
  n.nspname as schema_name,
  c.relname as relation_name,
  c.relkind as relation_kind
from pg_class as c
join pg_namespace as n
  on n.oid = c.relnamespace
where (
  n.nspname = 'supabase_migrations'
  and c.relname = 'schema_migrations'
)
or (
  n.nspname = 'auth'
  and c.relname = 'schema_migrations'
)
or (
  n.nspname = 'storage'
  and c.relname = 'migrations'
)
or (
  n.nspname = 'realtime'
  and c.relname = 'schema_migrations'
)
order by
  n.nspname,
  c.relname;

-- 3. Tabelas publicas e colunas.
select
  'public_columns' as audit_section,
  table_name,
  ordinal_position,
  column_name,
  data_type,
  udt_name,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
order by
  table_name,
  ordinal_position;

-- 4. Enums existentes.
select
  'enums' as audit_section,
  n.nspname as schema_name,
  t.typname as enum_name,
  e.enumsortorder,
  e.enumlabel as enum_value
from pg_type as t
join pg_enum as e
  on e.enumtypid = t.oid
join pg_namespace as n
  on n.oid = t.typnamespace
where n.nspname in ('public', 'auth', 'storage', 'realtime')
order by
  n.nspname,
  t.typname,
  e.enumsortorder;

-- 5. RLS por tabela publica.
select
  'rls_public_tables' as audit_section,
  n.nspname as schema_name,
  c.relname as table_name,
  c.relrowsecurity as rowsecurity,
  c.relforcerowsecurity as relforcerowsecurity
from pg_class as c
join pg_namespace as n
  on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
order by c.relname;

-- 6. Policies.
select
  'policies' as audit_section,
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname in ('public', 'storage')
order by
  schemaname,
  tablename,
  policyname;

-- 7. Foreign keys.
select
  'foreign_keys' as audit_section,
  source_ns.nspname as source_schema,
  source_table.relname as source_table,
  source_column.attname as source_column,
  target_ns.nspname as target_schema,
  target_table.relname as target_table,
  target_column.attname as target_column,
  constraint_record.conname as constraint_name
from pg_constraint as constraint_record
join pg_class as source_table
  on source_table.oid = constraint_record.conrelid
join pg_namespace as source_ns
  on source_ns.oid = source_table.relnamespace
join pg_class as target_table
  on target_table.oid = constraint_record.confrelid
join pg_namespace as target_ns
  on target_ns.oid = target_table.relnamespace
join unnest(constraint_record.conkey) with ordinality as source_columns(attnum, ord)
  on true
join unnest(constraint_record.confkey) with ordinality as target_columns(attnum, ord)
  on target_columns.ord = source_columns.ord
join pg_attribute as source_column
  on source_column.attrelid = source_table.oid
 and source_column.attnum = source_columns.attnum
join pg_attribute as target_column
  on target_column.attrelid = target_table.oid
 and target_column.attnum = target_columns.attnum
where constraint_record.contype = 'f'
  and source_ns.nspname = 'public'
order by
  source_table.relname,
  constraint_record.conname,
  source_columns.ord;

-- 8. Indexes principais.
select
  'indexes' as audit_section,
  schemaname,
  tablename,
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
order by
  tablename,
  indexname;

-- 9. Estimativa de quantidade de linhas em tabelas publicas relevantes.
select
  'public_table_estimated_rows' as audit_section,
  n.nspname as schema_name,
  c.relname as table_name,
  c.reltuples::bigint as estimated_rows
from pg_class as c
join pg_namespace as n
  on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relname in (
    'institutions',
    'profiles',
    'memberships',
    'academic_years',
    'terms',
    'students',
    'guardianships',
    'classes',
    'subjects',
    'subject_offerings',
    'enrollments',
    'student_registration_counters',
    'assessments',
    'grades',
    'attendance_sessions',
    'attendance_records'
  )
order by c.relname;

-- 10. Conferencia de relacoes esperadas.
select
  'expected_public_relations' as audit_section,
  expected.table_name,
  to_regclass(format('public.%I', expected.table_name)) as relation_regclass
from (
  values
    ('institutions'),
    ('profiles'),
    ('memberships'),
    ('academic_years'),
    ('terms'),
    ('students'),
    ('guardianships'),
    ('classes'),
    ('subjects'),
    ('subject_offerings'),
    ('enrollments'),
    ('student_registration_counters'),
    ('assessments'),
    ('grades'),
    ('attendance_sessions'),
    ('attendance_records')
) as expected(table_name)
order by expected.table_name;
