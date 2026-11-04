begin;

-- Publish only complete V5 packs that passed the pedagogical review report.
-- This is an authorial release lane; it deliberately does not claim official BNCC mapping.
do $publish_reviewed_authorial_v5$
declare
  reviewed_pack_ids constant text[] := array[
    'v5-english-context-vocabulary-inference',
    'v5-english-infer-from-text',
    'v5-english-relate-language-culture-contextual-use',
    'v6-english-infer-from-text-expansion',
    'v8-english-infer-from-text-expansion-v8'
  ];
  held_pack_ids constant text[] := array[
    'v5-art-character-experiment',
    'v5-biology-cell-function',
    'v5-biology-inheritance',
    'v5-chemistry-atomic-structure',
    'v5-chemistry-stoichiometry',
    'pe-distinguish-activity-exercise',
    'pe-plan-safe-activity',
    'v9-physics-average-speed-expansion-v9'
  ];
  lesson_count integer;
  set_count integer;
  question_count integer;
  held_active_count integer;
begin
  select count(*)
    into lesson_count
    from public.learning_skill_lessons lesson
   where lesson.metadata->>'content_pack' = 'TECESCOLA_CORE_V5_QUESTION_FIRST'
     and lesson.metadata->>'content_id' = any (reviewed_pack_ids);

  if lesson_count <> cardinality(reviewed_pack_ids) then
    raise exception 'AUTHORIAL_V5_RELEASE_GUARD lessons expected=% actual=%', cardinality(reviewed_pack_ids), lesson_count;
  end if;

  select count(*)
    into set_count
    from public.learning_question_sets question_set
   where question_set.metadata->>'content_pack' = 'TECESCOLA_CORE_V5_QUESTION_FIRST'
     and question_set.metadata->>'content_id' = any (reviewed_pack_ids);

  if set_count <> cardinality(reviewed_pack_ids) * 5 then
    raise exception 'AUTHORIAL_V5_RELEASE_GUARD sets expected=% actual=%', cardinality(reviewed_pack_ids) * 5, set_count;
  end if;

  select count(distinct question.id)
    into question_count
    from public.learning_question_bank question
    join public.learning_question_set_items item
      on item.question_bank_id = question.id
    join public.learning_question_sets question_set
      on question_set.id = item.question_set_id
     and question_set.metadata->>'content_pack' = 'TECESCOLA_CORE_V5_QUESTION_FIRST'
     and question_set.metadata->>'content_id' = any (reviewed_pack_ids)
   where question.source_type = 'TECESCOLA_CORE_V5_QUESTION_FIRST_STAGING';

  if question_count <> 226 then
    raise exception 'AUTHORIAL_V5_RELEASE_GUARD questions expected=226 actual=%', question_count;
  end if;

  select count(*)
    into held_active_count
    from public.learning_skill_lessons lesson
   where lesson.metadata->>'content_id' = any (held_pack_ids)
     and lesson.active;

  if held_active_count > 0 then
    raise exception 'AUTHORIAL_V5_RELEASE_GUARD held lessons already active=%', held_active_count;
  end if;

  select count(*)
    into held_active_count
    from public.learning_question_sets question_set
   where question_set.metadata->>'content_id' = any (held_pack_ids)
     and question_set.active;

  if held_active_count > 0 then
    raise exception 'AUTHORIAL_V5_RELEASE_GUARD held sets already active=%', held_active_count;
  end if;

  update public.learning_skill_lessons lesson
     set active = true,
         metadata = coalesce(lesson.metadata, '{}'::jsonb) || jsonb_build_object(
           'publication_status', 'PUBLISHED',
           'publication_lane', 'AUTHORIAL_REVIEWED',
           'publication_gate', 'PEDAGOGICAL_REVIEW_PASSED',
           'pedagogical_review_status', 'PEDAGOGICAL_REVIEWED',
           'official_mapping_status', 'NOT_CLAIMED',
           'bncc_alignment_status', 'NOT_CLAIMED',
           'publication_reason', 'PEDAGOGICAL_REVIEW_V1',
           'publication_report_sha256', '0cf15e24e6d2a83094055ac07105dbc38cfcf7b915b3d15c960b5f164754efc0',
           'published_at', now()
         ),
         updated_at = now()
   where lesson.metadata->>'content_pack' = 'TECESCOLA_CORE_V5_QUESTION_FIRST'
     and lesson.metadata->>'content_id' = any (reviewed_pack_ids);

  update public.learning_question_sets question_set
     set active = true,
         metadata = coalesce(question_set.metadata, '{}'::jsonb) || jsonb_build_object(
           'publication_status', 'PUBLISHED',
           'publication_lane', 'AUTHORIAL_REVIEWED',
           'publication_gate', 'PEDAGOGICAL_REVIEW_PASSED',
           'pedagogical_review_status', 'PEDAGOGICAL_REVIEWED',
           'official_mapping_status', 'NOT_CLAIMED',
           'bncc_alignment_status', 'NOT_CLAIMED',
           'publication_reason', 'PEDAGOGICAL_REVIEW_V1',
           'publication_report_sha256', '0cf15e24e6d2a83094055ac07105dbc38cfcf7b915b3d15c960b5f164754efc0',
           'published_at', now()
         ),
         updated_at = now()
   where question_set.metadata->>'content_pack' = 'TECESCOLA_CORE_V5_QUESTION_FIRST'
     and question_set.metadata->>'content_id' = any (reviewed_pack_ids);

  update public.learning_question_bank question
     set active = true,
         metadata = coalesce(question.metadata, '{}'::jsonb) || jsonb_build_object(
           'publication_status', 'PUBLISHED',
           'publication_lane', 'AUTHORIAL_REVIEWED',
           'publication_gate', 'PEDAGOGICAL_REVIEW_PASSED',
           'pedagogical_review_status', 'PEDAGOGICAL_REVIEWED',
           'official_mapping_status', 'NOT_CLAIMED',
           'bncc_alignment_status', 'NOT_CLAIMED',
           'publication_reason', 'PEDAGOGICAL_REVIEW_V1',
           'publication_report_sha256', '0cf15e24e6d2a83094055ac07105dbc38cfcf7b915b3d15c960b5f164754efc0',
           'published_at', now()
         ),
         updated_at = now()
    from public.learning_question_set_items item
    join public.learning_question_sets question_set
      on question_set.id = item.question_set_id
     and question_set.metadata->>'content_pack' = 'TECESCOLA_CORE_V5_QUESTION_FIRST'
     and question_set.metadata->>'content_id' = any (reviewed_pack_ids)
   where question.id = item.question_bank_id
     and question.source_type = 'TECESCOLA_CORE_V5_QUESTION_FIRST_STAGING';

  raise notice 'AUTHORIAL_V5_RELEASE lessons=% sets=% questions=% report_sha256=%',
    lesson_count, set_count, question_count,
    '0cf15e24e6d2a83094055ac07105dbc38cfcf7b915b3d15c960b5f164754efc0';
end;
$publish_reviewed_authorial_v5$;

notify pgrst, 'reload schema';
commit;
