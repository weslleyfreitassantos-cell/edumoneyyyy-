-- Versioned manual timetable editing.
-- Published timetable_entries remains the read model. All editing happens in
-- DRAFT timetable_versions and is published through the existing atomic RPC.

begin;

create or replace function private.assert_editable_timetable_draft(
  p_version_id uuid,
  p_institution_id uuid
)
returns public.timetable_versions
language plpgsql
security definer
set search_path = ''
as $$
declare
  version_row public.timetable_versions;
begin
  if not public.can_manage_institution_operations(p_institution_id) then
    raise exception 'TIMETABLE_VERSION_FORBIDDEN' using errcode = '42501';
  end if;

  select v.* into version_row
  from public.timetable_versions v
  where v.id = p_version_id
    and v.institution_id = p_institution_id
  for update;

  if not found then
    raise exception 'TIMETABLE_VERSION_NOT_FOUND' using errcode = 'P0002';
  end if;
  if version_row.status <> 'DRAFT' then
    raise exception 'TIMETABLE_VERSION_NOT_DRAFT' using errcode = '55000';
  end if;
  return version_row;
end;
$$;

create or replace function private.assert_timetable_draft_entry_scope(
  p_institution_id uuid,
  p_academic_year_id uuid,
  p_term_id uuid,
  p_class_id uuid,
  p_subject_offering_id uuid,
  p_room_id uuid,
  p_day_of_week smallint,
  p_start_time time,
  p_end_time time
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  class_shift text;
begin
  if p_day_of_week not between 1 and 6 or p_start_time >= p_end_time then
    raise exception 'TIMETABLE_SLOT_INVALID' using errcode = '22023';
  end if;

  select c.shift into class_shift
  from public.classes c
  where c.id = p_class_id
    and c.institution_id = p_institution_id
    and c.academic_year_id = p_academic_year_id
    and c.active is true;
  if not found then
    raise exception 'TIMETABLE_CLASS_SCOPE_MISMATCH' using errcode = '23514';
  end if;

  if not exists (
    select 1
    from public.subject_offerings so
    join public.classes c on c.id = so.class_id
    join public.terms t on t.id = so.term_id
    where so.id = p_subject_offering_id
      and so.class_id = p_class_id
      and so.term_id = p_term_id
      and so.active is true
      and c.institution_id = p_institution_id
      and c.academic_year_id = p_academic_year_id
      and t.academic_year_id = p_academic_year_id
  ) then
    raise exception 'TIMETABLE_OFFERING_SCOPE_MISMATCH' using errcode = '23514';
  end if;

  if p_room_id is not null and not exists (
    select 1 from public.rooms r
    where r.id = p_room_id
      and r.institution_id = p_institution_id
      and r.active is true
  ) then
    raise exception 'TIMETABLE_ROOM_SCOPE_MISMATCH' using errcode = '23514';
  end if;

  if not exists (
    select 1 from public.school_time_slots s
    where s.institution_id = p_institution_id
      and s.active is true
      and s.day_of_week = p_day_of_week
      and private.normalize_academic_shift(s.shift) = private.normalize_academic_shift(coalesce(class_shift, 'MATUTINO'))
      and s.start_time = p_start_time
      and s.end_time = p_end_time
  ) then
    raise exception 'SCHOOL_TIME_SLOT_NOT_CONFIGURED' using errcode = '23514';
  end if;

  if exists (
    select 1 from public.school_schedule_breaks b
    where b.institution_id = p_institution_id
      and b.day_of_week = p_day_of_week
      and b.active is true
      and private.normalize_academic_shift(b.shift) = private.normalize_academic_shift(coalesce(class_shift, 'MATUTINO'))
      and b.start_time < p_end_time
      and p_start_time < b.end_time
  ) then
    raise exception 'TIMETABLE_BREAK_CONFLICT' using errcode = '23P01';
  end if;
end;
$$;

create or replace function public.add_timetable_draft_entry(
  p_version_id uuid,
  p_institution_id uuid,
  p_academic_year_id uuid,
  p_term_id uuid,
  p_class_id uuid,
  p_subject_offering_id uuid,
  p_room_id uuid,
  p_day_of_week smallint,
  p_start_time time,
  p_end_time time,
  p_locked boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  entry_id uuid;
begin
  perform private.assert_editable_timetable_draft(p_version_id, p_institution_id);
  perform private.assert_timetable_draft_entry_scope(
    p_institution_id, p_academic_year_id, p_term_id, p_class_id,
    p_subject_offering_id, p_room_id, p_day_of_week, p_start_time, p_end_time
  );

  insert into public.timetable_version_entries (
    version_id, institution_id, academic_year_id, term_id, class_id,
    subject_offering_id, room_id, day_of_week, start_time, end_time, locked, active
  ) values (
    p_version_id, p_institution_id, p_academic_year_id, p_term_id, p_class_id,
    p_subject_offering_id, p_room_id, p_day_of_week, p_start_time, p_end_time,
    coalesce(p_locked, false), true
  ) returning id into entry_id;
  return entry_id;
end;
$$;

create or replace function public.update_timetable_draft_entry(
  p_entry_id uuid,
  p_version_id uuid,
  p_institution_id uuid,
  p_day_of_week smallint,
  p_start_time time,
  p_end_time time,
  p_locked boolean default false,
  p_room_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  entry_row public.timetable_version_entries;
begin
  perform private.assert_editable_timetable_draft(p_version_id, p_institution_id);
  select e.* into entry_row
  from public.timetable_version_entries e
  where e.id = p_entry_id and e.version_id = p_version_id
    and e.institution_id = p_institution_id and e.active is true
  for update;
  if not found then raise exception 'TIMETABLE_ENTRY_NOT_FOUND' using errcode = 'P0002'; end if;

  perform private.assert_timetable_draft_entry_scope(
    p_institution_id, entry_row.academic_year_id, entry_row.term_id, entry_row.class_id,
    entry_row.subject_offering_id, p_room_id, p_day_of_week, p_start_time, p_end_time
  );

  update public.timetable_version_entries
  set day_of_week = p_day_of_week, start_time = p_start_time, end_time = p_end_time,
      room_id = p_room_id, locked = coalesce(p_locked, false), updated_at = pg_catalog.now()
  where id = p_entry_id;
  return p_entry_id;
end;
$$;

create or replace function public.remove_timetable_draft_entry(
  p_entry_id uuid,
  p_version_id uuid,
  p_institution_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.assert_editable_timetable_draft(p_version_id, p_institution_id);
  update public.timetable_version_entries
  set active = false, updated_at = pg_catalog.now()
  where id = p_entry_id and version_id = p_version_id
    and institution_id = p_institution_id and active is true;
  if not found then raise exception 'TIMETABLE_ENTRY_NOT_FOUND' using errcode = 'P0002'; end if;
  return p_entry_id;
end;
$$;

create or replace function public.duplicate_timetable_draft_entry(
  p_entry_id uuid,
  p_version_id uuid,
  p_institution_id uuid,
  p_day_of_week smallint,
  p_start_time time,
  p_end_time time
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  source_entry public.timetable_version_entries;
  duplicate_id uuid;
begin
  perform private.assert_editable_timetable_draft(p_version_id, p_institution_id);
  select e.* into source_entry
  from public.timetable_version_entries e
  where e.id = p_entry_id and e.version_id = p_version_id
    and e.institution_id = p_institution_id and e.active is true
  for update;
  if not found then raise exception 'TIMETABLE_ENTRY_NOT_FOUND' using errcode = 'P0002'; end if;

  perform private.assert_timetable_draft_entry_scope(
    p_institution_id, source_entry.academic_year_id, source_entry.term_id, source_entry.class_id,
    source_entry.subject_offering_id, source_entry.room_id, p_day_of_week, p_start_time, p_end_time
  );
  insert into public.timetable_version_entries (
    version_id, institution_id, academic_year_id, term_id, class_id,
    subject_offering_id, room_id, day_of_week, start_time, end_time, locked, active
  ) values (
    p_version_id, p_institution_id, source_entry.academic_year_id, source_entry.term_id, source_entry.class_id,
    source_entry.subject_offering_id, source_entry.room_id, p_day_of_week, p_start_time, p_end_time,
    source_entry.locked, true
  ) returning id into duplicate_id;
  return duplicate_id;
end;
$$;

create or replace function public.copy_timetable_draft_day(
  p_version_id uuid,
  p_institution_id uuid,
  p_source_day smallint,
  p_target_day smallint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  source_entry record;
  created_count integer := 0;
  conflict_count integer := 0;
  conflicts jsonb := '[]'::jsonb;
begin
  perform private.assert_editable_timetable_draft(p_version_id, p_institution_id);
  if p_source_day not between 1 and 6 or p_target_day not between 1 and 6 or p_source_day = p_target_day then
    raise exception 'TIMETABLE_COPY_DAY_INVALID' using errcode = '22023';
  end if;

  for source_entry in
    select * from public.timetable_version_entries
    where version_id = p_version_id and institution_id = p_institution_id
      and day_of_week = p_source_day and active is true
  loop
    if exists (
      select 1 from public.timetable_version_entries existing
      where existing.version_id = p_version_id and existing.institution_id = p_institution_id
        and existing.active is true and existing.class_id = source_entry.class_id
        and existing.term_id = source_entry.term_id and existing.day_of_week = p_target_day
        and existing.start_time = source_entry.start_time and existing.end_time = source_entry.end_time
    ) then
      conflict_count := conflict_count + 1;
      conflicts := conflicts || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
        'class_id', source_entry.class_id, 'term_id', source_entry.term_id,
        'start_time', source_entry.start_time, 'end_time', source_entry.end_time,
        'reason', 'TARGET_CELL_OCCUPIED'
      ));
    else
      begin
        perform private.assert_timetable_draft_entry_scope(
          p_institution_id, source_entry.academic_year_id, source_entry.term_id,
          source_entry.class_id, source_entry.subject_offering_id, source_entry.room_id,
          p_target_day, source_entry.start_time, source_entry.end_time
        );
        insert into public.timetable_version_entries (
          version_id, institution_id, academic_year_id, term_id, class_id,
          subject_offering_id, room_id, day_of_week, start_time, end_time, locked, active
        ) values (
          p_version_id, p_institution_id, source_entry.academic_year_id, source_entry.term_id, source_entry.class_id,
          source_entry.subject_offering_id, source_entry.room_id, p_target_day, source_entry.start_time,
          source_entry.end_time, source_entry.locked, true
        );
        created_count := created_count + 1;
      exception when others then
        conflict_count := conflict_count + 1;
        conflicts := conflicts || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
          'class_id', source_entry.class_id, 'term_id', source_entry.term_id,
          'start_time', source_entry.start_time, 'end_time', source_entry.end_time,
          'reason', sqlerrm
        ));
      end;
    end if;
  end loop;

  return pg_catalog.jsonb_build_object(
    'created', created_count, 'conflicts', conflict_count, 'details', conflicts,
    'source_day', p_source_day, 'target_day', p_target_day
  );
end;
$$;

create or replace function public.validate_timetable_draft(
  p_version_id uuid,
  p_institution_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  diagnostics jsonb := '[]'::jsonb;
  version_row public.timetable_versions;
  entry_row record;
  required_row record;
  total_entries integer := 0;
  diagnostic_count integer := 0;
begin
  perform private.assert_editable_timetable_draft(p_version_id, p_institution_id);

  select v.* into version_row
  from public.timetable_versions v
  where v.id = p_version_id and v.institution_id = p_institution_id;

  select count(*) into total_entries
  from public.timetable_version_entries e
  where e.version_id = p_version_id and e.institution_id = p_institution_id and e.active is true;

  if total_entries = 0 then
    diagnostics := diagnostics || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'code', 'DRAFT_EMPTY', 'message', 'Adicione pelo menos uma aula ao rascunho antes de validar.'
    ));
  end if;

  for entry_row in
    select e.id, c.name class_name, c.shift, e.day_of_week, e.start_time, e.end_time,
           so.teacher_profile_id, s.name subject_name
    from public.timetable_version_entries e
    join public.classes c on c.id = e.class_id
    join public.subject_offerings so on so.id = e.subject_offering_id
    join public.subjects s on s.id = so.subject_id
    where e.version_id = p_version_id and e.institution_id = p_institution_id and e.active is true
      and not exists (
        select 1 from public.school_time_slots slot
        where slot.institution_id = p_institution_id and slot.active is true
          and slot.day_of_week = e.day_of_week
          and private.normalize_academic_shift(slot.shift) = private.normalize_academic_shift(coalesce(c.shift, 'MATUTINO'))
          and slot.start_time = e.start_time and slot.end_time = e.end_time
      )
  loop
    diagnostics := diagnostics || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'code', 'SCHOOL_TIME_SLOT_INVALID',
      'message', entry_row.class_name || ': ' || entry_row.subject_name || ' está fora de um horário escolar configurado.'
    ));
  end loop;

  for entry_row in
    select e.id, c.name class_name, e.day_of_week, e.start_time, e.end_time, b.name break_name
    from public.timetable_version_entries e
    join public.classes c on c.id = e.class_id
    join public.school_schedule_breaks b
      on b.institution_id = e.institution_id and b.day_of_week = e.day_of_week
      and b.active is true and private.normalize_academic_shift(b.shift) = private.normalize_academic_shift(coalesce(c.shift, 'MATUTINO'))
      and b.start_time < e.end_time and e.start_time < b.end_time
    where e.version_id = p_version_id and e.institution_id = p_institution_id and e.active is true
  loop
    diagnostics := diagnostics || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'code', 'BREAK_CONFLICT',
      'message', entry_row.class_name || ': aula conflita com ' || entry_row.break_name || '.'
    ));
  end loop;

  for entry_row in
    select a.class_name, a.subject_name, a.teacher_name, a.day_of_week, a.start_time, a.end_time, 'CLASS_CONFLICT' code
    from (
      select e1.class_id, c.name class_name, s.name subject_name, e1.day_of_week, e1.start_time, e1.end_time,
             e1.term_id, e1.id, p.full_name teacher_name, e1.subject_offering_id
      from public.timetable_version_entries e1
      join public.classes c on c.id = e1.class_id
      join public.subject_offerings so on so.id = e1.subject_offering_id
      join public.subjects s on s.id = so.subject_id
      join public.profiles p on p.id = so.teacher_profile_id
      where e1.version_id = p_version_id and e1.institution_id = p_institution_id and e1.active is true
    ) a
    join (
      select e2.class_id, e2.day_of_week, e2.start_time, e2.end_time, e2.term_id, e2.id
      from public.timetable_version_entries e2
      where e2.version_id = p_version_id and e2.institution_id = p_institution_id and e2.active is true
    ) b on b.class_id = a.class_id and b.day_of_week = a.day_of_week and b.id > a.id
      and a.start_time < b.end_time and b.start_time < a.end_time
      and (select term.start_date from public.terms term where term.id = a.term_id)
        <= (select term.end_date from public.terms term where term.id = b.term_id)
      and (select term.start_date from public.terms term where term.id = b.term_id)
        <= (select term.end_date from public.terms term where term.id = a.term_id)
  loop
    diagnostics := diagnostics || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'code', entry_row.code, 'message', entry_row.class_name || ': duas aulas ocupam o mesmo horário.'
    ));
  end loop;

  for entry_row in
    select c1.name class_name, s1.name subject_name, e1.day_of_week, e1.start_time, e1.end_time, 'TEACHER_CONFLICT' code
    from public.timetable_version_entries e1
    join public.timetable_version_entries e2 on e2.version_id = e1.version_id and e2.institution_id = e1.institution_id
      and e2.id > e1.id and e2.active is true and e1.active is true
      and e2.day_of_week = e1.day_of_week and e1.start_time < e2.end_time and e2.start_time < e1.end_time
    join public.subject_offerings so1 on so1.id = e1.subject_offering_id
    join public.subject_offerings so2 on so2.id = e2.subject_offering_id and so2.teacher_profile_id = so1.teacher_profile_id
    join public.terms term1 on term1.id = e1.term_id
    join public.terms term2 on term2.id = e2.term_id
    join public.classes c1 on c1.id = e1.class_id
    join public.subjects s1 on s1.id = so1.subject_id
    where e1.version_id = p_version_id and e1.institution_id = p_institution_id
      and term1.start_date <= term2.end_date and term2.start_date <= term1.end_date
  loop
    diagnostics := diagnostics || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'code', entry_row.code, 'message', entry_row.class_name || ': professor em duas aulas simultâneas.'
    ));
  end loop;

  for entry_row in
    select c1.name class_name, e1.day_of_week, e1.start_time, e1.end_time, 'ROOM_CONFLICT' code
    from public.timetable_version_entries e1
    join public.timetable_version_entries e2 on e2.version_id = e1.version_id and e2.institution_id = e1.institution_id
      and e2.id > e1.id and e2.active is true and e1.active is true and e1.room_id is not null
      and e2.room_id = e1.room_id and e2.day_of_week = e1.day_of_week
      and e1.start_time < e2.end_time and e2.start_time < e1.end_time
    join public.terms term1 on term1.id = e1.term_id
    join public.terms term2 on term2.id = e2.term_id
    join public.classes c1 on c1.id = e1.class_id
    where e1.version_id = p_version_id and e1.institution_id = p_institution_id
      and term1.start_date <= term2.end_date and term2.start_date <= term1.end_date
  loop
    diagnostics := diagnostics || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'code', entry_row.code, 'message', entry_row.class_name || ': sala em duas aulas simultâneas.'
    ));
  end loop;

  for entry_row in
    select c.name class_name, s.name subject_name
    from public.timetable_version_entries e
    join public.classes c on c.id = e.class_id
    join public.subject_offerings so on so.id = e.subject_offering_id
    join public.subjects s on s.id = so.subject_id
    where e.version_id = p_version_id and e.institution_id = p_institution_id and e.active is true
      and not exists (
        select 1 from public.teacher_availability availability
        where availability.institution_id = p_institution_id
          and availability.teacher_profile_id = so.teacher_profile_id
          and availability.day_of_week = e.day_of_week
          and availability.active is true
          and availability.start_time <= e.start_time
          and availability.end_time >= e.end_time
      )
  loop
    diagnostics := diagnostics || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'code', 'TEACHER_NOT_AVAILABLE',
      'message', entry_row.class_name || ': professor não está disponível para ' || entry_row.subject_name || '.'
    ));
  end loop;

  for required_row in
    select c.name class_name, t.name term_name, so.id offering_id, cci.weekly_lessons
    from public.subject_offerings so
    join public.classes c on c.id = so.class_id
    join public.terms t on t.id = so.term_id
    join public.class_curriculum_items cci
      on cci.class_id = so.class_id and cci.subject_id = so.subject_id and cci.active is true
    where so.active is true
      and c.active is true
      and c.institution_id = p_institution_id
      and t.academic_year_id = version_row.academic_year_id
      and (version_row.generation_shift = 'TODOS'
        or private.normalize_academic_shift(c.shift) = private.normalize_academic_shift(version_row.generation_shift))
      and (coalesce(cci.is_complementary, false) is false or exists (
        select 1 from public.teacher_subjects skill
        where skill.institution_id = p_institution_id
          and skill.subject_id = so.subject_id and skill.active is true
      ))
      and not exists (
        select 1 from public.timetable_version_entries e
        where e.version_id = p_version_id and e.institution_id = p_institution_id
          and e.subject_offering_id = so.id and e.active is true
      )
  loop
    diagnostics := diagnostics || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'code', 'VERSION_SCOPE_INCOMPLETE',
      'message', required_row.class_name || ' · ' || required_row.term_name || ' ainda não possui aulas desta oferta no rascunho.'
    ));
  end loop;

  for required_row in
    select c.name class_name, s.name subject_name, cci.weekly_lessons,
           count(e.id)::integer positioned_lessons
    from (select distinct class_id, term_id
          from public.timetable_version_entries
          where version_id = p_version_id and institution_id = p_institution_id and active is true) scope
    join public.class_curriculum_items cci on cci.class_id = scope.class_id
    join public.classes c on c.id = cci.class_id and c.institution_id = p_institution_id and c.active is true
    join public.subjects s on s.id = cci.subject_id
    left join public.subject_offerings so on so.class_id = cci.class_id and so.subject_id = cci.subject_id and so.term_id = scope.term_id and so.active is true
    left join public.timetable_version_entries e on e.version_id = p_version_id and e.institution_id = p_institution_id
      and e.active is true and e.class_id = cci.class_id and e.term_id = scope.term_id and e.subject_offering_id = so.id
    where cci.institution_id = p_institution_id and cci.active is true and scope.class_id = cci.class_id
      and (version_row.generation_shift = 'TODOS'
        or private.normalize_academic_shift(c.shift) = private.normalize_academic_shift(version_row.generation_shift))
    group by c.name, s.name, cci.weekly_lessons, scope.term_id
    having count(e.id) <> cci.weekly_lessons
  loop
    diagnostics := diagnostics || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'code', 'WEEKLY_LESSONS_MISMATCH',
      'message', required_row.class_name || ': ' || required_row.subject_name || ' tem ' || required_row.positioned_lessons || '/' || required_row.weekly_lessons || ' aula(s) no rascunho.'
    ));
  end loop;

  select jsonb_array_length(diagnostics) into diagnostic_count;
  return pg_catalog.jsonb_build_object(
    'valid', diagnostic_count = 0,
    'diagnostics', diagnostics,
    'summary', pg_catalog.jsonb_build_object('active_entries', total_entries, 'diagnostic_count', diagnostic_count)
  );
