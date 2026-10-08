-- TecEscola demo data for the existing Colégio Helita Vieira institution.
-- This fixture does not create accounts, people, classes, subjects, offerings,
-- or timetable data. It only complements the existing academic structure.

begin;

create temporary table helita_context on commit drop as
select id as institution_id
from public.institutions
where id = '1663123e-5046-41c5-a7db-f712da058536'::uuid
  and lower(trim(name)) = lower(trim('Colégio Helita Vieira'))
  and active is true;

do $$
declare
  institution_count integer;
begin
  select count(*) into institution_count from helita_context;
  if institution_count <> 1 then
    raise exception 'HELITA_INSTITUTION_SCOPE_INVALID:%', institution_count;
  end if;
end;
$$;

create temporary table helita_years on commit drop as
select id, institution_id
from public.academic_years
where institution_id = (select institution_id from helita_context)
  and name = '2026';

create temporary table helita_terms on commit drop as
select
  term.id,
  term.academic_year_id,
  term.name,
  term.start_date,
  term.end_date,
  row_number() over (order by term.start_date)::integer as term_no
from public.terms term
join helita_years year_row on year_row.id = term.academic_year_id;

create temporary table helita_classes on commit drop as
select id, name, grade_level
from public.classes
where institution_id = (select institution_id from helita_context)
  and active is true;

create temporary table helita_subjects on commit drop as
select
  subject.id,
  subject.code,
  subject.name,
  row_number() over (order by subject.code)::integer as subject_rank
from public.subjects subject
where subject.institution_id = (select institution_id from helita_context)
  and subject.active is true;

create temporary table helita_students on commit drop as
select
  student.id as student_id,
  enrollment.class_id,
  row_number() over (order by school_class.name, student.registration_number, student.id)::integer as student_rank
from public.students student
join public.enrollments enrollment
  on enrollment.student_id = student.id
 and enrollment.active is true
 and enrollment.status = 'ACTIVE'
join helita_classes school_class on school_class.id = enrollment.class_id
join helita_years year_row on year_row.id = enrollment.academic_year_id
where student.institution_id = (select institution_id from helita_context)
  and student.active is true;

create temporary table helita_offerings on commit drop as
select
  offering.id,
  offering.subject_id,
  offering.class_id,
  offering.teacher_profile_id,
  offering.term_id,
  term.term_no,
  term.start_date,
  term.end_date,
  subject.code,
  subject.subject_rank
from public.subject_offerings offering
join helita_terms term on term.id = offering.term_id
join helita_subjects subject on subject.id = offering.subject_id
join helita_classes school_class on school_class.id = offering.class_id
where offering.active is true;

create temporary table helita_timetable on commit drop as
select
  entry.id as entry_id,
  entry.term_id,
  entry.class_id,
  entry.subject_offering_id,
  entry.day_of_week,
  entry.start_time,
  entry.end_time
from public.timetable_version_entries entry
join public.timetable_versions version_row on version_row.id = entry.version_id
where version_row.id = (
    select id
    from public.timetable_versions
    where institution_id = (select institution_id from helita_context)
      and status = 'PUBLISHED'
    order by published_at desc nulls last, id desc
    limit 1
  )
  and entry.institution_id = (select institution_id from helita_context)
  and entry.active is true;

do $$
declare
  class_count integer;
  student_count integer;
  subject_count integer;
  offering_count integer;
  timetable_count integer;
begin
  select count(*) into class_count from helita_classes;
  select count(*) into student_count from helita_students;
  select count(*) into subject_count from helita_subjects;
  select count(*) into offering_count from helita_offerings;
  select count(*) into timetable_count from helita_timetable;
  if class_count <> 3 then raise exception 'HELITA_CLASS_STRUCTURE_MISMATCH:%', class_count; end if;
  if student_count <> 30 then raise exception 'HELITA_STUDENT_STRUCTURE_MISMATCH:%', student_count; end if;
  if subject_count <> 12 then raise exception 'HELITA_SUBJECT_STRUCTURE_MISMATCH:%', subject_count; end if;
  if offering_count <> 144 then raise exception 'HELITA_OFFERING_STRUCTURE_MISMATCH:%', offering_count; end if;
  if timetable_count = 0 then raise exception 'HELITA_PUBLISHED_TIMETABLE_MISSING'; end if;
end;
$$;

-- The existing demo enrollments were created at the current date. Move only
-- their effective date to the start of the same academic year so historical
-- grades and attendance pass the database integrity rules.
update public.enrollments enrollment
set enrolled_at = timestamptz '2026-01-07 00:00:00-03',
    updated_at = now()
where enrollment.class_id in (select id from helita_classes)
  and enrollment.academic_year_id = (select id from helita_years limit 1)
  and enrollment.active is true
  and upper(enrollment.status) = 'ACTIVE'
  and enrollment.enrolled_at > timestamptz '2026-01-07 00:00:00-03';

