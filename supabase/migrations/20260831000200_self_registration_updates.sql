begin;

create or replace function public.get_current_self_registration()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles%rowtype;
  v_student public.students%rowtype;
  v_details public.student_registration_details%rowtype;
  v_address public.student_addresses%rowtype;
  v_previous public.student_previous_schooling%rowtype;
  v_health public.student_health_information%rowtype;
begin
  if auth.uid() is null then
    raise exception using errcode = 'P0001', message = 'Sessao invalida.';
  end if;

  select * into v_profile
    from public.profiles
    where id = auth.uid() and active is true;

  if not found then
    raise exception using errcode = 'P0001', message = 'Perfil ativo nao encontrado.';
  end if;

  if v_profile.role = 'GUARDIAN' then
    return jsonb_build_object(
      'role', 'GUARDIAN',
      'profile', jsonb_build_object(
        'full_name', v_profile.full_name,
        'email', v_profile.email,
        'phone', v_profile.phone
      )
    );
  end if;

  if v_profile.role <> 'STUDENT' then
    raise exception using errcode = 'P0001', message = 'Este perfil nao permite edicao neste fluxo.';
  end if;

  select * into v_student
    from public.students
    where profile_id = auth.uid() and active is true
    order by created_at
    limit 1;

  if not found then
    raise exception using errcode = 'P0001', message = 'Registro academico do aluno nao encontrado.';
  end if;

  select * into v_details from public.student_registration_details where student_id = v_student.id;
  select * into v_address from public.student_addresses where student_id = v_student.id;
  select * into v_previous from public.student_previous_schooling where student_id = v_student.id;
  select * into v_health from public.student_health_information where student_id = v_student.id;

  return jsonb_build_object(
    'role', 'STUDENT',
    'profile', jsonb_build_object(
      'full_name', v_profile.full_name,
      'email', v_profile.email,
      'phone', v_profile.phone
    ),
    'student', jsonb_build_object(
      'birth_date', v_student.birth_date,
      'cpf', v_student.cpf,
      'social_name', v_details.social_name,
      'rg', v_details.rg,
      'rg_issuing_authority', v_details.rg_issuing_authority,
      'rg_state', v_details.rg_state,
      'birth_certificate', v_details.birth_certificate,
      'nationality', v_details.nationality,
      'birthplace', v_details.birthplace,
      'birth_state', v_details.birth_state,
      'sex', v_details.sex,
      'address', jsonb_build_object(
        'postal_code', v_address.postal_code,
        'street', v_address.street,
        'number', v_address.number,
        'complement', v_address.complement,
        'neighborhood', v_address.neighborhood,
        'city', v_address.city,
        'state', v_address.state,
        'rural_zone', coalesce(v_address.rural_zone, false)
      ),
      'previous_schooling', jsonb_build_object(
        'origin_school', v_previous.origin_school,
        'origin_network', v_previous.origin_network,
        'city', v_previous.city,
        'state', v_previous.state,
        'last_grade', v_previous.last_grade,
        'origin_year', v_previous.origin_year,
        'status', v_previous.status,
        'observations', v_previous.observations,
        'history_delivered', coalesce(v_previous.history_delivered, false),
        'transfer_declaration', coalesce(v_previous.transfer_declaration, false)
      ),
      'health', jsonb_build_object(
        'allergies', v_health.allergies,
        'health_conditions', v_health.health_conditions,
        'emergency_medication', v_health.emergency_medication,
        'disability', v_health.disability,
        'autism', coalesce(v_health.autism, false),
        'giftedness', coalesce(v_health.giftedness, false),
        'needs_special_education', coalesce(v_health.needs_special_education, false)
      )
    )
  );
end;
$$;

