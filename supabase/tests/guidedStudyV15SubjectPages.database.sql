begin;

do $guided_study_v15_subject_pages_database_test$
declare
  start_definition text;
  targets_definition text;
  legacy_selector_count integer;
  versioned_selector_count integer;
  start_is_security_definer boolean;
  target_count integer;
begin
  select pg_get_functiondef('public.start_guided_study_v11(uuid)'::regprocedure), procedure.prosecdef
    into start_definition, start_is_security_definer
    from pg_catalog.pg_proc procedure
   where procedure.oid = 'public.start_guided_study_v11(uuid)'::regprocedure;

  legacy_selector_count := (length(start_definition) - length(replace(start_definition, 'question_set.version = 4', ''))) /
    length('question_set.version = 4');
  versioned_selector_count := (length(start_definition) - length(replace(start_definition,
    'question_set.version = coalesce((select case when skill.metadata->>''content_version'' ~ ''^[0-9]+$'' then (skill.metadata->>''content_version'')::integer end from public.learning_curriculum_skills skill where skill.id = question_set.canonical_skill_id), 4)', ''))) /
    length('question_set.version = coalesce((select case when skill.metadata->>''content_version'' ~ ''^[0-9]+$'' then (skill.metadata->>''content_version'')::integer end from public.learning_curriculum_skills skill where skill.id = question_set.canonical_skill_id), 4)');

  if legacy_selector_count <> 0 or versioned_selector_count <> 1 or not start_is_security_definer then
    raise exception 'GUIDED_STUDY_V15_START_DIAGNOSTIC_VERSIONING_INVALID legacy=% versioned=% security_definer=%',
      legacy_selector_count, versioned_selector_count, start_is_security_definer;
  end if;

  if not has_function_privilege('authenticated', 'public.start_guided_study_v11(uuid)', 'EXECUTE')
     or has_function_privilege('anon', 'public.start_guided_study_v11(uuid)', 'EXECUTE') then
    raise exception 'GUIDED_STUDY_V15_START_PRIVILEGES_INVALID';
  end if;

  select pg_get_functiondef('public.list_student_guided_learning_targets(uuid,uuid)'::regprocedure)
    into targets_definition;
  if targets_definition not like '%learning_v2_scope_student%' then
    raise exception 'GUIDED_STUDY_V15_TARGETS_STUDENT_SCOPE_MISSING';
  end if;
  if not has_function_privilege('authenticated', 'public.list_student_guided_learning_targets(uuid,uuid)', 'EXECUTE')
     or has_function_privilege('anon', 'public.list_student_guided_learning_targets(uuid,uuid)', 'EXECUTE') then
    raise exception 'GUIDED_STUDY_V15_TARGETS_PRIVILEGES_INVALID';
  end if;

  if not exists (
    select 1
      from public.learning_curriculum_skills skill
      join public.learning_question_sets question_set
        on question_set.canonical_skill_id = skill.id
       and question_set.scope = 'GLOBAL'
       and question_set.purpose = 'PROBE'
       and question_set.version = case
         when skill.metadata->>'content_version' ~ '^[0-9]+$' then (skill.metadata->>'content_version')::integer
         else 4
       end
       and question_set.active
      join public.learning_question_set_items item on item.question_set_id = question_set.id
      join public.learning_question_bank bank on bank.id = item.question_bank_id and bank.active
     where skill.metadata->>'content_pack' = 'tec-escola-bncc-guided-study-v13'
       and skill.metadata->>'content_version' = '6'
       and question_set.metadata->>'content_pack' = 'tec-escola-bncc-guided-study-v13'
  ) then
    raise exception 'GUIDED_STUDY_V15_V13_VERSION_6_PROBE_NOT_SELECTABLE';
  end if;

  select count(*)::integer into target_count
    from public.learning_question_sets question_set
   where question_set.scope = 'GLOBAL' and question_set.purpose = 'PROBE'
     and question_set.version = 4 and question_set.active;
  if target_count = 0 then
    raise exception 'GUIDED_STUDY_V15_LEGACY_V4_PROBE_FIXTURE_MISSING';
  end if;

  if not exists (
    select 1 from pg_catalog.pg_class relation
     where relation.oid = 'public.learning_student_skill_state'::regclass
       and relation.relrowsecurity
  ) or not exists (
    select 1 from pg_catalog.pg_class relation
     where relation.oid = 'public.learning_curriculum_subject_links'::regclass
       and relation.relrowsecurity
  ) then
    raise exception 'GUIDED_STUDY_V15_SUBJECT_PROGRESS_RLS_DISABLED';
  end if;
end;
$guided_study_v15_subject_pages_database_test$;

rollback;
