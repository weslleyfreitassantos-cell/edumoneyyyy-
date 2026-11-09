WITH protected_relations AS (
  SELECT
    count(relation.oid) = 6
      AND coalesce(bool_and(owner_role.rolname = current_user), false) AS owns_v12_protected_relations,
    jsonb_object_agg(protected.relname, coalesce(owner_role.rolname, 'MISSING')) AS v12_relation_owners
  FROM (VALUES
    ('learning_curriculum_skills'),
    ('learning_adaptive_content_packs'),
    ('learning_central_studies_v2_candidates'),
    ('learning_central_studies_v2_runtime'),
    ('learning_central_studies_v2_institution_targets'),
    ('learning_guided_sessions')
  ) AS protected(relname)
  LEFT JOIN pg_catalog.pg_class relation
    ON relation.relname = protected.relname
   AND relation.relnamespace = 'public'::regnamespace
  LEFT JOIN pg_catalog.pg_roles owner_role ON owner_role.oid = relation.relowner
), executor AS (
  SELECT
    session_user::text AS session_user,
    current_user::text AS current_user,
    COALESCE((SELECT rolsuper FROM pg_roles WHERE rolname = current_user), false) AS is_superuser,
    COALESCE((SELECT rolsuper FROM pg_roles WHERE rolname = session_user), false) AS session_role_is_superuser,
    has_function_privilege(current_user, 'pg_catalog.pg_control_system()', 'EXECUTE') AS can_read_cluster_identity,
    has_database_privilege(current_user, current_database(), 'CREATE') AS can_create_in_database,
    CASE
      WHEN to_regnamespace('private') IS NOT NULL
        THEN has_schema_privilege(current_user, 'private', 'CREATE')
      ELSE false
    END AS can_create_private_objects,
    CASE
      WHEN to_regclass('supabase_migrations.schema_migrations') IS NOT NULL
        THEN has_table_privilege(current_user, 'supabase_migrations.schema_migrations', 'SELECT')
      ELSE false
    END AS can_read_migration_ledger,
    CASE
      WHEN to_regclass('supabase_migrations.schema_migrations') IS NOT NULL
        THEN has_table_privilege(current_user, 'supabase_migrations.schema_migrations', 'INSERT')
          AND has_table_privilege(current_user, 'supabase_migrations.schema_migrations', 'UPDATE')
      ELSE false
    END AS can_write_migration_ledger
)
SELECT json_build_object(
  'system_identifier', CASE
    WHEN executor.can_read_cluster_identity
      THEN (SELECT system_identifier::text FROM pg_control_system())
    ELSE 'UNAUTHORIZED'
  END,
  'database', current_database(),
  'session_user', executor.session_user,
  'current_user', executor.current_user,
  'is_superuser', executor.is_superuser,
  'session_role_is_superuser', executor.session_role_is_superuser,
  'owns_v12_protected_relations', protected_relations.owns_v12_protected_relations,
  'v12_relation_owners', protected_relations.v12_relation_owners,
  'can_read_cluster_identity', executor.can_read_cluster_identity,
  'can_create_in_database', executor.can_create_in_database,
  'can_create_private_objects', executor.can_create_private_objects,
  'can_read_migration_ledger', executor.can_read_migration_ledger,
  'can_write_migration_ledger', executor.can_write_migration_ledger,
  'latest_migration', CASE
    WHEN executor.can_read_migration_ledger
      THEN (SELECT max(version)::text FROM supabase_migrations.schema_migrations)
    ELSE NULL
  END
)::text
FROM executor CROSS JOIN protected_relations;
