begin;

create table if not exists public.student_registration_details (
  student_id uuid primary key references public.students(id) on delete cascade,
  institution_id uuid not null references public.institutions(id) on delete cascade,
  social_name text,
  rg text,
  rg_issuing_authority text,
  rg_state text,
  birth_certificate text,
  nationality text,
  birthplace text,
  birth_state text,
  sex text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists student_registration_details_institution_idx
  on public.student_registration_details(institution_id);

create table if not exists public.student_addresses (
  id uuid primary key default extensions.uuid_generate_v4(),
  student_id uuid not null unique references public.students(id) on delete cascade,
  institution_id uuid not null references public.institutions(id) on delete cascade,
  postal_code text,
  street text,
  number text,
  complement text,
  neighborhood text,
  city text,
  state text,
  rural_zone boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists student_addresses_institution_idx
  on public.student_addresses(institution_id);

create table if not exists public.student_previous_schooling (
  id uuid primary key default extensions.uuid_generate_v4(),
  student_id uuid not null unique references public.students(id) on delete cascade,
  institution_id uuid not null references public.institutions(id) on delete cascade,
  origin_school text,
  origin_network text,
  city text,
  state text,
  last_grade text,
  origin_year integer,
  status text,
  observations text,
  history_delivered boolean not null default false,
  transfer_declaration boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists student_previous_schooling_institution_idx
  on public.student_previous_schooling(institution_id);

create table if not exists public.student_health_information (
  student_id uuid primary key references public.students(id) on delete cascade,
  institution_id uuid not null references public.institutions(id) on delete cascade,
  allergies text,
  health_conditions text,
  emergency_medication text,
  disability text,
  autism boolean not null default false,
  giftedness boolean not null default false,
  needs_special_education boolean not null default false,
  school_care_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists student_health_information_institution_idx
  on public.student_health_information(institution_id);

create table if not exists public.student_documents (
  id uuid primary key default extensions.uuid_generate_v4(),
  student_id uuid not null references public.students(id) on delete cascade,
  institution_id uuid not null references public.institutions(id) on delete cascade,
  document_type text not null,
  status text not null default 'PENDING',
  file_path text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_documents_status_check
    check (status in ('PENDING', 'DELIVERED', 'VALIDATED', 'DISPENSED')),
  constraint student_documents_type_unique
    unique (student_id, document_type)
);

create index if not exists student_documents_institution_idx
  on public.student_documents(institution_id);

alter table public.student_registration_details enable row level security;
alter table public.student_addresses enable row level security;
alter table public.student_previous_schooling enable row level security;
alter table public.student_health_information enable row level security;
alter table public.student_documents enable row level security;

drop policy if exists student_registration_details_staff_select on public.student_registration_details;
create policy student_registration_details_staff_select
  on public.student_registration_details for select to authenticated
  using (private.has_institution_role(institution_id, array['ADMIN', 'DIRECTOR', 'SECRETARY']::public.user_role[]));

drop policy if exists student_registration_details_staff_write on public.student_registration_details;
create policy student_registration_details_staff_write
  on public.student_registration_details for all to authenticated
  using (private.has_institution_role(institution_id, array['ADMIN', 'DIRECTOR', 'SECRETARY']::public.user_role[]))
  with check (private.has_institution_role(institution_id, array['ADMIN', 'DIRECTOR', 'SECRETARY']::public.user_role[]));

drop policy if exists student_addresses_staff_access on public.student_addresses;
create policy student_addresses_staff_access
  on public.student_addresses for all to authenticated
  using (private.has_institution_role(institution_id, array['ADMIN', 'DIRECTOR', 'SECRETARY']::public.user_role[]))
  with check (private.has_institution_role(institution_id, array['ADMIN', 'DIRECTOR', 'SECRETARY']::public.user_role[]));

drop policy if exists student_previous_schooling_staff_access on public.student_previous_schooling;
create policy student_previous_schooling_staff_access
  on public.student_previous_schooling for all to authenticated
  using (private.has_institution_role(institution_id, array['ADMIN', 'DIRECTOR', 'SECRETARY']::public.user_role[]))
  with check (private.has_institution_role(institution_id, array['ADMIN', 'DIRECTOR', 'SECRETARY']::public.user_role[]));

drop policy if exists student_health_information_staff_access on public.student_health_information;
create policy student_health_information_staff_access
  on public.student_health_information for all to authenticated
  using (private.has_institution_role(institution_id, array['ADMIN', 'DIRECTOR', 'SECRETARY']::public.user_role[]))
  with check (private.has_institution_role(institution_id, array['ADMIN', 'DIRECTOR', 'SECRETARY']::public.user_role[]));

drop policy if exists student_documents_staff_access on public.student_documents;
create policy student_documents_staff_access
  on public.student_documents for all to authenticated
  using (private.has_institution_role(institution_id, array['ADMIN', 'DIRECTOR', 'SECRETARY']::public.user_role[]))
  with check (private.has_institution_role(institution_id, array['ADMIN', 'DIRECTOR', 'SECRETARY']::public.user_role[]));

create or replace function public.create_full_student_enrollment_bundle(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_institution_id uuid := (p_payload->>'institution_id')::uuid;
  v_student_id uuid := (p_payload->>'student_id')::uuid;
  v_academic_year_id uuid := (p_payload->>'academic_year_id')::uuid;
  v_class_id uuid := (p_payload->>'class_id')::uuid;
  v_enrollment_id uuid;
  v_guardian jsonb;
  v_guardian_id uuid;
  v_guardianship_id uuid;
  v_guardian_ids jsonb := '[]'::jsonb;
  v_primary_set boolean := false;
  v_document jsonb;
  v_student_institution uuid;
  v_class_institution uuid;
  v_class_year uuid;
  v_capacity integer;
  v_active_count integer;
begin
  if auth.uid() is null then
    raise exception using errcode = 'P0001', message = 'Sessao invalida.';
  end if;

  if not private.has_institution_role(v_institution_id, array['ADMIN', 'DIRECTOR', 'SECRETARY']::public.user_role[]) then
    raise exception using errcode = 'P0001', message = 'Seu papel atual nao permite concluir matriculas.';
  end if;

  select institution_id into v_student_institution
    from public.students where id = v_student_id and active is true;
  if v_student_institution is null or v_student_institution <> v_institution_id then
    raise exception using errcode = 'P0001', message = 'Aluno nao pertence a instituicao ativa.';
  end if;

  select institution_id, academic_year_id, capacity
    into v_class_institution, v_class_year, v_capacity
    from public.classes
    where id = v_class_id and active is true;
  if v_class_institution is null or v_class_institution <> v_institution_id or v_class_year <> v_academic_year_id then
    raise exception using errcode = 'P0001', message = 'Turma invalida para o ano letivo selecionado.';
  end if;

  if not exists (
    select 1 from public.academic_years
    where id = v_academic_year_id and institution_id = v_institution_id and active is true
  ) then
    raise exception using errcode = 'P0001', message = 'Ano letivo invalido para a instituicao ativa.';
  end if;

  select count(*) into v_active_count
    from public.enrollments
    where class_id = v_class_id and active is true;
  if v_capacity is not null and v_capacity > 0 and v_active_count >= v_capacity then
    raise exception using errcode = 'P0001', message = 'A turma selecionada atingiu a capacidade.';
  end if;

  if exists (
    select 1 from public.enrollments
    where student_id = v_student_id and academic_year_id = v_academic_year_id and active is true
  ) then
    raise exception using errcode = 'P0001', message = 'O aluno ja possui matricula ativa neste ano letivo.';
  end if;

  insert into public.student_registration_details (
    student_id, institution_id, social_name, rg, rg_issuing_authority,
    rg_state, birth_certificate, nationality, birthplace, birth_state,
    sex, updated_at
  ) values (
    v_student_id, v_institution_id, nullif(p_payload->'identity'->>'social_name', ''),
    nullif(p_payload->'identity'->>'rg', ''), nullif(p_payload->'identity'->>'rg_issuing_authority', ''),
    nullif(p_payload->'identity'->>'rg_state', ''), nullif(p_payload->'identity'->>'birth_certificate', ''),
    nullif(p_payload->'identity'->>'nationality', ''), nullif(p_payload->'identity'->>'birthplace', ''),
    nullif(p_payload->'identity'->>'birth_state', ''), nullif(p_payload->'identity'->>'sex', ''), now()
  )
  on conflict (student_id) do update set
    institution_id = excluded.institution_id,
    social_name = excluded.social_name,
    rg = excluded.rg,
    rg_issuing_authority = excluded.rg_issuing_authority,
    rg_state = excluded.rg_state,
    birth_certificate = excluded.birth_certificate,
    nationality = excluded.nationality,
    birthplace = excluded.birthplace,
    birth_state = excluded.birth_state,
    sex = excluded.sex,
    updated_at = now();

  insert into public.student_addresses (
    student_id, institution_id, postal_code, street, number, complement,
    neighborhood, city, state, rural_zone, updated_at
  ) values (
    v_student_id, v_institution_id, nullif(p_payload->'address'->>'postal_code', ''),
    nullif(p_payload->'address'->>'street', ''), nullif(p_payload->'address'->>'number', ''),
    nullif(p_payload->'address'->>'complement', ''), nullif(p_payload->'address'->>'neighborhood', ''),
    nullif(p_payload->'address'->>'city', ''), nullif(p_payload->'address'->>'state', ''),
    coalesce((p_payload->'address'->>'rural_zone')::boolean, false), now()
  )
  on conflict (student_id) do update set
    institution_id = excluded.institution_id,
    postal_code = excluded.postal_code,
    street = excluded.street,
    number = excluded.number,
    complement = excluded.complement,
    neighborhood = excluded.neighborhood,
    city = excluded.city,
    state = excluded.state,
    rural_zone = excluded.rural_zone,
    updated_at = now();

  insert into public.student_previous_schooling (
    student_id, institution_id, origin_school, origin_network, city, state,
    last_grade, origin_year, status, observations, history_delivered,
    transfer_declaration, updated_at
  ) values (
    v_student_id, v_institution_id, nullif(p_payload->'previous_schooling'->>'origin_school', ''),
    nullif(p_payload->'previous_schooling'->>'origin_network', ''), nullif(p_payload->'previous_schooling'->>'city', ''),
    nullif(p_payload->'previous_schooling'->>'state', ''), nullif(p_payload->'previous_schooling'->>'last_grade', ''),
    nullif(p_payload->'previous_schooling'->>'origin_year', '')::integer,
    nullif(p_payload->'previous_schooling'->>'status', ''), nullif(p_payload->'previous_schooling'->>'observations', ''),
    coalesce((p_payload->'previous_schooling'->>'history_delivered')::boolean, false),
    coalesce((p_payload->'previous_schooling'->>'transfer_declaration')::boolean, false), now()
  )
  on conflict (student_id) do update set
    institution_id = excluded.institution_id,
    origin_school = excluded.origin_school,
    origin_network = excluded.origin_network,
    city = excluded.city,
    state = excluded.state,
    last_grade = excluded.last_grade,
    origin_year = excluded.origin_year,
    status = excluded.status,
    observations = excluded.observations,
    history_delivered = excluded.history_delivered,
    transfer_declaration = excluded.transfer_declaration,
    updated_at = now();

  insert into public.student_health_information (
    student_id, institution_id, allergies, health_conditions,
    emergency_medication, disability, autism, giftedness,
    needs_special_education, school_care_notes, updated_at
  ) values (
    v_student_id, v_institution_id, nullif(p_payload->'health'->>'allergies', ''),
    nullif(p_payload->'health'->>'health_conditions', ''), nullif(p_payload->'health'->>'emergency_medication', ''),
    nullif(p_payload->'health'->>'disability', ''), coalesce((p_payload->'health'->>'autism')::boolean, false),
    coalesce((p_payload->'health'->>'giftedness')::boolean, false),
    coalesce((p_payload->'health'->>'needs_special_education')::boolean, false),
    nullif(p_payload->'health'->>'school_care_notes', ''), now()
  )
  on conflict (student_id) do update set
    institution_id = excluded.institution_id,
    allergies = excluded.allergies,
    health_conditions = excluded.health_conditions,
    emergency_medication = excluded.emergency_medication,
    disability = excluded.disability,
    autism = excluded.autism,
    giftedness = excluded.giftedness,
    needs_special_education = excluded.needs_special_education,
    school_care_notes = excluded.school_care_notes,
    updated_at = now();

  for v_document in select * from jsonb_array_elements(coalesce(p_payload->'documents', '[]'::jsonb)) loop
    insert into public.student_documents (
      student_id, institution_id, document_type, status, file_path, notes, updated_at
    ) values (
      v_student_id, v_institution_id, v_document->>'document_type',
      coalesce(v_document->>'status', 'PENDING'), nullif(v_document->>'file_path', ''),
      nullif(v_document->>'notes', ''), now()
    )
    on conflict (student_id, document_type) do update set
      institution_id = excluded.institution_id,
      status = excluded.status,
      file_path = excluded.file_path,
      notes = excluded.notes,
      updated_at = now();
  end loop;

  if jsonb_array_length(coalesce(p_payload->'guardians', '[]'::jsonb)) = 0 then
    raise exception using errcode = 'P0001', message = 'Associe pelo menos um responsavel ao aluno.';
  end if;

  for v_guardian in select * from jsonb_array_elements(p_payload->'guardians') loop
    v_guardian_id := (v_guardian->>'guardian_profile_id')::uuid;
    if not exists (
      select 1 from public.memberships
      where profile_id = v_guardian_id and institution_id = v_institution_id
        and role = 'GUARDIAN'::public.user_role and active is true
    ) then
      raise exception using errcode = 'P0001', message = 'Responsavel invalido para esta instituicao.';
    end if;
    if coalesce((v_guardian->>'is_primary')::boolean, false) then
      update public.guardianships set is_primary = false
        where student_id = v_student_id and active is true;
      v_primary_set := true;
    end if;
    select id into v_guardianship_id
      from public.guardianships
      where guardian_profile_id = v_guardian_id and student_id = v_student_id
      order by created_at desc limit 1;
    if v_guardianship_id is null then
      insert into public.guardianships (
        guardian_profile_id, student_id, relationship, is_primary, active
      ) values (
        v_guardian_id, v_student_id, v_guardian->>'relationship',
        coalesce((v_guardian->>'is_primary')::boolean, false), true
      ) returning id into v_guardianship_id;
    else
      update public.guardianships set
        relationship = v_guardian->>'relationship',
        is_primary = coalesce((v_guardian->>'is_primary')::boolean, false),
        active = true,
        updated_at = now()
        where id = v_guardianship_id;
    end if;
    v_guardian_ids := v_guardian_ids || jsonb_build_array(v_guardian_id);
  end loop;

  if not v_primary_set then
    update public.guardianships set is_primary = true
      where id = (select id from public.guardianships where student_id = v_student_id and active is true order by created_at limit 1);
  end if;

  insert into public.enrollments (
    student_id, class_id, academic_year_id, status, enrolled_at, active
  ) values (
    v_student_id, v_class_id, v_academic_year_id, 'ACTIVE',
    coalesce(nullif(p_payload->>'enrolled_at', '')::timestamptz, now()), true
  ) returning id into v_enrollment_id;

  return jsonb_build_object(
    'student_id', v_student_id,
    'enrollment_id', v_enrollment_id,
    'guardian_profile_ids', v_guardian_ids,
    'documents_pending', (
      select count(*) from public.student_documents
      where student_id = v_student_id and status = 'PENDING'
    )
  );
exception
  when unique_violation then
    raise exception using errcode = 'P0001', message = 'Ja existe um registro equivalente para este aluno.';
  when others then
    raise exception using errcode = 'P0001', message = 'Nao foi possivel concluir o pacote de matricula.';
end;
$$;

revoke all on function public.create_full_student_enrollment_bundle(jsonb) from public;
grant execute on function public.create_full_student_enrollment_bundle(jsonb) to authenticated;

commit;