end;
$$;

revoke all on function public.add_timetable_draft_entry(uuid, uuid, uuid, uuid, uuid, uuid, uuid, smallint, time, time, boolean) from public, anon;
revoke all on function public.update_timetable_draft_entry(uuid, uuid, uuid, smallint, time, time, boolean, uuid) from public, anon;
revoke all on function public.remove_timetable_draft_entry(uuid, uuid, uuid) from public, anon;
revoke all on function public.duplicate_timetable_draft_entry(uuid, uuid, uuid, smallint, time, time) from public, anon;
revoke all on function public.copy_timetable_draft_day(uuid, uuid, smallint, smallint) from public, anon;
revoke all on function public.validate_timetable_draft(uuid, uuid) from public, anon;
grant execute on function public.add_timetable_draft_entry(uuid, uuid, uuid, uuid, uuid, uuid, uuid, smallint, time, time, boolean) to authenticated, service_role;
grant execute on function public.update_timetable_draft_entry(uuid, uuid, uuid, smallint, time, time, boolean, uuid) to authenticated, service_role;
grant execute on function public.remove_timetable_draft_entry(uuid, uuid, uuid) to authenticated, service_role;
grant execute on function public.duplicate_timetable_draft_entry(uuid, uuid, uuid, smallint, time, time) to authenticated, service_role;
grant execute on function public.copy_timetable_draft_day(uuid, uuid, smallint, smallint) to authenticated, service_role;
grant execute on function public.validate_timetable_draft(uuid, uuid) to authenticated, service_role;

notify pgrst, 'reload schema';
commit;
