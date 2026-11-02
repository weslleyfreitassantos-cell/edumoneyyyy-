-- Explicit, institution-scoped teacher availability and class authorization.
-- Existing availability rows keep shift = NULL and must be reviewed; they are
-- never interpreted as availability for every school shift.

begin;

alter table public.teacher_availability
  add column if not exists shift text null;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conname = 'teacher_availability_supported_shift'
      and conrelid = 'public.teacher_availability'::regclass
  ) then
    alter table public.teacher_availability
      add constraint teacher_availability_supported_shift
      check (shift is null or shift in ('MATUTINO', 'VESPERTINO', 'INTEGRAL', 'NOTURNO'));
  end if;
end;
$$;

create index if not exists teacher_availability_shift_lookup_idx
  on public.teacher_availability (institution_id, teacher_profile_id, shift, day_of_week)
  where active is true;

create table if not exists public.teacher_scheduling_profiles (
  institution_id uuid not null references public.institutions(id) on delete restrict,
  teacher_profile_id uuid not null references public.profiles(id) on delete restrict,
  academic_year_id uuid not null references public.academic_years(id) on delete restrict,
  actuation_type text not null check (actuation_type in ('REGENTE', 'ESPECIALISTA', 'AMBOS')),
  authorized_shifts text[] not null default array[]::text[],
  authorized_stages text[] not null default array[]::text[],
  authorized_grade_levels text[] not null default array[]::text[],
  authorized_class_ids uuid[] not null default array[]::uuid[],
  max_weekly_lessons smallint null check (max_weekly_lessons between 1 and 60),
  max_daily_lessons smallint null check (max_daily_lessons between 1 and 16),
  contractual_weekly_minutes integer null check (contractual_weekly_minutes between 1 and 100000),
  configuration_status text not null default 'REVIEW_REQUIRED'
    check (configuration_status in ('READY', 'REVIEW_REQUIRED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (institution_id, teacher_profile_id, academic_year_id),
  constraint teacher_scheduling_supported_shifts
    check (authorized_shifts <@ array['MATUTINO', 'VESPERTINO', 'INTEGRAL', 'NOTURNO']::text[]),
  constraint teacher_scheduling_supported_stages
    check (authorized_stages <@ array['FUNDAMENTAL_I', 'FUNDAMENTAL_II', 'ENSINO_MEDIO']::text[]),
  constraint teacher_scheduling_supported_grades
    check (authorized_grade_levels <@ array['1', '2', '3', '4', '5', '6', '7', '8', '9', '1 EM', '2 EM', '3 EM']::text[]),
  constraint teacher_scheduling_ready_scope
    check (configuration_status <> 'READY' or (
      cardinality(authorized_shifts) > 0 and
      cardinality(authorized_stages) > 0 and
      cardinality(authorized_grade_levels) > 0 and
      cardinality(authorized_class_ids) > 0
    ))
);

create index if not exists teacher_scheduling_profile_lookup_idx
  on public.teacher_scheduling_profiles (institution_id, configuration_status, teacher_profile_id);

create or replace function private.normalize_teacher_grade_level(p_value text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  normalized text;
  grade_number text;
begin
  if p_value is null or pg_catalog.btrim(p_value) = '' then return null; end if;
  normalized := pg_catalog.upper(pg_catalog.translate(pg_catalog.btrim(p_value), 'ÁÀÃÂÉÊÍÓÔÕÚÜÇáàãâéêíóôõúüçºª°.-_', 'AAAAEEIOOOUUCaaaaeeiooouc      '));
  normalized := pg_catalog.regexp_replace(normalized, '[^A-Z0-9]+', ' ', 'g');
  grade_number := (pg_catalog.regexp_match(normalized, '(^|[^0-9])([1-9])([^0-9]|$)'))[2];
  if grade_number is null then return null; end if;
  if normalized ~ '(^| )(EM|ENSINO MEDIO|MEDIO)( |$)' then
    if grade_number in ('1', '2', '3') then return grade_number || ' EM'; end if;
    return null;
  end if;
  return grade_number;
end;
$$;

create or replace function private.teacher_stage_for_grade(p_grade text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_grade in ('1', '2', '3', '4', '5') then 'FUNDAMENTAL_I'
    when p_grade in ('6', '7', '8', '9') then 'FUNDAMENTAL_II'
    when p_grade in ('1 EM', '2 EM', '3 EM') then 'ENSINO_MEDIO'
    else null
  end
$$;

create or replace function private.is_teacher_regent_core_subject(p_subject_name text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(upper(p_subject_name) ~ '(PORTUGU|MATEMAT|CI[ÊE]NCI|HIST|GEOGRAF)', false)
$$;

create or replace function private.validate_teacher_scheduling_profile_tenant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.academic_years academic_year
    where academic_year.id = new.academic_year_id
      and academic_year.institution_id = new.institution_id
  ) then
    raise exception 'TEACHER_ACADEMIC_YEAR_SCOPE_MISMATCH' using errcode = '23514';
  end if;

  if not exists (
    select 1
    from public.memberships membership
    join public.profiles profile on profile.id = membership.profile_id
    where membership.institution_id = new.institution_id
      and membership.profile_id = new.teacher_profile_id
      and membership.role = 'TEACHER'::public.user_role
      and membership.active is true
      and profile.active is true
  ) then
    raise exception 'Teacher does not belong to this institution.' using errcode = '23514';
  end if;

  if exists (
    select 1
    from pg_catalog.unnest(new.authorized_class_ids) as selected(class_id)
    left join public.classes class_record
      on class_record.id = selected.class_id
     and class_record.institution_id = new.institution_id
    where class_record.id is null or class_record.academic_year_id <> new.academic_year_id
  ) then
    raise exception 'TEACHER_CLASS_SCOPE_MISMATCH' using errcode = '23514';
  end if;

  if new.configuration_status = 'READY' and exists (
    select 1
    from pg_catalog.unnest(new.authorized_class_ids) as selected(class_id)
    join public.classes class_record
      on class_record.id = selected.class_id
     and class_record.institution_id = new.institution_id
     and class_record.academic_year_id = new.academic_year_id
    where private.normalize_teacher_grade_level(class_record.grade_level) is null
      or not (private.normalize_teacher_grade_level(class_record.grade_level) = any(new.authorized_grade_levels))
      or not (private.teacher_stage_for_grade(private.normalize_teacher_grade_level(class_record.grade_level)) = any(new.authorized_stages))
  ) then
    raise exception 'TEACHER_CLASS_GRADE_SCOPE_MISMATCH' using errcode = '23514';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists teacher_scheduling_profile_validate_tenant on public.teacher_scheduling_profiles;
create trigger teacher_scheduling_profile_validate_tenant
before insert or update on public.teacher_scheduling_profiles
for each row execute function private.validate_teacher_scheduling_profile_tenant();

-- Availability overlaps are checked within the same shift; different shifts
-- can overlap in real clock time and are resolved by the timetable engine.
create or replace function private.validate_teacher_availability_tenant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.memberships m
    join public.profiles p on p.id = m.profile_id
    where m.institution_id = new.institution_id
      and m.profile_id = new.teacher_profile_id
      and m.role = 'TEACHER'::public.user_role
      and m.active is true and p.active is true
  ) then
    raise exception 'Teacher does not belong to this institution.' using errcode = '23514';
  end if;

  if exists (
    select 1 from public.teacher_availability a
    where a.institution_id = new.institution_id
      and a.teacher_profile_id = new.teacher_profile_id
      and a.day_of_week = new.day_of_week
      and a.shift is not distinct from new.shift
      and a.active is true
      and a.id is distinct from new.id
      and a.start_time < new.end_time
      and new.start_time < a.end_time
  ) then
    raise exception 'TEACHER_AVAILABILITY_OVERLAP' using errcode = '23P01';
  end if;
  return new;
end;
$$;

drop trigger if exists teacher_availability_validate_tenant on public.teacher_availability;
create trigger teacher_availability_validate_tenant
before insert or update of institution_id, teacher_profile_id, shift, day_of_week, start_time, end_time, active
on public.teacher_availability
for each row execute function private.validate_teacher_availability_tenant();

alter table public.teacher_scheduling_profiles enable row level security;
drop policy if exists teacher_scheduling_profiles_select_policy on public.teacher_scheduling_profiles;
create policy teacher_scheduling_profiles_select_policy
on public.teacher_scheduling_profiles for select to authenticated
using (private.can_access_academic_institution(institution_id));
drop policy if exists teacher_scheduling_profiles_write_policy on public.teacher_scheduling_profiles;
create policy teacher_scheduling_profiles_write_policy
on public.teacher_scheduling_profiles for all to authenticated
using (public.can_manage_institution_operations(institution_id))
with check (public.can_manage_institution_operations(institution_id));

grant select on public.teacher_scheduling_profiles to authenticated;
revoke insert, update, delete on public.teacher_scheduling_profiles from anon, authenticated;

create or replace function public.save_teacher_scheduling_configuration(
  p_institution_id uuid,
  p_teacher_profile_id uuid,
  p_academic_year_id uuid,
  p_profile jsonb,
  p_availability jsonb,
  p_subject_ids uuid[],
  p_primary_subject_id uuid,
  p_only_if_unconfigured boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_shifts text[];
  selected_subjects uuid[] := coalesce(p_subject_ids, array[]::uuid[]);
  row_item jsonb;
begin
  if not public.can_manage_institution_operations(p_institution_id) then
    raise exception 'INSTITUTION_OPERATION_FORBIDDEN' using errcode = '42501';
  end if;
  if coalesce(jsonb_typeof(p_profile), '') <> 'object' or coalesce(jsonb_typeof(p_availability), '') <> 'array' then
    raise exception 'TEACHER_SCHEDULING_PAYLOAD_INVALID' using errcode = '22023';
  end if;

  -- Serialize all configuration writes for this teacher. In safe bulk mode,
  -- re-check the preview condition under the same lock before changing rows.
  perform profile.id
  from public.profiles profile
  where profile.id = p_teacher_profile_id
  for update;
  if not found then
    raise exception 'TEACHER_PROFILE_NOT_FOUND' using errcode = '23503';
  end if;
  if p_only_if_unconfigured and (
    exists (
      select 1 from public.teacher_scheduling_profiles scheduling
      where scheduling.institution_id = p_institution_id
        and scheduling.teacher_profile_id = p_teacher_profile_id
        and scheduling.academic_year_id = p_academic_year_id
    )
    or exists (
      select 1 from public.teacher_availability availability
      where availability.institution_id = p_institution_id
        and availability.teacher_profile_id = p_teacher_profile_id
        and availability.active is true
    )
  ) then
    raise exception 'TEACHER_SCHEDULING_ALREADY_CONFIGURED' using errcode = '23505';
  end if;

  select coalesce(array_agg(distinct value), array[]::text[])
  into selected_shifts
  from jsonb_array_elements_text(coalesce(p_profile->'authorized_shifts', '[]'::jsonb)) as item(value);

  if p_subject_ids is not null and p_primary_subject_id is not null and not (p_primary_subject_id = any(selected_subjects)) then
    raise exception 'TEACHER_PRIMARY_SUBJECT_NOT_SELECTED' using errcode = '22023';
  end if;
  if p_subject_ids is not null and exists (
    select 1 from pg_catalog.unnest(selected_subjects) as selected(subject_id)
    left join public.subjects subject
      on subject.id = selected.subject_id and subject.institution_id = p_institution_id
    where subject.id is null
  ) then
    raise exception 'TEACHER_SUBJECT_SCOPE_MISMATCH' using errcode = '23514';
  end if;

  if p_subject_ids is not null then
    update public.teacher_subjects
    set active = false, updated_at = now()
    where institution_id = p_institution_id and teacher_profile_id = p_teacher_profile_id and active is true;

    insert into public.teacher_subjects (
      institution_id, teacher_profile_id, subject_id, primary_subject, active
    )
    select p_institution_id, p_teacher_profile_id, selected.subject_id,
      selected.subject_id = p_primary_subject_id, true
    from pg_catalog.unnest(selected_subjects) as selected(subject_id);
  end if;

  for row_item in select value from jsonb_array_elements(p_availability)
  loop
    if ((row_item->>'shift') is null and p_profile->>'configuration_status' = 'READY')
      or ((row_item->>'shift') is not null and not ((row_item->>'shift') = any(selected_shifts)))
      or (row_item->>'day_of_week')::integer not between 1 and 6
      or (row_item->>'start_time')::time >= (row_item->>'end_time')::time then
      raise exception 'TEACHER_AVAILABILITY_INVALID' using errcode = '22023';
    end if;
  end loop;

  insert into public.teacher_scheduling_profiles (
    institution_id, teacher_profile_id, academic_year_id, actuation_type, authorized_shifts,
    authorized_stages, authorized_grade_levels, authorized_class_ids,
    max_weekly_lessons, max_daily_lessons, contractual_weekly_minutes,
    configuration_status
  ) values (
    p_institution_id,
    p_teacher_profile_id,
    p_academic_year_id,
    p_profile->>'actuation_type',
    selected_shifts,
    coalesce(array(select jsonb_array_elements_text(coalesce(p_profile->'authorized_stages', '[]'::jsonb))), array[]::text[]),
    coalesce(array(select jsonb_array_elements_text(coalesce(p_profile->'authorized_grade_levels', '[]'::jsonb))), array[]::text[]),
    coalesce(array(select jsonb_array_elements_text(coalesce(p_profile->'authorized_class_ids', '[]'::jsonb))::uuid), array[]::uuid[]),
    nullif(p_profile->>'max_weekly_lessons', '')::smallint,
    nullif(p_profile->>'max_daily_lessons', '')::smallint,
    nullif(p_profile->>'contractual_weekly_minutes', '')::integer,
    p_profile->>'configuration_status'
  )
  on conflict (institution_id, teacher_profile_id, academic_year_id) do update set
    actuation_type = excluded.actuation_type,
    authorized_shifts = excluded.authorized_shifts,
    authorized_stages = excluded.authorized_stages,
    authorized_grade_levels = excluded.authorized_grade_levels,
    authorized_class_ids = excluded.authorized_class_ids,
    max_weekly_lessons = excluded.max_weekly_lessons,
    max_daily_lessons = excluded.max_daily_lessons,
    contractual_weekly_minutes = excluded.contractual_weekly_minutes,
    configuration_status = excluded.configuration_status,
    updated_at = now();

  update public.teacher_availability
  set active = false, updated_at = now()
  where institution_id = p_institution_id
    and teacher_profile_id = p_teacher_profile_id
    and active is true;

  insert into public.teacher_availability (
    institution_id, teacher_profile_id, shift, day_of_week, start_time, end_time, active
  )
  select p_institution_id, p_teacher_profile_id, availability_row.value->>'shift',
         (availability_row.value->>'day_of_week')::smallint, (availability_row.value->>'start_time')::time,
         (availability_row.value->>'end_time')::time, true
  from jsonb_array_elements(p_availability) as availability_row(value);
end;
$$;

revoke all on function public.save_teacher_scheduling_configuration(uuid, uuid, uuid, jsonb, jsonb, uuid[], uuid, boolean) from public, anon;
grant execute on function public.save_teacher_scheduling_configuration(uuid, uuid, uuid, jsonb, jsonb, uuid[], uuid, boolean) to authenticated, service_role;

create or replace function public.validate_teacher_scheduling_for_timetable_version(
  p_version_id uuid,
  p_institution_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  version_row public.timetable_versions;
  item record;
  diagnostics jsonb := '[]'::jsonb;
  policy_daily integer := 8;
  policy_weekly integer := 40;
begin
  if not public.can_manage_institution_operations(p_institution_id) then
    raise exception 'INSTITUTION_OPERATION_FORBIDDEN' using errcode = '42501';
  end if;
  select * into version_row from public.timetable_versions
  where id = p_version_id and institution_id = p_institution_id;
  if not found then raise exception 'TIMETABLE_VERSION_FORBIDDEN' using errcode = '42501'; end if;

  select coalesce(max(max_teacher_lessons_per_day), 8), coalesce(max(max_teacher_lessons_per_week), 40)
  into policy_daily, policy_weekly
  from public.academic_policies
  where institution_id = p_institution_id and academic_year_id = version_row.academic_year_id and active is true;

  for item in
    select distinct e.id, e.class_id, e.day_of_week, e.start_time, e.end_time,
      c.name as class_name, c.academic_year_id as class_academic_year_id, c.grade_level, c.shift, so.teacher_profile_id,
      so.subject_id, subject.name as subject_name, profile.full_name as teacher_name,
      scheduling.actuation_type, scheduling.authorized_shifts, scheduling.authorized_stages,
      scheduling.authorized_grade_levels, scheduling.authorized_class_ids,
      scheduling.configuration_status
    from public.timetable_version_entries e
    join public.subject_offerings so on so.id = e.subject_offering_id
    join public.classes c on c.id = e.class_id
    join public.subjects subject on subject.id = so.subject_id
    join public.profiles profile on profile.id = so.teacher_profile_id
    left join public.teacher_scheduling_profiles scheduling
      on scheduling.institution_id = e.institution_id
     and scheduling.teacher_profile_id = so.teacher_profile_id
     and scheduling.academic_year_id = version_row.academic_year_id
    where e.version_id = p_version_id and e.institution_id = p_institution_id and e.active is true
  loop
    -- Existing institutions may still have timetable entries from before
    -- scheduling profiles existed. Keep manual publish backward-compatible;
    -- automatic generation independently requires a reviewed profile.
    if item.configuration_status is null then
      continue;
    end if;

    if item.configuration_status is distinct from 'READY' then
      diagnostics := diagnostics || jsonb_build_array(jsonb_build_object(
        'code', 'TEACHER_PROFILE_REVIEW_REQUIRED',
        'message', coalesce(item.teacher_name, 'Docente') || ' precisa revisar turno, etapa, série e turma autorizados antes de publicar ' || item.class_name || '.'
      ));
      continue;
    end if;

    if item.class_academic_year_id <> version_row.academic_year_id then
      diagnostics := diagnostics || jsonb_build_array(jsonb_build_object(
        'code', 'TEACHER_CLASS_YEAR_MISMATCH',
        'message', coalesce(item.teacher_name, 'Docente') || ' está associado a uma turma fora do ano letivo da grade (' || item.class_name || ').'
      ));
    end if;

    if item.grade_level is null
      or private.normalize_teacher_grade_level(item.grade_level) is null
      or not (private.normalize_teacher_grade_level(item.grade_level) = any(item.authorized_grade_levels))
      or not (private.teacher_stage_for_grade(private.normalize_teacher_grade_level(item.grade_level)) = any(item.authorized_stages))
      or not (item.class_id = any(item.authorized_class_ids)) then
      diagnostics := diagnostics || jsonb_build_array(jsonb_build_object(
        'code', 'TEACHER_CLASS_SCOPE_MISMATCH',
        'message', coalesce(item.teacher_name, 'Docente') || ' não está autorizado(a) para ' || item.class_name || ' (' || coalesce(item.grade_level, 'série não identificada') || ').'
      ));
    end if;

    if item.shift is null or not (private.normalize_academic_shift(item.shift) = any(item.authorized_shifts)) then
      diagnostics := diagnostics || jsonb_build_array(jsonb_build_object(
        'code', 'TEACHER_SHIFT_NOT_AUTHORIZED',
        'message', coalesce(item.teacher_name, 'Docente') || ' não está autorizado(a) para o turno ' || coalesce(item.shift, 'não definido') || ' da turma ' || item.class_name || '.'
      ));
    end if;

    if not (
      ((item.actuation_type in ('REGENTE', 'AMBOS'))
        and private.teacher_stage_for_grade(private.normalize_teacher_grade_level(item.grade_level)) = 'FUNDAMENTAL_I'
        and private.is_teacher_regent_core_subject(item.subject_name)
        and item.class_id = any(item.authorized_class_ids))
      or
      ((item.actuation_type in ('ESPECIALISTA', 'AMBOS')) and exists (
        select 1 from public.teacher_subjects skill
        where skill.institution_id = p_institution_id
          and skill.teacher_profile_id = item.teacher_profile_id
          and skill.subject_id = item.subject_id and skill.active is true
      ))
    ) then
      diagnostics := diagnostics || jsonb_build_array(jsonb_build_object(
        'code', 'TEACHER_SUBJECT_NOT_AUTHORIZED',
        'message', coalesce(item.teacher_name, 'Docente') || ' não possui habilitação ou vínculo de regência válido para ' || item.subject_name || ' em ' || item.class_name || '.'
      ));
    end if;

    if not exists (
      select 1 from public.teacher_availability availability
      where availability.institution_id = p_institution_id
        and availability.teacher_profile_id = item.teacher_profile_id
        and availability.day_of_week = item.day_of_week
        and availability.shift = private.normalize_academic_shift(item.shift)
        and availability.active is true
        and availability.start_time <= item.start_time
        and availability.end_time >= item.end_time
    ) then
      diagnostics := diagnostics || jsonb_build_array(jsonb_build_object(
        'code', 'TEACHER_NOT_AVAILABLE_FOR_SHIFT',
        'message', coalesce(item.teacher_name, 'Docente') || ' não está disponível no turno e horário de ' || item.class_name || ' (' || item.start_time::text || '–' || item.end_time::text || ').'
      ));
    end if;
  end loop;

  for item in
    select distinct anchor_offering.teacher_profile_id, teacher.full_name teacher_name,
      anchor.term_id, anchor_term.name term_name, anchor.day_of_week,
      coalesce(scheduling.max_daily_lessons, policy_daily) individual_limit,
      count(distinct other.id)::integer daily_load
    from public.timetable_version_entries anchor
    join public.subject_offerings anchor_offering on anchor_offering.id = anchor.subject_offering_id
    join public.profiles teacher on teacher.id = anchor_offering.teacher_profile_id
    join public.terms anchor_term on anchor_term.id = anchor.term_id
    join public.timetable_version_entries other
      on other.version_id = anchor.version_id and other.institution_id = anchor.institution_id
     and other.active is true and other.day_of_week = anchor.day_of_week
    join public.subject_offerings other_offering on other_offering.id = other.subject_offering_id
      and other_offering.teacher_profile_id = anchor_offering.teacher_profile_id
    join public.terms other_term on other_term.id = other.term_id
      and anchor_term.start_date <= other_term.end_date and other_term.start_date <= anchor_term.end_date
    left join public.teacher_scheduling_profiles scheduling
      on scheduling.institution_id = anchor.institution_id
     and scheduling.teacher_profile_id = anchor_offering.teacher_profile_id
     and scheduling.academic_year_id = version_row.academic_year_id
    where anchor.version_id = p_version_id and anchor.institution_id = p_institution_id and anchor.active is true
    group by anchor_offering.teacher_profile_id, teacher.full_name, anchor.term_id, anchor_term.name, anchor.day_of_week,
      scheduling.max_daily_lessons, policy_daily
    having count(distinct other.id) >
      least(coalesce(scheduling.max_daily_lessons, policy_daily), policy_daily)
  loop
    diagnostics := diagnostics || jsonb_build_array(jsonb_build_object(
      'code', 'TEACHER_DAILY_LIMIT_EXCEEDED',
      'message', item.teacher_name || ' excede o limite diário (' || item.daily_load || '/' || item.individual_limit || ' aulas) no ' || item.day_of_week || 'º dia letivo.'
    ));
  end loop;

  for item in
    select anchor_offering.teacher_profile_id, teacher.full_name teacher_name,
      anchor.term_id, anchor_term.name term_name,
      coalesce(scheduling.max_weekly_lessons, policy_weekly) individual_limit,
      count(distinct other.id)::integer weekly_load
    from public.timetable_version_entries anchor
    join public.subject_offerings anchor_offering on anchor_offering.id = anchor.subject_offering_id
    join public.profiles teacher on teacher.id = anchor_offering.teacher_profile_id
    join public.terms anchor_term on anchor_term.id = anchor.term_id
    join public.timetable_version_entries other
      on other.version_id = anchor.version_id and other.institution_id = anchor.institution_id and other.active is true
    join public.subject_offerings other_offering on other_offering.id = other.subject_offering_id
      and other_offering.teacher_profile_id = anchor_offering.teacher_profile_id
    join public.terms other_term on other_term.id = other.term_id
      and anchor_term.start_date <= other_term.end_date and other_term.start_date <= anchor_term.end_date
    left join public.teacher_scheduling_profiles scheduling
      on scheduling.institution_id = anchor.institution_id
     and scheduling.teacher_profile_id = anchor_offering.teacher_profile_id
     and scheduling.academic_year_id = version_row.academic_year_id
    where anchor.version_id = p_version_id and anchor.institution_id = p_institution_id and anchor.active is true
    group by anchor_offering.teacher_profile_id, teacher.full_name, anchor.term_id, anchor_term.name,
      scheduling.max_weekly_lessons, policy_weekly
    having count(distinct other.id) > least(coalesce(scheduling.max_weekly_lessons, policy_weekly), policy_weekly)
  loop
    diagnostics := diagnostics || jsonb_build_array(jsonb_build_object(
      'code', 'TEACHER_WEEKLY_LIMIT_EXCEEDED',
      'message', item.teacher_name || ' excede o limite semanal (' || item.weekly_load || '/' || item.individual_limit || ' aulas) no período ' || item.term_name || '.'
    ));
  end loop;

  return jsonb_build_object('valid', jsonb_array_length(diagnostics) = 0, 'diagnostics', diagnostics);
end;
$$;

revoke all on function public.validate_teacher_scheduling_for_timetable_version(uuid, uuid) from public, anon;
grant execute on function public.validate_teacher_scheduling_for_timetable_version(uuid, uuid) to authenticated, service_role;

create or replace function private.guard_teacher_scheduling_before_publish()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  validation jsonb;
begin
  if new.status = 'PUBLISHED' and old.status is distinct from 'PUBLISHED' then
    validation := public.validate_teacher_scheduling_for_timetable_version(new.id, new.institution_id);
    if coalesce((validation->>'valid')::boolean, false) is not true then
      raise exception 'TEACHER_SCHEDULING_VALIDATION_FAILED'
        using errcode = '23514', detail = (validation->'diagnostics')::text;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists teacher_scheduling_before_timetable_publish on public.timetable_versions;
create trigger teacher_scheduling_before_timetable_publish
before update of status on public.timetable_versions
for each row execute function private.guard_teacher_scheduling_before_publish();

commit;
