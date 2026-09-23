-- Aurora Integral synthetic full-time high-school demo fixture.
-- Target: self-hosted EduManager VPS only.
-- Idempotency key: deterministic IDs derived from AURORA_INTEGRAL_2026_V1.
-- This fixture deliberately avoids migrations, external email/SMS/payment calls,
-- and all Supabase Cloud endpoints.

begin;

set local statement_timeout = '20min';
set local lock_timeout = '30s';

create temp table aurora_seed_users (
  user_key text primary key,
  profile_id uuid not null,
  full_name text not null,
  email text not null unique,
  role public.user_role not null,
  active_login boolean not null default false
) on commit drop;

create temp table aurora_subject_seed (
  code text primary key,
  name text not null,
  weekly_lessons smallint not null,
  teacher_number integer not null,
  sort_order integer not null
) on commit drop;

create temp table aurora_term_seed (
  term_no integer primary key,
  term_id uuid not null unique,
  start_date date not null,
  end_date date not null
) on commit drop;

insert into aurora_term_seed (term_no, term_id, start_date, end_date) values
  (1, md5('AURORA_INTEGRAL_2026_V1:term:1')::uuid, date '2026-02-02', date '2026-04-17'),
  (2, md5('AURORA_INTEGRAL_2026_V1:term:2')::uuid, date '2026-04-20', date '2026-06-30'),
  (3, md5('AURORA_INTEGRAL_2026_V1:term:3')::uuid, date '2026-08-03', date '2026-09-30'),
  (4, md5('AURORA_INTEGRAL_2026_V1:term:4')::uuid, date '2026-10-01', date '2026-12-18');

create temp table aurora_class_seed (
  class_key text primary key,
  class_id uuid not null unique,
  name text not null,
  grade_level text not null,
  class_number integer not null
) on commit drop;

create temp table aurora_student_seed (
  student_number integer primary key,
  student_id uuid not null unique,
  profile_id uuid not null unique,
  class_key text not null,
  guardian_number integer not null,
  full_name text not null,
  email text not null unique,
  registration_number text not null unique,
  birth_date date not null,
  active_login boolean not null
) on commit drop;

create temp table aurora_schedule_plan (
  term_id uuid not null,
  class_id uuid not null,
  subject_offering_id uuid not null,
  teacher_profile_id uuid not null,
  room_id uuid not null,
  day_of_week smallint not null,
  start_time time not null,
  end_time time not null,
  primary key (term_id, subject_offering_id, day_of_week, start_time)
) on commit drop;

insert into aurora_seed_users (user_key, profile_id, full_name, email, role, active_login) values
  ('admin', md5('AURORA_INTEGRAL_2026_V1:profile:admin')::uuid, 'Marcos Vinícius Almeida', 'marcos.almeida@auroraintegral.example.invalid', 'ADMIN', true),
  ('director', md5('AURORA_INTEGRAL_2026_V1:profile:director')::uuid, 'Helena Martins de Souza', 'helena.martins.souza@auroraintegral.example.invalid', 'DIRECTOR', true),
  ('secretary-1', md5('AURORA_INTEGRAL_2026_V1:profile:secretary-1')::uuid, 'Carolina Almeida Rocha', 'carolina.almeida.rocha@auroraintegral.example.invalid', 'SECRETARY', true),
  ('secretary-2', md5('AURORA_INTEGRAL_2026_V1:profile:secretary-2')::uuid, 'Diego Santana Reis', 'diego.santana.reis@auroraintegral.example.invalid', 'SECRETARY', true);

insert into aurora_seed_users (user_key, profile_id, full_name, email, role, active_login)
select
  'teacher-' || teacher_number,
  md5('AURORA_INTEGRAL_2026_V1:profile:teacher:' || teacher_number)::uuid,
  teacher_name,
  teacher_slug || '@auroraintegral.example.invalid',
  'TEACHER',
  teacher_number = 1
from (values
  (1, 'Mariana Lopes Ferreira', 'mariana-lopes-ferreira'),
  (2, 'Felipe Andrade Costa', 'felipe-andrade-costa'),
  (3, 'Camila Nunes Barbosa', 'camila-nunes-barbosa'),
  (4, 'Rafael Barros Menezes', 'rafael-barros-menezes'),
  (5, 'Lucas Menezes Carvalho', 'lucas-menezes-carvalho'),
  (6, 'Aline Carvalho Ribeiro', 'aline-carvalho-ribeiro'),
  (7, 'Beatriz Moreira Santos', 'beatriz-moreira-santos'),
  (8, 'Tiago Almeida Rocha', 'tiago-almeida-rocha'),
  (9, 'Renata Souza Martins', 'renata-souza-martins'),
  (10, 'Marcelo Ribeiro Lima', 'marcelo-ribeiro-lima'),
  (11, 'Paula Freitas Nogueira', 'paula-freitas-nogueira'),
  (12, 'Juliana Rocha Almeida', 'juliana-rocha-almeida'),
  (13, 'Daniel Costa Menezes', 'daniel-costa-menezes'),
  (14, 'Sofia Martins Carvalho', 'sofia-martins-carvalho'),
  (15, 'André Lima Barreto', 'andre-lima-barreto')
) as teacher_data(teacher_number, teacher_name, teacher_slug);

insert into aurora_seed_users (user_key, profile_id, full_name, email, role, active_login)
select
  'student-' || student_number,
  md5('AURORA_INTEGRAL_2026_V1:profile:student:' || student_number)::uuid,
  first_name || ' ' || middle_name || ' ' || surname,
  'aluno.' || lpad(student_number::text, 3, '0') || '@auroraintegral.example.invalid',
  'STUDENT',
  (student_number in (1, 10, 20, 31, 40, 50, 61, 70, 80))
from (
  select
    gs as student_number,
    (array['Ana','Gabriel','Lucas','Mariana','Joao','Beatriz','Isabela','Rafael','Clara','Pedro','Luiza','Miguel','Sofia','Enzo','Laura','Heitor','Valentina','Arthur','Manuela','Davi','Helena','Theo','Alice','Bernardo','Julia','Nicolas','Livia','Samuel','Cecilia','Guilherme'])[((gs - 1) % 30) + 1] as first_name,
    (array['Clara','Santos','Henrique','Costa','Pedro','Martins','Carolina','Nunes','Eduarda','Henrique','Fernanda','Augusto','Beatriz','Miguel','Cristina','Vitor','Aparecida','Ribeiro','Gabriela','Otavio','Marina','Felipe','Leticia','Antonio','Isadora','Joao','Camila','Andrade','Elisa','Matheus'])[((gs * 7 - 1) % 30) + 1] as middle_name,
    (array['Oliveira','Lima','Almeida','Souza','Ribeiro','Rocha','Carvalho','Ferreira','Barbosa','Mendes','Gomes','Martins','Teixeira','Nogueira','Melo','Freitas','Moreira','Cardoso','Azevedo','Pires','Monteiro','Borges','Correia','Batista','Farias','Moraes','Cavalcanti','Siqueira','Tavares','Dantas'])[((gs * 11 - 1) % 30) + 1] as surname
  from generate_series(1, 90) as g(gs)
) as generated_names;

insert into aurora_seed_users (user_key, profile_id, full_name, email, role, active_login)
select
  'guardian-' || guardian_number,
  md5('AURORA_INTEGRAL_2026_V1:profile:guardian:' || guardian_number)::uuid,
  first_name || ' ' || surname,
  'responsavel.' || lpad(guardian_number::text, 3, '0') || '@auroraintegral.example.invalid',
  'GUARDIAN',
  guardian_number in (1, 8, 10, 20, 31, 40, 50, 61, 70)
from (
  select
    gs as guardian_number,
    (array['Adriana','Carlos','Patricia','Eduardo','Luciana','Marcelo','Renata','Sergio','Tatiana','Roberto','Juliana','Fernando','Cristiane','Marcos','Aline','Ricardo','Monica','Leandro','Daniela','Gustavo','Flavia','Jose','Priscila','Andre','Vanessa','Fabio','Simone','Mauricio','Claudia','Ronaldo'])[((gs - 1) % 30) + 1] as first_name,
    (array['Oliveira','Santos','Almeida','Costa','Ribeiro','Rocha','Carvalho','Ferreira','Barbosa','Mendes','Gomes','Martins','Teixeira','Nogueira','Melo','Freitas','Moreira','Cardoso','Azevedo','Pires','Monteiro','Borges','Correia','Batista','Farias','Moraes','Cavalcanti','Siqueira','Tavares','Dantas'])[((gs * 13 - 1) % 30) + 1] as surname
  from generate_series(1, 72) as g(gs)
) as generated_guardians;

