do $guided_study_v16_2_database_contract$
declare
  v_pack_id uuid;
  v_catalog_id uuid;
  v_skill_ids uuid[];
  v_prior_skill_ids uuid[];
  v_count integer;
  function_definition text;
begin
  select id into v_pack_id
    from public.learning_adaptive_content_packs
   where pack_version = 'TECESCOLA_BNCC_GUIDED_STUDY_EM1_V16_2'
     and active
     and publication_status = 'PUBLISHED'
     and technical_validation_status = 'PUBLISHED'
     and pedagogical_review_status = 'PEDAGOGICAL_REVIEW_PENDING';
  if v_pack_id is null then raise exception 'V16_2_PACK_NOT_TECHNICALLY_PUBLISHED_OR_REVIEW_WAS_FORGED'; end if;
  if not exists (
    select 1 from public.learning_adaptive_content_packs pack
     where pack.id = v_pack_id
       and pack.manifest->'authoringAudit'->>'humanCertification' = 'NOT_CLAIMED'
       and pack.manifest->'authoringAudit'->>'sourceRecordsMutated' = 'false'
  ) then raise exception 'V16_2_AUTHORING_AUDIT_MISSING_OR_MISREPRESENTED'; end if;

  select id into v_catalog_id from public.learning_curriculum_catalogs
   where code = 'BNCC_2018' and active order by version desc limit 1;
  if v_catalog_id is null then raise exception 'V16_2_ACTIVE_BNCC_CATALOG_MISSING'; end if;

  select array_agg(skill.id order by skill.code), count(*)::integer
    into v_skill_ids, v_count
    from public.learning_curriculum_skills skill
   where skill.catalog_id = v_catalog_id
     and skill.code in ('EM13MAT302', 'EM13CNT204')
     and skill.active
     and skill.publication_status = 'PUBLISHED'
     and skill.technical_validation_status = 'PUBLISHED'
     and skill.content_readiness = 'ADAPTIVE_READY'
     and skill.mastery_targetable
     and skill.pedagogical_review_status = 'PEDAGOGICAL_REVIEW_PENDING'
     and skill.metadata->>'content_version' = '7'
     and skill.metadata->>'recommended_grade' = '1';
  if v_count <> 2 then raise exception 'V16_2_SKILL_PUBLICATION_CONTRACT_FAILED count=%', v_count; end if;

  if exists (
    select 1 from public.learning_curriculum_skills skill
    where skill.id = any(v_skill_ids)
      and (skill.metadata->>'official_code' is distinct from skill.code
        or skill.metadata->>'official_source_id' is distinct from 'BNCC_EM_2018'
        or skill.metadata->>'official_grade_range' is distinct from '1-3'
        or skill.metadata->>'content_pack' is distinct from 'TECESCOLA_BNCC_GUIDED_STUDY_EM1_V16_2'
        or skill.metadata->>'sequence_after' is null)
  ) then raise exception 'V16_2_CANONICAL_BNCC_PROVENANCE_MISSING'; end if;

  if exists (
    select 1 from public.learning_curriculum_skills skill
    where skill.id = any(v_skill_ids)
      and (skill.code, skill.subject_area, skill.metadata->>'sequence_after') not in (
        ('EM13MAT302', 'MATEMATICA', 'EM13MAT101'),
        ('EM13CNT204', 'CIENCIAS_DA_NATUREZA', 'EM13CNT101')
      )
  ) then raise exception 'V16_2_SKILL_TO_SUBJECT_SEQUENCE_MISMATCH'; end if;

  select count(*)::integer into v_count from public.learning_skill_lessons lesson
   where lesson.canonical_skill_id = any(v_skill_ids) and lesson.version = 7
     and lesson.active and length(lesson.content_markdown) >= 900
     and lesson.metadata->>'pedagogical_review_status' = 'PEDAGOGICAL_REVIEW_PENDING';
  if v_count <> 2 then raise exception 'V16_2_LESSON_VERSION_MISSING count=%', v_count; end if;

  select count(*)::integer into v_count from public.learning_question_bank bank
   where bank.source_type = 'TECESCOLA_BNCC_GUIDED_STUDY_V16_2'
     and bank.active and bank.metadata->>'content_version' = '7'
     and bank.metadata->>'pedagogical_review_status' = 'PEDAGOGICAL_REVIEW_PENDING';
  if v_count <> 20 then raise exception 'V16_2_QUESTION_BANK_COUNT_MISMATCH count=%', v_count; end if;

  select count(*)::integer into v_count
    from public.learning_question_sets question_set
   where question_set.canonical_skill_id = any(v_skill_ids)
     and question_set.scope = 'GLOBAL' and question_set.version = 7 and question_set.active;
  if v_count <> 10 then raise exception 'V16_2_ADAPTIVE_SET_COUNT_MISMATCH count=%', v_count; end if;

  if exists (
    select 1 from public.learning_question_sets question_set
    where question_set.canonical_skill_id = any(v_skill_ids)
      and question_set.scope = 'GLOBAL' and question_set.version = 7 and question_set.active
      and (select count(*) from public.learning_question_set_items item where item.question_set_id = question_set.id) <> 2
  ) then raise exception 'V16_2_ADAPTIVE_PURPOSE_MUST_HAVE_TWO_ITEMS'; end if;

  select count(*)::integer into v_count
    from public.learning_curriculum_grade_targets target
   where target.catalog_id = v_catalog_id and target.canonical_skill_id = any(v_skill_ids)
     and target.stage = 'ENSINO_MEDIO' and target.grade_level = 1 and target.active;
  if v_count <> 2 then raise exception 'V16_2_EM1_GRADE_TARGETS_MISSING count=%', v_count; end if;

  select array_agg(skill.id) into v_prior_skill_ids
    from public.learning_curriculum_skills skill
   where skill.catalog_id = v_catalog_id and skill.code in ('EM13MAT101', 'EM13CNT101');
  if cardinality(v_prior_skill_ids) <> 2 or not exists (
    select 1 from public.learning_skill_lessons lesson
     where lesson.canonical_skill_id = any(v_prior_skill_ids) and lesson.version = 6
  ) then raise exception 'V16_2_PRIOR_V13_LESSONS_WERE_NOT_PRESERVED'; end if;
  if not exists (
    select 1 from public.learning_question_sets question_set
     where question_set.canonical_skill_id = any(v_prior_skill_ids) and question_set.version = 6
  ) then raise exception 'V16_2_PRIOR_V13_QUESTION_SETS_WERE_NOT_PRESERVED'; end if;

  function_definition := pg_get_functiondef('public.start_guided_learning_session_v4(uuid,uuid,uuid)'::regprocedure);
  if position($selector$and lesson.version = coalesce(nullif(target_skill.metadata->>'content_version', '')::integer, 4)$selector$ in function_definition) = 0
     or position($selector$and set_row.version = coalesce(nullif(target_skill.metadata->>'content_version', '')::integer, 4)$selector$ in function_definition) = 0 then
    raise exception 'V16_2_V4_RUNTIME_DOES_NOT_SELECT_PUBLISHED_CONTENT_VERSION';
  end if;

  if (select count(*) from public.learning_adaptive_content_packs
       where pack_version = 'TECESCOLA_BNCC_GUIDED_STUDY_EM1_V16_2') <> 1 then
    raise exception 'V16_2_PACK_DUPLICATED';
  end if;
end;
$guided_study_v16_2_database_contract$;
