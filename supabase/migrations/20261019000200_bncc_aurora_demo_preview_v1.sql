begin;

-- Enable the existing, explicitly labeled BNCC demonstration preview for the
-- Aurora fixture institution. This does not publish or alter curriculum data.
-- The preview remains limited by the existing active-student, institution,
-- enrollment, and active-class checks in private.bncc_demo_preview_allowed.
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

  -- Do not enable a similarly named but unrelated institution. Require the
  -- stored fixture marker on an active student in this school,
  -- plus the exact subject/content pair used by the reported failure.
  if not exists (
    select 1
      from public.students student
      join auth.users auth_user on auth_user.id = student.profile_id
      join public.enrollments enrollment
        on enrollment.student_id = student.id
       and enrollment.active
       and upper(enrollment.status::text) = 'ACTIVE'
      join public.classes class
        on class.id = enrollment.class_id
       and class.institution_id = target_institution_id
       and class.active
     where student.institution_id = target_institution_id
       and student.active
       and auth_user.raw_user_meta_data->>'aurora_fixture' = 'AURORA_INTEGRAL_DEMO'
  ) then
    return;
  end if;

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

  insert into private.bncc_demo_preview_institutions(
    institution_id,
    preview_code,
    active
  )
  values (
    target_institution_id,
    'TECESCOLA_BNCC_AURORA_INTEGRAL_DEMO_V1',
    true
  )
  on conflict (institution_id) do update
    set preview_code = excluded.preview_code,
        active = true;
end;
$aurora_preview$;

commit;
