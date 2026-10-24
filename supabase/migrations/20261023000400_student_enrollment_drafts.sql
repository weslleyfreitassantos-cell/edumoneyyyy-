begin;

create table public.student_enrollment_drafts (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id),
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  status text not null default 'OPEN'
    check (status in ('OPEN', 'FINALIZING', 'COMPLETED', 'DISCARDED')),
  payload jsonb not null,
  current_step smallint not null default 0
    check (current_step between 0 and 7),
  version bigint not null default 1 check (version > 0),
  created_student_id uuid,
  created_guardian_profile_ids jsonb not null default '{}'::jsonb
    check (jsonb_typeof(created_guardian_profile_ids) = 'object'),
  finalization_owner uuid references auth.users(id),
  finalization_started_at timestamptz,
  enrollment_id uuid,
  completion_result jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  discarded_at timestamptz,
  unique (institution_id, id),
  check (octet_length(payload::text) <= 262144),
  check (
    status <> 'COMPLETED'
    or (created_student_id is not null and enrollment_id is not null
        and completion_result is not null and completed_at is not null)
  )
);

create index student_enrollment_drafts_open_idx
  on public.student_enrollment_drafts(institution_id, updated_at desc)
  where status in ('OPEN', 'FINALIZING');

alter table public.student_enrollment_drafts enable row level security;

create policy student_enrollment_drafts_manager_read
  on public.student_enrollment_drafts
  for select to authenticated
  using (
    private.has_institution_role(
      institution_id,
      array['ADMIN', 'DIRECTOR', 'SECRETARY']::public.user_role[]
    )
  );

revoke all on public.student_enrollment_drafts from public, anon, authenticated;

