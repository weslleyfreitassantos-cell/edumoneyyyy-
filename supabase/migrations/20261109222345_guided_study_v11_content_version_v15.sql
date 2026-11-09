begin;

do $guided_study_v15_diagnostic_version$
declare
  function_definition text;
  legacy_selector_count integer;
  versioned_selector_count integer;
begin
  if to_regprocedure('public.start_guided_study_v11_pre_v12(uuid)') is null then
    raise exception 'GUIDED_STUDY_V15_V11_IMPLEMENTATION_MISSING';
  end if;

  function_definition := pg_get_functiondef('public.start_guided_study_v11_pre_v12(uuid)'::regprocedure);
  select count(*)::integer
    into legacy_selector_count
    from regexp_matches(function_definition, 'question_set[[:space:]]*[.][[:space:]]*version[[:space:]]*=[[:space:]]*4', 'g');
  versioned_selector_count := (length(function_definition) - length(replace(
    function_definition, 'question_set.version = coalesce((select case when skill.metadata->>''content_version'' ~ ''^[0-9]+$'' then (skill.metadata->>''content_version'')::integer end from public.learning_curriculum_skills skill where skill.id = question_set.canonical_skill_id), 4)', ''))) /
    length('question_set.version = coalesce((select case when skill.metadata->>''content_version'' ~ ''^[0-9]+$'' then (skill.metadata->>''content_version'')::integer end from public.learning_curriculum_skills skill where skill.id = question_set.canonical_skill_id), 4)');

  if legacy_selector_count = 1 and versioned_selector_count = 0 then
    function_definition := regexp_replace(function_definition,
      'question_set[[:space:]]*[.][[:space:]]*version[[:space:]]*=[[:space:]]*4',
      'question_set.version = coalesce((select case when skill.metadata->>''content_version'' ~ ''^[0-9]+$'' then (skill.metadata->>''content_version'')::integer end from public.learning_curriculum_skills skill where skill.id = question_set.canonical_skill_id), 4)');
  elsif legacy_selector_count <> 0 or versioned_selector_count <> 1 then
    raise exception 'GUIDED_STUDY_V15_V11_START_SOURCE_SHAPE_CHANGED legacy=% versioned=%',
      legacy_selector_count, versioned_selector_count;
  end if;

  execute function_definition;
end;
$guided_study_v15_diagnostic_version$;

notify pgrst, 'reload schema';
commit;