create or replace function public.update_current_self_registration(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles%rowtype;
  v_student public.students%rowtype;
  v_role text := upper(coalesce(p_payload->>'role', ''));
  v_profile_payload jsonb := coalesce(p_payload->'profile', '{}'::jsonb);
  v_student_payload jsonb := coalesce(p_payload->'student', '{}'::jsonb);
  v_address jsonb := coalesce(v_student_payload->'address', '{}'::jsonb);
  v_previous jsonb := coalesce(v_student_payload->'previous_schooling', '{}'::jsonb);
  v_health jsonb := coalesce(v_student_payload->'health', '{}'::jsonb);
  v_full_name text := nullif(btrim(v_profile_payload->>'full_name'), '');
  v_phone text := nullif(btrim(v_profile_payload->>'phone'), '');
  v_origin_year text := nullif(btrim(v_previous->>'origin_year'), '');
begin
  if auth.uid() is null then
    raise exception using errcode = 'P0001', message = 'Sessao invalida.';
  end if;

  if v_full_name is null or char_length(v_full_name) < 2 or char_length(v_full_name) > 120 then
    raise exception using errcode = 'P0001', message = 'Informe um nome valido.';
  end if;

  if v_phone is not null and char_length(v_phone) > 40 then
    raise exception using errcode = 'P0001', message = 'Telefone invalido.';
  end if;

  if v_origin_year is not null and v_origin_year !~ '^[0-9]{4}$' then
    raise exception using errcode = 'P0001', message = 'Ano de origem invalido.';
  end if;

  select * into v_profile
    from public.profiles
    where id = auth.uid() and active is true;

  if not found or v_profile.role::text <> v_role then
    raise exception using errcode = 'P0001', message = 'Perfil nao autorizado para esta atualizacao.';
  end if;

  update public.profiles
    set full_name = v_full_name,
        phone = v_phone,
        updated_at = now()
    where id = auth.uid();

  if v_role = 'GUARDIAN' then
    return public.get_current_self_registration();
  end if;

  if v_role <> 'STUDENT' then
    raise exception using errcode = 'P0001', message = 'Este perfil nao permite edicao neste fluxo.';
  end if;

  select * into v_student
    from public.students
    where profile_id = auth.uid() and active is true
    order by created_at
    limit 1;

  if not found then
    raise exception using errcode = 'P0001', message = 'Registro academico do aluno nao encontrado.';
  end if;

  update public.students
    set birth_date = nullif(v_student_payload->>'birth_date', '')::date,
        cpf = nullif(btrim(v_student_payload->>'cpf'), ''),
        updated_at = now()
    where id = v_student.id;

  insert into public.student_registration_details (
    student_id, institution_id, social_name, rg, rg_issuing_authority,
    rg_state, birth_certificate, nationality, birthplace, birth_state,
    sex, updated_at
  ) values (
    v_student.id, v_student.institution_id,
    nullif(btrim(v_student_payload->>'social_name'), ''),
    nullif(btrim(v_student_payload->>'rg'), ''),
    nullif(btrim(v_student_payload->>'rg_issuing_authority'), ''),
    nullif(btrim(v_student_payload->>'rg_state'), ''),
    nullif(btrim(v_student_payload->>'birth_certificate'), ''),
    nullif(btrim(v_student_payload->>'nationality'), ''),
    nullif(btrim(v_student_payload->>'birthplace'), ''),
    nullif(btrim(v_student_payload->>'birth_state'), ''),
    nullif(btrim(v_student_payload->>'sex'), ''), now()
  )
  on conflict (student_id) do update set
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
    v_student.id, v_student.institution_id,
    nullif(btrim(v_address->>'postal_code'), ''),
    nullif(btrim(v_address->>'street'), ''),
    nullif(btrim(v_address->>'number'), ''),
    nullif(btrim(v_address->>'complement'), ''),
    nullif(btrim(v_address->>'neighborhood'), ''),
    nullif(btrim(v_address->>'city'), ''),
    nullif(btrim(v_address->>'state'), ''),
    coalesce((v_address->>'rural_zone') = 'true', false), now()
  )
  on conflict (student_id) do update set
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
    v_student.id, v_student.institution_id,
    nullif(btrim(v_previous->>'origin_school'), ''),
    nullif(btrim(v_previous->>'origin_network'), ''),
    nullif(btrim(v_previous->>'city'), ''),
    nullif(btrim(v_previous->>'state'), ''),
    nullif(btrim(v_previous->>'last_grade'), ''),
    v_origin_year::integer,
    nullif(btrim(v_previous->>'status'), ''),
    nullif(btrim(v_previous->>'observations'), ''),
    coalesce((v_previous->>'history_delivered') = 'true', false),
    coalesce((v_previous->>'transfer_declaration') = 'true', false), now()
  )
  on conflict (student_id) do update set
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
    needs_special_education, updated_at
  ) values (
    v_student.id, v_student.institution_id,
    nullif(btrim(v_health->>'allergies'), ''),
    nullif(btrim(v_health->>'health_conditions'), ''),
    nullif(btrim(v_health->>'emergency_medication'), ''),
    nullif(btrim(v_health->>'disability'), ''),
    coalesce((v_health->>'autism') = 'true', false),
    coalesce((v_health->>'giftedness') = 'true', false),
    coalesce((v_health->>'needs_special_education') = 'true', false), now()
  )
  on conflict (student_id) do update set
    allergies = excluded.allergies,
    health_conditions = excluded.health_conditions,
    emergency_medication = excluded.emergency_medication,
    disability = excluded.disability,
    autism = excluded.autism,
    giftedness = excluded.giftedness,
    needs_special_education = excluded.needs_special_education,
    updated_at = now();

  return public.get_current_self_registration();
end;
$$;

revoke all on function public.get_current_self_registration() from public;
grant execute on function public.get_current_self_registration() to authenticated;
revoke all on function public.update_current_self_registration(jsonb) from public;
grant execute on function public.update_current_self_registration(jsonb) to authenticated;

commit;
