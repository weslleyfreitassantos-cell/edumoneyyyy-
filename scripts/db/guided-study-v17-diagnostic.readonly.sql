-- Read-only diagnostic for the V17 guided-study promotion.
-- This script intentionally returns catalog metadata only, never student/content rows.
BEGIN TRANSACTION READ ONLY;

WITH expected_relations(schema_name, relation_name) AS (
  VALUES
    ('public', 'learning_adaptive_content_packs'),
    ('public', 'learning_curriculum_catalogs'),
    ('public', 'learning_curriculum_skills'),
    ('public', 'learning_curriculum_grade_targets'),
    ('public', 'learning_skill_lessons'),
    ('public', 'learning_question_bank'),
    ('public', 'learning_question_bank_skill_links'),
    ('public', 'learning_question_sets'),
    ('public', 'learning_question_set_items'),
    ('public', 'subjects'),
    ('public', 'learning_curriculum_subject_links'),
    ('private', 'learning_guided_subject_skill_bindings_v16'),
    ('private', 'learning_curriculum_subject_links_v13')
), role_info AS (
  SELECT
    session_user::text AS session_user,
    current_user::text AS current_user,
    current_database() AS database_name,
    current_setting('server_version') AS server_version,
    COALESCE((SELECT rolsuper FROM pg_catalog.pg_roles WHERE rolname = session_user), false) AS session_user_is_superuser,
    COALESCE((SELECT rolsuper FROM pg_catalog.pg_roles WHERE rolname = current_user), false) AS current_user_is_superuser,
    COALESCE((SELECT rolbypassrls FROM pg_catalog.pg_roles WHERE rolname = current_user), false) AS current_user_bypasses_rls,
    has_database_privilege(current_user, current_database(), 'CREATE') AS database_create,
    has_table_privilege(current_user, 'supabase_migrations.schema_migrations', 'SELECT') AS ledger_select,
    has_table_privilege(current_user, 'supabase_migrations.schema_migrations', 'INSERT') AS ledger_insert,
    has_table_privilege(current_user, 'supabase_migrations.schema_migrations', 'UPDATE') AS ledger_update
), schemas AS (
  SELECT jsonb_agg(jsonb_build_object(
    'schema', namespace.nspname,
    'owner', pg_catalog.pg_get_userbyid(namespace.nspowner),
    'usage', has_schema_privilege(current_user, namespace.oid, 'USAGE'),
    'create', has_schema_privilege(current_user, namespace.oid, 'CREATE')
  ) ORDER BY namespace.nspname) AS value
  FROM pg_catalog.pg_namespace namespace
  WHERE namespace.nspname IN ('public', 'private', 'supabase_migrations')
), relations AS (
  SELECT jsonb_agg(jsonb_build_object(
    'schema', expected.schema_name,
    'name', expected.relation_name,
    'exists', relation.oid IS NOT NULL,
    'kind', relation.relkind,
    'owner', CASE WHEN relation.oid IS NULL THEN NULL ELSE pg_catalog.pg_get_userbyid(relation.relowner) END,
    'rls_enabled', relation.relrowsecurity,
    'rls_forced', relation.relforcerowsecurity,
    'select', CASE WHEN relation.oid IS NULL OR relation.relkind NOT IN ('r', 'p', 'v', 'm', 'f') THEN NULL ELSE has_table_privilege(current_user, relation.oid, 'SELECT') END,
    'insert', CASE WHEN relation.oid IS NULL OR relation.relkind NOT IN ('r', 'p', 'v', 'f') THEN NULL ELSE has_table_privilege(current_user, relation.oid, 'INSERT') END,
    'update', CASE WHEN relation.oid IS NULL OR relation.relkind NOT IN ('r', 'p', 'v', 'f') THEN NULL ELSE has_table_privilege(current_user, relation.oid, 'UPDATE') END,
    'delete', CASE WHEN relation.oid IS NULL OR relation.relkind NOT IN ('r', 'p', 'v', 'f') THEN NULL ELSE has_table_privilege(current_user, relation.oid, 'DELETE') END,
    'truncate', CASE WHEN relation.oid IS NULL OR relation.relkind NOT IN ('r', 'p') THEN NULL ELSE has_table_privilege(current_user, relation.oid, 'TRUNCATE') END
  ) ORDER BY expected.schema_name, expected.relation_name) AS value
  FROM expected_relations expected
  LEFT JOIN pg_catalog.pg_namespace namespace ON namespace.nspname = expected.schema_name
  LEFT JOIN pg_catalog.pg_class relation
    ON relation.relnamespace = namespace.oid AND relation.relname = expected.relation_name
), functions(signature) AS (
  VALUES
    ('private.validate_mapped_bncc_skill_v12(uuid,text,jsonb)'),
    ('private.validate_bncc_high_school_skill_v12(uuid,text,jsonb)'),
    ('private.validate_adaptive_content_pack_v12(uuid)'),
    ('private.recommend_guided_study_v11(uuid)'),
    ('public.start_guided_learning_session_v4(uuid,uuid,uuid)')
), function_info AS (
  SELECT jsonb_agg(jsonb_build_object(
    'signature', expected.signature,
    'exists', procedure.oid IS NOT NULL,
    'owner', CASE WHEN procedure.oid IS NULL THEN NULL ELSE pg_catalog.pg_get_userbyid(procedure.proowner) END,
    'security_definer', procedure.prosecdef,
    'volatility', procedure.provolatile,
    'execute', CASE WHEN procedure.oid IS NULL THEN NULL ELSE has_function_privilege(current_user, procedure.oid, 'EXECUTE') END
  ) ORDER BY expected.signature) AS value
  FROM functions expected
  LEFT JOIN LATERAL (SELECT to_regprocedure(expected.signature) AS oid) resolved ON true
  LEFT JOIN pg_catalog.pg_proc procedure ON procedure.oid = resolved.oid
), policies AS (
  SELECT jsonb_agg(jsonb_build_object(
    'schema', namespace.nspname,
    'table', relation.relname,
    'policy', policy.polname,
    'command', policy.polcmd,
    'roles', policy.polroles,
    'permissive', policy.polpermissive
  ) ORDER BY namespace.nspname, relation.relname, policy.polname) AS value
  FROM pg_catalog.pg_policy policy
  JOIN pg_catalog.pg_class relation ON relation.oid = policy.polrelid
  JOIN pg_catalog.pg_namespace namespace ON namespace.oid = relation.relnamespace
  WHERE relation.relname IN (
    'learning_adaptive_content_packs', 'learning_curriculum_skills',
    'learning_curriculum_grade_targets', 'learning_skill_lessons',
    'learning_question_bank', 'learning_question_bank_skill_links',
    'learning_question_sets', 'learning_question_set_items'
  ) AND namespace.nspname IN ('public', 'private')
), expected_migrations(version, name) AS (
  VALUES
    ('20261108173911', 'guided_study_v12_automatic_content_validation'),
    ('20261109000100', 'guided_study_bncc_content_recovery_v13'),
    ('20261110010546', 'guided_study_v16_subject_scoped_planner'),
    ('20261111000200', 'guided_study_v16_2_math_physics_content'),
    ('20261111000300', 'guided_study_v17_em1_subject_strands')
), ledger AS (
  SELECT jsonb_build_object(
    'exists', to_regclass('supabase_migrations.schema_migrations') IS NOT NULL,
    'latest', (SELECT max(version)::text FROM supabase_migrations.schema_migrations),
    'expected_migrations', (
      SELECT jsonb_agg(jsonb_build_object(
        'version', expected.version,
        'name', expected.name,
        'present', EXISTS (
          SELECT 1
          FROM supabase_migrations.schema_migrations applied
          WHERE applied.version::text = expected.version
        )
      ) ORDER BY expected.version)
      FROM expected_migrations expected
    )
  ) AS value
)
SELECT jsonb_build_object(
  'role', (SELECT to_jsonb(role_info) FROM role_info),
  'schemas', (SELECT value FROM schemas),
  'relations', (SELECT value FROM relations),
  'functions', (SELECT value FROM function_info),
  'policies', (SELECT value FROM policies),
  'ledger', (SELECT value FROM ledger)
)::text;

ROLLBACK;
