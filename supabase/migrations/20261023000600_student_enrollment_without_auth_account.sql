begin;

alter table public.students
  alter column profile_id drop not null,
  add column if not exists full_name text,
  add column if not exists phone text;

update public.students student
   set full_name = coalesce(nullif(btrim(profile.full_name), ''), student.full_name),
       phone = coalesce(student.phone, profile.phone)
  from public.profiles profile
 where profile.id = student.profile_id
   and (student.full_name is null or student.phone is null);

alter table public.students
  add constraint students_require_profile_or_name
  check (
    profile_id is not null
    or nullif(btrim(full_name), '') is not null
  );

create or replace function public.list_students_page(
  p_institution_id uuid,
  p_search text default null,
  p_limit integer default 25,
  p_offset integer default 0
)
returns table (
  id uuid,
  profile_id uuid,
  institution_id uuid,
  registration_number text,
  active boolean,
  full_name text,
  email text,
  total_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with filtered_students as (
    select
      student.id,
      student.profile_id,
      student.institution_id,
      student.registration_number,
      student.active,
      coalesce(nullif(btrim(profile.full_name), ''), student.full_name, student.registration_number) as full_name,
      coalesce(profile.email, '') as email,
      count(*) over () as total_count
    from public.students as student
    left join public.profiles as profile
      on profile.id = student.profile_id
    where student.institution_id = p_institution_id
      and (
        nullif(btrim(p_search), '') is null
        or student.registration_number ilike '%' || btrim(p_search) || '%'
        or coalesce(nullif(btrim(profile.full_name), ''), student.full_name, '') ilike '%' || btrim(p_search) || '%'
        or coalesce(profile.email, '') ilike '%' || btrim(p_search) || '%'
      )
    order by student.created_at desc, student.id desc
    limit greatest(least(coalesce(p_limit, 25), 100), 1)
    offset greatest(coalesce(p_offset, 0), 0)
  )
  select
    filtered_students.id,
    filtered_students.profile_id,
    filtered_students.institution_id,
    filtered_students.registration_number,
    filtered_students.active,
    filtered_students.full_name,
    filtered_students.email,
    filtered_students.total_count
  from filtered_students;
$$;

create or replace function public.get_teacher_offering_rosters(
  target_offering_ids uuid[],
  effective_date date default null
)
returns table (
  offering_id uuid,
  enrollment_id uuid,
  student_id uuid,
  profile_id uuid,
  full_name text,
  registration_number text,
  class_id uuid,
  academic_year_id uuid,
  enrolled_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_teacher_profile_id uuid := auth.uid();
  v_invalid_count int;
  v_invalid_date boolean;
begin
  select count(distinct so.id)
    into v_invalid_count
    from unnest(target_offering_ids) as req_id
    left join public.subject_offerings so on so.id = req_id
    left join public.classes c on c.id = so.class_id
    left join public.terms t on t.id = so.term_id
    left join public.memberships m
      on m.institution_id = c.institution_id
     and m.profile_id = v_teacher_profile_id
   where so.teacher_profile_id = v_teacher_profile_id
     and so.active is true
     and c.active is true
     and t.active is true
     and m.role = 'TEACHER'
     and m.active is true;

  if v_invalid_count <> (select count(distinct x) from unnest(target_offering_ids) as x) then
    raise exception 'Acesso negado ou oferta invalida/inativa solicitada.' using errcode = '42501';
  end if;

  if effective_date is not null then
    select exists (
      select 1
        from unnest(target_offering_ids) as req_id
        join public.subject_offerings so on so.id = req_id
        join public.terms t on t.id = so.term_id
       where effective_date < t.start_date or effective_date > t.end_date
    ) into v_invalid_date;
    if v_invalid_date then
      raise exception 'Data da chamada ou avaliacao fora do periodo letivo.' using errcode = '22000';
    end if;
  end if;

  return query
  select
    so.id,
    e.id,
    s.id,
    p.id,
    coalesce(nullif(btrim(p.full_name), ''), s.full_name, s.registration_number),
    s.registration_number,
    e.class_id,
    e.academic_year_id,
    e.enrolled_at
  from unnest(target_offering_ids) as req_id
  join public.subject_offerings so on so.id = req_id
  join public.classes c on c.id = so.class_id
  join public.enrollments e on e.class_id = c.id and e.academic_year_id = c.academic_year_id
  join public.students s on s.id = e.student_id
  left join public.profiles p on p.id = s.profile_id
  where e.active is true
    and upper(trim(e.status)) = 'ACTIVE'
    and s.active is true
    and s.institution_id = c.institution_id
    and (p.id is null or p.active is true)
    and (effective_date is null or e.enrolled_at < (effective_date + interval '1 day'));
end;
$$;

revoke execute on function public.get_teacher_offering_rosters(uuid[], date) from public, anon;
grant execute on function public.get_teacher_offering_rosters(uuid[], date) to authenticated, service_role;

create or replace function public.update_student_without_auth_identity(
  p_institution_id uuid,
  p_student_id uuid,
  p_full_name text,
  p_phone text default null
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
    raise exception using errcode = '42501', message = 'STUDENT_UPDATE_FORBIDDEN';
  end if;
  if p_full_name is null
    or length(btrim(p_full_name)) < 3
    or length(btrim(p_full_name)) > 120
    or (p_phone is not null and length(btrim(p_phone)) > 40)
  then
    raise exception using errcode = '22023', message = 'STUDENT_IDENTITY_INVALID';
  end if;

  update public.students
     set full_name = btrim(p_full_name),
         phone = nullif(btrim(p_phone), ''),
         updated_at = now()
   where id = p_student_id
     and institution_id = p_institution_id
     and profile_id is null;
  if not found then
    raise exception using errcode = 'P0002', message = 'STUDENT_WITHOUT_AUTH_NOT_FOUND';
  end if;
  return true;
end;
$$;

revoke all on function public.update_student_without_auth_identity(uuid, uuid, text, text) from public, anon;
grant execute on function public.update_student_without_auth_identity(uuid, uuid, text, text) to authenticated;

create table public.student_enrollment_duplicate_approvals (
  draft_id uuid not null references public.student_enrollment_drafts(id),
  institution_id uuid not null references public.institutions(id),
  approved_by uuid not null references public.profiles(id),
  identity_fingerprint text not null check (identity_fingerprint ~ '^[0-9a-f]{32}$'),
  candidate_student_ids uuid[] not null check (cardinality(candidate_student_ids) between 1 and 100),
  approved_at timestamptz not null default now(),
  used_at timestamptz,
  primary key (draft_id, approved_by, identity_fingerprint)
);

alter table public.student_enrollment_duplicate_approvals enable row level security;
revoke all on public.student_enrollment_duplicate_approvals from public, anon, authenticated;

create or replace function private.student_identity_fingerprint(
  p_full_name text,
  p_birth_date date,
  p_cpf text
)
returns text
language sql
immutable
set search_path = ''
as $$
  select md5(
    translate(
      lower(regexp_replace(btrim(coalesce(p_full_name, '')), '[[:space:]]+', ' ', 'g')),
      'áàãâäéèêëíìîïóòõôöúùûüç',
      'aaaaaeeeeiiiiooooouuuuc'
    ) || chr(31) || coalesce(p_birth_date::text, '') || chr(31) ||
    regexp_replace(coalesce(p_cpf, ''), '[^0-9]', '', 'g')
  );
$$;

create or replace function private.find_student_duplicate_ids(
  p_institution_id uuid,
  p_full_name text,
  p_birth_date date,
  p_cpf text,
  p_exclude_student_id uuid
)
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(student.id order by student.id), '{}'::uuid[])
    from public.students student
    left join public.profiles profile on profile.id = student.profile_id
   where student.institution_id = p_institution_id
     and student.id is distinct from p_exclude_student_id
     and (
       (
         nullif(regexp_replace(coalesce(p_cpf, ''), '[^0-9]', '', 'g'), '') is not null
         and regexp_replace(coalesce(student.cpf, ''), '[^0-9]', '', 'g') =
             regexp_replace(coalesce(p_cpf, ''), '[^0-9]', '', 'g')
       )
       or (
         p_birth_date is not null
         and student.birth_date = p_birth_date
         and translate(
           lower(regexp_replace(btrim(coalesce(profile.full_name, student.full_name, '')), '[[:space:]]+', ' ', 'g')),
           'áàãâäéèêëíìîïóòõôöúùûüç',
           'aaaaaeeeeiiiiooooouuuuc'
         ) = translate(
           lower(regexp_replace(btrim(coalesce(p_full_name, '')), '[[:space:]]+', ' ', 'g')),
           'áàãâäéèêëíìîïóòõôöúùûüç',
           'aaaaaeeeeiiiiooooouuuuc'
         )
       )
     );
$$;

revoke all on function private.student_identity_fingerprint(text, date, text) from public, anon, authenticated;
revoke all on function private.find_student_duplicate_ids(uuid, text, date, text, uuid) from public, anon, authenticated;

create or replace function public.approve_student_enrollment_duplicate_review(
  p_institution_id uuid,
  p_draft_id uuid,
  p_candidate_student_ids uuid[]
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_draft public.student_enrollment_drafts%rowtype;
  v_birth_date date;
  v_full_name text;
  v_cpf text;
  v_fingerprint text;
  v_current_ids uuid[];
  v_requested_ids uuid[];
begin
  if auth.uid() is null or not private.has_institution_role(
    p_institution_id,
    array['ADMIN', 'DIRECTOR', 'SECRETARY']::public.user_role[]
  ) then
    raise exception using errcode = '42501', message = 'ENROLLMENT_DRAFT_FORBIDDEN';
  end if;
  if p_candidate_student_ids is null
    or cardinality(p_candidate_student_ids) < 1
    or cardinality(p_candidate_student_ids) > 100
    or array_position(p_candidate_student_ids, null) is not null
  then
    raise exception using errcode = '22023', message = 'STUDENT_DUPLICATE_REVIEW_INVALID';
  end if;

  select * into v_draft
    from public.student_enrollment_drafts draft
   where draft.id = p_draft_id
     and draft.institution_id = p_institution_id
     and draft.status = 'FINALIZING'
     and draft.finalization_owner = auth.uid()
   for update;
  if not found or not private.valid_student_enrollment_draft_payload(v_draft.payload) then
    raise exception using errcode = '55000', message = 'ENROLLMENT_DRAFT_NOT_FINALIZING';
  end if;

  v_full_name := v_draft.payload->'identity'->>'full_name';
  v_birth_date := nullif(v_draft.payload->'identity'->>'birth_date', '')::date;
  v_cpf := v_draft.payload->'identity'->>'cpf';
  v_fingerprint := private.student_identity_fingerprint(v_full_name, v_birth_date, v_cpf);
  v_current_ids := private.find_student_duplicate_ids(
    p_institution_id, v_full_name, v_birth_date, v_cpf, v_draft.created_student_id
  );
  select coalesce(array_agg(distinct requested.id order by requested.id), '{}'::uuid[])
    into v_requested_ids
    from unnest(p_candidate_student_ids) requested(id);
  if v_current_ids is distinct from v_requested_ids then
    raise exception using errcode = 'P0001', message = 'STUDENT_DUPLICATE_REVIEW_STALE';
  end if;

  insert into public.student_enrollment_duplicate_approvals(
    draft_id, institution_id, approved_by, identity_fingerprint, candidate_student_ids, used_at
  ) values (
    p_draft_id, p_institution_id, auth.uid(), v_fingerprint, v_current_ids, null
  )
  on conflict (draft_id, approved_by, identity_fingerprint) do update set
    candidate_student_ids = excluded.candidate_student_ids,
    approved_at = now(),
    used_at = null;
  return true;
end;
$$;

revoke all on function public.approve_student_enrollment_duplicate_review(uuid, uuid, uuid[]) from public, anon;
grant execute on function public.approve_student_enrollment_duplicate_review(uuid, uuid, uuid[]) to authenticated;

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
  v_student_id uuid;
  v_full_name text;
  v_birth_date date;
  v_cpf text;
  v_fingerprint text;
  v_duplicate_ids uuid[];
  v_duplicate_approval_used boolean := false;
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
    or not private.valid_student_enrollment_draft_payload(v_draft.payload)
  then
    raise exception using errcode = '55000', message = 'ENROLLMENT_DRAFT_NOT_FINALIZING';
  end if;

  v_full_name := v_draft.payload->'identity'->>'full_name';
  v_birth_date := nullif(v_draft.payload->'identity'->>'birth_date', '')::date;
  v_cpf := v_draft.payload->'identity'->>'cpf';
  v_fingerprint := private.student_identity_fingerprint(v_full_name, v_birth_date, v_cpf);
  v_duplicate_ids := private.find_student_duplicate_ids(
    p_institution_id, v_full_name, v_birth_date, v_cpf, v_draft.created_student_id
  );
  if cardinality(v_duplicate_ids) > 0 then
    select exists (
      select 1
        from public.student_enrollment_duplicate_approvals approval
       where approval.draft_id = p_draft_id
         and approval.institution_id = p_institution_id
         and approval.approved_by = auth.uid()
         and approval.identity_fingerprint = v_fingerprint
         and approval.candidate_student_ids = v_duplicate_ids
    ) into v_duplicate_approval_used;
    if not v_duplicate_approval_used then
      raise exception using errcode = 'P0001', message = 'STUDENT_DUPLICATE_REVIEW_REQUIRED';
    end if;
  end if;

  v_student_id := v_draft.created_student_id;
  if v_student_id is null then
    if nullif(btrim(v_draft.payload->'identity'->>'email'), '') is not null
      or nullif(btrim(v_draft.payload->'identity'->>'full_name'), '') is null
    then
      raise exception using errcode = '22023', message = 'ENROLLMENT_DRAFT_STUDENT_INCOMPLETE';
    end if;
    insert into public.students(
      profile_id, institution_id, registration_number, full_name,
      birth_date, cpf, phone, active
    ) values (
      null, p_institution_id, '', btrim(v_draft.payload->'identity'->>'full_name'),
      nullif(v_draft.payload->'identity'->>'birth_date', '')::date,
      nullif(btrim(v_draft.payload->'identity'->>'cpf'), ''),
      nullif(btrim(v_draft.payload->'identity'->>'phone'), ''), true
    ) returning id into v_student_id;
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
    'student_id', v_student_id,
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
  if cardinality(v_duplicate_ids) > 0 then
    update public.student_enrollment_duplicate_approvals
       set used_at = now()
     where draft_id = p_draft_id
       and institution_id = p_institution_id
       and approved_by = auth.uid()
       and identity_fingerprint = v_fingerprint
       and candidate_student_ids = v_duplicate_ids;
  end if;
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
exception
  when unique_violation then
    raise exception using errcode = 'P0001', message = 'STUDENT_DUPLICATE_POSSIBLE';
end;
$$;

notify pgrst, 'reload schema';
commit;