insert into aurora_subject_seed (code, name, weekly_lessons, teacher_number, sort_order) values
  ('PORT', 'Língua Portuguesa', 5, 1, 1),
  ('RED', 'Redação', 2, 1, 2),
  ('ING', 'Língua Inglesa', 2, 2, 3),
  ('ART', 'Arte', 1, 3, 4),
  ('EDF', 'Educação Física', 2, 4, 5),
  ('MAT', 'Matemática', 5, 5, 6),
  ('FIS', 'Física', 3, 6, 7),
  ('QUI', 'Química', 3, 7, 8),
  ('BIO', 'Biologia', 3, 8, 9),
  ('HIS', 'História', 2, 9, 10),
  ('GEO', 'Geografia', 2, 10, 11),
  ('FIL', 'Filosofia', 1, 11, 12),
  ('SOC', 'Sociologia', 1, 11, 13),
  ('PVD', 'Projeto de Vida', 2, 12, 14),
  ('CDI', 'Cultura Digital', 2, 13, 15),
  ('ICI', 'Iniciação Científica', 2, 14, 16),
  ('OES', 'Orientação de Estudos', 2, 12, 17),
  ('ELE', 'Eletiva Interdisciplinar', 2, 15, 18),
  ('PIN', 'Projeto Integrador', 3, 15, 19);

insert into aurora_class_seed (class_key, class_id, name, grade_level, class_number) values
  ('1A', md5('AURORA_INTEGRAL_2026_V1:class:1A')::uuid, '1ª Série A', '1º EM', 1),
  ('2A', md5('AURORA_INTEGRAL_2026_V1:class:2A')::uuid, '2ª Série A', '2º EM', 2),
  ('3A', md5('AURORA_INTEGRAL_2026_V1:class:3A')::uuid, '3ª Série A', '3º EM', 3);

insert into aurora_student_seed (student_number, student_id, profile_id, class_key, guardian_number, full_name, email, registration_number, birth_date, active_login)
select
  s.student_number,
  md5('AURORA_INTEGRAL_2026_V1:student:' || s.student_number)::uuid,
  u.profile_id,
  c.class_key,
  case when s.student_number <= 72 then s.student_number else s.student_number - 72 end,
  u.full_name,
  u.email,
  '2026-EM-' || c.class_key || '-' || lpad(((s.student_number - 1) % 30 + 1)::text, 3, '0'),
  make_date(
    case when c.class_number = 1 then 2009 + (s.student_number % 2)
         when c.class_number = 2 then 2008 + (s.student_number % 2)
         else 2007 + (s.student_number % 2) end,
    ((s.student_number * 5 - 1) % 12) + 1,
    ((s.student_number * 7 - 1) % 27) + 1
  ),
  u.active_login
from generate_series(1, 90) as s(student_number)
join aurora_seed_users u on u.user_key = 'student-' || s.student_number
join aurora_class_seed c on c.class_number = ((s.student_number - 1) / 30) + 1;

do $$
declare
  aurora_account_id uuid := md5('AURORA_INTEGRAL_2026_V1:account')::uuid;
  aurora_institution_id uuid := md5('AURORA_INTEGRAL_2026_V1:institution')::uuid;
  conflicting_id uuid;
begin
  select id into conflicting_id from public.accounts where name = 'Grupo Educacional Aurora Integral' and id <> aurora_account_id limit 1;
  if conflicting_id is not null then raise exception 'AURORA_ACCOUNT_NAME_CONFLICT:%', conflicting_id; end if;
  select id into conflicting_id from public.institutions where name = 'Colégio Aurora Integral de Salvador' and id <> aurora_institution_id limit 1;
  if conflicting_id is not null then raise exception 'AURORA_INSTITUTION_NAME_CONFLICT:%', conflicting_id; end if;
  if exists (select 1 from auth.users u join aurora_seed_users s on s.email = u.email where u.id <> s.profile_id) then
    raise exception 'AURORA_EMAIL_ID_CONFLICT';
  end if;
end;
$$;

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change, email_change_token_new, is_sso_user, is_anonymous, banned_until)
select
  '00000000-0000-0000-0000-000000000000'::uuid,
  u.profile_id,
  'authenticated',
  'authenticated',
  u.email,
  crypt(encode(gen_random_bytes(24), 'hex'), gen_salt('bf')),
  now(),
  jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
  jsonb_build_object('email_verified', true, 'full_name', u.full_name, 'role', u.role::text, 'aurora_fixture', 'AURORA_INTEGRAL_DEMO'),
  now(), now(), '', '', '', '', false, false,
  case when u.active_login then null else timestamptz '2099-12-31 00:00:00+00' end
from aurora_seed_users u
on conflict (id) do update set
  email = excluded.email,
  email_confirmed_at = coalesce(auth.users.email_confirmed_at, excluded.email_confirmed_at),
  raw_user_meta_data = excluded.raw_user_meta_data,
  banned_until = excluded.banned_until,
  updated_at = now();

insert into auth.identities (id, provider_id, user_id, identity_data, provider, created_at, updated_at)
select
  md5('AURORA_INTEGRAL_2026_V1:identity:' || u.email)::uuid,
  u.profile_id::text,
  u.profile_id,
  jsonb_build_object('sub', u.profile_id::text, 'email', u.email, 'email_verified', true),
  'email', now(), now()
from aurora_seed_users u
on conflict (id) do update set
  identity_data = excluded.identity_data,
  updated_at = now();

insert into public.profiles (id, full_name, email, role, active, platform_role)
select profile_id, full_name, email, role, true, 'USER'
from aurora_seed_users
on conflict (id) do update set
  full_name = excluded.full_name,
  email = excluded.email,
  role = excluded.role,
  active = true,
  platform_role = 'USER',
  updated_at = now();

insert into public.accounts (id, name, owner_profile_id, institution_limit, status)
values (md5('AURORA_INTEGRAL_2026_V1:account')::uuid, 'Grupo Educacional Aurora Integral', md5('AURORA_INTEGRAL_2026_V1:profile:admin')::uuid, 1, 'ACTIVE')
on conflict (id) do update set
  name = excluded.name,
  owner_profile_id = excluded.owner_profile_id,
  institution_limit = excluded.institution_limit,
  status = 'ACTIVE',
  updated_at = now();

insert into public.institutions (id, account_id, name, cnpj, address, phone, email, logo_url, favicon_url, public_slug, subdomain, primary_color, secondary_color, login_display_name, active)
values (
  md5('AURORA_INTEGRAL_2026_V1:institution')::uuid,
  md5('AURORA_INTEGRAL_2026_V1:account')::uuid,
  'Colégio Aurora Integral de Salvador',
  '00.000.000/0000-00',
  'Avenida das Palmeiras, 1450 - Caminho das Árvores - Salvador - BA - CEP 41820-000',
  '(71) 4000-2026',
  'contato@auroraintegral.example.invalid',
  '/media/aurora-integral-logo.svg',
  '/media/aurora-integral-favicon.svg',
  'aurora-integral',
  'aurora-integral',
  '#173F5F',
  '#F4B942',
  'Colégio Aurora Integral',
  true
)
on conflict (id) do update set
  account_id = excluded.account_id,
  name = excluded.name,
  cnpj = excluded.cnpj,
  address = excluded.address,
  phone = excluded.phone,
  email = excluded.email,
  logo_url = excluded.logo_url,
  favicon_url = excluded.favicon_url,
  public_slug = excluded.public_slug,
  subdomain = excluded.subdomain,
  primary_color = excluded.primary_color,
  secondary_color = excluded.secondary_color,
  login_display_name = excluded.login_display_name,
  active = true,
  updated_at = now();

insert into public.memberships (id, profile_id, institution_id, role, active)
select
  md5('AURORA_INTEGRAL_2026_V1:membership:' || u.user_key)::uuid,
  u.profile_id,
  md5('AURORA_INTEGRAL_2026_V1:institution')::uuid,
  u.role,
  true
from aurora_seed_users u
on conflict (id) do update set role = excluded.role, active = true;

insert into public.branding_settings (id, scope_type, account_id, display_name, logo_path, favicon_path, primary_color, secondary_color, created_by, updated_by)
values (
  md5('AURORA_INTEGRAL_2026_V1:branding')::uuid,
  'ACCOUNT',
  md5('AURORA_INTEGRAL_2026_V1:account')::uuid,
  'Colégio Aurora Integral',
  'branding/accounts/' || md5('AURORA_INTEGRAL_2026_V1:account')::uuid || '/logo/' || md5('AURORA_INTEGRAL_2026_V1:logo')::uuid || '.png',
  'branding/accounts/' || md5('AURORA_INTEGRAL_2026_V1:account')::uuid || '/favicon/' || md5('AURORA_INTEGRAL_2026_V1:favicon')::uuid || '.png',
  '#173F5F',
  '#F4B942',
  md5('AURORA_INTEGRAL_2026_V1:profile:admin')::uuid,
  md5('AURORA_INTEGRAL_2026_V1:profile:admin')::uuid
)
on conflict (id) do update set
  display_name = excluded.display_name,
  logo_path = excluded.logo_path,
  favicon_path = excluded.favicon_path,
  primary_color = excluded.primary_color,
  secondary_color = excluded.secondary_color,
  updated_by = excluded.updated_by,
  updated_at = now();

