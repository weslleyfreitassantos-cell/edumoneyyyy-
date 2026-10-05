begin;

alter table public.students
  add column if not exists self_registration_confirmed_at timestamptz;

create or replace function private.normalize_self_registration_text(
  p_value text,
  p_max_length integer default 500
)
returns text
language sql
immutable
set search_path = ''
as $$
  select left(
    regexp_replace(
      regexp_replace(btrim(coalesce(p_value, '')), '[[:cntrl:]]', '', 'g'),
      '[[:space:]]+',
      ' ',
      'g'
    ),
    greatest(p_max_length, 0)
  );
$$;

create or replace function private.normalize_self_registration_digits(
  p_value text
)
returns text
language sql
immutable
set search_path = ''
as $$
  select regexp_replace(coalesce(p_value, ''), '[^0-9]', '', 'g');
$$;

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
      'self_registration_confirmed', false,
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
    'self_registration_confirmed', v_student.self_registration_confirmed_at is not null,
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
  v_details public.student_registration_details%rowtype;
  v_address public.student_addresses%rowtype;
  v_previous public.student_previous_schooling%rowtype;
  v_health public.student_health_information%rowtype;
  v_role text := upper(coalesce(p_payload->>'role', ''));
  v_profile_payload jsonb := coalesce(p_payload->'profile', '{}'::jsonb);
  v_student_payload jsonb := coalesce(p_payload->'student', '{}'::jsonb);
  v_address_payload jsonb := coalesce(p_payload->'student'->'address', '{}'::jsonb);
  v_previous_payload jsonb := coalesce(p_payload->'student'->'previous_schooling', '{}'::jsonb);
  v_health_payload jsonb := coalesce(p_payload->'student'->'health', '{}'::jsonb);
  v_confirm boolean := (p_payload->>'confirm_protected_data') = 'true';
  v_full_name text;
  v_phone text;
  v_birth_date_text text;
  v_birth_date date;
  v_cpf text;
  v_birth_state text;
  v_rg_state text;
  v_postal_code text;
  v_address_state text;
  v_origin_state text;
  v_origin_year_text text;
  v_origin_year integer;
  v_rural_zone boolean;
  v_history_delivered boolean;
  v_transfer_declaration boolean;
  v_autism boolean;
  v_giftedness boolean;
  v_needs_special_education boolean;
  v_cpf_first integer := 0;
  v_cpf_second integer := 0;
  v_cpf_digit integer;
  i integer;
  v_requested_protected jsonb;
  v_current_protected jsonb;