create or replace function private.valid_student_enrollment_draft_payload(
  p_payload jsonb
)
returns boolean
language plpgsql
immutable
security definer
set search_path = ''
as $$
begin
  if p_payload is null or jsonb_typeof(p_payload) is distinct from 'object' then
    return false;
  end if;
  if octet_length(p_payload::text) > 262144 then
    return false;
  end if;
  if p_payload - array[
      'identity', 'address', 'guardians', 'previous_schooling', 'health',
      'documents', 'academic_year_id', 'class_id', 'enrolled_at'
    ]::text[] <> '{}'::jsonb
    or jsonb_typeof(p_payload->'identity') is distinct from 'object'
    or jsonb_typeof(p_payload->'address') is distinct from 'object'
    or jsonb_typeof(p_payload->'guardians') is distinct from 'array'
    or jsonb_typeof(p_payload->'previous_schooling') is distinct from 'object'
    or jsonb_typeof(p_payload->'health') is distinct from 'object'
    or jsonb_typeof(p_payload->'documents') is distinct from 'array'
  then
    return false;
  end if;
  if (p_payload->'identity') - array[
      'full_name', 'email', 'birth_date', 'cpf', 'social_name', 'rg',
      'rg_issuing_authority', 'rg_state', 'birth_certificate', 'nationality',
      'birthplace', 'birth_state', 'sex', 'phone'
    ]::text[] <> '{}'::jsonb
    or jsonb_typeof(p_payload->'identity'->'full_name') is distinct from 'string'
    or jsonb_typeof(p_payload->'identity'->'email') is distinct from 'string'
    or jsonb_typeof(p_payload->'identity'->'birth_date') is distinct from 'string'
    or jsonb_typeof(p_payload->'identity'->'cpf') is distinct from 'string'
    or jsonb_typeof(p_payload->'identity'->'social_name') is distinct from 'string'
    or jsonb_typeof(p_payload->'identity'->'rg') is distinct from 'string'
    or jsonb_typeof(p_payload->'identity'->'rg_issuing_authority') is distinct from 'string'
    or jsonb_typeof(p_payload->'identity'->'rg_state') is distinct from 'string'
    or jsonb_typeof(p_payload->'identity'->'birth_certificate') is distinct from 'string'
    or jsonb_typeof(p_payload->'identity'->'nationality') is distinct from 'string'
    or jsonb_typeof(p_payload->'identity'->'birthplace') is distinct from 'string'
    or jsonb_typeof(p_payload->'identity'->'birth_state') is distinct from 'string'
    or jsonb_typeof(p_payload->'identity'->'sex') is distinct from 'string'
    or jsonb_typeof(p_payload->'identity'->'phone') is distinct from 'string'
    or length(p_payload->'identity'->>'full_name') > 160
    or length(p_payload->'identity'->>'email') > 254
    or length(p_payload->'identity'->>'cpf') > 32
    or length(p_payload->'identity'->>'phone') > 40
    or (p_payload->'address') - array[
      'postal_code', 'street', 'number', 'complement', 'neighborhood', 'city', 'state', 'rural_zone'
    ]::text[] <> '{}'::jsonb
    or jsonb_typeof(p_payload->'address'->'postal_code') is distinct from 'string'
    or jsonb_typeof(p_payload->'address'->'street') is distinct from 'string'
    or jsonb_typeof(p_payload->'address'->'number') is distinct from 'string'
    or jsonb_typeof(p_payload->'address'->'complement') is distinct from 'string'
    or jsonb_typeof(p_payload->'address'->'neighborhood') is distinct from 'string'
    or jsonb_typeof(p_payload->'address'->'city') is distinct from 'string'
    or jsonb_typeof(p_payload->'address'->'state') is distinct from 'string'
    or jsonb_typeof(p_payload->'address'->'rural_zone') is distinct from 'boolean'
    or length(p_payload->'address'->>'street') > 180
    or length(p_payload->'address'->>'complement') > 180
    or (p_payload->'previous_schooling') - array[
      'origin_school', 'origin_network', 'city', 'state', 'last_grade', 'origin_year',
      'status', 'observations', 'history_delivered', 'transfer_declaration'
    ]::text[] <> '{}'::jsonb
    or jsonb_typeof(p_payload->'previous_schooling'->'origin_school') is distinct from 'string'
    or jsonb_typeof(p_payload->'previous_schooling'->'origin_network') is distinct from 'string'
    or jsonb_typeof(p_payload->'previous_schooling'->'city') is distinct from 'string'
    or jsonb_typeof(p_payload->'previous_schooling'->'state') is distinct from 'string'
    or jsonb_typeof(p_payload->'previous_schooling'->'last_grade') is distinct from 'string'
    or jsonb_typeof(p_payload->'previous_schooling'->'origin_year') is distinct from 'string'
    or jsonb_typeof(p_payload->'previous_schooling'->'status') is distinct from 'string'
    or jsonb_typeof(p_payload->'previous_schooling'->'observations') is distinct from 'string'
    or jsonb_typeof(p_payload->'previous_schooling'->'history_delivered') is distinct from 'boolean'
    or jsonb_typeof(p_payload->'previous_schooling'->'transfer_declaration') is distinct from 'boolean'
    or length(p_payload->'previous_schooling'->>'observations') > 2000
    or (p_payload->'health') - array[
      'allergies', 'health_conditions', 'emergency_medication', 'disability',
      'autism', 'giftedness', 'needs_special_education', 'school_care_notes'
    ]::text[] <> '{}'::jsonb
    or jsonb_typeof(p_payload->'health'->'allergies') is distinct from 'string'
    or jsonb_typeof(p_payload->'health'->'health_conditions') is distinct from 'string'
    or jsonb_typeof(p_payload->'health'->'emergency_medication') is distinct from 'string'
    or jsonb_typeof(p_payload->'health'->'disability') is distinct from 'string'
    or jsonb_typeof(p_payload->'health'->'autism') is distinct from 'boolean'
    or jsonb_typeof(p_payload->'health'->'giftedness') is distinct from 'boolean'
    or jsonb_typeof(p_payload->'health'->'needs_special_education') is distinct from 'boolean'
    or jsonb_typeof(p_payload->'health'->'school_care_notes') is distinct from 'string'
    or length(p_payload->'health'->>'allergies') > 2000
    or length(p_payload->'health'->>'health_conditions') > 2000
    or length(p_payload->'health'->>'emergency_medication') > 2000
    or length(p_payload->'health'->>'disability') > 2000
    or length(p_payload->'health'->>'school_care_notes') > 2000
  then
    return false;
  end if;
  if jsonb_array_length(p_payload->'guardians') > 10
    or jsonb_array_length(p_payload->'documents') > 10
  then
    return false;
  end if;
  if exists (
    select 1
      from jsonb_array_elements(p_payload->'guardians') guardian
     where jsonb_typeof(guardian) is distinct from 'object'
        or guardian - array[
          'mode', 'profile_id', 'full_name', 'email', 'phone', 'relationship', 'is_primary'
        ]::text[] <> '{}'::jsonb
        or jsonb_typeof(guardian->'mode') is distinct from 'string'
        or jsonb_typeof(guardian->'profile_id') is distinct from 'string'
        or jsonb_typeof(guardian->'full_name') is distinct from 'string'
        or jsonb_typeof(guardian->'email') is distinct from 'string'
        or jsonb_typeof(guardian->'phone') is distinct from 'string'
        or jsonb_typeof(guardian->'relationship') is distinct from 'string'
        or jsonb_typeof(guardian->'is_primary') is distinct from 'boolean'
        or coalesce(length(guardian->>'full_name'), 0) > 120
        or coalesce(length(guardian->>'email'), 0) > 254
        or coalesce(length(guardian->>'relationship'), 0) > 40
  ) or exists (
    select 1
      from jsonb_array_elements(p_payload->'documents') document
     where jsonb_typeof(document) is distinct from 'object'
        or document - array['document_type', 'status', 'notes']::text[] <> '{}'::jsonb
        or jsonb_typeof(document->'document_type') is distinct from 'string'
        or jsonb_typeof(document->'status') is distinct from 'string'
        or jsonb_typeof(document->'notes') is distinct from 'string'
        or coalesce(length(document->>'document_type'), 0) > 80
        or coalesce(length(document->>'notes'), 0) > 2000
        or document->>'status' not in (
          'NOT_REQUESTED', 'PENDING', 'REQUESTED', 'DELIVERED', 'UNDER_REVIEW',
          'VALIDATED', 'REJECTED', 'DISPENSED'
        )
  ) then
    return false;
  end if;
  if p_payload::text ~* '"(file|file_path|filepath|signed_url|signedurl|storage_url|storageurl|access_token|accesstoken|refresh_token|refreshtoken|data_url|dataurl|base64)"[[:space:]]*:' then
    return false;
  end if;
  return true;