insert into public.academic_years (id, institution_id, name, start_date, end_date, active)
values (md5('AURORA_INTEGRAL_2026_V1:year:2026')::uuid, md5('AURORA_INTEGRAL_2026_V1:institution')::uuid, '2026', date '2026-02-02', date '2026-12-18', true)
on conflict (id) do update set name = excluded.name, start_date = excluded.start_date, end_date = excluded.end_date, active = true, updated_at = now();

insert into public.terms (id, academic_year_id, name, start_date, end_date, active) values
  (md5('AURORA_INTEGRAL_2026_V1:term:1')::uuid, md5('AURORA_INTEGRAL_2026_V1:year:2026')::uuid, '1º Bimestre', date '2026-02-02', date '2026-04-17', true),
  (md5('AURORA_INTEGRAL_2026_V1:term:2')::uuid, md5('AURORA_INTEGRAL_2026_V1:year:2026')::uuid, '2º Bimestre', date '2026-04-20', date '2026-07-03', true),
  (md5('AURORA_INTEGRAL_2026_V1:term:3')::uuid, md5('AURORA_INTEGRAL_2026_V1:year:2026')::uuid, '3º Bimestre', date '2026-08-03', date '2026-10-02', true),
  (md5('AURORA_INTEGRAL_2026_V1:term:4')::uuid, md5('AURORA_INTEGRAL_2026_V1:year:2026')::uuid, '4º Bimestre', date '2026-10-05', date '2026-12-18', true)
on conflict (id) do update set name = excluded.name, start_date = excluded.start_date, end_date = excluded.end_date, active = true, updated_at = now();

insert into public.institution_shift_settings (institution_id, enabled_shifts)
values (md5('AURORA_INTEGRAL_2026_V1:institution')::uuid, array['INTEGRAL']::text[])
on conflict (institution_id) do update set enabled_shifts = excluded.enabled_shifts, updated_at = now();

insert into public.academic_policies (id, institution_id, academic_year_id, minimum_grade_percentage, minimum_attendance_percentage, decimal_places, active, school_days, default_lesson_duration_minutes, max_lessons_per_day, max_teacher_lessons_per_day, max_teacher_lessons_per_week, max_consecutive_subject_lessons, max_subject_lessons_per_day, require_teacher_availability, require_room_for_generation, allow_shared_rooms)
values (md5('AURORA_INTEGRAL_2026_V1:policy:2026')::uuid, md5('AURORA_INTEGRAL_2026_V1:institution')::uuid, md5('AURORA_INTEGRAL_2026_V1:year:2026')::uuid, 60, 75, 1, true, array[1,2,3,4,5]::smallint[], 50, 9, 9, 45, 2, 2, true, false, true)
on conflict (id) do update set minimum_grade_percentage=60, minimum_attendance_percentage=75, decimal_places=1, active=true, school_days=array[1,2,3,4,5]::smallint[], default_lesson_duration_minutes=50, max_lessons_per_day=9, max_teacher_lessons_per_day=9, max_teacher_lessons_per_week=45, max_consecutive_subject_lessons=2, max_subject_lessons_per_day=2, require_teacher_availability=true, require_room_for_generation=false, allow_shared_rooms=true, updated_at=now();

insert into public.school_time_slots (id, institution_id, shift, day_of_week, slot_number, start_time, end_time, active)
select
  md5('AURORA_INTEGRAL_2026_V1:slot:' || d.day_of_week || ':' || s.slot_number)::uuid,
  md5('AURORA_INTEGRAL_2026_V1:institution')::uuid,
  'INTEGRAL', d.day_of_week, s.slot_number, s.start_time, s.end_time, true
from (values (1),(2),(3),(4),(5)) as d(day_of_week)
cross join (values
  (1, time '07:30', time '08:20'), (2, time '08:20', time '09:10'),
  (3, time '09:30', time '10:20'), (4, time '10:20', time '11:10'),
  (5, time '11:10', time '12:00'), (6, time '13:00', time '13:50'),
  (7, time '13:50', time '14:40'), (8, time '15:00', time '15:50'),
  (9, time '15:50', time '16:40')
) as s(slot_number, start_time, end_time)
on conflict (id) do update set start_time=excluded.start_time, end_time=excluded.end_time, active=true;

insert into public.school_schedule_breaks (id, institution_id, shift, day_of_week, name, start_time, end_time, active)
select md5('AURORA_INTEGRAL_2026_V1:break:' || d.day_of_week || ':' || b.name)::uuid,
  md5('AURORA_INTEGRAL_2026_V1:institution')::uuid, 'INTEGRAL', d.day_of_week, b.name, b.start_time, b.end_time, true
from (values (1),(2),(3),(4),(5)) as d(day_of_week)
cross join (values ('Intervalo da manhã', time '09:10', time '09:30'), ('Almoço', time '12:00', time '13:00'), ('Intervalo da tarde', time '14:40', time '15:00')) as b(name, start_time, end_time)
on conflict (id) do update set start_time=excluded.start_time, end_time=excluded.end_time, active=true;

insert into public.subjects (id, institution_id, name, code, workload, active)
select md5('AURORA_INTEGRAL_2026_V1:subject:' || code)::uuid, md5('AURORA_INTEGRAL_2026_V1:institution')::uuid, name, code, weekly_lessons * 40, true
from aurora_subject_seed
on conflict (id) do update set name=excluded.name, code=excluded.code, workload=excluded.workload, active=true;

insert into public.curriculum_templates (id, institution_id, name, grade_level, stage, active)
values (md5('AURORA_INTEGRAL_2026_V1:template')::uuid, md5('AURORA_INTEGRAL_2026_V1:institution')::uuid, 'Ensino Médio Integral 2026', '1º EM a 3º EM', 'Ensino Médio', true)
on conflict (id) do update set name=excluded.name, grade_level=excluded.grade_level, stage=excluded.stage, active=true, updated_at=now();

insert into public.curriculum_template_items (id, institution_id, template_id, subject_id, weekly_lessons, lesson_duration_minutes, active, is_complementary)
select md5('AURORA_INTEGRAL_2026_V1:template-item:' || s.code)::uuid, md5('AURORA_INTEGRAL_2026_V1:institution')::uuid, md5('AURORA_INTEGRAL_2026_V1:template')::uuid, md5('AURORA_INTEGRAL_2026_V1:subject:' || s.code)::uuid, s.weekly_lessons, 50, true, false
from aurora_subject_seed s
on conflict (id) do update set weekly_lessons=excluded.weekly_lessons, lesson_duration_minutes=50, active=true, is_complementary=false, updated_at=now();

insert into public.classes (id, institution_id, academic_year_id, name, grade_level, shift, capacity, active)
select class_id, md5('AURORA_INTEGRAL_2026_V1:institution')::uuid, md5('AURORA_INTEGRAL_2026_V1:year:2026')::uuid, name, grade_level, 'INTEGRAL', 30, true
from aurora_class_seed
on conflict (id) do update set name=excluded.name, grade_level=excluded.grade_level, shift='INTEGRAL', capacity=30, active=true, updated_at=now();

insert into public.class_curriculum_items (id, institution_id, class_id, subject_id, weekly_lessons, lesson_duration_minutes, needs_review, active, is_complementary)
select md5('AURORA_INTEGRAL_2026_V1:class-item:' || c.class_key || ':' || s.code)::uuid, md5('AURORA_INTEGRAL_2026_V1:institution')::uuid, c.class_id, md5('AURORA_INTEGRAL_2026_V1:subject:' || s.code)::uuid, s.weekly_lessons, 50, false, true, false
from aurora_class_seed c cross join aurora_subject_seed s
on conflict (id) do update set weekly_lessons=excluded.weekly_lessons, lesson_duration_minutes=50, needs_review=false, active=true, is_complementary=false, updated_at=now();

insert into public.students (id, profile_id, institution_id, registration_number, birth_date, cpf, active)
select student_id, profile_id, md5('AURORA_INTEGRAL_2026_V1:institution')::uuid, registration_number, birth_date, null, true
from aurora_student_seed
on conflict (id) do update set profile_id=excluded.profile_id, registration_number=excluded.registration_number, birth_date=excluded.birth_date, cpf=null, active=true, updated_at=now();

insert into public.enrollments (id, student_id, class_id, academic_year_id, status, enrolled_at, active)
select md5('AURORA_INTEGRAL_2026_V1:enrollment:' || s.student_number)::uuid, s.student_id, c.class_id, md5('AURORA_INTEGRAL_2026_V1:year:2026')::uuid, 'ACTIVE', timestamptz '2026-02-02 07:30:00-03', true
from aurora_student_seed s join aurora_class_seed c on c.class_key=s.class_key
on conflict (id) do update set class_id=excluded.class_id, status='ACTIVE', enrolled_at=excluded.enrolled_at, active=true, updated_at=now();

insert into public.guardianships (id, student_id, guardian_profile_id, relationship, is_primary, active)
select md5('AURORA_INTEGRAL_2026_V1:guardianship:' || s.student_number)::uuid, s.student_id, u.profile_id, case when s.guardian_number % 3 = 0 then 'Avó/Avô' else 'Responsável legal' end, true, true
from aurora_student_seed s join aurora_seed_users u on u.user_key='guardian-' || s.guardian_number
on conflict (id) do update set relationship=excluded.relationship, is_primary=true, active=true, updated_at=now();