-- Calls are generated from the published timetable. The fourth bimestre is
-- intentionally partial and never creates a session after 2026-10-07.
insert into public.attendance_sessions (
  id,
  institution_id,
  subject_offering_id,
  session_date,
  starts_at,
  ends_at,
  topic,
  notes,
  status,
  created_by,
  closed_at,
  class_activity,
  homework
)
select
  md5('HELITA_VIEIRA_FULL_DEMO_2026_V1:session:' || timetable.entry_id || ':' || occurrence.n)::uuid,
  context.institution_id,
  timetable.subject_offering_id,
  occurrence_date.session_date,
  timetable.start_time,
  timetable.end_time,
  case offering.code
    when 'MAT' then 'Resolução de situações-problema e interpretação de dados.'
    when 'LP' then 'Leitura, argumentação e produção de sínteses.'
    when 'FIS' then 'Modelagem de fenômenos e análise de evidências.'
    when 'QUI' then 'Investigação de transformações e propriedades da matéria.'
    when 'BIO' then 'Observação de sistemas vivos e construção de hipóteses.'
    else 'Estudo orientado, participação e consolidação das aprendizagens.'
  end,
  case when term.term_no >= 3
    then 'Registro pedagógico do período recente.'
    else 'Registro pedagógico do bimestre e encaminhamentos da turma.'
  end,
  'CLOSED',
  offering.teacher_profile_id,
  ((occurrence_date.session_date + timetable.end_time) at time zone 'America/Sao_Paulo'),
  case offering.code
    when 'MAT' then 'Atividade guiada com resolução compartilhada.'
    when 'LP' then 'Leitura orientada e debate em pequenos grupos.'
    else 'Atividade prática com registro no caderno.'
  end,
  case offering.code
    when 'MAT' then 'Resolver os exercícios selecionados e justificar uma estratégia.'
    when 'LP' then 'Registrar uma evidência do texto e uma pergunta para o debate.'
    else 'Revisar os apontamentos e registrar uma dúvida para a próxima aula.'
  end
from helita_context context
join helita_timetable timetable on true
join helita_offerings offering on offering.id = timetable.subject_offering_id
join helita_terms term on term.id = timetable.term_id
cross join lateral generate_series(
  0,
  case when term.term_no in (1, 2) then 7 when term.term_no = 3 then 11 else 4 end
) occurrence(n)
cross join lateral (
  select term.start_date
    + (((timetable.day_of_week - extract(isodow from term.start_date)::integer + 7) % 7)
    + occurrence.n * 7) as session_date
) occurrence_date
where occurrence_date.session_date between term.start_date and least(term.end_date, date '2026-10-07')
on conflict (id) do update set
  session_date = excluded.session_date,
  starts_at = excluded.starts_at,
  ends_at = excluded.ends_at,
  topic = excluded.topic,
  notes = excluded.notes,
  status = excluded.status,
  created_by = excluded.created_by,
  closed_at = excluded.closed_at,
  class_activity = excluded.class_activity,
  homework = excluded.homework,
  updated_at = now();

insert into public.attendance_records (
  id,
  institution_id,
  attendance_session_id,
  student_id,
  status,
  notes,
  recorded_by
)
select
  md5('HELITA_VIEIRA_FULL_DEMO_2026_V1:attendance:' || session_row.id || ':' || student_row.student_id)::uuid,
  context.institution_id,
  session_row.id,
  student_row.student_id,
  case
    when student_row.student_rank % 10 = 0
      and (extract(day from session_row.session_date)::integer + student_row.student_rank + extract(hour from session_row.starts_at)::integer) % 3 = 0 then 'ABSENT'
    when student_row.student_rank % 10 in (8, 9)
      and (extract(day from session_row.session_date)::integer + student_row.student_rank + extract(hour from session_row.starts_at)::integer) % 11 = 0 then 'ABSENT'
    when student_row.student_rank % 10 in (7, 8, 9)
      and (extract(day from session_row.session_date)::integer + student_row.student_rank) % 17 = 0 then 'LATE'
    when (extract(day from session_row.session_date)::integer + student_row.student_rank + extract(hour from session_row.starts_at)::integer) % 31 = 0 then 'ABSENT'
    else 'PRESENT'
  end,
  case
    when student_row.student_rank % 10 in (0, 8, 9)
      and (extract(day from session_row.session_date)::integer + student_row.student_rank) % 11 = 0
      then 'Ausência registrada no acompanhamento de frequência.'
    when student_row.student_rank % 10 in (7, 8, 9)
      and (extract(day from session_row.session_date)::integer + student_row.student_rank) % 17 = 0
      then 'Atraso registrado na chegada.'
    else null
  end,
  offering.teacher_profile_id
from helita_context context
join public.attendance_sessions session_row on session_row.institution_id = context.institution_id
join helita_offerings offering on offering.id = session_row.subject_offering_id
join helita_students student_row on student_row.class_id = offering.class_id
on conflict (id) do update set
  status = excluded.status,
  notes = excluded.notes,
  recorded_by = excluded.recorded_by,
  updated_at = now();

