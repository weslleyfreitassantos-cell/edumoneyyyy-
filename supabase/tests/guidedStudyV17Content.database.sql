begin;

do $guided_study_v17_content_contract$
declare
  v_catalog_id uuid;
  v_institution_id uuid;
  v_skill_count integer;
  v_lesson_count integer;
  v_question_count integer;
  v_set_count integer;
  v_item_count integer;
  v_binding_count integer;
  v_skill_id uuid;
  v_validation jsonb;
begin
  select catalog.id into v_catalog_id
    from public.learning_curriculum_catalogs catalog
   where catalog.code = 'BNCC_2018' and catalog.active
   order by catalog.version desc limit 1;
  if v_catalog_id is null then raise exception 'V17_ACTIVE_BNCC_CATALOG_MISSING'; end if;

  if not exists (
    select 1 from public.learning_adaptive_content_packs pack
     where pack.pack_version = 'TECESCOLA_BNCC_GUIDED_STUDY_EM1_V17'
       and pack.active and pack.publication_status = 'PUBLISHED'
       and pack.technical_validation_status = 'PUBLISHED'
       and pack.pedagogical_review_status = 'PEDAGOGICAL_REVIEW_PENDING'
       and pack.manifest->>'canonicalHash' = pack.canonical_hash
       and pack.manifest->>'humanCertification' is null
       and pack.manifest->'authoringAudit'->>'humanCertification' = 'NOT_CLAIMED'
  ) then raise exception 'V17_PACK_NOT_TECHNICALLY_PUBLISHED_OR_REVIEW_WAS_FORGED'; end if;

  select count(*)::integer into v_skill_count
    from public.learning_curriculum_skills skill
   where skill.catalog_id = v_catalog_id
     and skill.code in ('EM13CNT104', 'EM13CNT105', 'EM13LGG403', 'EM13LP05',
       'EM13CHS101', 'EM13CHS106', 'EM13CHS501', 'EM13CHS403', 'EM13LGG603', 'EM13LGG501')
     and skill.metadata->>'content_pack' = 'TECESCOLA_BNCC_GUIDED_STUDY_EM1_V17'
     and skill.metadata->>'content_version' = '8'
     and skill.active and skill.publication_status = 'PUBLISHED'
     and skill.technical_validation_status = 'PUBLISHED'
     and skill.content_readiness = 'ADAPTIVE_READY' and skill.mastery_targetable
     and skill.pedagogical_review_status = 'PEDAGOGICAL_REVIEW_PENDING'
     and skill.bncc_alignment_status = 'MAPPED';
  if v_skill_count <> 10 then raise exception 'V17_SKILL_PUBLICATION_CONTRACT_FAILED count=%', v_skill_count; end if;

  select skill.id into v_skill_id
    from public.learning_curriculum_skills skill
   where skill.catalog_id = v_catalog_id and skill.code = 'EM13LP05';
  select private.validate_mapped_bncc_skill_v12(v_skill_id, 'EM13LP05', skill.metadata)
    into v_validation
    from public.learning_curriculum_skills skill where skill.id = v_skill_id;
  if v_validation->>'status' <> 'READY' then
    raise exception 'V17_PORTUGUESE_BNCC_CODE_VALIDATION_FAILED result=%', v_validation;
  end if;

  select private.validate_bncc_high_school_skill_v12(v_skill_id, 'EM13LP05', skill.metadata)
    into v_validation
    from public.learning_curriculum_skills skill where skill.id = v_skill_id;
  if v_validation->'errors' ? 'OFFICIAL_BNCC_CODE_NOT_VERIFIABLE' then
    raise exception 'V17_PORTUGUESE_HIGH_SCHOOL_CODE_VALIDATION_FAILED result=%', v_validation;
  end if;

  select private.validate_mapped_bncc_skill_v12(
    v_skill_id, 'EM13XX05', jsonb_build_object('official_code', 'EM13XX05'))
    into v_validation;
  if not (v_validation->'errors' ? 'OFFICIAL_BNCC_MAPPING_NOT_VERIFIABLE') then
    raise exception 'V17_INVALID_TWO_LETTER_COMPONENT_WAS_ACCEPTED result=%', v_validation;
  end if;

  if exists (
    select 1 from (values
      ('EM13CNT104', 'CNT', 'CIENCIAS_DA_NATUREZA'),
      ('EM13CNT105', 'CNT', 'CIENCIAS_DA_NATUREZA'),
      ('EM13LGG403', 'LGG', 'LINGUAGENS'),
      ('EM13LP05', 'LP', 'LINGUAGENS'),
      ('EM13CHS101', 'CHS', 'CIENCIAS_HUMANAS'),
      ('EM13CHS106', 'CHS', 'CIENCIAS_HUMANAS'),
      ('EM13CHS501', 'CHS', 'CIENCIAS_HUMANAS'),
      ('EM13CHS403', 'CHS', 'CIENCIAS_HUMANAS'),
      ('EM13LGG603', 'LGG', 'LINGUAGENS'),
      ('EM13LGG501', 'LGG', 'LINGUAGENS')
    ) expected(code, component, area)
    join public.learning_curriculum_skills skill
      on skill.catalog_id = v_catalog_id and skill.code = expected.code
    where skill.metadata->>'official_code' is distinct from expected.code
       or skill.metadata->>'official_component_code' is distinct from expected.component
       or skill.subject_area is distinct from expected.area
       or skill.metadata->>'recommended_grade_source' is distinct from 'TECESCOLA_PEDAGOGICAL_SEQUENCE'
       or skill.metadata->>'pedagogical_review_status' is distinct from 'PENDING'
  ) then raise exception 'V17_OFFICIAL_PROVENANCE_OR_DISCIPLINE_ALLOCATION_MISMATCH'; end if;

  select count(*)::integer into v_lesson_count
    from public.learning_skill_lessons lesson
    join public.learning_curriculum_skills skill on skill.id = lesson.canonical_skill_id
   where skill.catalog_id = v_catalog_id
     and skill.code in ('EM13CNT104', 'EM13CNT105', 'EM13LGG403', 'EM13LP05',
       'EM13CHS101', 'EM13CHS106', 'EM13CHS501', 'EM13CHS403', 'EM13LGG603', 'EM13LGG501')
     and lesson.version = 8 and lesson.active
     and lesson.metadata->>'content_pack' = 'TECESCOLA_BNCC_GUIDED_STUDY_EM1_V17'
     and length(lesson.content_markdown) >= 900
     and length(lesson.worked_example) >= 80;
  if v_lesson_count <> 10 then raise exception 'V17_LESSON_VERSION_OR_CONTRACT_FAILED count=%', v_lesson_count; end if;

  select count(*)::integer into v_question_count
    from public.learning_question_bank bank
   where bank.source_type = 'TECESCOLA_BNCC_GUIDED_STUDY_V17'
     and bank.active and bank.metadata->>'content_pack' = 'TECESCOLA_BNCC_GUIDED_STUDY_EM1_V17'
     and bank.metadata->>'content_version' = '8';
  if v_question_count <> 100 then raise exception 'V17_QUESTION_BANK_COUNT_MISMATCH count=%', v_question_count; end if;

  select count(*)::integer into v_set_count
    from public.learning_question_sets question_set
    join public.learning_curriculum_skills skill on skill.id = question_set.canonical_skill_id
   where skill.catalog_id = v_catalog_id
     and skill.code in ('EM13CNT104', 'EM13CNT105', 'EM13LGG403', 'EM13LP05',
       'EM13CHS101', 'EM13CHS106', 'EM13CHS501', 'EM13CHS403', 'EM13LGG603', 'EM13LGG501')
     and question_set.scope = 'GLOBAL' and question_set.version = 8 and question_set.active
     and question_set.metadata->>'content_pack' = 'TECESCOLA_BNCC_GUIDED_STUDY_EM1_V17';
  if v_set_count <> 50 then raise exception 'V17_ADAPTIVE_SET_COUNT_MISMATCH count=%', v_set_count; end if;

  select count(*)::integer into v_item_count
    from public.learning_question_set_items item
    join public.learning_question_sets question_set on question_set.id = item.question_set_id
    join public.learning_curriculum_skills skill on skill.id = question_set.canonical_skill_id
   where skill.catalog_id = v_catalog_id
     and skill.code in ('EM13CNT104', 'EM13CNT105', 'EM13LGG403', 'EM13LP05',
       'EM13CHS101', 'EM13CHS106', 'EM13CHS501', 'EM13CHS403', 'EM13LGG603', 'EM13LGG501')
     and question_set.scope = 'GLOBAL' and question_set.version = 8;
  if v_item_count <> 100 then raise exception 'V17_ADAPTIVE_ITEM_COUNT_MISMATCH count=%', v_item_count; end if;

  if exists (
    select 1 from public.learning_question_sets question_set
    join public.learning_curriculum_skills skill on skill.id = question_set.canonical_skill_id
    left join public.learning_question_set_items item on item.question_set_id = question_set.id
   where skill.catalog_id = v_catalog_id
     and skill.code in ('EM13CNT104', 'EM13CNT105', 'EM13LGG403', 'EM13LP05',
       'EM13CHS101', 'EM13CHS106', 'EM13CHS501', 'EM13CHS403', 'EM13LGG603', 'EM13LGG501')
     and question_set.scope = 'GLOBAL' and question_set.version = 8
   group by skill.code, question_set.purpose
  having count(item.question_bank_id) <> 2
  ) then raise exception 'V17_EACH_ADAPTIVE_PURPOSE_MUST_HAVE_TWO_ITEMS'; end if;

  select count(distinct skill.code)::integer into v_skill_count
    from public.learning_curriculum_skills skill
    join public.learning_curriculum_grade_targets target on target.canonical_skill_id = skill.id
   where skill.catalog_id = v_catalog_id
     and skill.code in ('EM13CNT104', 'EM13CNT105', 'EM13LGG403', 'EM13LP05',
       'EM13CHS101', 'EM13CHS106', 'EM13CHS501', 'EM13CHS403', 'EM13LGG603', 'EM13LGG501')
     and target.stage = 'ENSINO_MEDIO' and target.grade_level = 1 and target.active;
  if v_skill_count <> 10 then raise exception 'V17_EM1_GRADE_TARGET_MISSING count=%', v_skill_count; end if;

  if not exists (
    select 1 from public.learning_adaptive_content_packs pack
     where pack.pack_version = 'TECESCOLA_BNCC_GUIDED_STUDY_EM1_V16_2'
       and pack.active and pack.publication_status = 'PUBLISHED'
  ) then raise exception 'V17_MUST_PRESERVE_V16_2_PACK'; end if;
  if not exists (
    select 1 from public.learning_curriculum_skills skill
    join public.learning_skill_lessons lesson on lesson.canonical_skill_id = skill.id
   where skill.catalog_id = v_catalog_id and skill.code = 'EM13MAT302' and lesson.version = 7 and lesson.active
  ) then raise exception 'V17_MUST_PRESERVE_V16_2_MATH_CONTENT'; end if;

  insert into public.institutions(name, active) values ('Guided Study V17 Binding Contract', true)
    returning id into v_institution_id;
  insert into public.subjects(institution_id, name, code, active) values
    (v_institution_id, 'Química V17 contract', 'QUI', true),
    (v_institution_id, 'Biologia V17 contract', 'BIO', true),
    (v_institution_id, 'Inglês V17 contract', 'ING', true),
    (v_institution_id, 'Inglês homologação V17 contract', 'ING-HOM', true),
    (v_institution_id, 'Português V17 contract', 'LP', true),
    (v_institution_id, 'Português homologação V17 contract', 'LP-HOM', true),
    (v_institution_id, 'Português legado V17 contract', 'PORT', true),
    (v_institution_id, 'Educação Física V17 contract', 'EDF', true),
    (v_institution_id, 'Educação Física homologação V17 contract', 'EDF-HOM', true),
    (v_institution_id, 'História V17 contract', 'HIS', true),
    (v_institution_id, 'História homologação V17 contract', 'HIS-HOM', true),
    (v_institution_id, 'Geografia V17 contract', 'GEO', true),
    (v_institution_id, 'Geografia homologação V17 contract', 'GEO-HOM', true),
    (v_institution_id, 'Filosofia V17 contract', 'FIL', true),
    (v_institution_id, 'Sociologia V17 contract', 'SOC', true),
    (v_institution_id, 'Arte V17 contract', 'ART', true),
    (v_institution_id, 'Ciências V17 decoy', 'CIE', true);

  select count(*)::integer into v_binding_count
    from private.learning_guided_subject_skill_bindings_v16 binding
    join public.subjects subject on subject.id = binding.subject_id
   where binding.institution_id = v_institution_id
     and (subject.code, (select skill.code from public.learning_curriculum_skills skill where skill.id = binding.canonical_skill_id)) in (
       ('QUI', 'EM13CNT104'), ('BIO', 'EM13CNT105'),
       ('ING', 'EM13LGG403'), ('ING-HOM', 'EM13LGG403'),
       ('LP', 'EM13LP05'), ('LP-HOM', 'EM13LP05'), ('PORT', 'EM13LP05'),
       ('HIS', 'EM13CHS101'), ('HIS-HOM', 'EM13CHS101'),
       ('GEO', 'EM13CHS106'), ('GEO-HOM', 'EM13CHS106'),
       ('FIL', 'EM13CHS501'), ('SOC', 'EM13CHS403'), ('ART', 'EM13LGG603'),
       ('EDF', 'EM13LGG501'), ('EDF-HOM', 'EM13LGG501')
     );
  if v_binding_count <> 16 then raise exception 'V17_EXPLICIT_SUBJECT_BINDINGS_FAILED count=%', v_binding_count; end if;
  select count(*)::integer into v_binding_count
    from private.learning_curriculum_subject_links_v13 link
    join public.subjects subject on subject.id = link.subject_id
   where link.institution_id = v_institution_id
     and subject.code in ('LP', 'LP-HOM', 'PORT', 'ING', 'ING-HOM', 'ART', 'EDF', 'EDF-HOM')
     and link.subject_area = 'LINGUAGENS' and link.active;
  if v_binding_count <> 8 then raise exception 'V17_REAL_SUBJECT_ALIAS_COMPATIBILITY_FAILED count=%', v_binding_count; end if;
  select count(*)::integer into v_binding_count
    from private.learning_curriculum_subject_links_v13 link
    join public.subjects subject on subject.id = link.subject_id
   where link.institution_id = v_institution_id
     and subject.code in ('HIS', 'HIS-HOM', 'GEO', 'GEO-HOM', 'FIL', 'SOC')
     and link.subject_area = 'CIENCIAS_HUMANAS' and link.active;
  if v_binding_count <> 6 then raise exception 'V17_HUMANITIES_SUBJECT_ALIAS_COMPATIBILITY_FAILED count=%', v_binding_count; end if;
  if exists (
    select 1 from private.learning_guided_subject_skill_bindings_v16 binding
    join public.subjects subject on subject.id = binding.subject_id
   where binding.institution_id = v_institution_id and subject.code = 'CIE'
  ) then raise exception 'V17_MUST_NOT_BIND_AN_ENTIRE_BNCC_AREA_TO_OTHER_SUBJECTS'; end if;
end;
$guided_study_v17_content_contract$;

rollback;