insert into public.teacher_subjects (id, institution_id, teacher_profile_id, subject_id, primary_subject, active)
select md5('AURORA_INTEGRAL_2026_V1:teacher-subject:' || s.code)::uuid, md5('AURORA_INTEGRAL_2026_V1:institution')::uuid, md5('AURORA_INTEGRAL_2026_V1:profile:teacher:' || s.teacher_number)::uuid, md5('AURORA_INTEGRAL_2026_V1:subject:' || s.code)::uuid, s.code in ('PORT','ING','ART','EDF','MAT','FIS','QUI','BIO','HIS','GEO','FIL','PVD','CDI','ICI','ELE'), true
from aurora_subject_seed s
on conflict (id) do update set primary_subject=excluded.primary_subject, active=true, updated_at=now();

insert into public.teacher_availability (id, institution_id, teacher_profile_id, day_of_week, start_time, end_time, active)
select md5('AURORA_INTEGRAL_2026_V1:availability:' || teacher_number || ':' || day_of_week)::uuid, md5('AURORA_INTEGRAL_2026_V1:institution')::uuid, md5('AURORA_INTEGRAL_2026_V1:profile:teacher:' || teacher_number)::uuid, day_of_week, time '07:30', time '16:40', true
from generate_series(1, 15) as t(teacher_number)
cross join lateral generate_series(1, 5) as d(day_of_week)
on conflict (id) do update set start_time=time '07:30', end_time=time '16:40', active=true, updated_at=now();

insert into public.subject_offerings (id, subject_id, class_id, teacher_profile_id, term_id, active)
select md5('AURORA_INTEGRAL_2026_V1:offering:' || c.class_key || ':' || s.code || ':' || t.term_no)::uuid, md5('AURORA_INTEGRAL_2026_V1:subject:' || s.code)::uuid, c.class_id, md5('AURORA_INTEGRAL_2026_V1:profile:teacher:' || s.teacher_number)::uuid, md5('AURORA_INTEGRAL_2026_V1:term:' || t.term_no)::uuid, true
from aurora_class_seed c cross join aurora_subject_seed s cross join (values (1),(2),(3),(4)) as t(term_no)
on conflict (id) do update set teacher_profile_id=excluded.teacher_profile_id, active=true, updated_at=now();

insert into public.rooms (id, institution_id, name, code, capacity, active, class_id)
select md5('AURORA_INTEGRAL_2026_V1:room:' || c.class_key)::uuid, md5('AURORA_INTEGRAL_2026_V1:institution')::uuid, 'Sala ' || c.name, 'AI-' || c.class_key, 36, true, c.class_id
from aurora_class_seed c
on conflict (id) do update set name=excluded.name, code=excluded.code, capacity=36, active=true, class_id=excluded.class_id, updated_at=now();

insert into aurora_schedule_plan (term_id, class_id, subject_offering_id, teacher_profile_id, room_id, day_of_week, start_time, end_time)
select
  o.term_id,
  o.class_id,
  o.id,
  o.teacher_profile_id,
  md5('AURORA_INTEGRAL_2026_V1:room:' || c.class_key)::uuid,
  slot.day_of_week,
  slot.start_time,
  slot.end_time
from public.subject_offerings o
join aurora_class_seed c on c.class_id=o.class_id
join aurora_subject_seed s on s.code=(select code from public.subjects where id=o.subject_id)
cross join lateral generate_series(0, s.weekly_lessons - 1) as occurrence(n)
cross join lateral (
  select coalesce(sum(s2.weekly_lessons), 0)::integer + occurrence.n as lesson_index
  from aurora_subject_seed s2
  where s2.sort_order < s.sort_order
) as position
join public.school_time_slots slot
  on slot.institution_id=md5('AURORA_INTEGRAL_2026_V1:institution')::uuid
 and slot.shift='INTEGRAL'
 and slot.active is true
 and slot.day_of_week=1 + (((position.lesson_index + ((c.class_number - 1) * 15)) % 45) % 5)
 and slot.slot_number=1 + floor(((position.lesson_index + ((c.class_number - 1) * 15)) % 45) / 5)::integer
where o.active is true
  and o.class_id in (select class_id from aurora_class_seed);

do $$
declare
  assigned_count integer;
  bad_offering record;
begin
  select count(*) into assigned_count from aurora_schedule_plan;
  if assigned_count <> 540 then raise exception 'AURORA_TIMETABLE_TOTAL_MISMATCH:%', assigned_count; end if;
  if exists (
    select 1 from aurora_schedule_plan p
    where not exists (
      select 1 from public.teacher_availability a
      where a.institution_id=md5('AURORA_INTEGRAL_2026_V1:institution')::uuid
        and a.teacher_profile_id=p.teacher_profile_id
        and a.day_of_week=p.day_of_week
        and a.start_time <= p.start_time
        and a.end_time >= p.end_time
        and a.active is true
    )
  ) then raise exception 'AURORA_TIMETABLE_AVAILABILITY_MISMATCH'; end if;
  select p.* into bad_offering
  from aurora_schedule_plan p
  join aurora_schedule_plan q on q.term_id=p.term_id and q.teacher_profile_id=p.teacher_profile_id and q.day_of_week=p.day_of_week and q.start_time=p.start_time and q.subject_offering_id<>p.subject_offering_id
  limit 1;
  if found then raise exception 'AURORA_TIMETABLE_TEACHER_CONFLICT:%', bad_offering.subject_offering_id; end if;
end;
$$;

do $$
declare
  existing_version uuid;
  new_version uuid;
  admin_id uuid := md5('AURORA_INTEGRAL_2026_V1:profile:director')::uuid;
begin
  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  select id into existing_version from public.timetable_versions where institution_id=md5('AURORA_INTEGRAL_2026_V1:institution')::uuid and academic_year_id=md5('AURORA_INTEGRAL_2026_V1:year:2026')::uuid and name='Aurora Integral 2026 - Grade V1' and status='PUBLISHED' limit 1;
  if existing_version is null then
    select public.create_timetable_draft(
      md5('AURORA_INTEGRAL_2026_V1:institution')::uuid,
      md5('AURORA_INTEGRAL_2026_V1:year:2026')::uuid,
      'Aurora Integral 2026 - Grade V1',
      'AURORA_INTEGRAL_2026_V1',
      'INTEGRAL',
      admin_id,
      null,
      (select jsonb_agg(jsonb_build_object('academic_year_id', md5('AURORA_INTEGRAL_2026_V1:year:2026')::uuid, 'term_id', term_id, 'class_id', class_id, 'subject_offering_id', subject_offering_id, 'room_id', room_id, 'day_of_week', day_of_week, 'start_time', start_time, 'end_time', end_time, 'locked', false, 'active', true)) from aurora_schedule_plan)
    ) into new_version;
    perform public.publish_timetable_version(new_version);
  end if;
end;
$$;

insert into public.attendance_sessions (id, institution_id, subject_offering_id, session_date, starts_at, ends_at, topic, notes, status, created_by, class_activity, homework)
select
  md5('AURORA_INTEGRAL_2026_V1:session:' || o.id || ':' || ats.term_no || ':' || n.n)::uuid,
  md5('AURORA_INTEGRAL_2026_V1:institution')::uuid,
  o.id,
  t.start_date + ((sp.day_of_week - 1) + ((n.n - 1) * 7)),
  sp.start_time,
  sp.end_time,
  case s.code when 'PORT' then 'Interpretação de textos argumentativos' when 'MAT' then 'Funções exponenciais e aplicações' when 'FIS' then 'Movimento harmônico simples' when 'QUI' then 'Equilíbrio químico' when 'BIO' then 'Genética mendeliana' when 'HIS' then 'República Oligárquica' when 'GEO' then 'Globalização e redes produtivas' else 'Estudo orientado e prática de aprendizagem' end,
  case when ats.term_no in (1,2) then 'Registro pedagógico do encontro e encaminhamentos da turma.' else 'Aula acompanhada no bimestre corrente.' end,
  case when ats.term_no in (1,2) then 'CLOSED' else case when t.start_date + ((sp.day_of_week - 1) + ((n.n - 1) * 7)) <= date '2026-09-23' then 'CLOSED' else 'OPEN' end end,
  o.teacher_profile_id,
  case s.code when 'PORT' then 'Leitura compartilhada, debate e síntese escrita.' when 'MAT' then 'Resolução guiada de situações-problema.' else 'Atividade prática com registro no caderno.' end,
  case s.code when 'PORT' then 'Produzir um parágrafo argumentativo sobre o tema discutido.' when 'MAT' then 'Resolver a lista de exercícios e justificar duas estratégias.' else 'Revisar o material da aula e registrar uma dúvida.' end