insert into public.assessments (
  id,
  institution_id,
  subject_offering_id,
  term_id,
  title,
  description,
  assessment_type,
  assessment_date,
  max_score,
  weight,
  status,
  created_by,
  published_at
)
select
  md5('HELITA_VIEIRA_FULL_DEMO_2026_V1:assessment:' || offering.id || ':' || term.term_no || ':' || assessment_seed.assessment_no)::uuid,
  context.institution_id,
  offering.id,
  term.id,
  assessment_seed.title,
  'Instrumento avaliativo com critérios publicados para acompanhamento da turma.',
  assessment_seed.assessment_type,
  case
    when term.term_no = 4 then date '2026-10-06'
    else least(term.end_date - 3, term.start_date + assessment_seed.day_offset)
  end,
  10,
  1,
  'PUBLISHED',
  offering.teacher_profile_id,
  (((case
    when term.term_no = 4 then date '2026-10-06'
    else least(term.end_date - 3, term.start_date + assessment_seed.day_offset)
  end) + time '12:00') at time zone 'America/Sao_Paulo')
from helita_context context
join helita_offerings offering on true
join helita_terms term on term.id = offering.term_id
cross join lateral (
  values
    (1, 'Avaliação de aprendizagem', 'EXAM', 28),
    (2, 'Atividade aplicada', 'ASSIGNMENT', 56)
) assessment_seed(assessment_no, title, assessment_type, day_offset)
where (term.term_no <= 3 or assessment_seed.assessment_no = 1)
  and not exists (
    select 1
    from public.term_closures closure
    where closure.institution_id = context.institution_id
      and closure.term_id = term.id
      and closure.subject_offering_id = offering.id
      and closure.status = 'CLOSED'
  )
on conflict (id) do nothing;

insert into public.grades (
  id,
  institution_id,
  assessment_id,
  student_id,
  score,
  status,
  feedback,
  recorded_by,
  recorded_at
)
select
  md5('HELITA_VIEIRA_FULL_DEMO_2026_V1:grade:' || assessment.id || ':' || student_row.student_id)::uuid,
  context.institution_id,
  assessment.id,
  student_row.student_id,
  case
    when term.term_no = 4 and student_row.student_rank % 5 = 0 then null
    when student_row.student_rank % 10 = 0 then round((4.2 + ((student_row.student_rank + subject.subject_rank + assessment_no.assessment_no) % 6) * 0.15)::numeric, 1)
    when student_row.student_rank % 10 in (8, 9) and subject.code in ('MAT', 'FIS', 'QUI') then round((5.2 + ((student_row.student_rank + subject.subject_rank + assessment_no.assessment_no) % 7) * 0.15)::numeric, 1)
    when student_row.student_rank % 10 in (8, 9) then round((6.0 + ((student_row.student_rank + subject.subject_rank + assessment_no.assessment_no) % 7) * 0.15)::numeric, 1)
    when student_row.student_rank % 10 in (1, 2) then round((8.6 + ((student_row.student_rank + subject.subject_rank + assessment_no.assessment_no) % 10) * 0.1)::numeric, 1)
    else round((7.0 + ((student_row.student_rank + subject.subject_rank + assessment_no.assessment_no) % 10) * 0.1)::numeric, 1)
  end,
  case when term.term_no = 4 and student_row.student_rank % 5 = 0 then 'PENDING' else 'GRADED' end,
  case when term.term_no = 4 and student_row.student_rank % 5 = 0
    then 'Lançamento pendente do período atual.'
    else 'Resultado lançado com devolutiva orientadora.'
  end,
  offering.teacher_profile_id,
  ((assessment.assessment_date + time '16:00') at time zone 'America/Sao_Paulo')
from helita_context context
join public.assessments assessment on assessment.institution_id = context.institution_id
join helita_offerings offering on offering.id = assessment.subject_offering_id
join helita_terms term on term.id = assessment.term_id
join helita_subjects subject on subject.id = offering.subject_id
join helita_students student_row on student_row.class_id = offering.class_id
cross join lateral (
  select case when assessment.title = 'Atividade aplicada' then 2 else 1 end as assessment_no
) assessment_no
where not exists (
  select 1
  from public.term_closures closure
  where closure.institution_id = context.institution_id
    and closure.term_id = term.id
    and closure.subject_offering_id = offering.id
    and closure.status = 'CLOSED'
)
on conflict (id) do nothing;

-- Close the first three bimesters through the official workflow so the
-- system calculates student_term_results and report-card data itself.
do $$
declare
  offering_row record;
  director_id uuid;
