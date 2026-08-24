-- QA ONLY: idempotent demo dataset for the Escola Tv institution.
-- This file is intentionally not a migration and is never executed by deploy.
-- The school-tv.test users are synthetic and may be removed after homologation.

begin;

insert into public.subjects (institution_id, name, code, workload, active)
select
  i.id,
  subject_data.name,
  subject_data.code,
  subject_data.workload,
  true
from public.institutions i
cross join (
  values
    ('Língua Portuguesa', 'LP', 200),
    ('Matemática', 'MAT', 200),
    ('Ciências', 'CIE', 120),
    ('História', 'HIS', 120),
    ('Geografia', 'GEO', 120),
    ('Arte', 'ART', 80),
    ('Educação Física', 'EDF', 80),
    ('Língua Inglesa', 'ING', 80),
    ('Biologia', 'BIO', 120),
    ('Química', 'QUI', 120),
    ('Física', 'FIS', 120),
    ('Filosofia', 'FIL', 80),
    ('Sociologia', 'SOC', 80)
) as subject_data(name, code, workload)
where i.id = '0bd4ae6f-051a-4baf-b000-3953b1eb5874'::uuid
  and not exists (
    select 1
    from public.subjects s
    where s.institution_id = i.id
      and lower(trim(s.name)) = lower(trim(subject_data.name))
  )
  and not exists (
    select 1
    from public.subjects s
    where s.code = subject_data.code
  );

insert into public.academic_years (institution_id, name, start_date, end_date, active)
select
  i.id,
  'primeiro ano',
  date '2026-01-10',
  date '2026-12-10',
  true
from public.institutions i
where i.id = '0bd4ae6f-051a-4baf-b000-3953b1eb5874'::uuid
  and not exists (
    select 1
    from public.academic_years y
    where y.institution_id = i.id
      and lower(trim(y.name)) = 'primeiro ano'
  );

insert into public.terms (academic_year_id, name, start_date, end_date, active)
select
  y.id,
  period_data.name,
  period_data.start_date,
  period_data.end_date,
  true
from public.academic_years y
cross join (
  values
    ('1º Bimestre', date '2026-01-10', date '2026-03-31'),
    ('2º Bimestre', date '2026-04-01', date '2026-06-30'),
    ('3º Bimestre', date '2026-07-01', date '2026-09-30'),
    ('4º Bimestre', date '2026-10-01', date '2026-12-10')
) as period_data(name, start_date, end_date)
where y.institution_id = '0bd4ae6f-051a-4baf-b000-3953b1eb5874'::uuid
  and lower(trim(y.name)) = 'primeiro ano'
  and not exists (
    select 1
    from public.terms t
    where t.academic_year_id = y.id
      and lower(trim(t.name)) = lower(trim(period_data.name))
  );

insert into public.curriculum_templates (institution_id, name, grade_level, stage, active)
select
  i.id,
  template_data.name,
  template_data.grade_level,
  template_data.stage,
  true
from public.institutions i
cross join (
  values
    ('QA - Ensino Fundamental I', '1º ao 5º ano', 'Ensino Fundamental - anos iniciais'),
    ('QA - Ensino Fundamental II', '6º ao 9º ano', 'Ensino Fundamental - anos finais'),
    ('QA - Ensino Médio', '1ª a 3ª série', 'Ensino Médio')
) as template_data(name, grade_level, stage)
where i.id = '0bd4ae6f-051a-4baf-b000-3953b1eb5874'::uuid
  and not exists (
    select 1
    from public.curriculum_templates t
    where t.institution_id = i.id
      and t.name = template_data.name
  );

insert into public.curriculum_template_items (
  institution_id,
  template_id,
  subject_id,
  weekly_lessons,
  lesson_duration_minutes,
  active
)
select
  t.institution_id,
  t.id,
  s.id,
  item_data.weekly_lessons,
  50,
  true
from public.curriculum_templates t
join public.subjects s
  on s.institution_id = t.institution_id