from public.subject_offerings o
join public.subjects s on s.id=o.subject_id
join public.terms t on t.id=o.term_id
join aurora_term_seed ats on ats.term_id=t.id
join lateral (select p.day_of_week,p.start_time,p.end_time from aurora_schedule_plan p where p.subject_offering_id=o.id and p.term_id=o.term_id order by p.day_of_week,p.start_time limit 1) sp on true
cross join lateral generate_series(1, case when ats.term_no in (1,2) then 5 else 10 end) n(n)
where o.active is true and t.academic_year_id=md5('AURORA_INTEGRAL_2026_V1:year:2026')::uuid
  and t.start_date + ((sp.day_of_week - 1) + ((n.n - 1) * 7)) <= t.end_date
on conflict (id) do update set session_date=excluded.session_date, starts_at=excluded.starts_at, ends_at=excluded.ends_at, topic=excluded.topic, notes=excluded.notes, status=excluded.status, class_activity=excluded.class_activity, homework=excluded.homework, updated_at=now();

insert into public.attendance_records (id, institution_id, attendance_session_id, student_id, status, notes, recorded_by)
select
  md5('AURORA_INTEGRAL_2026_V1:attendance:' || sess.id || ':' || st.student_id)::uuid,
  md5('AURORA_INTEGRAL_2026_V1:institution')::uuid,
  sess.id,
  st.student_id,
  case when sess.session_date >= date '2026-08-01' and sess.status='OPEN' then 'PRESENT'
       when (st.student_number % 20) in (18,19) and (extract(day from sess.session_date)::integer % 4) = 0 then 'ABSENT'
       when (st.student_number % 20) in (15,16,17) and (extract(day from sess.session_date)::integer % 5) = 0 then 'ABSENT'
       when (extract(day from sess.session_date)::integer + st.student_number) % 17 = 0 then 'ABSENT'
       when (extract(day from sess.session_date)::integer + st.student_number) % 13 = 0 then 'LATE'
       else 'PRESENT' end,
  case when (extract(day from sess.session_date)::integer + st.student_number) % 17 = 0 then 'Ausência registrada no acompanhamento de frequência.' else null end,
  o.teacher_profile_id
from public.attendance_sessions sess
join public.subject_offerings o on o.id=sess.subject_offering_id
join aurora_student_seed st on st.class_key=(select class_key from aurora_class_seed where class_id=o.class_id)
on conflict (id) do update set status=excluded.status, notes=excluded.notes, recorded_by=excluded.recorded_by, updated_at=now();

insert into public.assessments (id, institution_id, subject_offering_id, term_id, title, description, assessment_type, assessment_date, max_score, weight, status, created_by, published_at)
select
  md5('AURORA_INTEGRAL_2026_V1:assessment:' || o.id || ':' || ats.term_no || ':' || a.assessment_no)::uuid,
  md5('AURORA_INTEGRAL_2026_V1:institution')::uuid,
  o.id,
  t.id,
  case when a.assessment_no=1 then 'Avaliação I' else case when s.code in ('PORT','RED') then 'Produção Textual' when s.code in ('FIS','QUI','BIO') then 'Relatório Experimental' when s.code='PIN' then 'Projeto Interdisciplinar' else 'Avaliação II' end end,
  'Instrumento avaliativo sintético do componente curricular, com critérios publicados para a turma.',
  case when a.assessment_no=1 then 'EXAM' when s.code='PIN' then 'PROJECT' else 'ASSIGNMENT' end,
  case when ats.term_no=1 and a.assessment_no=1 then date '2026-03-10' when ats.term_no=1 then date '2026-04-07' when ats.term_no=2 and a.assessment_no=1 then date '2026-05-20' when ats.term_no=2 then date '2026-06-17' when ats.term_no=3 and a.assessment_no=1 then date '2026-08-26' else date '2026-09-30' end,
  10, 1, case when ats.term_no=3 and a.assessment_no=2 then 'DRAFT' else 'PUBLISHED' end, o.teacher_profile_id,
  case when ats.term_no=3 and a.assessment_no=2 then null else timestamptz '2026-08-26 12:00:00-03' end
from public.subject_offerings o join public.subjects s on s.id=o.subject_id join public.terms t on t.id=o.term_id join aurora_term_seed ats on ats.term_id=t.id
cross join lateral generate_series(1, case when ats.term_no in (1,2,3) then 2 else 0 end) a(assessment_no)
where o.active is true and t.academic_year_id=md5('AURORA_INTEGRAL_2026_V1:year:2026')::uuid
  and not exists (select 1 from public.assessments existing where existing.id=md5('AURORA_INTEGRAL_2026_V1:assessment:' || o.id || ':' || ats.term_no || ':' || a.assessment_no)::uuid)
on conflict (id) do nothing;

insert into public.grades (id, institution_id, assessment_id, student_id, score, status, feedback, recorded_by)
select
  md5('AURORA_INTEGRAL_2026_V1:grade:' || a.id || ':' || st.student_number)::uuid,
  md5('AURORA_INTEGRAL_2026_V1:institution')::uuid,
  a.id,
  st.student_id,
  case
    when a.term_id=md5('AURORA_INTEGRAL_2026_V1:term:2')::uuid and s.code='MAT' and st.student_number between 1 and 8 then round((4.8 + ((st.student_number % 4) * 0.2))::numeric, 1)
    when ((st.student_number * 7 + seed.sort_order * 3 + extract(day from a.assessment_date)::integer) % 20) <= 2 then round((8.5 + ((st.student_number + seed.sort_order) % 15) / 10.0)::numeric, 1)
    when ((st.student_number * 7 + seed.sort_order * 3 + extract(day from a.assessment_date)::integer) % 20) <= 13 then round((6.5 + ((st.student_number + seed.sort_order) % 20) / 10.0)::numeric, 1)
    when ((st.student_number * 7 + seed.sort_order * 3 + extract(day from a.assessment_date)::integer) % 20) <= 17 then round((5.0 + ((st.student_number + seed.sort_order) % 15) / 10.0)::numeric, 1)
    else round((4.0 + ((st.student_number + seed.sort_order) % 10) / 10.0)::numeric, 1)
  end,
  'GRADED',
  case when a.assessment_date < date '2026-09-23' then 'Resultado lançado com devolutiva orientadora.' else 'Avaliação prevista no planejamento do bimestre.' end,
  o.teacher_profile_id
from public.assessments a
join public.subject_offerings o on o.id=a.subject_offering_id
join public.subjects s on s.id=o.subject_id
join aurora_subject_seed seed on seed.code=s.code
join aurora_student_seed st on st.class_key=(select class_key from aurora_class_seed where class_id=o.class_id)
where a.status in ('PUBLISHED','CLOSED')
  and not exists (select 1 from public.grades existing where existing.id=md5('AURORA_INTEGRAL_2026_V1:grade:' || a.id || ':' || st.student_number)::uuid)
on conflict (id) do nothing;

set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000000';

do $$
declare
  admin_id uuid := md5('AURORA_INTEGRAL_2026_V1:profile:director')::uuid;
  offering_row record;
begin
  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  for offering_row in select o.id, o.term_id from public.subject_offerings o join public.terms t on t.id=o.term_id where o.class_id in (select class_id from aurora_class_seed) and t.id in (md5('AURORA_INTEGRAL_2026_V1:term:1')::uuid, md5('AURORA_INTEGRAL_2026_V1:term:2')::uuid) order by t.start_date, o.class_id, o.subject_id loop
    if exists (select 1 from public.term_closures where institution_id=md5('AURORA_INTEGRAL_2026_V1:institution')::uuid and subject_offering_id=offering_row.id and term_id=offering_row.term_id and status='CLOSED') then
      continue;
    end if;
    perform public.submit_term_closure(md5('AURORA_INTEGRAL_2026_V1:institution')::uuid, md5('AURORA_INTEGRAL_2026_V1:year:2026')::uuid, offering_row.term_id, offering_row.id);
    perform public.close_term_closure(md5('AURORA_INTEGRAL_2026_V1:institution')::uuid, md5('AURORA_INTEGRAL_2026_V1:year:2026')::uuid, offering_row.term_id, offering_row.id);
  end loop;
end;
$$;

do $$
declare
  admin_id uuid := md5('AURORA_INTEGRAL_2026_V1:profile:director')::uuid;
  recovery_row record;
  recovery_value numeric;
