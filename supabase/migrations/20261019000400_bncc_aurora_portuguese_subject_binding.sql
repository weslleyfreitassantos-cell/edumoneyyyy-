begin;

-- Aurora's production subject code is PORT (not the demo fixture's LP).
-- Bind only that exact active subject to the canonical BNCC Portuguese subject;
-- do not rename subjects or change curriculum/journey content.
do $aurora_portuguese_binding$
declare
  institution_count integer;
  target_institution_id uuid;
  subject_count integer;
  target_subject_id uuid;
  canonical_count integer;
  target_canonical_subject_id uuid;
begin
  select count(*)::integer,
         (array_agg(institution.id order by institution.id))[1]
    into institution_count, target_institution_id
    from public.institutions institution
   where institution.public_slug = 'aurora-integral'
     and institution.active;

  -- Local and preview databases without the production school are unchanged.
  if institution_count = 0 then
    return;
  end if;
  if institution_count <> 1 then
    raise exception 'BNCC_AURORA_PORTUGUESE_INSTITUTION_NOT_UNIQUE';
  end if;

  select count(*)::integer,
         (array_agg(subject.id order by subject.id))[1]
    into subject_count, target_subject_id
    from public.subjects subject
   where subject.institution_id = target_institution_id
     and subject.active
     and upper(btrim(subject.code)) = 'PORT'
     and upper(btrim(subject.name)) = 'LÍNGUA PORTUGUESA';

  if subject_count <> 1 then
    raise exception 'BNCC_AURORA_PORTUGUESE_SUBJECT_NOT_UNIQUE';
  end if;

  select count(*)::integer,
         (array_agg(canonical.id order by canonical.id))[1]
    into canonical_count, target_canonical_subject_id
    from public.learning_canonical_subjects canonical
   where canonical.code = 'PORTUGUESE'
     and canonical.active;

  if canonical_count <> 1 then
    raise exception 'BNCC_PORTUGUESE_CANONICAL_SUBJECT_NOT_UNIQUE';
  end if;

  insert into private.learning_demo_subject_bindings(
    institution_id,
    subject_id,
    canonical_subject_id,
    mapping_source
  )
  values (
    target_institution_id,
    target_subject_id,
    target_canonical_subject_id,
    'V9_AURORA_PORT_EXACT_SUBJECT_CODE_AND_NAME'
  )
  on conflict (institution_id, subject_id) do update
    set canonical_subject_id = excluded.canonical_subject_id,
        mapping_source = excluded.mapping_source;

  if not exists (
    select 1
      from private.learning_demo_subject_bindings binding
     where binding.institution_id = target_institution_id
       and binding.subject_id = target_subject_id
       and binding.canonical_subject_id = target_canonical_subject_id
  ) then
    raise exception 'BNCC_AURORA_PORTUGUESE_BINDING_REQUIRED';
  end if;
end;
$aurora_portuguese_binding$;

commit;
