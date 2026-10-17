begin;

-- Retire the V9 argument lesson from the concept skill without deleting content
-- or changing any historical session, step, answer, or progress record.
do $philosophy_concept_semantic_reconciliation$
declare
  v_catalog_id uuid;
  v_concept_skill_id uuid;
  v_argument_skill_id uuid;
  v_question_count integer;
  v_question_set_count integer;
  v_lesson_count integer;
  v_journey_count integer;
begin
  select id into v_catalog_id
    from public.learning_curriculum_catalogs
   where code = 'TECESCOLA_CORE' and version = '1.0'
   limit 1;
  if v_catalog_id is null then raise exception 'PHILOSOPHY_CONCEPT_RECONCILIATION_CATALOG_MISSING'; end if;

  select id into v_concept_skill_id
    from public.learning_curriculum_skills
   where catalog_id = v_catalog_id and code = 'PHILOSOPHY_DISTINGUISH_CONCEPT';
  select id into v_argument_skill_id
    from public.learning_curriculum_skills
   where catalog_id = v_catalog_id and code = 'PHILOSOPHY_EVALUATE_ARGUMENT';
  if v_concept_skill_id is null or v_argument_skill_id is null then
    raise exception 'PHILOSOPHY_CONCEPT_RECONCILIATION_SKILL_MISSING';
  end if;

  select count(*) into v_question_count
    from public.learning_question_bank question
   where question.source_type = 'TECESCOLA_V9_AUTHORED_V1'
     and question.metadata->>'content_version' = 'tec-escola-core-v9.3-journey-expansion-v1'
     and question.metadata->>'content_id' like 'v93-phil-argument-%'
     and question.metadata->>'primary_skill' in ('PHILOSOPHY_DISTINGUISH_CONCEPT', 'PHILOSOPHY_EVALUATE_ARGUMENT');
  if v_question_count <> 20 then
    raise exception 'PHILOSOPHY_CONCEPT_RECONCILIATION_QUESTION_COUNT:%', v_question_count;
  end if;

  select count(*) into v_question_set_count
    from public.learning_question_sets question_set
   where question_set.scope = 'GLOBAL'
     and question_set.canonical_skill_id = v_concept_skill_id
     and question_set.version = 4
     and question_set.metadata->>'content_version' = 'tec-escola-core-v9.3-journey-expansion-v1';
  if v_question_set_count <> 5 then
    raise exception 'PHILOSOPHY_CONCEPT_RECONCILIATION_SET_COUNT:%', v_question_set_count;
  end if;

  select count(*) into v_lesson_count
    from public.learning_skill_lessons lesson
   where lesson.canonical_skill_id = v_concept_skill_id
     and lesson.version = 4
     and lesson.metadata->>'content_version' = 'tec-escola-core-v9.3-journey-expansion-v1';
  if v_lesson_count <> 1 then
    raise exception 'PHILOSOPHY_CONCEPT_RECONCILIATION_LESSON_COUNT:%', v_lesson_count;
  end if;

  select count(*) into v_journey_count
    from public.learning_bncc_discipline_journeys journey
   where journey.journey_code = 'PHILOSOPHY_DISTINGUISH_CONCEPT_V93'
     and journey.execution_skill_id = v_concept_skill_id
     and journey.content_version = 'tec-escola-core-v9.3-journey-expansion-v1';
  if v_journey_count <> 1 then
    raise exception 'PHILOSOPHY_CONCEPT_RECONCILIATION_JOURNEY_COUNT:%', v_journey_count;
  end if;

  update public.learning_curriculum_skills
     set content_readiness = 'GRAPH_ONLY',
         mastery_targetable = false,
         publication_status = 'STAGING',
         pedagogical_review_status = 'PEDAGOGICAL_REVIEW_PENDING',
         metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
           'content_authoring_status', 'SCAFFOLD',
           'semantic_alignment_status', 'MISMATCH_SUPERSEDED',
           'superseded_content_version', 'tec-escola-core-v9.3-journey-expansion-v1',
           'pedagogical_review_status', 'PEDAGOGICAL_REVIEW_PENDING',
           'publication_status', 'STAGING'
         ),
         updated_at = now()
   where id = v_concept_skill_id
     and metadata->>'content_version' = 'tec-escola-core-v9.3-journey-expansion-v1';
  if not exists (
    select 1 from public.learning_curriculum_skills
     where id = v_concept_skill_id
       and content_readiness = 'GRAPH_ONLY'
       and mastery_targetable = false
       and publication_status = 'STAGING'
       and pedagogical_review_status = 'PEDAGOGICAL_REVIEW_PENDING'
       and metadata->>'semantic_alignment_status' = 'MISMATCH_SUPERSEDED'
  ) then raise exception 'PHILOSOPHY_CONCEPT_RECONCILIATION_SKILL_STATE_INVALID'; end if;

  update public.learning_bncc_discipline_journeys
     set active = false,
         publication_status = 'STAGING',
         mapping_status = 'MAPPING_PENDING',
         pedagogical_review_status = 'PEDAGOGICAL_REVIEW_PENDING',
         metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
           'semantic_alignment_status', 'MISMATCH_SUPERSEDED',
           'superseded_by_content_id', 'v5-philosophy-distinguish-concept',
           'student_available', false
         ),
         updated_at = now()
   where journey_code = 'PHILOSOPHY_DISTINGUISH_CONCEPT_V93'
     and execution_skill_id = v_concept_skill_id
     and content_version = 'tec-escola-core-v9.3-journey-expansion-v1';

  update public.learning_skill_lessons
     set active = false,
         metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
           'semantic_alignment_status', 'MISMATCH_SUPERSEDED',
           'superseded_by_content_id', 'v5-philosophy-distinguish-concept'
         ),
         updated_at = now()
   where canonical_skill_id = v_concept_skill_id
     and version = 4
     and metadata->>'content_version' = 'tec-escola-core-v9.3-journey-expansion-v1';

  update public.learning_question_sets
     set active = false,
         metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
           'semantic_alignment_status', 'MISMATCH_SUPERSEDED',
           'superseded_by_content_id', 'v5-philosophy-distinguish-concept'
         ),
         updated_at = now()
   where scope = 'GLOBAL'
     and canonical_skill_id = v_concept_skill_id
     and version = 4
     and metadata->>'content_version' = 'tec-escola-core-v9.3-journey-expansion-v1';

  update public.learning_question_bank question
     set domain = 'ARGUMENTO',
         metadata = coalesce(question.metadata, '{}'::jsonb) || jsonb_build_object(
           'primary_skill', 'PHILOSOPHY_EVALUATE_ARGUMENT',
           'semantic_reassignment_reason', 'V9_ARGUMENT_CONTENT_WAS_MISASSIGNED_TO_CONCEPT_SKILL'
         ),
         updated_at = now()
   where question.source_type = 'TECESCOLA_V9_AUTHORED_V1'
     and question.metadata->>'content_version' = 'tec-escola-core-v9.3-journey-expansion-v1'
     and question.metadata->>'content_id' like 'v93-phil-argument-%';

  delete from public.learning_question_bank_skill_links link
   using public.learning_question_bank question
   where link.question_bank_id = question.id
     and link.canonical_skill_id = v_concept_skill_id
     and question.source_type = 'TECESCOLA_V9_AUTHORED_V1'
     and question.metadata->>'content_version' = 'tec-escola-core-v9.3-journey-expansion-v1'
     and question.metadata->>'content_id' like 'v93-phil-argument-%';

  insert into public.learning_question_bank_skill_links(question_bank_id, canonical_skill_id, skill_role)
  select question.id, v_argument_skill_id, 'PRIMARY'
    from public.learning_question_bank question
   where question.source_type = 'TECESCOLA_V9_AUTHORED_V1'
     and question.metadata->>'content_version' = 'tec-escola-core-v9.3-journey-expansion-v1'
     and question.metadata->>'content_id' like 'v93-phil-argument-%'
  on conflict (question_bank_id, canonical_skill_id) do nothing;

  if exists (
    select 1
      from public.learning_question_bank_skill_links link
      join public.learning_question_bank question on question.id = link.question_bank_id
     where link.canonical_skill_id = v_concept_skill_id
       and question.source_type = 'TECESCOLA_V9_AUTHORED_V1'
       and question.metadata->>'content_version' = 'tec-escola-core-v9.3-journey-expansion-v1'
       and question.metadata->>'content_id' like 'v93-phil-argument-%'
  ) then raise exception 'PHILOSOPHY_CONCEPT_RECONCILIATION_OLD_LINK_REMAINS'; end if;

  if (select count(*)
        from public.learning_question_bank_skill_links link
        join public.learning_question_bank question on question.id = link.question_bank_id
       where link.canonical_skill_id = v_argument_skill_id
         and question.source_type = 'TECESCOLA_V9_AUTHORED_V1'
         and question.metadata->>'content_version' = 'tec-escola-core-v9.3-journey-expansion-v1'
         and question.metadata->>'content_id' like 'v93-phil-argument-%') <> 20 then
    raise exception 'PHILOSOPHY_CONCEPT_RECONCILIATION_ARGUMENT_LINK_COUNT_INVALID';
  end if;
end;
$philosophy_concept_semantic_reconciliation$;

commit;