begin
  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  for recovery_row in
    select st.student_id, st.student_number, o.id as offering_id, o.teacher_profile_id, tc.id as closure_id
    from aurora_student_seed st
    join aurora_class_seed c on c.class_key=st.class_key
    join public.subject_offerings o on o.class_id=c.class_id and o.subject_id=md5('AURORA_INTEGRAL_2026_V1:subject:MAT')::uuid and o.term_id=md5('AURORA_INTEGRAL_2026_V1:term:2')::uuid
    join public.term_closures tc on tc.subject_offering_id=o.id and tc.term_id=md5('AURORA_INTEGRAL_2026_V1:term:2')::uuid and tc.status='CLOSED'
    where st.student_number in (1,2,3,4,5,6,7,8)
    order by st.student_number
  loop
    if exists (select 1 from public.student_term_recoveries where institution_id=md5('AURORA_INTEGRAL_2026_V1:institution')::uuid and student_id=recovery_row.student_id and subject_offering_id=recovery_row.offering_id and term_id=md5('AURORA_INTEGRAL_2026_V1:term:2')::uuid and status='PUBLISHED') then
      continue;
    end if;
    if exists (select 1 from public.term_closures where id=recovery_row.closure_id and status='CLOSED') then
      perform public.reopen_term_closure(md5('AURORA_INTEGRAL_2026_V1:institution')::uuid, recovery_row.closure_id, 'Revisão pedagógica sintética do conselho de classe do 2º bimestre.');
    end if;
    perform set_config('request.jwt.claim.sub', recovery_row.teacher_profile_id::text, true);
    recovery_value := case when recovery_row.student_number <= 4 then 68 + recovery_row.student_number else 52 + recovery_row.student_number end;
    perform public.save_academic_recovery(md5('AURORA_INTEGRAL_2026_V1:institution')::uuid, md5('AURORA_INTEGRAL_2026_V1:year:2026')::uuid, md5('AURORA_INTEGRAL_2026_V1:term:2')::uuid, recovery_row.offering_id, recovery_row.student_id, recovery_value, 'DRAFT', 'Plano de recuperação com retomada de conceitos essenciais.');
    perform public.save_academic_recovery(md5('AURORA_INTEGRAL_2026_V1:institution')::uuid, md5('AURORA_INTEGRAL_2026_V1:year:2026')::uuid, md5('AURORA_INTEGRAL_2026_V1:term:2')::uuid, recovery_row.offering_id, recovery_row.student_id, recovery_value, 'PUBLISHED', 'Plano de recuperação com retomada de conceitos essenciais.');
    perform set_config('request.jwt.claim.sub', admin_id::text, true);
  end loop;
  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  for recovery_row in select distinct o.id as offering_id from public.subject_offerings o join public.student_term_recoveries r on r.subject_offering_id=o.id where r.institution_id=md5('AURORA_INTEGRAL_2026_V1:institution')::uuid and r.term_id=md5('AURORA_INTEGRAL_2026_V1:term:2')::uuid loop
    perform public.close_term_closure(md5('AURORA_INTEGRAL_2026_V1:institution')::uuid, md5('AURORA_INTEGRAL_2026_V1:year:2026')::uuid, md5('AURORA_INTEGRAL_2026_V1:term:2')::uuid, recovery_row.offering_id);
  end loop;
end;
$$;

do $$
declare
  existing_version uuid;
  new_version uuid;
  admin_id uuid := md5('AURORA_INTEGRAL_2026_V1:profile:director')::uuid;
begin
  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  select id into existing_version from public.timetable_versions where institution_id=md5('AURORA_INTEGRAL_2026_V1:institution')::uuid and academic_year_id=md5('AURORA_INTEGRAL_2026_V1:year:2026')::uuid and name='Aurora Integral 2026 - Grade V1' and status='PUBLISHED' limit 1;
  if existing_version is null then
    select public.create_timetable_draft(
      md5('AURORA_INTEGRAL_2026_V1:institution')::uuid,
      md5('AURORA_INTEGRAL_2026_V1:year:2026')::uuid,
      'Aurora Integral 2026 - Grade V1',
      'AURORA_INTEGRAL_2026_V1',
      'INTEGRAL',
      admin_id,
      null,
      (select jsonb_agg(jsonb_build_object('academic_year_id', md5('AURORA_INTEGRAL_2026_V1:year:2026')::uuid, 'term_id', term_id, 'class_id', class_id, 'subject_offering_id', subject_offering_id, 'room_id', room_id, 'day_of_week', day_of_week, 'start_time', start_time, 'end_time', end_time, 'locked', false, 'active', true)) from aurora_schedule_plan)
    ) into new_version;
    perform public.publish_timetable_version(new_version);
  end if;
end;
$$;

insert into public.student_registration_details (student_id, institution_id, nationality, birthplace, birth_state, sex)
select s.student_id, md5('AURORA_INTEGRAL_2026_V1:institution')::uuid, 'Brasileira', 'Salvador', 'BA', case when s.student_number % 2 = 0 then 'F' else 'M' end
from aurora_student_seed s where s.student_number in (1, 61)
on conflict (student_id) do update set nationality=excluded.nationality, birthplace=excluded.birthplace, birth_state=excluded.birth_state, sex=excluded.sex, updated_at=now();

insert into public.institution_announcements (id, institution_id, title, message, audience, active, starts_at, ends_at, created_by) values
  (md5('AURORA_INTEGRAL_2026_V1:announcement:1')::uuid, md5('AURORA_INTEGRAL_2026_V1:institution')::uuid, 'Bem-vindos ao 3º bimestre', 'Retomamos as aulas com foco em projetos, acompanhamento de aprendizagem e autonomia nos estudos.', 'ALL', true, timestamptz '2026-08-03 07:00:00-03', timestamptz '2026-10-02 23:59:00-03', md5('AURORA_INTEGRAL_2026_V1:profile:admin')::uuid),
  (md5('AURORA_INTEGRAL_2026_V1:announcement:2')::uuid, md5('AURORA_INTEGRAL_2026_V1:institution')::uuid, 'Feira de Ciências - 25 de setembro', 'As equipes apresentarão protótipos e relatórios de investigação no pátio pedagógico.', 'ALL', true, timestamptz '2026-09-01 07:00:00-03', timestamptz '2026-09-26 23:59:00-03', md5('AURORA_INTEGRAL_2026_V1:profile:director')::uuid),
  (md5('AURORA_INTEGRAL_2026_V1:announcement:3')::uuid, md5('AURORA_INTEGRAL_2026_V1:institution')::uuid, 'Reunião de responsáveis - 30 de setembro', 'A reunião tratará de frequência, resultados parciais e preparação para o último bimestre.', 'GUARDIANS', true, timestamptz '2026-09-10 07:00:00-03', timestamptz '2026-10-01 23:59:00-03', md5('AURORA_INTEGRAL_2026_V1:profile:director')::uuid),
  (md5('AURORA_INTEGRAL_2026_V1:announcement:4')::uuid, md5('AURORA_INTEGRAL_2026_V1:institution')::uuid, 'Semana de Avaliações', 'Confira no calendário as avaliações parciais do 3º bimestre e organize o seu plano de estudo.', 'STUDENTS', true, timestamptz '2026-09-14 07:00:00-03', timestamptz '2026-09-25 23:59:00-03', md5('AURORA_INTEGRAL_2026_V1:profile:secretary-1')::uuid),
  (md5('AURORA_INTEGRAL_2026_V1:announcement:5')::uuid, md5('AURORA_INTEGRAL_2026_V1:institution')::uuid, 'Mostra Cultural do Ensino Médio', 'A comunidade escolar está convidada para a mostra de linguagens, artes e cultura digital.', 'ALL', true, timestamptz '2026-09-01 07:00:00-03', timestamptz '2026-10-10 23:59:00-03', md5('AURORA_INTEGRAL_2026_V1:profile:director')::uuid),
  (md5('AURORA_INTEGRAL_2026_V1:announcement:6')::uuid, md5('AURORA_INTEGRAL_2026_V1:institution')::uuid, 'Prazo para entrega do Projeto Integrador', 'As equipes devem publicar o relatório parcial e registrar as referências utilizadas até 02 de outubro.', 'STUDENTS', true, timestamptz '2026-09-01 07:00:00-03', timestamptz '2026-10-03 23:59:00-03', md5('AURORA_INTEGRAL_2026_V1:profile:secretary-2')::uuid)
on conflict (id) do update set title=excluded.title, message=excluded.message, audience=excluded.audience, active=true, starts_at=excluded.starts_at, ends_at=excluded.ends_at, created_by=excluded.created_by, updated_at=now();

