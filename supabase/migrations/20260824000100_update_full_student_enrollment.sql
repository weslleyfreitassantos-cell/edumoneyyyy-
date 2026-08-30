begin;

create or replace function public.update_full_student_enrollment_bundle(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_institution_id uuid := (p_payload->>'institution_id')::uuid;
  v_student_id uuid := (p_payload->>'student_id')::uuid;
  v_enrollment_id uuid := nullif(p_payload->>'enrollment_id', '')::uuid;
  v_student_institution uuid;
  v_student_profile_id uuid;
  v_guardian jsonb;
  v_guardian_id uuid;
  v_guardianship_id uuid;
  v_guardian_ids jsonb := '[]'::jsonb;
  v_primary_set boolean := false;
  v_document jsonb;
  v_class_institution uuid;
  v_class_year uuid;
  v_capacity integer;
  v_active_count integer;
  v_current_enrollment_student uuid;
  v_current_enrollment_active boolean;
begin
  if auth.uid() is null then
    raise exception using errcode = 'P0001', message = 'Sessao invalida.';
  end if;

  if not private.has_institution_role(v_institution_id, array['ADMIN', 'DIRECTOR', 'SECRETARY']::public.user_role[]) then
    raise exception using errcode = 'P0001', message = 'Seu papel atual nao permite editar alunos.';
  end if;

  select institution_id, profile_id
    into v_student_institution, v_student_profile_id
    from public.students
    where id = v_student_id;

  if v_student_institution is null or v_student_institution <> v_institution_id then
    raise exception using errcode = 'P0001', message = 'Aluno nao pertence a instituicao ativa.';
  end if;

  update public.students
    set birth_date = nullif(p_payload->'identity'->>'birth_date', ''),
        cpf = nullif(p_payload->'identity'->>'cpf', ''),
        updated_at = now()
    where id = v_student_id and institution_id = v_institution_id;

  update public.profiles
    set phone = nullif(p_payload->'identity'->>'phone', ''),
        updated_at = now()
    where id = v_student_profile_id;

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
      file_path = coalesce(excluded.file_path, student_documents.file_path),
      notes = excluded.notes,
      updated_at = now();
  end loop;

  update public.guardianships
    set active = false, is_primary = false, updated_at = now()
    where student_id = v_student_id and active is true;

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
      where id = (
        select id from public.guardianships
        where student_id = v_student_id and active is true
        order by created_at limit 1
      );
  end if;

  if v_enrollment_id is not null then
    select student_id, active
      into v_current_enrollment_student, v_current_enrollment_active
      from public.enrollments
      where id = v_enrollment_id;
    if v_current_enrollment_student is null or v_current_enrollment_student <> v_student_id then
      raise exception using errcode = 'P0001', message = 'Matricula invalida para o aluno selecionado.';
    end if;
    if v_current_enrollment_active is not true then
      raise exception using errcode = 'P0001', message = 'Somente matriculas ativas podem ser editadas.';
    end if;

    select institution_id, academic_year_id, capacity
      into v_class_institution, v_class_year, v_capacity
      from public.classes
      where id = (p_payload->>'class_id')::uuid and active is true;
    if v_class_institution is null or v_class_institution <> v_institution_id or v_class_year <> (p_payload->>'academic_year_id')::uuid then
      raise exception using errcode = 'P0001', message = 'Turma invalida para o ano letivo selecionado.';
    end if;
    if not exists (
      select 1 from public.academic_years
      where id = (p_payload->>'academic_year_id')::uuid
        and institution_id = v_institution_id and active is true
    ) then
      raise exception using errcode = 'P0001', message = 'Ano letivo invalido para a instituicao ativa.';
    end if;
    if exists (
      select 1 from public.enrollments
      where student_id = v_student_id
        and academic_year_id = (p_payload->>'academic_year_id')::uuid
        and active is true and id <> v_enrollment_id
    ) then
      raise exception using errcode = 'P0001', message = 'O aluno ja possui matricula ativa neste ano letivo.';
    end if;
    select count(*) into v_active_count
      from public.enrollments
      where class_id = (p_payload->>'class_id')::uuid
        and active is true and id <> v_enrollment_id;
    if v_capacity is not null and v_capacity > 0 and v_active_count >= v_capacity then
      raise exception using errcode = 'P0001', message = 'A turma selecionada atingiu a capacidade.';
    end if;
    update public.enrollments set
      class_id = (p_payload->>'class_id')::uuid,
      academic_year_id = (p_payload->>'academic_year_id')::uuid,
      enrolled_at = coalesce(nullif(p_payload->>'enrolled_at', '')::timestamptz, enrolled_at),
      updated_at = now()
      where id = v_enrollment_id;
  end if;

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
    raise exception using errcode = 'P0001', message = 'Nao foi possivel atualizar o cadastro completo do aluno.';
end;
$$;

revoke all on function public.update_full_student_enrollment_bundle(jsonb) from public;
grant execute on function public.update_full_student_enrollment_bundle(jsonb) to authenticated;

commit;
