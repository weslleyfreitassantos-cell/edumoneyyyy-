begin;

-- Release only content that has crossed every student-facing gate. Source
-- verification or technical readiness alone must never publish content.
do $release_verified_learning_content$
declare
  promoted_skill_count integer;
  promoted_pack_count integer;
begin
  with eligible_skills as (
    select skill.id
      from public.learning_curriculum_skills skill
      join public.learning_adaptive_content_packs pack
        on pack.pack_version = skill.metadata->>'content_pack'
       and pack.active
       and pack.pedagogical_review_status = 'PEDAGOGICAL_REVIEWED'
       and pack.publication_status in ('STAGING', 'QA_ONLY', 'PUBLISHED')
     where skill.active
       and skill.publication_status in ('STAGING', 'QA_ONLY')
       and skill.pedagogical_review_status = 'PEDAGOGICAL_REVIEWED'
       and skill.bncc_alignment_status = 'MAPPED'
       and skill.content_readiness = 'ADAPTIVE_READY'
       and skill.mastery_targetable
       and exists (
         select 1
           from public.learning_skill_lessons lesson
          where lesson.canonical_skill_id = skill.id
            and lesson.version = 4
            and lesson.active
       )
       and exists (
         select 1
           from public.learning_question_sets question_set
           join public.learning_question_set_items item
             on item.question_set_id = question_set.id
           join public.learning_question_bank question
             on question.id = item.question_bank_id
            and question.active
          where question_set.canonical_skill_id = skill.id
            and question_set.scope = 'GLOBAL'
            and question_set.version = 4
            and question_set.active
       )
  )
  update public.learning_curriculum_skills skill
     set publication_status = 'PUBLISHED',
         metadata = coalesce(skill.metadata, '{}'::jsonb) || jsonb_build_object(
           'publication_status', 'PUBLISHED',
           'publication_gate', 'PASSED',
           'publication_reason', 'VERIFIED_CONTENT_RELEASE',
           'published_at', now()
         ),
         updated_at = now()
    from eligible_skills eligible
   where skill.id = eligible.id;

  get diagnostics promoted_skill_count = row_count;

  update public.learning_adaptive_content_packs pack
     set publication_status = 'PUBLISHED',
         manifest = coalesce(pack.manifest, '{}'::jsonb) || jsonb_build_object(
           'publication_status', 'PUBLISHED',
           'publication_gate', 'PASSED',
           'publication_reason', 'VERIFIED_CONTENT_RELEASE',
           'published_at', now()
         ),
         updated_at = now()
   where pack.active
     and pack.pedagogical_review_status = 'PEDAGOGICAL_REVIEWED'
     and pack.publication_status in ('STAGING', 'QA_ONLY')
     and exists (
       select 1
         from public.learning_curriculum_skills skill
        where skill.active
          and skill.publication_status = 'PUBLISHED'
          and skill.pedagogical_review_status = 'PEDAGOGICAL_REVIEWED'
          and skill.bncc_alignment_status = 'MAPPED'
          and skill.content_readiness = 'ADAPTIVE_READY'
          and skill.mastery_targetable
          and skill.metadata->>'content_pack' = pack.pack_version
     );

  get diagnostics promoted_pack_count = row_count;

  raise notice 'VERIFIED_CONTENT_RELEASE skills=% packs=%', promoted_skill_count, promoted_pack_count;
end;
$release_verified_learning_content$;

notify pgrst, 'reload schema';
commit;