insert into public.academic_calendar_events (id, institution_id, academic_year_id, title, description, event_type, starts_at, ends_at, all_day, audience, created_by) values
  (md5('AURORA_INTEGRAL_2026_V1:event:1')::uuid, md5('AURORA_INTEGRAL_2026_V1:institution')::uuid, md5('AURORA_INTEGRAL_2026_V1:year:2026')::uuid, 'Feira de Ciências', 'Apresentação dos projetos de iniciação científica e laboratório.', 'SCHOOL_EVENT', timestamptz '2026-09-25 08:00:00-03', timestamptz '2026-09-25 16:00:00-03', false, 'ALL', md5('AURORA_INTEGRAL_2026_V1:profile:director')::uuid),
  (md5('AURORA_INTEGRAL_2026_V1:event:2')::uuid, md5('AURORA_INTEGRAL_2026_V1:institution')::uuid, md5('AURORA_INTEGRAL_2026_V1:year:2026')::uuid, 'Reunião de responsáveis', 'Encontro de acompanhamento do 3º bimestre.', 'MEETING', timestamptz '2026-09-30 18:30:00-03', timestamptz '2026-09-30 20:00:00-03', false, 'GUARDIANS', md5('AURORA_INTEGRAL_2026_V1:profile:director')::uuid),
  (md5('AURORA_INTEGRAL_2026_V1:event:3')::uuid, md5('AURORA_INTEGRAL_2026_V1:institution')::uuid, md5('AURORA_INTEGRAL_2026_V1:year:2026')::uuid, 'Semana de Avaliações', 'Período de atividades avaliativas parciais.', 'ASSESSMENT', timestamptz '2026-09-21 07:30:00-03', timestamptz '2026-09-25 16:40:00-03', false, 'STUDENTS', md5('AURORA_INTEGRAL_2026_V1:profile:secretary-1')::uuid),
  (md5('AURORA_INTEGRAL_2026_V1:event:4')::uuid, md5('AURORA_INTEGRAL_2026_V1:institution')::uuid, md5('AURORA_INTEGRAL_2026_V1:year:2026')::uuid, 'Mostra Cultural', 'Exposições de arte, leitura, música e cultura digital.', 'SCHOOL_EVENT', timestamptz '2026-10-09 08:00:00-03', timestamptz '2026-10-09 16:00:00-03', false, 'ALL', md5('AURORA_INTEGRAL_2026_V1:profile:director')::uuid),
  (md5('AURORA_INTEGRAL_2026_V1:event:5')::uuid, md5('AURORA_INTEGRAL_2026_V1:institution')::uuid, md5('AURORA_INTEGRAL_2026_V1:year:2026')::uuid, 'Conselho de Classe - 2º Bimestre', 'Reunião concluída de acompanhamento pedagógico da 3ª Série A.', 'MEETING', timestamptz '2026-07-10 14:00:00-03', timestamptz '2026-07-10 16:00:00-03', false, 'STAFF', md5('AURORA_INTEGRAL_2026_V1:profile:director')::uuid),
  (md5('AURORA_INTEGRAL_2026_V1:event:6')::uuid, md5('AURORA_INTEGRAL_2026_V1:institution')::uuid, md5('AURORA_INTEGRAL_2026_V1:year:2026')::uuid, 'Conselho de Classe - 3º Bimestre', 'Espaço aberto de análise formativa da 2ª Série A.', 'MEETING', timestamptz '2026-09-28 14:00:00-03', timestamptz '2026-09-28 16:00:00-03', false, 'STAFF', md5('AURORA_INTEGRAL_2026_V1:profile:director')::uuid),
  (md5('AURORA_INTEGRAL_2026_V1:event:7')::uuid, md5('AURORA_INTEGRAL_2026_V1:institution')::uuid, md5('AURORA_INTEGRAL_2026_V1:year:2026')::uuid, 'Início do 4º Bimestre', 'Abertura do planejamento do bimestre final.', 'SCHOOL_EVENT', timestamptz '2026-10-05 07:30:00-03', timestamptz '2026-10-05 08:00:00-03', false, 'ALL', md5('AURORA_INTEGRAL_2026_V1:profile:director')::uuid),
  (md5('AURORA_INTEGRAL_2026_V1:event:8')::uuid, md5('AURORA_INTEGRAL_2026_V1:institution')::uuid, md5('AURORA_INTEGRAL_2026_V1:year:2026')::uuid, 'Encerramento do ano letivo', 'Celebração do percurso formativo e fechamento do ano de 2026.', 'SCHOOL_EVENT', timestamptz '2026-12-18 09:00:00-03', timestamptz '2026-12-18 12:00:00-03', false, 'ALL', md5('AURORA_INTEGRAL_2026_V1:profile:director')::uuid)
on conflict (id) do update set title=excluded.title, description=excluded.description, event_type=excluded.event_type, starts_at=excluded.starts_at, ends_at=excluded.ends_at, audience=excluded.audience, active=true, updated_at=now();

insert into public.learning_posts (id, institution_id, class_id, subject_id, created_by, post_type, title, body, pinned, active, published_at, expires_at)
select
  md5('AURORA_INTEGRAL_2026_V1:learning:' || p.item_no)::uuid,
  md5('AURORA_INTEGRAL_2026_V1:institution')::uuid,
  (select class_id from aurora_class_seed order by class_number limit 1 offset ((p.item_no - 1) % 3)),
  md5('AURORA_INTEGRAL_2026_V1:subject:' || p.code)::uuid,
  md5('AURORA_INTEGRAL_2026_V1:profile:teacher:' || (select teacher_number from aurora_subject_seed where code=p.code))::uuid,
  'MATERIAL', p.title, p.body, p.item_no <= 3, true, timestamptz '2026-08-03 08:00:00-03', null
from (values
  (1,'PORT','Exercícios de interpretação textual','Observe a tese, os argumentos e as marcas de coesão. Registre duas evidências do texto e uma pergunta para o debate.'),
  (2,'PORT','Oficina de redação argumentativa','Esboce introdução, desenvolvimento e conclusão para um tema de interesse coletivo.'),
  (3,'MAT','Guia de funções exponenciais','Relacione crescimento, decaimento e representação gráfica em três exemplos autorais.'),
  (4,'MAT','Lista de revisão algébrica','Resolva os desafios graduados e explique o passo em que escolheu cada estratégia.'),
  (5,'FIS','Lista de cinemática','Compare movimento uniforme e variado usando tabelas de posição e tempo.'),
  (6,'FIS','Laboratório de movimento harmônico','Registre período, amplitude e uma hipótese para a próxima observação.'),
  (7,'QUI','Revisão de equilíbrio químico','Monte um mapa de fatores que deslocam o equilíbrio e justifique cada seta.'),
  (8,'QUI','Roteiro de relatório experimental','Use problema, método, evidências e conclusão como seções do relatório.'),
  (9,'BIO','Resumo de genética mendeliana','Represente dois cruzamentos simples e compare genótipo e fenótipo.'),
  (10,'HIS','Mapa mental da República Oligárquica','Organize grupos sociais, economia e conflitos em relações de causa e consequência.'),
  (11,'GEO','Globalização e redes produtivas','Escolha um produto cotidiano e trace sua cadeia produtiva em um esquema original.'),
  (12,'BIO','Fichamento de investigação científica','Registre pergunta, fonte, evidência e uma limitação do estudo analisado.')
) as p(item_no, code, title, body)
on conflict (id) do update set title=excluded.title, body=excluded.body, active=true, pinned=excluded.pinned, updated_at=now();

insert into public.book_recommendations (id, institution_id, subject_offering_id, title, author, note, active, created_by)
select
  md5('AURORA_INTEGRAL_2026_V1:book:' || b.book_no)::uuid,
  md5('AURORA_INTEGRAL_2026_V1:institution')::uuid,
  (select o.id from public.subject_offerings o join public.subjects s on s.id=o.subject_id where s.code=b.code and o.term_id=md5('AURORA_INTEGRAL_2026_V1:term:3')::uuid order by o.class_id limit 1),
  b.title, 'Equipe de Estudos Aurora', b.note, true, md5('AURORA_INTEGRAL_2026_V1:profile:teacher:' || (select teacher_number from aurora_subject_seed where code=b.code))::uuid
from (values
  (1,'MAT','Matemática em Movimento','Leituras e desafios para conectar modelos e situações cotidianas.'),
  (2,'BIO','Horizontes da Ciência','Caderno fictício de perguntas para observar sistemas vivos.'),
  (3,'PORT','Leituras do Brasil Contemporâneo','Seleção autoral para ampliar repertório e argumentação.'),
  (4,'GEO','Atlas de Ideias','Percursos visuais para interpretar território, redes e paisagens.'),
  (5,'FIS','Laboratório de Física','Experimentos narrados para formular hipóteses e registrar evidências.'),
  (6,'ICI','Introdução à Pesquisa Científica','Guia sintético de perguntas, métodos e comunicação de resultados.'),
  (7,'RED','Redação em Prática','Propostas fictícias de escrita, revisão e reescrita.'),
  (8,'HIS','Sociedade e Transformações','Linha do tempo comentada para conectar mudanças históricas.')
) as b(book_no, code, title, note)
on conflict (id) do update set title=excluded.title, author=excluded.author, note=excluded.note, active=true, updated_at=now();

insert into public.class_councils (id, institution_id, academic_year_id, term_id, class_id, status, scheduled_at, opened_at, completed_at, general_notes, created_by, opened_by, completed_by)
values
  (md5('AURORA_INTEGRAL_2026_V1:council:3A:T2')::uuid, md5('AURORA_INTEGRAL_2026_V1:institution')::uuid, md5('AURORA_INTEGRAL_2026_V1:year:2026')::uuid, md5('AURORA_INTEGRAL_2026_V1:term:2')::uuid, md5('AURORA_INTEGRAL_2026_V1:class:3A')::uuid, 'COMPLETED', timestamptz '2026-07-10 14:00:00-03', timestamptz '2026-07-10 14:00:00-03', timestamptz '2026-07-10 16:00:00-03', 'Conselho concluído com foco em autonomia, frequência e consolidação das aprendizagens do semestre.', md5('AURORA_INTEGRAL_2026_V1:profile:director')::uuid, md5('AURORA_INTEGRAL_2026_V1:profile:director')::uuid, md5('AURORA_INTEGRAL_2026_V1:profile:director')::uuid),
  (md5('AURORA_INTEGRAL_2026_V1:council:2A:T3')::uuid, md5('AURORA_INTEGRAL_2026_V1:institution')::uuid, md5('AURORA_INTEGRAL_2026_V1:year:2026')::uuid, md5('AURORA_INTEGRAL_2026_V1:term:3')::uuid, md5('AURORA_INTEGRAL_2026_V1:class:2A')::uuid, 'OPEN', timestamptz '2026-09-28 14:00:00-03', timestamptz '2026-09-28 14:00:00-03', null, 'Conselho aberto para acompanhar os dados parciais e combinar encaminhamentos pedagógicos.', md5('AURORA_INTEGRAL_2026_V1:profile:director')::uuid, md5('AURORA_INTEGRAL_2026_V1:profile:director')::uuid, null)
