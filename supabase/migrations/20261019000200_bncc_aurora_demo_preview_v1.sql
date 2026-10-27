begin;

-- Add exact local-to-canonical subject mappings for the Aurora institution.
-- Preview eligibility is governed by authenticated student/institution scope,
-- enrollment, class, and content-state checks, not a per-institution allowlist.
do $aurora_preview$
declare
  candidate_count integer;
  target_institution_id uuid;
begin
  select count(*)::integer,
         (array_agg(institution.id order by institution.id))[1]
    into candidate_count, target_institution_id
    from public.institutions institution
   where institution.public_slug = 'aurora-integral'
     and institution.active;

  -- Local/preview databases without this production fixture remain valid.
  if candidate_count = 0 then
    return;
  end if;
  if candidate_count <> 1 then
    raise exception 'BNCC_AURORA_DEMO_INSTITUTION_NOT_UNIQUE';
  end if;

  -- Require the exact subject/content pair used by the reported failure.
  if not exists (
    select 1
      from public.subjects subject
      join public.learning_canonical_subjects canonical
        on canonical.code = 'ART'
       and canonical.active
      join public.learning_bncc_discipline_journeys journey
        on journey.canonical_subject_id = canonical.id
       and journey.active
       and journey.publication_status = 'DEMO_PREVIEW'
       and journey.mapping_status = 'MAPPING_PENDING'
       and journey.pedagogical_review_status = 'PEDAGOGICAL_REVIEW_PENDING'
       and journey.suggested_stage = 'ENSINO_MEDIO'
       and journey.suggested_grade = 1
     where subject.institution_id = target_institution_id
       and subject.active
       and upper(btrim(subject.code)) = 'ART'
       and upper(btrim(subject.name)) = 'ARTE'
  ) then
    return;
  end if;

  with expected(subject_code, subject_name, canonical_code) as (
    values
      ('ART', 'ARTE', 'ART'),
      ('BIO', 'BIOLOGIA', 'BIOLOGY'),
      ('EDF', 'EDUCAÇÃO FÍSICA', 'PHYSICAL_EDUCATION'),
      ('FIL', 'FILOSOFIA', 'PHILOSOPHY'),
      ('FIS', 'FÍSICA', 'PHYSICS'),
      ('GEO', 'GEOGRAFIA', 'GEOGRAPHY'),
      ('HIS', 'HISTÓRIA', 'HISTORY'),
      ('ING', 'LÍNGUA INGLESA', 'ENGLISH'),
      ('LP', 'LÍNGUA PORTUGUESA', 'PORTUGUESE'),
      ('MAT', 'MATEMÁTICA', 'MATHEMATICS'),
      ('QUI', 'QUÍMICA', 'CHEMISTRY'),
      ('SOC', 'SOCIOLOGIA', 'SOCIOLOGY')
  )
  insert into private.learning_demo_subject_bindings(
    institution_id,
    subject_id,
    canonical_subject_id,
    mapping_source
  )
  select target_institution_id,
         subject.id,
         canonical.id,
         'V9_DEMO_EXACT_SUBJECT_CODE_AND_NAME'
    from expected
    join public.subjects subject
      on subject.institution_id = target_institution_id
     and subject.active
     and upper(btrim(subject.code)) = expected.subject_code
     and upper(btrim(subject.name)) = expected.subject_name
    join public.learning_canonical_subjects canonical
      on canonical.code = expected.canonical_code
     and canonical.active
  on conflict (institution_id, subject_id) do update
    set canonical_subject_id = excluded.canonical_subject_id,
        mapping_source = excluded.mapping_source;

  if not exists (
    select 1
      from public.subjects subject
      join private.learning_demo_subject_bindings binding
        on binding.institution_id = target_institution_id
       and binding.subject_id = subject.id
      join public.learning_canonical_subjects canonical
        on canonical.id = binding.canonical_subject_id
       and canonical.code = 'ART'
     where subject.institution_id = target_institution_id
       and subject.active
       and upper(btrim(subject.code)) = 'ART'
       and upper(btrim(subject.name)) = 'ARTE'
  ) then
    raise exception 'BNCC_AURORA_DEMO_ART_BINDING_REQUIRED';
  end if;

end;
$aurora_preview$;

commit;
