-- Read-only inventory for the self-hosted Supabase PostgreSQL instance.
-- Run via psql and save output only to an access-controlled location.
begin transaction read only;

select current_database() as database_name,
       current_user as audit_role,
       current_setting('server_version') as postgres_version,
       now() at time zone 'utc' as captured_at_utc,
       to_regclass('supabase_migrations.schema_migrations') as cli_migration_history,
       to_regclass('auth.schema_migrations') as auth_migration_history,
       to_regclass('storage.migrations') as storage_migration_history,
       to_regclass('realtime.schema_migrations') as realtime_migration_history;

select nspname as schema_name
from pg_catalog.pg_namespace
where nspname !~ '^pg_' and nspname <> 'information_schema'
order by nspname;

select extname as extension_name, extversion as extension_version, nspname as installed_schema
from pg_catalog.pg_extension e
join pg_catalog.pg_namespace n on n.oid = e.extnamespace
order by extname;

select n.nspname as schema_name, t.typname as enum_name,
       string_agg(e.enumlabel, ', ' order by e.enumsortorder) as enum_values
from pg_catalog.pg_type t
join pg_catalog.pg_enum e on e.enumtypid = t.oid
join pg_catalog.pg_namespace n on n.oid = t.typnamespace
group by n.nspname, t.typname
order by n.nspname, t.typname;

select table_schema, table_name, column_name, ordinal_position, data_type,
       udt_schema, udt_name, is_nullable, column_default
from information_schema.columns
where table_schema not in ('pg_catalog', 'information_schema')
  and table_schema not like 'pg_toast%'
order by table_schema, table_name, ordinal_position;

select ns.nspname as schema_name, cls.relname as table_name,
       con.conname as constraint_name, con.contype as constraint_type,
       pg_get_constraintdef(con.oid, true) as definition
from pg_catalog.pg_constraint con
join pg_catalog.pg_class cls on cls.oid = con.conrelid
join pg_catalog.pg_namespace ns on ns.oid = cls.relnamespace
where ns.nspname not in ('pg_catalog', 'information_schema')
order by ns.nspname, cls.relname, con.conname;

select schemaname as schema_name, tablename as table_name,
       indexname as index_name, indexdef as definition
from pg_catalog.pg_indexes
where schemaname not in ('pg_catalog', 'information_schema')
order by schemaname, tablename, indexname;

-- Catalog estimates only; this avoids full table scans or exporting row data.
select ns.nspname as schema_name, cls.relname as table_name,
       greatest(cls.reltuples, 0)::bigint as estimated_rows,
       pg_size_pretty(pg_total_relation_size(cls.oid)) as total_size,
       stats.n_live_tup as estimated_live_rows,
       stats.last_analyze, stats.last_autoanalyze
from pg_catalog.pg_class cls
join pg_catalog.pg_namespace ns on ns.oid = cls.relnamespace
left join pg_catalog.pg_stat_user_tables stats on stats.relid = cls.oid
where cls.relkind in ('r', 'p')
  and ns.nspname not in ('pg_catalog', 'information_schema')
order by ns.nspname, cls.relname;

select ns.nspname as schema_name, cls.relname as table_name,
       trg.tgname as trigger_name, pg_get_triggerdef(trg.oid, true) as definition
from pg_catalog.pg_trigger trg
join pg_catalog.pg_class cls on cls.oid = trg.tgrelid
join pg_catalog.pg_namespace ns on ns.oid = cls.relnamespace
where not trg.tgisinternal
  and ns.nspname not in ('pg_catalog', 'information_schema')
order by ns.nspname, cls.relname, trg.tgname;

select ns.nspname as schema_name, cls.relname as table_name,
       cls.relrowsecurity as rls_enabled, cls.relforcerowsecurity as rls_forced
from pg_catalog.pg_class cls
join pg_catalog.pg_namespace ns on ns.oid = cls.relnamespace
where cls.relkind in ('r', 'p')
  and ns.nspname not in ('pg_catalog', 'information_schema')
order by ns.nspname, cls.relname;

select schemaname as schema_name, tablename as table_name, policyname,
       permissive, roles, cmd, qual, with_check
from pg_catalog.pg_policies
order by schemaname, tablename, policyname;

select ns.nspname as schema_name, p.proname as function_name,
       pg_get_function_identity_arguments(p.oid) as arguments,
       pg_get_userbyid(p.proowner) as owner_name, l.lanname as language,
       p.prosecdef as security_definer,
       coalesce(array_to_string(p.proconfig, ','), '') as function_settings,
       md5(pg_get_functiondef(p.oid)) as definition_md5
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace ns on ns.oid = p.pronamespace
join pg_catalog.pg_language l on l.oid = p.prolang
where ns.nspname not in ('pg_catalog', 'information_schema')
  and p.prokind in ('f', 'p')
order by ns.nspname, p.proname, arguments;

select rolname, rolsuper, rolcreaterole, rolcreatedb, rolcanlogin, rolreplication,
       rolbypassrls, rolvaliduntil
from pg_catalog.pg_roles
order by rolname;

select to_regclass('storage.buckets') as storage_buckets_relation,
       to_regclass('storage.objects') as storage_objects_relation,
       to_regclass('auth.users') as auth_users_relation;

commit;