end;
$$;

revoke all on function private.valid_student_enrollment_draft_payload(jsonb)
  from public, anon, authenticated;

create or replace function public.save_student_enrollment_draft(
  p_institution_id uuid,
  p_draft_id uuid,
  p_expected_version bigint,
  p_payload jsonb,
  p_current_step integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_version bigint;
begin
  if auth.uid() is null or not private.has_institution_role(
    p_institution_id,
    array['ADMIN', 'DIRECTOR', 'SECRETARY']::public.user_role[]
  ) then
    raise exception using errcode = '42501', message = 'ENROLLMENT_DRAFT_FORBIDDEN';
  end if;
  if not private.valid_student_enrollment_draft_payload(p_payload)
    or p_current_step is null or p_current_step < 0 or p_current_step > 7
  then
    raise exception using errcode = '22023', message = 'ENROLLMENT_DRAFT_INVALID';
  end if;

  if p_draft_id is null then
    if p_expected_version is not null then
      raise exception using errcode = '22023', message = 'ENROLLMENT_DRAFT_INVALID';
    end if;
    insert into public.student_enrollment_drafts(
      institution_id, created_by, updated_by, payload, current_step
    ) values (
      p_institution_id, auth.uid(), auth.uid(), p_payload, p_current_step
    ) returning id, version into v_id, v_version;
  else
    perform pg_catalog.set_config('lock_timeout', '2s', true);
    begin
      update public.student_enrollment_drafts
         set payload = p_payload,
             current_step = p_current_step,
             version = version + 1,
             updated_by = auth.uid(),
             updated_at = now()
       where id = p_draft_id
         and institution_id = p_institution_id
         and status = 'OPEN'
         and version = p_expected_version
      returning id, version into v_id, v_version;
    exception
      when lock_not_available then
        raise exception using errcode = 'P0001', message = 'ENROLLMENT_DRAFT_VERSION_CONFLICT';
    end;
    if v_id is null then
      if exists (
        select 1 from public.student_enrollment_drafts
         where id = p_draft_id and institution_id = p_institution_id
      ) then
        raise exception using errcode = 'P0001', message = 'ENROLLMENT_DRAFT_VERSION_CONFLICT';
      end if;
      raise exception using errcode = 'P0002', message = 'ENROLLMENT_DRAFT_NOT_FOUND';
    end if;
  end if;

  return jsonb_build_object('draft_id', v_id, 'version', v_version);
end;
$$;

create or replace function public.list_student_enrollment_drafts(
  p_institution_id uuid
)
returns table (
  draft_id uuid,
  student_name text,
  current_step smallint,
  version bigint,
  status text,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not private.has_institution_role(
    p_institution_id,
    array['ADMIN', 'DIRECTOR', 'SECRETARY']::public.user_role[]
  ) then
    raise exception using errcode = '42501', message = 'ENROLLMENT_DRAFT_FORBIDDEN';
  end if;
  return query
    select draft.id,
           coalesce(nullif(btrim(draft.payload #>> '{identity,full_name}'), ''), 'Aluno sem nome'),
           draft.current_step,
           draft.version,
           draft.status,
           draft.updated_at
      from public.student_enrollment_drafts draft
     where draft.institution_id = p_institution_id
       and draft.status in ('OPEN', 'FINALIZING')
     order by draft.updated_at desc
     limit 100;
end;
$$;

create or replace function public.get_student_enrollment_draft(
  p_institution_id uuid,
  p_draft_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_draft public.student_enrollment_drafts%rowtype;
begin
  if auth.uid() is null or not private.has_institution_role(
    p_institution_id,
    array['ADMIN', 'DIRECTOR', 'SECRETARY']::public.user_role[]
  ) then
    raise exception using errcode = '42501', message = 'ENROLLMENT_DRAFT_FORBIDDEN';
  end if;
  select * into v_draft
    from public.student_enrollment_drafts draft
   where draft.id = p_draft_id
     and draft.institution_id = p_institution_id
     and draft.status in ('OPEN', 'FINALIZING');
  if not found then
    raise exception using errcode = 'P0002', message = 'ENROLLMENT_DRAFT_NOT_FOUND';
  end if;
  return jsonb_build_object(
    'draft_id', v_draft.id,
    'institution_id', v_draft.institution_id,
    'payload', v_draft.payload,
    'current_step', v_draft.current_step,
    'version', v_draft.version,
    'status', v_draft.status,
    'created_student_id', v_draft.created_student_id,
    'created_guardian_profile_ids', v_draft.created_guardian_profile_ids,
    'updated_at', v_draft.updated_at
  );
end;
$$;

create or replace function public.discard_student_enrollment_draft(
  p_institution_id uuid,
  p_draft_id uuid,
  p_expected_version bigint
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if auth.uid() is null or not private.has_institution_role(
    p_institution_id,
    array['ADMIN', 'DIRECTOR', 'SECRETARY']::public.user_role[]
  ) then
    raise exception using errcode = '42501', message = 'ENROLLMENT_DRAFT_FORBIDDEN';
  end if;
  update public.student_enrollment_drafts
     set status = 'DISCARDED', payload = '{}'::jsonb, current_step = 0,
         discarded_at = now(),
         updated_at = now(), updated_by = auth.uid()
   where id = p_draft_id and institution_id = p_institution_id
     and status = 'OPEN' and version = p_expected_version;
  get diagnostics v_count = row_count;
  if v_count = 0 then
    raise exception using errcode = 'P0001', message = 'ENROLLMENT_DRAFT_VERSION_CONFLICT';
  end if;
  return true;
end;
$$;

create or replace function public.claim_student_enrollment_draft_finalization(
  p_institution_id uuid,
  p_draft_id uuid,
  p_expected_version bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_draft public.student_enrollment_drafts%rowtype;
begin
  if auth.uid() is null or not private.has_institution_role(
    p_institution_id,
    array['ADMIN', 'DIRECTOR', 'SECRETARY']::public.user_role[]
  ) then
    raise exception using errcode = '42501', message = 'ENROLLMENT_DRAFT_FORBIDDEN';
  end if;
  select * into v_draft
    from public.student_enrollment_drafts draft
   where draft.id = p_draft_id and draft.institution_id = p_institution_id
   for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'ENROLLMENT_DRAFT_NOT_FOUND';
  end if;
  if v_draft.status = 'COMPLETED' then
    return jsonb_build_object('state', 'COMPLETED', 'result', v_draft.completion_result);
  end if;
  if v_draft.status = 'DISCARDED' then
    raise exception using errcode = '55000', message = 'ENROLLMENT_DRAFT_NOT_OPEN';
  end if;
  if v_draft.status = 'FINALIZING'
    and v_draft.finalization_started_at > now() - interval '3 minutes'
  then
    return jsonb_build_object('state', 'IN_PROGRESS');
  end if;
  if v_draft.version <> p_expected_version then
    raise exception using errcode = 'P0001', message = 'ENROLLMENT_DRAFT_VERSION_CONFLICT';
  end if;
  update public.student_enrollment_drafts
     set status = 'FINALIZING', finalization_started_at = now(),
         finalization_owner = auth.uid(), updated_at = now()
   where id = p_draft_id and institution_id = p_institution_id;
  return jsonb_build_object(
    'state', 'CLAIMED', 'version', v_draft.version,
    'created_student_id', v_draft.created_student_id,
    'created_guardian_profile_ids', v_draft.created_guardian_profile_ids
  );
end;
$$;

create or replace function public.record_student_enrollment_draft_progress(
  p_institution_id uuid,
  p_draft_id uuid,
  p_student_id uuid,
  p_guardian_profile_ids jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_draft public.student_enrollment_drafts%rowtype;
  v_pair record;
  v_existing_profile_id text;
begin
  if auth.uid() is null or not private.has_institution_role(
    p_institution_id,
    array['ADMIN', 'DIRECTOR', 'SECRETARY']::public.user_role[]
  ) then
    raise exception using errcode = '42501', message = 'ENROLLMENT_DRAFT_FORBIDDEN';
  end if;
  if p_guardian_profile_ids is null
    or jsonb_typeof(p_guardian_profile_ids) <> 'object'
    or octet_length(p_guardian_profile_ids::text) > 4096
  then
    raise exception using errcode = '22023', message = 'ENROLLMENT_DRAFT_INVALID';
  end if;
  select * into v_draft from public.student_enrollment_drafts draft
   where draft.id = p_draft_id and draft.institution_id = p_institution_id
     and draft.status = 'FINALIZING'
   for update;
  if not found then
    raise exception using errcode = '55000', message = 'ENROLLMENT_DRAFT_NOT_FINALIZING';
  end if;
  if v_draft.finalization_owner is distinct from auth.uid() then
    raise exception using errcode = '42501', message = 'ENROLLMENT_DRAFT_FORBIDDEN';
  end if;
  if p_student_id is not null and not exists (
    select 1 from public.students student
     where student.id = p_student_id and student.institution_id = p_institution_id
  ) then
    raise exception using errcode = '22023', message = 'ENROLLMENT_DRAFT_INVALID';
  end if;
  for v_pair in select key, value from jsonb_each_text(p_guardian_profile_ids) loop
    if v_pair.value !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      raise exception using errcode = '22023', message = 'ENROLLMENT_DRAFT_INVALID';
    end if;
    if not exists (
      select 1 from public.memberships membership
       where membership.profile_id = v_pair.value::uuid
         and membership.institution_id = p_institution_id
         and membership.role = 'GUARDIAN'::public.user_role
         and membership.active is true
    ) then
      raise exception using errcode = '22023', message = 'ENROLLMENT_DRAFT_INVALID';
    end if;
    v_existing_profile_id := v_draft.created_guardian_profile_ids->>v_pair.key;
    if v_existing_profile_id is not null and v_existing_profile_id <> v_pair.value then
      raise exception using errcode = 'P0001', message = 'ENROLLMENT_DRAFT_VERSION_CONFLICT';
    end if;
  end loop;
  if v_draft.created_student_id is not null and p_student_id is not null
    and v_draft.created_student_id <> p_student_id
  then
    raise exception using errcode = 'P0001', message = 'ENROLLMENT_DRAFT_VERSION_CONFLICT';
  end if;
  update public.student_enrollment_drafts
     set created_student_id = coalesce(created_student_id, p_student_id),
         created_guardian_profile_ids = created_guardian_profile_ids || p_guardian_profile_ids,
         updated_at = now()
   where id = p_draft_id and institution_id = p_institution_id;
  return true;
end;
$$;

create or replace function public.release_student_enrollment_draft_finalization(
  p_institution_id uuid,
  p_draft_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not private.has_institution_role(
    p_institution_id,
    array['ADMIN', 'DIRECTOR', 'SECRETARY']::public.user_role[]
  ) then
    raise exception using errcode = '42501', message = 'ENROLLMENT_DRAFT_FORBIDDEN';
  end if;
  update public.student_enrollment_drafts
     set status = 'OPEN', finalization_started_at = null,
         finalization_owner = null, updated_at = now()
   where id = p_draft_id and institution_id = p_institution_id
     and status = 'FINALIZING' and finalization_owner = auth.uid();
  return found;
end;
$$;

create or replace function public.finalize_student_enrollment_draft(
  p_institution_id uuid,
  p_draft_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_draft public.student_enrollment_drafts%rowtype;
  v_result jsonb;
  v_payload jsonb;
  v_guardians jsonb;
  v_documents jsonb;
begin
  if auth.uid() is null or not private.has_institution_role(
    p_institution_id,
    array['ADMIN', 'DIRECTOR', 'SECRETARY']::public.user_role[]
  ) then
    raise exception using errcode = '42501', message = 'ENROLLMENT_DRAFT_FORBIDDEN';
  end if;
  select * into v_draft from public.student_enrollment_drafts draft
   where draft.id = p_draft_id and draft.institution_id = p_institution_id
   for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'ENROLLMENT_DRAFT_NOT_FOUND';
  end if;
  if v_draft.status = 'COMPLETED' then
    return v_draft.completion_result;
  end if;
  if v_draft.status <> 'FINALIZING'
    or v_draft.finalization_owner is distinct from auth.uid()
    or v_draft.created_student_id is null
    or not private.valid_student_enrollment_draft_payload(v_draft.payload)
  then
    raise exception using errcode = '55000', message = 'ENROLLMENT_DRAFT_NOT_FINALIZING';
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'guardian_profile_id', coalesce(
        nullif(guardian.value->>'profile_id', ''),
        v_draft.created_guardian_profile_ids->>((guardian.ordinality - 1)::text)
      ),
      'relationship', guardian.value->>'relationship',
      'is_primary', coalesce((guardian.value->>'is_primary')::boolean, false)
    ) order by guardian.ordinality
  ), '[]'::jsonb)
    into v_guardians
    from jsonb_array_elements(v_draft.payload->'guardians') with ordinality guardian(value, ordinality);

  if jsonb_array_length(v_guardians) = 0 or exists (
    select 1 from jsonb_array_elements(v_guardians) guardian
     where nullif(guardian->>'guardian_profile_id', '') is null
  ) then
    raise exception using errcode = '22023', message = 'ENROLLMENT_DRAFT_GUARDIANS_INCOMPLETE';
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'document_type', document.value->>'document_type',
      'status', document.value->>'status',
      'file_path', null,
      'notes', document.value->>'notes'
    ) order by document.ordinality
  ), '[]'::jsonb)
    into v_documents
    from jsonb_array_elements(v_draft.payload->'documents') with ordinality document(value, ordinality);

  v_payload := jsonb_build_object(
    'institution_id', p_institution_id,
    'student_id', v_draft.created_student_id,
    'enrollment_id', null,
    'academic_year_id', v_draft.payload->>'academic_year_id',
    'class_id', v_draft.payload->>'class_id',
    'enrolled_at', v_draft.payload->>'enrolled_at',
    'identity', v_draft.payload->'identity',
    'address', v_draft.payload->'address',
    'previous_schooling', v_draft.payload->'previous_schooling' || jsonb_build_object(
      'origin_year', nullif(v_draft.payload->'previous_schooling'->>'origin_year', '')
    ),
    'health', v_draft.payload->'health',
    'documents', v_documents,
    'guardians', v_guardians
  );

  v_result := public.create_full_student_enrollment_bundle(v_payload);
  update public.student_enrollment_drafts
     set status = 'COMPLETED',
         payload = '{}'::jsonb,
         current_step = 7,
         enrollment_id = (v_result->>'enrollment_id')::uuid,
         created_student_id = (v_result->>'student_id')::uuid,
         completion_result = v_result,
         completed_at = now(),
         updated_at = now(),
         finalization_started_at = null
   where id = p_draft_id and institution_id = p_institution_id;
  return v_result;
end;
$$;

revoke all on function public.save_student_enrollment_draft(uuid, uuid, bigint, jsonb, integer)
  from public, anon, authenticated;
revoke all on function public.list_student_enrollment_drafts(uuid)
  from public, anon, authenticated;
revoke all on function public.get_student_enrollment_draft(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.discard_student_enrollment_draft(uuid, uuid, bigint)
  from public, anon, authenticated;
revoke all on function public.claim_student_enrollment_draft_finalization(uuid, uuid, bigint)
  from public, anon, authenticated;
revoke all on function public.record_student_enrollment_draft_progress(uuid, uuid, uuid, jsonb)
  from public, anon, authenticated;
revoke all on function public.release_student_enrollment_draft_finalization(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.finalize_student_enrollment_draft(uuid, uuid)
  from public, anon, authenticated;

grant execute on function public.save_student_enrollment_draft(uuid, uuid, bigint, jsonb, integer)
  to authenticated;
grant execute on function public.list_student_enrollment_drafts(uuid)
  to authenticated;
grant execute on function public.get_student_enrollment_draft(uuid, uuid)
  to authenticated;
grant execute on function public.discard_student_enrollment_draft(uuid, uuid, bigint)
  to authenticated;
grant execute on function public.claim_student_enrollment_draft_finalization(uuid, uuid, bigint)
  to authenticated;
grant execute on function public.record_student_enrollment_draft_progress(uuid, uuid, uuid, jsonb)
  to authenticated;
grant execute on function public.release_student_enrollment_draft_finalization(uuid, uuid)
  to authenticated;
grant execute on function public.finalize_student_enrollment_draft(uuid, uuid)
  to authenticated;

comment on table public.student_enrollment_drafts is
  'Institution-scoped, versioned enrollment drafts. Sensitive health fields are stored only server-side; uploads, paths, and tokens are excluded.';

notify pgrst, 'reload schema';
commit;