cross join (
  values
    ('QA - Ensino Fundamental I', 'LP', 5),
    ('QA - Ensino Fundamental I', 'MAT', 5),
    ('QA - Ensino Fundamental I', 'CIE', 2),
    ('QA - Ensino Fundamental I', 'HIS', 2),
    ('QA - Ensino Fundamental I', 'GEO', 2),
    ('QA - Ensino Fundamental I', 'ART', 2),
    ('QA - Ensino Fundamental I', 'EDF', 2),
    ('QA - Ensino Fundamental I', 'ING', 2),
    ('QA - Ensino Fundamental II', 'LP', 4),
    ('QA - Ensino Fundamental II', 'MAT', 4),
    ('QA - Ensino Fundamental II', 'CIE', 3),
    ('QA - Ensino Fundamental II', 'HIS', 2),
    ('QA - Ensino Fundamental II', 'GEO', 2),
    ('QA - Ensino Fundamental II', 'ART', 1),
    ('QA - Ensino Fundamental II', 'EDF', 2),
    ('QA - Ensino Fundamental II', 'ING', 2),
    ('QA - Ensino Médio', 'LP', 3),
    ('QA - Ensino Médio', 'MAT', 4),
    ('QA - Ensino Médio', 'BIO', 2),
    ('QA - Ensino Médio', 'QUI', 2),
    ('QA - Ensino Médio', 'FIS', 2),
    ('QA - Ensino Médio', 'HIS', 2),
    ('QA - Ensino Médio', 'GEO', 2),
    ('QA - Ensino Médio', 'ING', 2),
    ('QA - Ensino Médio', 'FIL', 1),
    ('QA - Ensino Médio', 'SOC', 1)
) as item_data(template_name, subject_code, weekly_lessons)
where t.institution_id = '0bd4ae6f-051a-4baf-b000-3953b1eb5874'::uuid
  and t.name = item_data.template_name
  and s.code = item_data.subject_code
  and not exists (
    select 1
    from public.curriculum_template_items existing_item
    where existing_item.template_id = t.id
      and existing_item.subject_id = s.id
  );

with grades(grade_level, base_name) as (
  values
    ('1', '1º ano'),
    ('2', '2º ano'),
    ('3', '3º ano'),
    ('4', '4º ano'),
    ('5', '5º ano'),
    ('6', '6º ano'),
    ('7', '7º ano'),
    ('8', '8º ano'),
    ('9', '9º ano'),
    ('1º EM', '1ª série EM'),
    ('2º EM', '2ª série EM'),
    ('3º EM', '3ª série EM')
), letters(value) as (
  values (1), (2)
)
insert into public.classes (
  institution_id,
  academic_year_id,
  name,
  grade_level,
  shift,
  capacity,
  active
)
select
  y.institution_id,
  y.id,
  grades.base_name || ' ' || chr(64 + letters.value),
  grades.grade_level,
  'Integral',
  30,
  true
from public.academic_years y
cross join grades
cross join letters
where y.institution_id = '0bd4ae6f-051a-4baf-b000-3953b1eb5874'::uuid
  and lower(trim(y.name)) = 'primeiro ano'
  and not exists (
    select 1
    from public.classes c
    where c.institution_id = y.institution_id
      and c.academic_year_id = y.id
      and c.name = grades.base_name || ' ' || chr(64 + letters.value)
  );

create temporary table school_tv_demo_users (
  email text primary key,
  full_name text not null,
  role public.user_role not null,
  subject_code text,
  class_id uuid
) on commit drop;

-- Create a QA teacher pool sized for the current weekly demand. The divisor of
-- 25 keeps the fixture schedulable even when classes use five daily slots.
insert into school_tv_demo_users (email, full_name, role, subject_code)
select
  'qa.professor.' || lower(s.code) || '.' || lpad(teacher_number.value::text, 2, '0') || '@school-tv.test',
  'Professor QA ' || lpad(teacher_number.value::text, 2, '0') || ' - ' || s.name,
  'TEACHER'::public.user_role,
  s.code
