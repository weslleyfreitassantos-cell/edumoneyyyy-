begin;

do $guided_study_v12_database_test$
declare
  target_count integer;
  target_diagnostics jsonb;
  selected public.learning_central_studies_v2_candidates%rowtype;
  invalid_id uuid;
  invalid_code text;
  invalid_version text;
  invalid_payload jsonb;
  integration_result jsonb;
  runtime_count integer;
  test_skill_id uuid;
  test_lesson_id uuid;
  test_bank_id uuid;
  original_lesson_content text;
  original_bank_metadata jsonb;
  original_correct_answer jsonb;
begin
  update public.learning_curriculum_skills
     set pedagogical_review_status = 'PEDAGOGICAL_REVIEW_PENDING'
   where metadata->>'official_code' = any (array['EM13MAT101', 'EM13LGG303', 'EM13CNT101', 'EM13CHS103']);
  set constraints all immediate;

  select count(*)::integer into target_count
    from public.learning_curriculum_skills skill
   where skill.metadata->>'official_code' = any (array['EM13MAT101', 'EM13LGG303', 'EM13CNT101', 'EM13CHS103'])
     and skill.metadata->>'content_pack' = 'TECESCOLA_BNCC_DEEP_LEARNING_V8'
     and skill.publication_status = 'STAGING'
     and skill.content_readiness = 'CONTENT_READY'
     and not skill.mastery_targetable
     and skill.technical_validation_status = 'VALIDATION_FAILED'
     and skill.technical_validation_errors = jsonb_build_array('DEMONSTRATION_OR_TEST_CONTENT');
  if target_count <> 4 then
    select coalesce(jsonb_agg(jsonb_build_object(
      'code', skill.metadata->>'official_code',
      'publication_status', skill.publication_status,
      'technical_validation_status', skill.technical_validation_status,
      'technical_validation_errors', skill.technical_validation_errors
    ) order by skill.metadata->>'official_code'), '[]'::jsonb)
      into target_diagnostics
      from public.learning_curriculum_skills skill
     where skill.metadata->>'official_code' = any (array['EM13MAT101', 'EM13LGG303', 'EM13CNT101', 'EM13CHS103']);
    raise exception 'V12_V8_DEMO_CONTENT_NOT_ISOLATED expected=4 actual=% diagnostics=%',
      target_count, target_diagnostics;
  end if;
  if (select count(*) from public.learning_curriculum_skills skill
       where skill.metadata->>'official_code' = any (array['EM13MAT101', 'EM13LGG303', 'EM13CNT101', 'EM13CHS103'])
         and skill.pedagogical_review_status = 'PEDAGOGICAL_REVIEW_PENDING') <> 4 then
    raise exception 'V12_HISTORICAL_HUMAN_REVIEW_AUDIT_CHANGED';
  end if;

  update public.learning_curriculum_skills
     set pedagogical_review_status = 'PEDAGOGICAL_REVIEW_PENDING'
   where code = 'EF06HI01';
  if not exists (
    select 1 from public.learning_curriculum_skills skill
    join public.learning_curriculum_grade_targets grade on grade.canonical_skill_id = skill.id
      and grade.active and grade.stage = 'ENSINO_FUNDAMENTAL' and grade.grade_level = 6
    join public.learning_curriculum_catalogs catalog on catalog.id = skill.catalog_id
      and catalog.active and catalog.code = 'BNCC_2018'
     where skill.code = 'EF06HI01' and skill.publication_status = 'PUBLISHED'
       and skill.bncc_alignment_status = 'MAPPED' and skill.technical_validation_status = 'PUBLISHED'
       and skill.pedagogical_review_status = 'PEDAGOGICAL_REVIEW_PENDING'
  ) then
    raise exception 'V12_VALID_EF06_CONTENT_NOT_PUBLISHED_WITHOUT_HUMAN_REVIEW';
  end if;

  select skill.id into test_skill_id
    from public.learning_curriculum_skills skill
   where skill.code = 'EF06HI01' limit 1;
  select lesson.id, lesson.content_markdown into test_lesson_id, original_lesson_content
    from public.learning_skill_lessons lesson
   where lesson.canonical_skill_id = test_skill_id and lesson.version = 4 and lesson.active
   order by lesson.id limit 1;
  select bank.id, bank.metadata, bank.correct_answer
    into test_bank_id, original_bank_metadata, original_correct_answer
    from public.learning_question_sets question_set
    join public.learning_question_set_items item on item.question_set_id = question_set.id
    join public.learning_question_bank bank on bank.id = item.question_bank_id
   where question_set.canonical_skill_id = test_skill_id and question_set.scope = 'GLOBAL'
     and question_set.version = 4 and question_set.active and bank.active
   order by question_set.purpose, item.position limit 1;
  if test_skill_id is null or test_lesson_id is null or test_bank_id is null then
    raise exception 'V12_GENERIC_BNCC_FIXTURE_INCOMPLETE';
  end if;

  update public.learning_curriculum_skills set bncc_alignment_status = 'CANDIDATE'
   where id = test_skill_id;
  if not exists (
    select 1 from public.learning_curriculum_skills skill
     where skill.id = test_skill_id and skill.publication_status = 'STAGING'
       and skill.technical_validation_status = 'VALIDATION_FAILED'
       and skill.technical_validation_errors ? 'OFFICIAL_BNCC_MAPPING_NOT_VERIFIABLE'
  ) then
    raise exception 'V12_UNVERIFIABLE_BNCC_MAPPING_WAS_NOT_BLOCKED';
  end if;
  update public.learning_curriculum_skills set bncc_alignment_status = 'MAPPED'
   where id = test_skill_id;

  update public.learning_skill_lessons set content_markdown = 'x' where id = test_lesson_id;
  if not exists (
    select 1 from public.learning_curriculum_skills skill
     where skill.id = test_skill_id and skill.publication_status = 'STAGING'
       and skill.technical_validation_status = 'VALIDATION_FAILED'
       and skill.technical_validation_errors ? 'LESSON_STRUCTURE_OR_SCOPE_INVALID'
  ) then
    raise exception 'V12_INCOMPLETE_LESSON_WAS_NOT_BLOCKED';
  end if;
  update public.learning_skill_lessons set content_markdown = original_lesson_content where id = test_lesson_id;

  update public.learning_question_bank
     set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('demo_preview_only', true)
   where id = test_bank_id;
  if not exists (
    select 1 from public.learning_curriculum_skills skill
     where skill.id = test_skill_id and skill.publication_status = 'STAGING'
       and skill.technical_validation_status = 'VALIDATION_FAILED'
       and skill.technical_validation_errors ? 'DEMONSTRATION_OR_TEST_QUESTIONS'
  ) then
    raise exception 'V12_DEMONSTRATION_QUESTION_WAS_NOT_BLOCKED';
  end if;
  update public.learning_question_bank set metadata = original_bank_metadata where id = test_bank_id;

  update public.learning_question_bank
     set correct_answer = to_jsonb('V12_NONEXISTENT_OPTION'::text)
   where id = test_bank_id;
  if not exists (
    select 1 from public.learning_curriculum_skills skill
     where skill.id = test_skill_id and skill.publication_status = 'STAGING'
       and skill.technical_validation_status = 'VALIDATION_FAILED'
       and skill.technical_validation_errors ? 'QUESTION_STRUCTURE_OR_COVERAGE_INCOMPLETE'
  ) then
    raise exception 'V12_INCONSISTENT_ANSWER_WAS_NOT_BLOCKED';
  end if;
  update public.learning_question_bank set correct_answer = original_correct_answer where id = test_bank_id;

  select candidate.* into selected
    from public.learning_central_studies_v2_candidates candidate
   where candidate.publication_status = 'PUBLISHED'
     and candidate.technical_validation_status = 'PUBLISHED'
     and candidate.review_status = 'PEDAGOGICAL_REVIEW_PENDING'
     and candidate.reviewed_at is null
     and candidate.reviewer_id_snapshot is null
   order by candidate.journey_code limit 1;
  if not found then
    raise exception 'V12_NO_AUTOMATICALLY_PUBLISHED_PENDING_REVIEW_CANDIDATE';
  end if;

  integration_result := private.integrate_central_studies_v2_candidate_v12(selected.id, selected.snapshot_fingerprint);
  integration_result := private.integrate_central_studies_v2_candidate_v12(selected.id, selected.snapshot_fingerprint);
  if integration_result->>'status' <> 'PUBLISHED' then
    raise exception 'V12_CENTRAL_STUDY_IDEMPOTENT_INTEGRATION_FAILED';
  end if;
  select count(*)::integer into runtime_count
    from public.learning_central_studies_v2_runtime runtime where runtime.candidate_id = selected.id;
  if runtime_count <> 1 then
    raise exception 'V12_CENTRAL_STUDY_RUNTIME_DUPLICATED expected=1 actual=%', runtime_count;
  end if;
  if not exists (
    select 1 from public.learning_central_studies_v2_candidates candidate
     where candidate.id = selected.id and candidate.review_status = 'PEDAGOGICAL_REVIEW_PENDING'
       and candidate.reviewed_at is null and candidate.reviewer_id_snapshot is null
  ) then
    raise exception 'V12_FABRICATED_HUMAN_REVIEW';
  end if;
  if not exists (
    select 1 from public.learning_curriculum_skills skill
     where skill.metadata->>'central_studies_v2_candidate_id' = selected.id::text
       and skill.publication_status = 'PUBLISHED'
       and skill.technical_validation_status = 'PUBLISHED'
       and skill.pedagogical_review_status = 'PEDAGOGICAL_REVIEW_PENDING'
  ) then
    raise exception 'V12_EXECUTION_SKILL_REVIEW_STATUS_NOT_TRUTHFUL';
  end if;

  invalid_code := selected.journey_code || '_V12_BAD';
  invalid_version := selected.content_version || '.V12BAD';
  invalid_payload := jsonb_set(selected.payload, '{journeyCode}', to_jsonb(invalid_code), true);
  invalid_payload := jsonb_set(invalid_payload, '{questions,0,options}', '[]'::jsonb, true);
  insert into public.learning_central_studies_v2_candidates(
    journey_code, content_version, subject_area, grade_level, official_skill_code,
    snapshot_fingerprint, payload
  ) values (
    invalid_code, invalid_version, selected.subject_area, selected.grade_level, selected.official_skill_code,
    repeat('a', 64), invalid_payload
  ) returning id into invalid_id;

  if not exists (
    select 1 from public.learning_central_studies_v2_candidates candidate
     where candidate.id = invalid_id and candidate.technical_validation_status = 'VALIDATION_FAILED'
       and candidate.publication_status = 'STAGING'
       and exists (
         select 1 from jsonb_array_elements_text(candidate.technical_validation_errors) as validation_error(value)
          where validation_error.value like 'QUESTION_STRUCTURE_INVALID:%'
       )
  ) then
    raise exception 'V12_MALFORMED_CENTRAL_CONTENT_WAS_NOT_REJECTED';
  end if;
  if exists (
    select 1 from public.learning_central_studies_v2_runtime runtime where runtime.candidate_id = invalid_id
  ) then
    raise exception 'V12_MALFORMED_CENTRAL_CONTENT_CREATED_RUNTIME';
  end if;

  if has_function_privilege('authenticated', 'public.review_central_studies_v2_candidate_v1(text,text,text,text,text,jsonb)', 'EXECUTE') then
    raise exception 'V12_HUMAN_REVIEW_RPC_REMAINS_EXECUTABLE';
  end if;
  if not has_function_privilege('authenticated', 'public.get_guided_study_overview_v11(uuid)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.start_guided_study_v11(uuid)', 'EXECUTE') then
    raise exception 'V12_V11_STUDENT_RPC_ACCESS_LOST';
  end if;
end;
$guided_study_v12_database_test$;

rollback;
