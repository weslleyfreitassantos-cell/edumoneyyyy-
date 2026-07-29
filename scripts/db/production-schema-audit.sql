-- =============================================================================
-- EduManager Pro — SCHEMA AUDIT: mapeamento completo do schema remoto
-- =============================================================================
-- Projeto: jrdmrhsqqclnrouoednn
-- Instrucao: Executar no SQL Editor do Supabase Dashboard.
--            Usar o resultado para validar os scripts de limpeza.
-- =============================================================================

-----------------------------------------------------------------------------
-- 1. Todas as tabelas de usuario no schema public
-----------------------------------------------------------------------------
select
  table_name,
  table_type,
  pg_size_pretty(pg_total_relation_size(quote_ident(table_schema) || '.' || quote_ident(table_name))) as estimated_size
from information_schema.tables
where table_schema = 'public'
  and table_type = 'BASE TABLE'
order by table_name;

-----------------------------------------------------------------------------
-- 2. Todas as foreign keys do schema public
-----------------------------------------------------------------------------
select
  tc.constraint_name,
  tc.table_name as tabela_filha,
  kcu.column_name as coluna_filha,
  ccu.table_name as tabela_pai,
  ccu.column_name as coluna_pai,
  rc.delete_rule as on_delete
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
  on tc.constraint_name = kcu.constraint_name
  and tc.table_schema = kcu.table_schema
join information_schema.constraint_column_usage ccu
  on ccu.constraint_name = tc.constraint_name
  and ccu.table_schema = tc.table_schema
join information_schema.referential_constraints rc
  on rc.constraint_name = tc.constraint_name
  and rc.constraint_schema = tc.table_schema
where tc.constraint_type = 'FOREIGN KEY'
  and tc.table_schema = 'public'
order by tc.table_name, kcu.column_name;

-----------------------------------------------------------------------------
-- 3. Tabelas que possuem coluna account_id
-----------------------------------------------------------------------------
select table_name, column_name
from information_schema.columns
where table_schema = 'public'
  and column_name = 'account_id'
  and table_name in (
    select table_name from information_schema.tables
    where table_schema = 'public' and table_type = 'BASE TABLE'
  )
order by table_name;

-----------------------------------------------------------------------------
-- 4. Tabelas que possuem coluna institution_id
-----------------------------------------------------------------------------
select table_name, column_name
from information_schema.columns
where table_schema = 'public'
  and column_name = 'institution_id'
  and table_name in (
    select table_name from information_schema.tables
    where table_schema = 'public' and table_type = 'BASE TABLE'
  )
order by table_name;

-----------------------------------------------------------------------------
-- 5. Tabelas que possuem coluna profile_id
-----------------------------------------------------------------------------
select table_name, column_name
from information_schema.columns
where table_schema = 'public'
  and column_name like '%profile_id%'
  and table_name in (
    select table_name from information_schema.tables
    where table_schema = 'public' and table_type = 'BASE TABLE'
  )
order by table_name;

-----------------------------------------------------------------------------
-- 6. Tabelas que possuem coluna class_id
-----------------------------------------------------------------------------
select table_name, column_name
from information_schema.columns
where table_schema = 'public'
  and column_name like '%class_id%'
  and table_name in (
    select table_name from information_schema.tables
    where table_schema = 'public' and table_type = 'BASE TABLE'
  )
order by table_name;

-----------------------------------------------------------------------------
-- 7. Tabelas que referenciam auth.users
-----------------------------------------------------------------------------
select
  tc.table_name as tabela_filha,
  kcu.column_name as coluna
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
  on tc.constraint_name = kcu.constraint_name
  and tc.table_schema = kcu.table_schema
join information_schema.constraint_column_usage ccu
  on ccu.constraint_name = tc.constraint_name
  and ccu.table_schema = tc.table_schema
where tc.constraint_type = 'FOREIGN KEY'
  and ccu.table_name = 'users'
  and ccu.table_schema = 'auth'
order by tc.table_name;

-----------------------------------------------------------------------------
-- 8. Resumo: tabelas NAO classificadas no script de limpeza
--    (lista as que estao no banco mas NAO constam no dry-run)
-----------------------------------------------------------------------------
with tabelas_no_banco as (
  select table_name
  from information_schema.tables
  where table_schema = 'public'
    and table_type = 'BASE TABLE'
),
tabelas_no_script as (
  values
    ('institutions'), ('profiles'), ('accounts'),
    ('account_status_events'), ('branding_settings'), ('account_domains'),
    ('memberships'), ('academic_years'), ('terms'),
    ('academic_policies'), ('classes'), ('subjects'),
    ('class_curriculum_items'), ('students'), ('guardianships'),
    ('subject_offerings'), ('enrollments'), ('student_registration_counters'),
    ('assessments'), ('grades'), ('attendance_sessions'),
    ('attendance_records'), ('term_closures'), ('student_term_results'),
    ('rooms'), ('timetable_entries')
)
select
  t.table_name as tabela_nao_classificada
from tabelas_no_banco t
left join tabelas_no_script s on t.table_name = s.column1
where s.column1 is null
order by t.table_name;

-----------------------------------------------------------------------------
-- 9. Enums do schema public
-----------------------------------------------------------------------------
select t.typname as enum_name,
  string_agg(e.enumlabel, ', ' order by e.enumsortorder) as values
from pg_type t
join pg_enum e on t.oid = e.enumtypid
join pg_catalog.pg_namespace n on n.oid = t.typnamespace
where n.nspname = 'public'
group by t.typname
order by t.typname;