begin
  if auth.uid() is null then
    raise exception using errcode = 'P0001', message = 'Sessao invalida.';
  end if;

  select * into v_profile
    from public.profiles
    where id = auth.uid() and active is true;

  if not found or v_profile.role::text <> v_role then
    raise exception using errcode = 'P0001', message = 'Perfil nao autorizado para esta atualizacao.';
  end if;

  v_full_name := nullif(private.normalize_self_registration_text(v_profile_payload->>'full_name', 120), '');
  v_phone := nullif(private.normalize_self_registration_digits(v_profile_payload->>'phone'), '');

  if v_full_name is null or char_length(v_full_name) < 2 then
    raise exception using errcode = 'P0001', message = 'Informe um nome valido.';
  end if;
  if v_phone is not null and v_phone !~ '^\d{10,11}$' then
    raise exception using errcode = 'P0001', message = 'Telefone invalido.';
  end if;

  if v_role = 'GUARDIAN' then
    update public.profiles
      set full_name = v_full_name, phone = v_phone, updated_at = now()
      where id = auth.uid();
    return public.get_current_self_registration();
  end if;

  if v_role <> 'STUDENT' then
    raise exception using errcode = 'P0001', message = 'Este perfil nao permite edicao neste fluxo.';
  end if;

  select * into v_student
    from public.students
    where profile_id = auth.uid() and active is true
    order by created_at
    limit 1
    for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'Registro academico do aluno nao encontrado.';
  end if;

  select * into v_details from public.student_registration_details where student_id = v_student.id;
  select * into v_address from public.student_addresses where student_id = v_student.id;
  select * into v_previous from public.student_previous_schooling where student_id = v_student.id;
  select * into v_health from public.student_health_information where student_id = v_student.id;

  v_birth_date_text := private.normalize_self_registration_text(v_student_payload->>'birth_date', 10);
  if v_birth_date_text <> '' then
    if v_birth_date_text !~ '^\d{4}-\d{2}-\d{2}$' then
      raise exception using errcode = 'P0001', message = 'Data de nascimento invalida.';
    end if;
    v_birth_date := v_birth_date_text::date;
    if to_char(v_birth_date, 'YYYY-MM-DD') <> v_birth_date_text or v_birth_date > current_date then
      raise exception using errcode = 'P0001', message = 'Data de nascimento invalida.';
    end if;
  end if;

  v_cpf := nullif(private.normalize_self_registration_digits(v_student_payload->>'cpf'), '');
  if v_cpf is not null then
    if v_cpf !~ '^\d{11}$' or v_cpf ~ '^(\d)\1{10}$' then
      raise exception using errcode = 'P0001', message = 'CPF invalido.';
    end if;
    for i in 1..9 loop
      v_cpf_first := v_cpf_first + substring(v_cpf from i for 1)::integer * (11 - i);
    end loop;
    v_cpf_digit := mod(v_cpf_first * 10, 11);
    if v_cpf_digit = 10 then v_cpf_digit := 0; end if;
    if v_cpf_digit <> substring(v_cpf from 10 for 1)::integer then
      raise exception using errcode = 'P0001', message = 'CPF invalido.';
    end if;
    for i in 1..10 loop
      v_cpf_second := v_cpf_second + substring(v_cpf from i for 1)::integer * (12 - i);
    end loop;
    v_cpf_digit := mod(v_cpf_second * 10, 11);
    if v_cpf_digit = 10 then v_cpf_digit := 0; end if;
    if v_cpf_digit <> substring(v_cpf from 11 for 1)::integer then
      raise exception using errcode = 'P0001', message = 'CPF invalido.';
    end if;
  end if;

  v_birth_state := upper(private.normalize_self_registration_text(v_student_payload->>'birth_state', 2));
  v_rg_state := upper(private.normalize_self_registration_text(v_student_payload->>'rg_state', 2));
  v_postal_code := nullif(private.normalize_self_registration_digits(v_address_payload->>'postal_code'), '');
  v_address_state := upper(private.normalize_self_registration_text(v_address_payload->>'state', 2));
  v_origin_state := upper(private.normalize_self_registration_text(v_previous_payload->>'state', 2));
  v_origin_year_text := private.normalize_self_registration_text(v_previous_payload->>'origin_year', 4);

  if v_postal_code is not null and v_postal_code !~ '^\d{8}$' then
    raise exception using errcode = 'P0001', message = 'CEP invalido.';
  end if;
  if v_origin_year_text <> '' then
    if v_origin_year_text !~ '^\d{4}$' or v_origin_year_text::integer > extract(year from current_date)::integer then
      raise exception using errcode = 'P0001', message = 'Ano de origem invalido.';
    end if;
    v_origin_year := v_origin_year_text::integer;
  end if;
  if v_birth_state <> '' and v_birth_state !~ '^[A-Z]{2}$' then
    raise exception using errcode = 'P0001', message = 'UF de nascimento invalida.';
  end if;
  if v_rg_state <> '' and v_rg_state !~ '^[A-Z]{2}$' then
    raise exception using errcode = 'P0001', message = 'UF do RG invalida.';
  end if;
  if v_address_state <> '' and v_address_state !~ '^[A-Z]{2}$' then
    raise exception using errcode = 'P0001', message = 'UF do endereco invalida.';
  end if;
  if v_origin_state <> '' and v_origin_state !~ '^[A-Z]{2}$' then
    raise exception using errcode = 'P0001', message = 'UF da escola de origem invalida.';
  end if;

  v_rural_zone := (v_address_payload->>'rural_zone') = 'true';
  v_history_delivered := (v_previous_payload->>'history_delivered') = 'true';
  v_transfer_declaration := (v_previous_payload->>'transfer_declaration') = 'true';
  v_autism := (v_health_payload->>'autism') = 'true';
  v_giftedness := (v_health_payload->>'giftedness') = 'true';
  v_needs_special_education := (v_health_payload->>'needs_special_education') = 'true';

  v_requested_protected := jsonb_build_object(
    'full_name', v_full_name,
    'birth_date', coalesce(v_birth_date_text, ''),
    'cpf', coalesce(v_cpf, ''),
    'social_name', private.normalize_self_registration_text(v_student_payload->>'social_name', 120),
    'rg', private.normalize_self_registration_text(v_student_payload->>'rg', 40),
    'rg_issuing_authority', private.normalize_self_registration_text(v_student_payload->>'rg_issuing_authority', 80),
    'rg_state', v_rg_state,
    'birth_certificate', private.normalize_self_registration_text(v_student_payload->>'birth_certificate', 80),
    'nationality', private.normalize_self_registration_text(v_student_payload->>'nationality', 80),
    'birthplace', private.normalize_self_registration_text(v_student_payload->>'birthplace', 120),
    'birth_state', v_birth_state,
    'sex', private.normalize_self_registration_text(v_student_payload->>'sex', 40),
    'address', jsonb_build_object(
      'postal_code', coalesce(v_postal_code, ''),
      'street', private.normalize_self_registration_text(v_address_payload->>'street', 160),
      'number', private.normalize_self_registration_text(v_address_payload->>'number', 30),
      'complement', private.normalize_self_registration_text(v_address_payload->>'complement', 100),
      'neighborhood', private.normalize_self_registration_text(v_address_payload->>'neighborhood', 100),
      'city', private.normalize_self_registration_text(v_address_payload->>'city', 100),
      'state', v_address_state,
      'rural_zone', v_rural_zone
    ),
    'previous_schooling', jsonb_build_object(
      'origin_school', private.normalize_self_registration_text(v_previous_payload->>'origin_school', 160),
      'origin_network', private.normalize_self_registration_text(v_previous_payload->>'origin_network', 80),
      'city', private.normalize_self_registration_text(v_previous_payload->>'city', 100),
      'state', v_origin_state,
      'last_grade', private.normalize_self_registration_text(v_previous_payload->>'last_grade', 80),
      'origin_year', coalesce(v_origin_year_text, ''),
      'status', private.normalize_self_registration_text(v_previous_payload->>'status', 80),
      'observations', private.normalize_self_registration_text(v_previous_payload->>'observations', 500),
      'history_delivered', v_history_delivered,
      'transfer_declaration', v_transfer_declaration
    ),
    'health', jsonb_build_object(
      'allergies', private.normalize_self_registration_text(v_health_payload->>'allergies', 500),
      'health_conditions', private.normalize_self_registration_text(v_health_payload->>'health_conditions', 500),
      'emergency_medication', private.normalize_self_registration_text(v_health_payload->>'emergency_medication', 500),
      'disability', private.normalize_self_registration_text(v_health_payload->>'disability', 500),
      'autism', v_autism,
      'giftedness', v_giftedness,
      'needs_special_education', v_needs_special_education
    )
  );

  v_current_protected := jsonb_build_object(
    'full_name', private.normalize_self_registration_text(v_profile.full_name, 120),
    'birth_date', coalesce(v_student.birth_date::text, ''),
    'cpf', coalesce(private.normalize_self_registration_digits(v_student.cpf), ''),
    'social_name', private.normalize_self_registration_text(v_details.social_name, 120),
    'rg', private.normalize_self_registration_text(v_details.rg, 40),
    'rg_issuing_authority', private.normalize_self_registration_text(v_details.rg_issuing_authority, 80),
    'rg_state', upper(private.normalize_self_registration_text(v_details.rg_state, 2)),
    'birth_certificate', private.normalize_self_registration_text(v_details.birth_certificate, 80),
    'nationality', private.normalize_self_registration_text(v_details.nationality, 80),
    'birthplace', private.normalize_self_registration_text(v_details.birthplace, 120),
    'birth_state', upper(private.normalize_self_registration_text(v_details.birth_state, 2)),
    'sex', private.normalize_self_registration_text(v_details.sex, 40),
    'address', jsonb_build_object(
      'postal_code', coalesce(private.normalize_self_registration_digits(v_address.postal_code), ''),
      'street', private.normalize_self_registration_text(v_address.street, 160),
      'number', private.normalize_self_registration_text(v_address.number, 30),
      'complement', private.normalize_self_registration_text(v_address.complement, 100),
      'neighborhood', private.normalize_self_registration_text(v_address.neighborhood, 100),
      'city', private.normalize_self_registration_text(v_address.city, 100),
      'state', upper(private.normalize_self_registration_text(v_address.state, 2)),
      'rural_zone', coalesce(v_address.rural_zone, false)
    ),
    'previous_schooling', jsonb_build_object(
      'origin_school', private.normalize_self_registration_text(v_previous.origin_school, 160),
      'origin_network', private.normalize_self_registration_text(v_previous.origin_network, 80),
      'city', private.normalize_self_registration_text(v_previous.city, 100),
      'state', upper(private.normalize_self_registration_text(v_previous.state, 2)),
      'last_grade', private.normalize_self_registration_text(v_previous.last_grade, 80),
      'origin_year', coalesce(v_previous.origin_year::text, ''),
      'status', private.normalize_self_registration_text(v_previous.status, 80),
      'observations', private.normalize_self_registration_text(v_previous.observations, 500),
      'history_delivered', coalesce(v_previous.history_delivered, false),
      'transfer_declaration', coalesce(v_previous.transfer_declaration, false)
    ),
    'health', jsonb_build_object(
      'allergies', private.normalize_self_registration_text(v_health.allergies, 500),
      'health_conditions', private.normalize_self_registration_text(v_health.health_conditions, 500),
      'emergency_medication', private.normalize_self_registration_text(v_health.emergency_medication, 500),
      'disability', private.normalize_self_registration_text(v_health.disability, 500),
      'autism', coalesce(v_health.autism, false),
      'giftedness', coalesce(v_health.giftedness, false),
      'needs_special_education', coalesce(v_health.needs_special_education, false)
    )
  );

  if v_student.self_registration_confirmed_at is not null
    and v_current_protected is distinct from v_requested_protected then
    raise exception using
      errcode = 'P0001',
      message = 'Seus dados cadastrais ja foram confirmados. Para solicitar uma correcao, procure a secretaria ou direcao da escola.';
  end if;

  if v_confirm then
    if v_birth_date is null
      or v_cpf is null
      or private.normalize_self_registration_text(v_student_payload->>'sex', 40) = ''
      or private.normalize_self_registration_text(v_student_payload->>'nationality', 80) = ''
      or private.normalize_self_registration_text(v_student_payload->>'birthplace', 120) = ''
      or v_birth_state = ''
      or v_phone is null
      or v_postal_code is null
      or private.normalize_self_registration_text(v_address_payload->>'street', 160) = ''
      or private.normalize_self_registration_text(v_address_payload->>'number', 30) = ''
      or private.normalize_self_registration_text(v_address_payload->>'neighborhood', 100) = ''
      or private.normalize_self_registration_text(v_address_payload->>'city', 100) = ''
      or v_address_state = '' then
      raise exception using errcode = 'P0001', message = 'Complete os dados cadastrais obrigatorios antes de confirmar.';
    end if;
  end if;

  update public.profiles
    set full_name = v_full_name, phone = v_phone, updated_at = now()
    where id = auth.uid();

  update public.students
    set birth_date = v_birth_date,
        cpf = v_cpf,
        self_registration_confirmed_at = case
          when v_confirm then coalesce(self_registration_confirmed_at, now())
          else self_registration_confirmed_at
        end,
        updated_at = now()
    where id = v_student.id;

  insert into public.student_registration_details (
    student_id, institution_id, social_name, rg, rg_issuing_authority,
    rg_state, birth_certificate, nationality, birthplace, birth_state,
    sex, updated_at
  ) values (
    v_student.id, v_student.institution_id,
    nullif(private.normalize_self_registration_text(v_student_payload->>'social_name', 120), ''),
    nullif(private.normalize_self_registration_text(v_student_payload->>'rg', 40), ''),
    nullif(private.normalize_self_registration_text(v_student_payload->>'rg_issuing_authority', 80), ''),
    nullif(v_rg_state, ''),
    nullif(private.normalize_self_registration_text(v_student_payload->>'birth_certificate', 80), ''),
    nullif(private.normalize_self_registration_text(v_student_payload->>'nationality', 80), ''),
    nullif(private.normalize_self_registration_text(v_student_payload->>'birthplace', 120), ''),
    nullif(v_birth_state, ''),
    nullif(private.normalize_self_registration_text(v_student_payload->>'sex', 40), ''), now()
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
    v_postal_code,
    nullif(private.normalize_self_registration_text(v_address_payload->>'street', 160), ''),
    nullif(private.normalize_self_registration_text(v_address_payload->>'number', 30), ''),
    nullif(private.normalize_self_registration_text(v_address_payload->>'complement', 100), ''),
    nullif(private.normalize_self_registration_text(v_address_payload->>'neighborhood', 100), ''),
    nullif(private.normalize_self_registration_text(v_address_payload->>'city', 100), ''),
    nullif(v_address_state, ''),
    v_rural_zone, now()
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
    nullif(private.normalize_self_registration_text(v_previous_payload->>'origin_school', 160), ''),
    nullif(private.normalize_self_registration_text(v_previous_payload->>'origin_network', 80), ''),
    nullif(private.normalize_self_registration_text(v_previous_payload->>'city', 100), ''),
    nullif(v_origin_state, ''),
    nullif(private.normalize_self_registration_text(v_previous_payload->>'last_grade', 80), ''),
    v_origin_year,
    nullif(private.normalize_self_registration_text(v_previous_payload->>'status', 80), ''),
    nullif(private.normalize_self_registration_text(v_previous_payload->>'observations', 500), ''),
    v_history_delivered, v_transfer_declaration, now()
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
    nullif(private.normalize_self_registration_text(v_health_payload->>'allergies', 500), ''),
    nullif(private.normalize_self_registration_text(v_health_payload->>'health_conditions', 500), ''),
    nullif(private.normalize_self_registration_text(v_health_payload->>'emergency_medication', 500), ''),
    nullif(private.normalize_self_registration_text(v_health_payload->>'disability', 500), ''),
    v_autism, v_giftedness, v_needs_special_education, now()
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