from public.subjects s
join (
  with class_subject_load as (
    select
      c.id as class_id,
      item.subject_id,
      max(item.weekly_lessons) as weekly_lessons
    from public.classes c
    join public.curriculum_templates template
      on template.institution_id = c.institution_id
     and (
       (c.grade_level between '1' and '5' and template.name = 'QA - Ensino Fundamental I')
       or (c.grade_level between '6' and '9' and template.name = 'QA - Ensino Fundamental II')
       or (c.grade_level in ('1º EM', '2º EM', '3º EM') and template.name = 'QA - Ensino Médio')
     )
     and template.active is true
    join public.curriculum_template_items item
      on item.template_id = template.id
     and item.institution_id = c.institution_id
     and item.active is true
    where c.institution_id = '0bd4ae6f-051a-4baf-b000-3953b1eb5874'::uuid
      and c.active is true
    group by c.id, item.subject_id
  )
  select
    subject_id,
    greatest(2, ceil(sum(weekly_lessons)::numeric / 25)::integer) as teacher_count
  from class_subject_load
  group by subject_id
) as subject_demand
  on subject_demand.subject_id = s.id
cross join lateral generate_series(1, subject_demand.teacher_count) as teacher_number(value)
where s.institution_id = '0bd4ae6f-051a-4baf-b000-3953b1eb5874'::uuid
  and s.active is true;

with student_seed as (
  select
    c.id as class_id,
    row_number() over (order by c.name, student_number.value) as sequence_number
  from public.classes c
  cross join (values (1), (2), (3)) as student_number(value)
  where c.institution_id = '0bd4ae6f-051a-4baf-b000-3953b1eb5874'::uuid
    and c.active is true
)
insert into school_tv_demo_users (email, full_name, role, class_id)
select
  'qa.aluno.' || lpad(student_seed.sequence_number::text, 3, '0') || '@school-tv.test',
  'Aluno QA ' || lpad(student_seed.sequence_number::text, 3, '0'),
  'STUDENT'::public.user_role,
  student_seed.class_id
from student_seed;

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  is_sso_user,
  is_anonymous
)
select
  '00000000-0000-0000-0000-000000000000'::uuid,
  md5(u.email)::uuid,
  'authenticated',
  'authenticated',
  u.email,
  crypt('SchoolTvQa!2026', gen_salt('bf')),
  now(),
  jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
  jsonb_build_object('email_verified', true, 'full_name', u.full_name, 'role', u.role::text),
  now(),
  now(),
  '',
  false,
  false
from school_tv_demo_users u
where not exists (
  select 1
  from auth.users existing_user
  where existing_user.email = u.email
);

insert into auth.identities (
  id,
  provider_id,
  user_id,
  identity_data,
  provider,
  created_at,
  updated_at
)
select
  md5('school-tv-identity:' || u.email)::uuid,
  md5(u.email)::uuid::text,
  md5(u.email)::uuid,
  jsonb_build_object('sub', md5(u.email)::uuid::text, 'email', u.email),
  'email',
  now(),
  now()
from school_tv_demo_users u
where not exists (
  select 1
  from auth.identities existing_identity
  where existing_identity.provider = 'email'
    and existing_identity.user_id = md5(u.email)::uuid
);

update auth.users
set email_change = '',
    email_change_token_new = '',
    recovery_token = ''
where email in (select email from school_tv_demo_users);

update auth.identities
set identity_data = jsonb_build_object(
      'sub', user_id::text,
      'email', email,
      'email_verified', false,
      'phone_verified', false
    )
where provider = 'email'
  and user_id in (select md5(email)::uuid from school_tv_demo_users);

insert into public.profiles (id, full_name, email, role, active)
select
  md5(u.email)::uuid,
  u.full_name,
  u.email,
  u.role,
  true
from school_tv_demo_users u
on conflict (id) do update
set full_name = excluded.full_name,
    role = excluded.role,
    active = true,
    updated_at = now();