on conflict (id) do update set status=excluded.status, scheduled_at=excluded.scheduled_at, opened_at=excluded.opened_at, completed_at=excluded.completed_at, general_notes=excluded.general_notes, updated_at=now();

insert into public.class_council_participants (id, institution_id, council_id, profile_id, participant_role, added_by) values
  (md5('AURORA_INTEGRAL_2026_V1:council-participant:2A:director')::uuid, md5('AURORA_INTEGRAL_2026_V1:institution')::uuid, md5('AURORA_INTEGRAL_2026_V1:council:2A:T3')::uuid, md5('AURORA_INTEGRAL_2026_V1:profile:director')::uuid, 'DIRECTOR', md5('AURORA_INTEGRAL_2026_V1:profile:director')::uuid),
  (md5('AURORA_INTEGRAL_2026_V1:council-participant:2A:secretary')::uuid, md5('AURORA_INTEGRAL_2026_V1:institution')::uuid, md5('AURORA_INTEGRAL_2026_V1:council:2A:T3')::uuid, md5('AURORA_INTEGRAL_2026_V1:profile:secretary-1')::uuid, 'SECRETARY', md5('AURORA_INTEGRAL_2026_V1:profile:director')::uuid),
  (md5('AURORA_INTEGRAL_2026_V1:council-participant:teacher')::uuid, md5('AURORA_INTEGRAL_2026_V1:institution')::uuid, md5('AURORA_INTEGRAL_2026_V1:council:2A:T3')::uuid, md5('AURORA_INTEGRAL_2026_V1:profile:teacher:1')::uuid, 'TEACHER', md5('AURORA_INTEGRAL_2026_V1:profile:director')::uuid)
on conflict (id) do update set participant_role=excluded.participant_role, added_by=excluded.added_by;

insert into public.class_council_student_notes (id, institution_id, council_id, student_id, student_name, registration_number, class_name, average_grade, attendance_percentage, low_performance_subjects, low_attendance_subjects, pending_items, risk_level, risk_reasons, data_status, teacher_contributions, observation, resolution, follow_up_category, follow_up_text, updated_by)
select
  md5('AURORA_INTEGRAL_2026_V1:council-note:' || c.council_key || ':' || st.student_number)::uuid,
  md5('AURORA_INTEGRAL_2026_V1:institution')::uuid,
  md5('AURORA_INTEGRAL_2026_V1:council:' || c.class_key || ':' || c.term_key)::uuid,
  st.student_id, st.full_name, st.registration_number, cls.name,
  case when st.student_number % 10 in (8,9) then 54.0 else 78.5 end,
  case when st.student_number % 10 = 9 then 72.0 when st.student_number % 10 = 8 then 84.0 else 94.0 end,
  case when st.student_number % 10 in (8,9) then 3 else 0 end,
  case when st.student_number % 10 = 9 then 2 when st.student_number % 10 = 8 then 1 else 0 end,
  case when st.student_number % 10 in (8,9) then 1 else 0 end,
  case when st.student_number % 10 = 9 then 'CRITICAL' when st.student_number % 10 = 8 then 'ATTENTION' else 'NORMAL' end,
  case when st.student_number % 10 = 9 then '["frequência abaixo da referência", "necessita plano de estudos"]'::jsonb when st.student_number % 10 = 8 then '["acompanhar consolidação de conceitos"]'::jsonb else '[]'::jsonb end,
  case when c.term_key='T2' then 'OFFICIAL' else 'PARTIAL' end,
  jsonb_build_object('teacher', 'Observação formativa registrada pela equipe docente.'),
  case when st.student_number % 10 in (8,9) then 'Revisar rotina de estudos e combinar metas quinzenais.' else 'Percurso consistente no período analisado.' end,
  case when st.student_number % 10 in (8,9) then 'Acompanhar devolutivas e participação nas atividades.' else 'Manter estratégias de aprendizagem e participação.' end,
  case when st.student_number % 10 = 9 then 'INDIVIDUAL_PLAN' when st.student_number % 10 = 8 then 'MONITOR' else 'NONE' end,
  case when st.student_number % 10 in (8,9) then 'Revisão quinzenal com registro de avanços.' else null end,
  md5('AURORA_INTEGRAL_2026_V1:profile:director')::uuid
from aurora_student_seed st
join aurora_class_seed cls on cls.class_key=st.class_key
cross join (values ('3A','T2','3A:T2'),('2A','T3','2A:T3')) as c(class_key,term_key,council_key)
where cls.class_key=c.class_key and st.student_number % 10 in (0,8,9)
on conflict (id) do update set average_grade=excluded.average_grade, attendance_percentage=excluded.attendance_percentage, risk_level=excluded.risk_level, risk_reasons=excluded.risk_reasons, data_status=excluded.data_status, observation=excluded.observation, resolution=excluded.resolution, follow_up_category=excluded.follow_up_category, follow_up_text=excluded.follow_up_text, updated_by=excluded.updated_by, updated_at=now();

select jsonb_build_object(
  'fixture_type', 'AURORA_INTEGRAL_DEMO',
  'fixture_version', 'AURORA_INTEGRAL_2026_V1',
  'account_id', md5('AURORA_INTEGRAL_2026_V1:account')::uuid,
  'institution_id', md5('AURORA_INTEGRAL_2026_V1:institution')::uuid,
  'academic_year_id', md5('AURORA_INTEGRAL_2026_V1:year:2026')::uuid,
  'timetable_version_id', (select id from public.timetable_versions where institution_id=md5('AURORA_INTEGRAL_2026_V1:institution')::uuid and academic_year_id=md5('AURORA_INTEGRAL_2026_V1:year:2026')::uuid and status='PUBLISHED' order by published_at desc limit 1),
  'profile_ids', (select jsonb_agg(profile_id order by user_key) from aurora_seed_users),
  'student_ids', (select jsonb_agg(student_id order by student_number) from aurora_student_seed),
  'guardian_ids', (select jsonb_agg(profile_id order by user_key) from aurora_seed_users where role='GUARDIAN'),
  'class_ids', (select jsonb_agg(class_id order by class_number) from aurora_class_seed),
  'term_ids', (select jsonb_agg(id order by start_date) from public.terms where academic_year_id=md5('AURORA_INTEGRAL_2026_V1:year:2026')::uuid),
  'subject_ids', (select jsonb_agg(id order by sort_order) from public.subjects s join aurora_subject_seed seed on seed.code=s.code where s.institution_id=md5('AURORA_INTEGRAL_2026_V1:institution')::uuid),
  'offering_ids', (select jsonb_agg(id order by id) from public.subject_offerings where class_id in (select class_id from aurora_class_seed)),
  'counts', jsonb_build_object(
    'profiles', (select count(*) from aurora_seed_users),
    'students', (select count(*) from aurora_student_seed),
    'guardians', (select count(*) from aurora_seed_users where role='GUARDIAN'),
    'classes', (select count(*) from aurora_class_seed),
    'subjects', (select count(*) from aurora_subject_seed),
    'active_enrollments', (select count(*) from public.enrollments where academic_year_id=md5('AURORA_INTEGRAL_2026_V1:year:2026')::uuid and class_id in (select class_id from aurora_class_seed) and active is true),
    'attendance_records', (select count(*) from public.attendance_records where institution_id=md5('AURORA_INTEGRAL_2026_V1:institution')::uuid),
    'assessments', (select count(*) from public.assessments where institution_id=md5('AURORA_INTEGRAL_2026_V1:institution')::uuid),
    'grade_records', (select count(*) from public.grades where institution_id=md5('AURORA_INTEGRAL_2026_V1:institution')::uuid),
    'recovery_records', (select count(*) from public.student_term_recoveries where institution_id=md5('AURORA_INTEGRAL_2026_V1:institution')::uuid),
    'diary_sessions', (select count(*) from public.attendance_sessions where institution_id=md5('AURORA_INTEGRAL_2026_V1:institution')::uuid),
    'announcements', (select count(*) from public.institution_announcements where institution_id=md5('AURORA_INTEGRAL_2026_V1:institution')::uuid),
    'study_center_contents', (select count(*) from public.learning_posts where institution_id=md5('AURORA_INTEGRAL_2026_V1:institution')::uuid),
    'book_recommendations', (select count(*) from public.book_recommendations where institution_id=md5('AURORA_INTEGRAL_2026_V1:institution')::uuid)
  )
);

commit;
