begin;

do $guided_study_v13_database_test$
declare
  skill_count integer;
  lesson_count integer;
  set_count integer;
  item_count integer;
  reauthored_count integer;
  supplement_count integer;
  lineage_count integer;
  preserved_v8_count integer;
  bad_skills jsonb;
  function_definition text;
begin
  select count(*)::integer into skill_count
    from public.learning_curriculum_skills skill
    join public.learning_curriculum_catalogs catalog on catalog.id = skill.catalog_id
   where catalog.code = 'BNCC_2018'
     and skill.code = any (array['EM13MAT101','EM13LGG303','EM13CNT101','EM13CHS103'])
     and skill.active and skill.publication_status = 'PUBLISHED'
     and skill.technical_validation_status = 'PUBLISHED'
     and skill.content_readiness = 'ADAPTIVE_READY' and skill.mastery_targetable
     and skill.bncc_alignment_status = 'MAPPED'
     and skill.pedagogical_review_status = 'PEDAGOGICAL_REVIEW_PENDING'
     and skill.metadata->>'content_pack' = 'tec-escola-bncc-guided-study-v13'
     and skill.metadata->>'content_version' = '6'
     and skill.metadata->>'recommended_grade_source' = 'TECESCOLA_PEDAGOGICAL_SEQUENCE';
  if skill_count <> 4 then
    select coalesce(jsonb_agg(jsonb_build_object(
      'code', skill.code,
      'publication_status', skill.publication_status,
      'technical_validation_status', skill.technical_validation_status,
      'technical_validation_errors', skill.technical_validation_errors,
      'content_version', skill.metadata->>'content_version'
    ) order by skill.code), '[]'::jsonb)
      into bad_skills
      from public.learning_curriculum_skills skill
     where skill.code = any (array['EM13MAT101','EM13LGG303','EM13CNT101','EM13CHS103']);
    raise exception 'GUIDED_STUDY_V13_SKILLS_NOT_AUTOMATICALLY_PUBLISHED expected=4 actual=% details=%', skill_count, bad_skills;
  end if;

  select count(*)::integer into lesson_count
    from public.learning_skill_lessons lesson
    join public.learning_curriculum_skills skill on skill.id = lesson.canonical_skill_id
   where skill.code = any (array['EM13MAT101','EM13LGG303','EM13CNT101','EM13CHS103'])
     and lesson.version = 6 and lesson.active
     and lesson.metadata->>'content_pack' = 'tec-escola-bncc-guided-study-v13'
     and lesson.metadata->>'pedagogical_review_status' = 'PEDAGOGICAL_REVIEW_PENDING';
  if lesson_count <> 4 then raise exception 'GUIDED_STUDY_V13_LESSON_COVERAGE actual=%', lesson_count; end if;

  select count(*)::integer into set_count
    from public.learning_question_sets question_set
    join public.learning_curriculum_skills skill on skill.id = question_set.canonical_skill_id
   where skill.code = any (array['EM13MAT101','EM13LGG303','EM13CNT101','EM13CHS103'])
     and question_set.scope = 'GLOBAL' and question_set.version = 6 and question_set.active
     and question_set.purpose in ('PROBE','PRACTICE','TRANSFER','LOCK_IN','REVIEW')
     and question_set.metadata->>'content_pack' = 'tec-escola-bncc-guided-study-v13';
  if set_count <> 20 then raise exception 'GUIDED_STUDY_V13_PURPOSE_COVERAGE expected=20 actual=%', set_count; end if;

  select count(item.id)::integer into item_count
    from public.learning_question_set_items item
    join public.learning_question_sets question_set on question_set.id = item.question_set_id
    join public.learning_curriculum_skills skill on skill.id = question_set.canonical_skill_id
    join public.learning_question_bank bank on bank.id = item.question_bank_id
   where skill.code = any (array['EM13MAT101','EM13LGG303','EM13CNT101','EM13CHS103'])
     and question_set.scope = 'GLOBAL' and question_set.version = 6 and question_set.active
     and bank.active and bank.source_type = 'TECESCOLA_BNCC_GUIDED_STUDY_V13'
     and bank.metadata->>'content_pack' = 'tec-escola-bncc-guided-study-v13'
     and coalesce(bank.metadata->>'demo_preview', 'false') <> 'true'
     and coalesce(bank.metadata->>'demo_preview_only', 'false') <> 'true'
     and coalesce(bank.metadata->>'demonstration_only', 'false') <> 'true'
     and coalesce(bank.metadata->>'is_test_fixture', 'false') <> 'true'
     and coalesce(bank.metadata->>'test_fixture', 'false') <> 'true'
     and jsonb_typeof(bank.options) = 'array'
     and exists (select 1 from jsonb_array_elements(bank.options) option(value) where option.value = bank.correct_answer)
     and length(btrim(coalesce(bank.explanation, ''))) >= 12;
  if item_count <> 24 then raise exception 'GUIDED_STUDY_V13_QUESTION_COVERAGE expected=24 actual=%', item_count; end if;

  select count(*) filter (where bank.metadata->>'conversion_action' = 'REAUTHORED_AND_REVALIDATED')::integer,
         count(*) filter (where bank.metadata->>'conversion_action' = 'NEW_PRACTICE_VARIATION')::integer,
         count(*)::integer
    into reauthored_count, supplement_count, lineage_count
    from public.learning_question_bank bank
   where bank.source_type = 'TECESCOLA_BNCC_GUIDED_STUDY_V13'
     and bank.metadata->>'content_pack' = 'tec-escola-bncc-guided-study-v13';
  if reauthored_count <> 20 or supplement_count <> 4 or lineage_count <> 24 then
    raise exception 'GUIDED_STUDY_V13_CONVERSION_LINEAGE_INVALID reauthored=% supplements=% total=%', reauthored_count, supplement_count, lineage_count;
  end if;

  select count(distinct legacy.id)::integer into preserved_v8_count
    from public.learning_adaptive_content_packs pack,
         jsonb_array_elements(pack.manifest->'conversionAudit'->'questions') lineage
    join public.learning_question_bank legacy
      on legacy.source_type = 'TECESCOLA_BNCC_EM_V8'
     and legacy.metadata->>'content_id' = lineage->>'sourceQuestionId'
   where pack.pack_version = 'tec-escola-bncc-guided-study-v13'
     and lineage->>'sourceQuestionId' is not null
     and legacy.metadata->>'content_pack' = 'TECESCOLA_BNCC_DEEP_LEARNING_V8';
  if preserved_v8_count <> 20 then
    raise exception 'GUIDED_STUDY_V13_LEGACY_SOURCE_RECORDS_NOT_PRESERVED expected=20 actual=%', preserved_v8_count;
  end if;

  if exists (
    select 1 from public.learning_curriculum_skills skill
    where skill.code = any (array['EM13MAT101','EM13LGG303','EM13CNT101','EM13CHS103'])
      and (not exists (
        select 1 from public.learning_skill_lessons lesson
         where lesson.canonical_skill_id = skill.id and lesson.version = 4 and lesson.active
      ) or not exists (
        select 1 from public.learning_skill_lessons lesson
         where lesson.canonical_skill_id = skill.id and lesson.version = 5 and lesson.active
      ) or not exists (
        select 1 from public.learning_question_sets old_set
         where old_set.canonical_skill_id = skill.id and old_set.version = 5 and old_set.active
           and old_set.metadata->>'content_pack' = 'TECESCOLA_BNCC_DEEP_LEARNING_V8'
      ))
  ) then raise exception 'GUIDED_STUDY_V13_HISTORICAL_V4_V8_CONTENT_NOT_PRESERVED'; end if;

  if exists (
    select 1 from public.learning_question_sets question_set
    join public.learning_curriculum_skills skill on skill.id = question_set.canonical_skill_id
    left join lateral (
      select count(*)::integer as amount from public.learning_question_set_items item
       where item.question_set_id = question_set.id
    ) counts on true
    where skill.code = any (array['EM13MAT101','EM13LGG303','EM13CNT101','EM13CHS103'])
      and question_set.scope = 'GLOBAL' and question_set.version = 6 and question_set.active
      and counts.amount <> case question_set.purpose when 'PRACTICE' then 2 else 1 end
  ) then raise exception 'GUIDED_STUDY_V13_PURPOSE_ITEM_DISTRIBUTION_INVALID'; end if;

  if not exists (
    select 1 from public.learning_adaptive_content_packs pack
     where pack.pack_version = 'tec-escola-bncc-guided-study-v13'
       and pack.active and pack.publication_status = 'PUBLISHED'
       and pack.technical_validation_status = 'PUBLISHED'
       and pack.canonical_hash = pack.manifest->>'canonicalHash'
       and pack.canonical_hash ~ '^[0-9a-f]{64}$'
       and pack.pedagogical_review_status = 'PEDAGOGICAL_REVIEW_PENDING'
       and pack.manifest->>'skillCount' = '4'
       and pack.manifest->>'questionCount' = '24'
       and pack.manifest->>'reusedQuestionSourceCount' = '20'
       and pack.manifest->>'newPracticeQuestionCount' = '4'
       and pack.manifest->'conversionAudit'->>'humanCertification' = 'NOT_CLAIMED'
       and pack.manifest->'conversionAudit'->>'sourceRecordsMutated' = 'false'
       and pack.manifest->'errors' = '[]'::jsonb
       and pack.manifest->'unknownPrerequisites' = '[]'::jsonb
       and pack.manifest->'prerequisiteCycles' = '[]'::jsonb
       and pack.manifest->'nearDuplicateStems' = '[]'::jsonb
  ) then raise exception 'GUIDED_STUDY_V13_PACK_MANIFEST_INVALID'; end if;

  select pg_get_functiondef('private.recommend_guided_study_v11(uuid)'::regprocedure)
    into function_definition;
  if (length(function_definition) - length(replace(function_definition, 'private.learning_curriculum_subject_links_v13 subject_link', ''))) /
       length('private.learning_curriculum_subject_links_v13 subject_link') <> 3
     or function_definition like '%public.learning_curriculum_subject_links subject_link%'
     or function_definition like '%question_set.version = 4%' then
    raise exception 'GUIDED_STUDY_V13_V11_COMPATIBILITY_NOT_INSTALLED';
  end if;
  if has_table_privilege('authenticated', 'private.learning_curriculum_subject_links_v13', 'select')
     or has_table_privilege('anon', 'private.learning_curriculum_subject_links_v13', 'select') then
    raise exception 'GUIDED_STUDY_V13_PRIVATE_CURRICULUM_VIEW_EXPOSED';
  end if;

  select pg_get_functiondef('public.start_guided_learning_session_v4(uuid,uuid,uuid)'::regprocedure)
    into function_definition;
  if function_definition not like '%target_skill.metadata%content_version%' then
    raise exception 'GUIDED_STUDY_V13_START_PROVENANCE_NOT_VERSIONED';
  end if;
  select pg_get_functiondef('public.submit_guided_learning_step_v4(uuid,jsonb,text)'::regprocedure)
    into function_definition;
  if function_definition not like '%session_row.metadata%content_version%' then
    raise exception 'GUIDED_STUDY_V13_EVIDENCE_PROVENANCE_NOT_VERSIONED';
  end if;
end;
$guided_study_v13_database_test$;

rollback;