insert into public.memberships (profile_id, institution_id, role, active)
select
  md5(u.email)::uuid,
  '0bd4ae6f-051a-4baf-b000-3953b1eb5874'::uuid,
  u.role,
  true
from school_tv_demo_users u
where not exists (
  select 1
  from public.memberships existing_membership
  where existing_membership.profile_id = md5(u.email)::uuid
    and existing_membership.institution_id = '0bd4ae6f-051a-4baf-b000-3953b1eb5874'::uuid
    and existing_membership.role = u.role
);

insert into public.teacher_subjects (institution_id, teacher_profile_id, subject_id, primary_subject, active)
select
  '0bd4ae6f-051a-4baf-b000-3953b1eb5874'::uuid,
  md5(u.email)::uuid,
  s.id,
  true,
  true
from school_tv_demo_users u
join public.subjects s
  on s.institution_id = '0bd4ae6f-051a-4baf-b000-3953b1eb5874'::uuid
 and s.code = u.subject_code
where u.role = 'TEACHER'::public.user_role
  and not exists (
    select 1
    from public.teacher_subjects existing_link
    where existing_link.institution_id = '0bd4ae6f-051a-4baf-b000-3953b1eb5874'::uuid
      and existing_link.teacher_profile_id = md5(u.email)::uuid
      and existing_link.subject_id = s.id
      and existing_link.active is true
  );

insert into public.class_curriculum_items (
  institution_id,
  class_id,
  subject_id,
  weekly_lessons,
  lesson_duration_minutes,
  needs_review,
  active
)
select distinct on (c.id, item.subject_id)
  c.institution_id,
  c.id,
  item.subject_id,
  item.weekly_lessons,
  item.lesson_duration_minutes,
  false,
  true
from public.classes c
join public.curriculum_templates template
  on template.institution_id = c.institution_id
 and (
   (c.grade_level between '1' and '5' and template.name = 'QA - Ensino Fundamental I')
   or (c.grade_level between '6' and '9' and template.name = 'QA - Ensino Fundamental II')
   or (c.grade_level in ('1º EM', '2º EM', '3º EM') and template.name = 'QA - Ensino Médio')
 )
join public.curriculum_template_items item
  on item.template_id = template.id
 and item.institution_id = c.institution_id
where c.institution_id = '0bd4ae6f-051a-4baf-b000-3953b1eb5874'::uuid
order by c.id, item.subject_id, template.id
on conflict (class_id, subject_id) do update
set weekly_lessons = excluded.weekly_lessons,
    lesson_duration_minutes = excluded.lesson_duration_minutes,
    needs_review = false,
    active = true,
    updated_at = now();

insert into public.students (profile_id, institution_id, registration_number, birth_date, active)
select
  md5(u.email)::uuid,
  '0bd4ae6f-051a-4baf-b000-3953b1eb5874'::uuid,
  'TV-QA-' || split_part(split_part(u.email, '@', 1), '.', 3),
  date '2010-01-01',
  true
from school_tv_demo_users u
where u.role = 'STUDENT'
  and not exists (
    select 1
    from public.students existing_student
    where existing_student.profile_id = md5(u.email)::uuid
  );

insert into public.enrollments (student_id, class_id, academic_year_id, status, active)
select
  st.id,
  u.class_id,
  y.id,
  'active',
  true
from school_tv_demo_users u
join public.students st
  on st.profile_id = md5(u.email)::uuid
join public.academic_years y
  on y.institution_id = '0bd4ae6f-051a-4baf-b000-3953b1eb5874'::uuid
 and lower(trim(y.name)) = 'primeiro ano'
where u.role = 'STUDENT'
  and not exists (
    select 1
    from public.enrollments existing_enrollment
    where existing_enrollment.student_id = st.id
      and existing_enrollment.class_id = u.class_id
      and existing_enrollment.academic_year_id = y.id
  );

create temporary table school_tv_demo_teacher_assignments (
  class_id uuid not null,
  subject_id uuid not null,
  teacher_profile_id uuid not null,
  primary key (class_id, subject_id)
) on commit drop;