begin
  select profile_id into director_id
  from public.memberships
  where institution_id = (select institution_id from helita_context)
    and role = 'DIRECTOR'
    and active is true
  order by profile_id
  limit 1;

  if director_id is null then raise exception 'HELITA_DIRECTOR_MISSING'; end if;
  perform set_config('request.jwt.claim.sub', director_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  for offering_row in
    select offering.id as offering_id, offering.term_id
    from helita_offerings offering
    where offering.term_no <= 3
    order by offering.term_no, offering.class_id, offering.subject_id
  loop
    if not exists (
      select 1 from public.term_closures closure
      where closure.institution_id = (select institution_id from helita_context)
        and closure.subject_offering_id = offering_row.offering_id
        and closure.term_id = offering_row.term_id
        and closure.status = 'CLOSED'
    ) then
      perform public.submit_term_closure(
        (select institution_id from helita_context),
        (select id from helita_years limit 1),
        offering_row.term_id,
        offering_row.offering_id
      );
      perform public.close_term_closure(
        (select institution_id from helita_context),
        (select id from helita_years limit 1),
        offering_row.term_id,
        offering_row.offering_id
      );
    end if;
  end loop;
end;
$$;

-- A small number of recovery cases make the report-card and council flows
-- demonstrable without changing credentials or academic structure.
do $$
declare
  recovery_row record;
  director_id uuid;
begin
  select profile_id into director_id
  from public.memberships
  where institution_id = (select institution_id from helita_context)
    and role = 'DIRECTOR'
    and active is true
  order by profile_id
  limit 1;
  perform set_config('request.jwt.claim.sub', director_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  for recovery_row in
    select
      result.student_id,
      result.subject_offering_id,
      result.term_id,
      offering.teacher_profile_id,
      closure.id as closure_id
    from public.student_term_results result
    join helita_offerings offering on offering.id = result.subject_offering_id
    join helita_students student_seed
      on student_seed.student_id = result.student_id
     and student_seed.student_rank in (8, 9, 10)
    join public.term_closures closure
      on closure.institution_id = result.institution_id
     and closure.academic_year_id = result.academic_year_id
     and closure.term_id = result.term_id
     and closure.subject_offering_id = result.subject_offering_id
     and closure.status = 'CLOSED'
    where result.institution_id = (select institution_id from helita_context)
      and offering.term_no = 2
      and offering.code = 'MAT'
      and result.result_status in ('FAILED_BY_GRADE', 'FAILED_BY_GRADE_AND_ATTENDANCE')
      and not exists (
        select 1
        from public.student_term_recoveries existing_recovery
        where existing_recovery.institution_id = result.institution_id
          and existing_recovery.student_id = result.student_id
          and existing_recovery.subject_offering_id = result.subject_offering_id
          and existing_recovery.term_id = result.term_id
          and existing_recovery.status = 'PUBLISHED'
      )
    order by result.student_id
    limit 3
  loop
    if not exists (
      select 1 from public.student_term_recoveries recovery
      where recovery.institution_id = (select institution_id from helita_context)
        and recovery.student_id = recovery_row.student_id
        and recovery.subject_offering_id = recovery_row.subject_offering_id
        and recovery.term_id = recovery_row.term_id
        and recovery.status = 'PUBLISHED'
    ) then
      if exists (
        select 1
        from public.term_closures closure
        where closure.id = recovery_row.closure_id
          and closure.status = 'CLOSED'
      ) then
        perform public.reopen_term_closure(
          (select institution_id from helita_context),
          recovery_row.closure_id,
          'Revisão pedagógica sintética do conselho de classe do 2º bimestre.'
        );
      end if;
      perform set_config('request.jwt.claim.sub', recovery_row.teacher_profile_id::text, true);
      perform public.save_academic_recovery(
        (select institution_id from helita_context),
        (select id from helita_years limit 1),
        recovery_row.term_id,
        recovery_row.subject_offering_id,
        recovery_row.student_id,
        72,
        'DRAFT',
        'Recuperação com retomada de conceitos essenciais e acompanhamento quinzenal.'
      );
      perform public.save_academic_recovery(
        (select institution_id from helita_context),
        (select id from helita_years limit 1),
        recovery_row.term_id,
        recovery_row.subject_offering_id,
        recovery_row.student_id,
        72,
        'PUBLISHED',
        'Recuperação com retomada de conceitos essenciais e acompanhamento quinzenal.'
      );
      perform set_config('request.jwt.claim.sub', director_id::text, true);
    end if;
  end loop;

  for recovery_row in
    select distinct recovery.subject_offering_id, recovery.term_id
    from public.student_term_recoveries recovery
    join public.term_closures closure
      on closure.institution_id = recovery.institution_id
     and closure.academic_year_id = recovery.academic_year_id
     and closure.term_id = recovery.term_id
     and closure.subject_offering_id = recovery.subject_offering_id
     and closure.status = 'REOPENED'
    where recovery.institution_id = (select institution_id from helita_context)
      and recovery.status = 'PUBLISHED'
  loop
    perform public.close_term_closure(
      (select institution_id from helita_context),
      (select id from helita_years limit 1),
      recovery_row.term_id,
      recovery_row.subject_offering_id
    );
  end loop;
end;
$$;

do $$
declare
  director_id uuid;
  class_two_id uuid;
  class_three_id uuid;
  term_two_id uuid;
  term_three_id uuid;
  council_row record;
  teacher_one uuid;
  teacher_two uuid;
  teacher_three uuid;
begin
  select profile_id into director_id
  from public.memberships
  where institution_id = (select institution_id from helita_context)
    and role = 'DIRECTOR'
    and active is true
  order by profile_id
  limit 1;
  select id into class_two_id from helita_classes where name = '2ª série EM' limit 1;
  select id into class_three_id from helita_classes where name = '3ª série EM' limit 1;
  select id into term_two_id from helita_terms where term_no = 2;
  select id into term_three_id from helita_terms where term_no = 3;
  select teacher_profile_id into teacher_one from helita_offerings where class_id = class_two_id and term_id = term_three_id and code = 'MAT' limit 1;
  select teacher_profile_id into teacher_two from helita_offerings where class_id = class_two_id and term_id = term_three_id and code = 'LP' limit 1;
  select teacher_profile_id into teacher_three from helita_offerings where class_id = class_three_id and term_id = term_two_id and code = 'MAT' limit 1;

  insert into public.class_councils (id, institution_id, academic_year_id, term_id, class_id, status, scheduled_at, opened_at, completed_at, general_notes, created_by, opened_by, completed_by)
  values
    (md5('HELITA_VIEIRA_FULL_DEMO_2026_V1:council:3EM:T2')::uuid, (select institution_id from helita_context), (select id from helita_years limit 1), term_two_id, class_three_id, 'OPEN', timestamptz '2026-07-10 14:00:00-03', timestamptz '2026-07-10 14:00:00-03', null, 'Conselho concluído com foco em aprendizagem, frequência e encaminhamentos do semestre.', director_id, director_id, null),
    (md5('HELITA_VIEIRA_FULL_DEMO_2026_V1:council:2EM:T3')::uuid, (select institution_id from helita_context), (select id from helita_years limit 1), term_three_id, class_two_id, 'OPEN', timestamptz '2026-09-12 14:00:00-03', timestamptz '2026-09-12 14:00:00-03', null, 'Conselho aberto para acompanhamento dos dados parciais e combinação de próximos passos.', director_id, director_id, null)
  on conflict (id) do update set
    scheduled_at = excluded.scheduled_at,
    general_notes = excluded.general_notes,
    updated_at = now();

  insert into public.class_council_participants (id, institution_id, council_id, profile_id, participant_role, added_by)
  values
    (md5('HELITA_VIEIRA_FULL_DEMO_2026_V1:council-participant:2EM:director')::uuid, (select institution_id from helita_context), md5('HELITA_VIEIRA_FULL_DEMO_2026_V1:council:2EM:T3')::uuid, director_id, 'DIRECTOR', director_id),
    (md5('HELITA_VIEIRA_FULL_DEMO_2026_V1:council-participant:2EM:teacher1')::uuid, (select institution_id from helita_context), md5('HELITA_VIEIRA_FULL_DEMO_2026_V1:council:2EM:T3')::uuid, teacher_one, 'TEACHER', director_id),
    (md5('HELITA_VIEIRA_FULL_DEMO_2026_V1:council-participant:2EM:teacher2')::uuid, (select institution_id from helita_context), md5('HELITA_VIEIRA_FULL_DEMO_2026_V1:council:2EM:T3')::uuid, teacher_two, 'TEACHER', director_id)
  on conflict (id) do nothing;

  if exists (
    select 1
    from public.class_councils council
    where council.id = md5('HELITA_VIEIRA_FULL_DEMO_2026_V1:council:3EM:T2')::uuid
      and council.status in ('DRAFT', 'OPEN')
  ) then
    insert into public.class_council_participants (id, institution_id, council_id, profile_id, participant_role, added_by)
    values
      (md5('HELITA_VIEIRA_FULL_DEMO_2026_V1:council-participant:3EM:director')::uuid, (select institution_id from helita_context), md5('HELITA_VIEIRA_FULL_DEMO_2026_V1:council:3EM:T2')::uuid, director_id, 'DIRECTOR', director_id),
      (md5('HELITA_VIEIRA_FULL_DEMO_2026_V1:council-participant:3EM:teacher1')::uuid, (select institution_id from helita_context), md5('HELITA_VIEIRA_FULL_DEMO_2026_V1:council:3EM:T2')::uuid, teacher_three, 'TEACHER', director_id)
    on conflict (id) do nothing;
  end if;

  for council_row in
    select * from (values
      (md5('HELITA_VIEIRA_FULL_DEMO_2026_V1:council:3EM:T2')::uuid, class_three_id, term_two_id, 'OFFICIAL'::text),
      (md5('HELITA_VIEIRA_FULL_DEMO_2026_V1:council:2EM:T3')::uuid, class_two_id, term_three_id, 'PARTIAL'::text)
    ) as council(council_id, class_id, term_id, data_status)
  loop
    if exists (
      select 1
      from public.class_councils council
      where council.id = council_row.council_id
        and council.status in ('DRAFT', 'OPEN')
    ) then
      insert into public.class_council_student_notes (
      id, institution_id, council_id, student_id, student_name, registration_number,
      class_name, average_grade, attendance_percentage, low_performance_subjects,
      low_attendance_subjects, pending_items, risk_level, risk_reasons, data_status,
      teacher_contributions, observation, resolution, follow_up_category, follow_up_text, updated_by
    )
    select
      md5('HELITA_VIEIRA_FULL_DEMO_2026_V1:council-note:' || council_row.council_id || ':' || student.id)::uuid,
      context.institution_id,
      council_row.council_id,
      student.id,
      profile.full_name,
      student.registration_number,
      school_class.name,
      round(avg(result.final_grade_percentage), 1),
      round(avg(result.attendance_percentage), 1),
      count(*) filter (where coalesce(result.final_grade_percentage, result.grade_percentage) < 60),
      count(*) filter (where result.attendance_percentage < 75),
      count(*) filter (where coalesce(result.final_grade_percentage, result.grade_percentage) is null),
      case
        when avg(result.final_grade_percentage) < 60 and avg(result.attendance_percentage) < 75 then 'CRITICAL'
        when avg(result.final_grade_percentage) < 60 or avg(result.attendance_percentage) < 75 then 'ATTENTION'
        else 'NORMAL'
      end,
      case
        when avg(result.final_grade_percentage) < 60 and avg(result.attendance_percentage) < 75 then jsonb_build_array('frequência abaixo da referência', 'necessita plano de estudos')
        when avg(result.final_grade_percentage) < 60 then jsonb_build_array('consolidar conteúdos prioritários')
        when avg(result.attendance_percentage) < 75 then jsonb_build_array('frequência abaixo da referência')
        else '[]'::jsonb
      end,
      council_row.data_status,
      jsonb_build_object('equipe_docente', 'Acompanhamento formativo registrado pelos professores da turma.'),
      case when avg(result.final_grade_percentage) < 60 or avg(result.attendance_percentage) < 75 then 'Revisar rotina de estudos e combinar metas quinzenais.' else 'Bom desempenho geral e participação consistente nas atividades.' end,
      case when avg(result.final_grade_percentage) < 60 or avg(result.attendance_percentage) < 75 then 'Acompanhar devolutivas e participação nas próximas atividades.' else 'Manter estratégias de aprendizagem e participação.' end,
      case when avg(result.final_grade_percentage) < 60 and avg(result.attendance_percentage) < 75 then 'INDIVIDUAL_PLAN' when avg(result.final_grade_percentage) < 60 or avg(result.attendance_percentage) < 75 then 'MONITOR' else 'NONE' end,
      case when avg(result.final_grade_percentage) < 60 or avg(result.attendance_percentage) < 75 then 'Revisão quinzenal com registro de avanços.' else null end,
      director_id
    from helita_context context
    join public.students student on student.institution_id = context.institution_id and student.active
    join public.profiles profile on profile.id = student.profile_id
    join public.enrollments enrollment on enrollment.student_id = student.id and enrollment.class_id = council_row.class_id and enrollment.active and enrollment.status = 'ACTIVE'
    join public.classes school_class on school_class.id = council_row.class_id
    left join public.student_term_results result on result.institution_id = context.institution_id and result.student_id = student.id and result.term_id = council_row.term_id
    group by context.institution_id, student.id, profile.full_name, student.registration_number, school_class.name
      on conflict (id) do nothing;
    end if;
  end loop;

  perform set_config('request.jwt.claim.sub', director_id::text, true);
  if exists (
    select 1
    from public.class_councils council
    where council.id = md5('HELITA_VIEIRA_FULL_DEMO_2026_V1:council:3EM:T2')::uuid
      and council.status = 'OPEN'
  ) then
    perform public.complete_class_council(
      md5('HELITA_VIEIRA_FULL_DEMO_2026_V1:council:3EM:T2')::uuid
    );
  end if;
end;
$$;

insert into public.institution_announcements (
  id, institution_id, title, message, audience, active, starts_at, ends_at, created_by
)
select
  md5('HELITA_VIEIRA_FULL_DEMO_2026_V1:announcement:' || seed.item_no)::uuid,
  context.institution_id,
  seed.title,
  seed.message,
  seed.audience,
  true,
  seed.starts_at,
  seed.ends_at,
  director_id.profile_id
from helita_context context
cross join lateral (select profile_id from public.memberships where institution_id = context.institution_id and role = 'DIRECTOR' and active order by profile_id limit 1) director_id
cross join (values
  (1, 'Acompanhamento do 4º bimestre', 'Acompanhe as atividades, a frequência e os resultados parciais desta etapa.', 'ALL', timestamptz '2026-10-05 07:00:00-03', timestamptz '2026-10-31 23:59:00-03'),
  (2, 'Reunião de responsáveis', 'Encontro para conversar sobre frequência, resultados e próximos passos dos estudantes.', 'GUARDIANS', timestamptz '2026-09-20 07:00:00-03', timestamptz '2026-10-15 23:59:00-03'),
  (3, 'Semana de estudos orientados', 'Use as devolutivas das avaliações para organizar uma rotina de revisão.', 'STUDENTS', timestamptz '2026-09-20 07:00:00-03', timestamptz '2026-10-20 23:59:00-03')
) seed(item_no, title, message, audience, starts_at, ends_at)
on conflict (id) do update set title = excluded.title, message = excluded.message, audience = excluded.audience, active = true, starts_at = excluded.starts_at, ends_at = excluded.ends_at, created_by = excluded.created_by, updated_at = now();

insert into public.academic_calendar_events (
  id, institution_id, academic_year_id, title, description, event_type, starts_at, ends_at, all_day, audience, active, created_by
)
select
  md5('HELITA_VIEIRA_FULL_DEMO_2026_V1:event:' || seed.item_no)::uuid,
  context.institution_id,
  (select id from helita_years limit 1),
  seed.title,
  seed.description,
  seed.event_type,
  seed.starts_at,
  seed.ends_at,
  false,
  seed.audience,
  true,
  director_id.profile_id
from helita_context context
cross join lateral (select profile_id from public.memberships where institution_id = context.institution_id and role = 'DIRECTOR' and active order by profile_id limit 1) director_id
cross join (values
  (1, 'Semana de avaliações parciais', 'Período de atividades avaliativas e devolutivas das turmas.', 'ASSESSMENT'::public.academic_calendar_event_type, 'STUDENTS'::public.academic_calendar_audience, timestamptz '2026-09-21 07:30:00-03', timestamptz '2026-09-25 16:40:00-03'),
  (2, 'Conselho de classe do 3º bimestre', 'Análise formativa das turmas e definição de encaminhamentos.', 'MEETING'::public.academic_calendar_event_type, 'STAFF'::public.academic_calendar_audience, timestamptz '2026-09-12 14:00:00-03', timestamptz '2026-09-12 16:00:00-03'),
  (3, 'Mostra de projetos', 'Compartilhamento de projetos e aprendizagens da comunidade escolar.', 'SCHOOL_EVENT'::public.academic_calendar_event_type, 'ALL'::public.academic_calendar_audience, timestamptz '2026-10-09 08:00:00-03', timestamptz '2026-10-09 16:00:00-03')
) seed(item_no, title, description, event_type, audience, starts_at, ends_at)
on conflict (id) do update set title = excluded.title, description = excluded.description, event_type = excluded.event_type, starts_at = excluded.starts_at, ends_at = excluded.ends_at, all_day = excluded.all_day, audience = excluded.audience, active = true, created_by = excluded.created_by, updated_at = now();

insert into public.learning_posts (
  id, institution_id, class_id, subject_id, created_by, post_type, title, body, pinned, active, published_at, expires_at
)
select
  md5('HELITA_VIEIRA_FULL_DEMO_2026_V1:post:' || seed.item_no)::uuid,
  context.institution_id,
  (select id from helita_classes order by name limit 1 offset ((seed.item_no - 1) % 3)),
  subject.id,
  offering.teacher_profile_id,
  'MATERIAL',
  seed.title,
  seed.body,
  seed.item_no <= 3,
  true,
  timestamptz '2026-09-01 08:00:00-03',
  null
from helita_context context
cross join (values
  (1, 'MAT', 'Guia de funções e gráficos', 'Relacione crescimento, variação e representação gráfica em situações do cotidiano.'),
  (2, 'LP', 'Oficina de argumentação', 'Identifique tese, evidências e estratégias de coesão em um texto.'),
  (3, 'FIS', 'Roteiro de investigação', 'Registre hipótese, procedimento, evidências e conclusão.'),
  (4, 'QUI', 'Mapa de transformações', 'Organize conceitos, exemplos e evidências sobre as transformações estudadas.'),
  (5, 'BIO', 'Fichamento de pesquisa', 'Registre pergunta, fonte, evidência e uma limitação do estudo analisado.'),
  (6, 'HIS', 'Linha do tempo comentada', 'Conecte acontecimentos, grupos sociais e mudanças históricas.'),
  (7, 'GEO', 'Redes e território', 'Trace a cadeia produtiva de um produto cotidiano e suas relações espaciais.'),
  (8, 'ART', 'Processo criativo', 'Compartilhe referências e registre as escolhas feitas na produção.'),
  (9, 'ING', 'Reading practice', 'Read the short text and register two key ideas in your notebook.'),
  (10, 'FIL', 'Perguntas para o debate', 'Formule uma pergunta filosófica e sustente uma hipótese inicial.'),
  (11, 'SOC', 'Observação da comunidade', 'Relacione um fenômeno social observado a um conceito estudado.'),
  (12, 'EDF', 'Rotina de bem-estar', 'Registre hábitos de movimento e uma meta possível para a semana.')
) seed(item_no, code, title, body)
join helita_subjects subject on subject.code = seed.code
join lateral (
  select offering.teacher_profile_id
  from helita_offerings offering
  join helita_terms term on term.id = offering.term_id and term.term_no = 3
  where offering.subject_id = subject.id
  order by offering.class_id
  limit 1
) offering on true
on conflict (id) do update set title = excluded.title, body = excluded.body, active = true, pinned = excluded.pinned, published_at = excluded.published_at, updated_at = now();

insert into public.book_recommendations (
  id, institution_id, subject_offering_id, title, author, note, active, created_by
)
select
  md5('HELITA_VIEIRA_FULL_DEMO_2026_V1:book:' || seed.item_no)::uuid,
  context.institution_id,
  offering.id,
  seed.title,
  seed.author,
  seed.note,
  true,
  offering.teacher_profile_id
from helita_context context
cross join (values
  (1, 'MAT', 'Matemática em movimento', 'Equipe pedagógica', 'Desafios para conectar modelos e situações cotidianas.'),
  (2, 'LP', 'Leituras do Brasil contemporâneo', 'Equipe pedagógica', 'Repertório para ampliar leitura e argumentação.'),
  (3, 'BIO', 'Horizontes da ciência', 'Equipe pedagógica', 'Perguntas para observar sistemas vivos e construir hipóteses.'),
  (4, 'FIS', 'Laboratório de Física', 'Equipe pedagógica', 'Experimentos narrados para formular hipóteses e registrar evidências.'),
  (5, 'HIS', 'Sociedade e transformações', 'Equipe pedagógica', 'Linha do tempo comentada para conectar mudanças históricas.'),
  (6, 'GEO', 'Atlas de ideias', 'Equipe pedagógica', 'Percursos visuais para interpretar território, redes e paisagens.')
) seed(item_no, code, title, author, note)
join helita_subjects subject on subject.code = seed.code
join lateral (
  select offering.id, offering.teacher_profile_id
  from helita_offerings offering
  join helita_terms term on term.id = offering.term_id and term.term_no = 3
  where offering.subject_id = subject.id
  order by offering.class_id
  limit 1
) offering on true
on conflict (id) do update set title = excluded.title, author = excluded.author, note = excluded.note, active = true, created_by = excluded.created_by, updated_at = now();

do $$
declare
  target_institution_id uuid := (select institution_id from helita_context);
  year_id uuid := (select id from helita_years limit 1);
  session_count integer;
  record_count integer;
  assessment_count integer;
  grade_count integer;
  result_count integer;
begin
  select count(*) into session_count from public.attendance_sessions where attendance_sessions.institution_id = target_institution_id;
  select count(*) into record_count from public.attendance_records where attendance_records.institution_id = target_institution_id;
  select count(*) into assessment_count from public.assessments where assessments.institution_id = target_institution_id;
  select count(*) into grade_count from public.grades where grades.institution_id = target_institution_id;
  select count(*) into result_count from public.student_term_results where student_term_results.institution_id = target_institution_id and student_term_results.academic_year_id = year_id;
  if session_count = 0 or record_count = 0 or assessment_count = 0 or grade_count = 0 then
    raise exception 'HELITA_OPERATIONAL_DATA_EMPTY:%:%:%:%', session_count, record_count, assessment_count, grade_count;
  end if;
  if result_count = 0 then raise exception 'HELITA_REPORT_CARD_RESULTS_EMPTY'; end if;
end;
$$;

select jsonb_build_object(
  'campaign', 'TECESCOLA_COLEGIO_HELITA_VIEIRA_FULL_DEMO_ACADEMIC_DATA_V1',
  'institution_id', (select institution_id from helita_context),
  'students', (select count(*) from helita_students),
  'classes', (select count(*) from helita_classes),
  'subjects', (select count(*) from helita_subjects),
  'offerings', (select count(*) from helita_offerings),
  'attendance_sessions', (select count(*) from public.attendance_sessions where institution_id = (select institution_id from helita_context)),
  'attendance_records', (select count(*) from public.attendance_records where institution_id = (select institution_id from helita_context)),
  'assessments', (select count(*) from public.assessments where institution_id = (select institution_id from helita_context)),
  'grades', (select count(*) from public.grades where institution_id = (select institution_id from helita_context)),
  'term_results', (select count(*) from public.student_term_results where institution_id = (select institution_id from helita_context)),
  'recoveries', (select count(*) from public.student_term_recoveries where institution_id = (select institution_id from helita_context) and status = 'PUBLISHED'),
  'canceled_recoveries', (select count(*) from public.student_term_recoveries where institution_id = (select institution_id from helita_context) and status = 'CANCELED'),
  'class_councils', (select count(*) from public.class_councils where institution_id = (select institution_id from helita_context))
);

commit;