with teacher_pool as (
  select
    s.id as subject_id,
    md5(u.email)::uuid as teacher_profile_id,
    row_number() over (partition by s.id order by u.email) - 1 as teacher_index,
    count(*) over (partition by s.id) as teacher_count
  from school_tv_demo_users u
  join public.subjects s
    on s.institution_id = '0bd4ae6f-051a-4baf-b000-3953b1eb5874'::uuid
   and s.code = u.subject_code
  where u.role = 'TEACHER'::public.user_role
), class_subject_pairs as (
  select distinct
    item.class_id,
    item.subject_id
  from public.class_curriculum_items item
  join public.classes c
    on c.id = item.class_id
   and c.institution_id = item.institution_id
   and c.active is true
  where item.institution_id = '0bd4ae6f-051a-4baf-b000-3953b1eb5874'::uuid
    and item.active is true
), ranked_pairs as (
  select
    class_id,
    subject_id,
    row_number() over (partition by subject_id order by class_id) - 1 as assignment_index
  from class_subject_pairs
)
insert into school_tv_demo_teacher_assignments (class_id, subject_id, teacher_profile_id)
select
  ranked.class_id,
  ranked.subject_id,
  pool.teacher_profile_id
from ranked_pairs ranked
join teacher_pool pool
  on pool.subject_id = ranked.subject_id
 and pool.teacher_index = mod(ranked.assignment_index, pool.teacher_count);

create temporary table school_tv_demo_target_offerings on commit drop as
select
  assignment.subject_id,
  assignment.class_id,
  assignment.teacher_profile_id,
  term.id as term_id
from school_tv_demo_teacher_assignments assignment
join public.classes class_record
  on class_record.id = assignment.class_id
join public.terms term
  on term.academic_year_id = class_record.academic_year_id
 and term.active is true;

-- Rebalance only synthetic QA assignments. Real/manual teacher choices remain intact.
update public.subject_offerings offering
set teacher_profile_id = target.teacher_profile_id,
    updated_at = now()
from school_tv_demo_target_offerings target
where offering.class_id = target.class_id
  and offering.subject_id = target.subject_id
  and offering.term_id = target.term_id
  and offering.active is true
  and offering.teacher_profile_id in (
    select profile.id
    from public.profiles profile
    where profile.email like 'qa.professor.%@school-tv.test'
  );

insert into public.subject_offerings (subject_id, class_id, teacher_profile_id, term_id, active)
select
  target.subject_id,
  target.class_id,
  target.teacher_profile_id,
  target.term_id,
  true
from school_tv_demo_target_offerings target
where not exists (
  select 1
  from public.subject_offerings existing_offering
  where existing_offering.subject_id = target.subject_id
    and existing_offering.class_id = target.class_id
    and existing_offering.term_id = target.term_id
    and existing_offering.active is true
);

commit;

select json_build_object(
  'institution', 'Escola Tv',
  'classes', (select count(*) from public.classes where institution_id = '0bd4ae6f-051a-4baf-b000-3953b1eb5874'::uuid and active is true),
  'teachers', (select count(*) from public.memberships where institution_id = '0bd4ae6f-051a-4baf-b000-3953b1eb5874'::uuid and role = 'TEACHER'::public.user_role and active is true),
  'teacher_subject_links', (select count(*) from public.teacher_subjects where institution_id = '0bd4ae6f-051a-4baf-b000-3953b1eb5874'::uuid and active is true),
  'students', (select count(*) from public.students where institution_id = '0bd4ae6f-051a-4baf-b000-3953b1eb5874'::uuid and active is true),
  'enrollments', (select count(*) from public.enrollments where class_id in (select id from public.classes where institution_id = '0bd4ae6f-051a-4baf-b000-3953b1eb5874'::uuid) and active is true),
  'offerings', (select count(*) from public.subject_offerings where class_id in (select id from public.classes where institution_id = '0bd4ae6f-051a-4baf-b000-3953b1eb5874'::uuid) and active is true)
) as school_tv_demo_snapshot;
