begin;

alter table public.attendance_sessions
  add column if not exists class_activity text null,
  add column if not exists homework text null;

comment on column public.attendance_sessions.class_activity is
  'Registro da atividade realizada durante a aula.';

comment on column public.attendance_sessions.homework is
  'Registro da tarefa proposta para a aula.';

-- Persist the diary fields and attendance records in one transaction. The
-- session is temporarily kept editable while records are upserted so a final
-- submission can close an existing draft without violating closed immutability.
create or replace function public.save_attendance_class_diary(
  p_institution_id uuid,
  p_subject_offering_id uuid,
  p_session_date date,
  p_starts_at time,
  p_ends_at time,
  p_topic text,
  p_class_activity text,
  p_homework text,
  p_notes text,
  p_status text,
  p_records jsonb
)
returns public.attendance_sessions
language plpgsql
security invoker
set search_path = ''
as $$
declare
  session_record public.attendance_sessions%rowtype;
  record_item record;
begin
  if (select auth.uid()) is null then
    raise exception 'ATTENDANCE_FORBIDDEN' using errcode = '42501';
  end if;

  if not private.is_teacher_for_offering(
    p_subject_offering_id,
    p_institution_id
  ) then
    raise exception 'ATTENDANCE_FORBIDDEN' using errcode = '42501';
  end if;

  if p_status not in ('DRAFT', 'OPEN', 'CLOSED') then
    raise exception 'ATTENDANCE_STATUS_INVALID' using errcode = '22023';
  end if;

  if jsonb_typeof(p_records) <> 'array'
     or jsonb_array_length(p_records) = 0 then
    raise exception 'ATTENDANCE_RECORDS_REQUIRED' using errcode = '22023';
  end if;

  select *
    into session_record
  from public.attendance_sessions
  where institution_id = p_institution_id
    and subject_offering_id = p_subject_offering_id
    and session_date = p_session_date
    and starts_at = p_starts_at
    and status <> 'CANCELED';

  if session_record.id is not null
     and session_record.status = 'CLOSED' then
    raise exception 'ATTENDANCE_SESSION_CLOSED' using errcode = '42501';
  end if;

  if session_record.id is not null then
    select *
      into session_record
    from public.attendance_sessions
    where id = session_record.id
    for update;

    if session_record.status = 'CLOSED' then
      raise exception 'ATTENDANCE_SESSION_CLOSED' using errcode = '42501';
    end if;
  end if;

  if session_record.id is null then
    insert into public.attendance_sessions (
      institution_id,
      subject_offering_id,
      session_date,
      starts_at,
      ends_at,
      topic,
      class_activity,
      homework,
      notes,
      status,
      created_by
    ) values (
      p_institution_id,
      p_subject_offering_id,
      p_session_date,
      p_starts_at,
      p_ends_at,
      nullif(trim(p_topic), ''),
      nullif(trim(p_class_activity), ''),
      nullif(trim(p_homework), ''),
      nullif(trim(p_notes), ''),
      'DRAFT',
      (select auth.uid())
    )
    returning * into session_record;
  else
    update public.attendance_sessions
       set starts_at = p_starts_at,
           ends_at = p_ends_at,
           topic = nullif(trim(p_topic), ''),
           class_activity = nullif(trim(p_class_activity), ''),
           homework = nullif(trim(p_homework), ''),
           notes = nullif(trim(p_notes), ''),
           status = 'DRAFT'
     where id = session_record.id
     returning * into session_record;
  end if;

  for record_item in
    select *
    from jsonb_to_recordset(p_records)
      as item(student_id uuid, status text, notes text)
  loop
    if record_item.student_id is null
       or record_item.status not in ('PRESENT', 'ABSENT', 'LATE', 'EXCUSED') then
      raise exception 'ATTENDANCE_RECORD_INVALID' using errcode = '22023';
    end if;

    if not private.is_student_enrolled_for_attendance_session(
      record_item.student_id,
      session_record.id,
      p_institution_id
    ) then
      raise exception 'ATTENDANCE_STUDENT_NOT_ENROLLED' using errcode = '42501';
    end if;

    insert into public.attendance_records (
      institution_id,
      attendance_session_id,
      student_id,
      status,
      notes,
      recorded_by,
      recorded_at
    ) values (
      p_institution_id,
      session_record.id,
      record_item.student_id,
      record_item.status,
      nullif(trim(record_item.notes), ''),
      (select auth.uid()),
      now()
    )
    on conflict (attendance_session_id, student_id)
    do update set
      status = excluded.status,
      notes = excluded.notes,
      recorded_by = excluded.recorded_by,
      recorded_at = excluded.recorded_at;
  end loop;

  update public.attendance_sessions
     set status = p_status,
         closed_at = case
           when p_status = 'CLOSED' then coalesce(closed_at, now())
           else null
         end
   where id = session_record.id
   returning * into session_record;

  return session_record;
end;
$$;

alter function public.save_attendance_class_diary(
  uuid, uuid, date, time, time, text, text, text, text, text, jsonb
) owner to postgres;

revoke all on function public.save_attendance_class_diary(
  uuid, uuid, date, time, time, text, text, text, text, text, jsonb
) from public, anon, authenticated;

grant execute on function public.save_attendance_class_diary(
  uuid, uuid, date, time, time, text, text, text, text, text, jsonb
) to authenticated;

create or replace function private.can_write_attendance_session(
  target_session_id uuid,
  target_institution_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.attendance_sessions as attendance_session
    where attendance_session.id = target_session_id
      and attendance_session.institution_id = target_institution_id
      and attendance_session.status <> 'CLOSED'
      and private.is_teacher_for_offering(
        attendance_session.subject_offering_id,
        target_institution_id
      )
  );
$$;

alter function private.can_write_attendance_session(uuid, uuid)
  owner to postgres;

revoke all on function private.can_write_attendance_session(uuid, uuid)
  from public, anon, authenticated;

grant execute on function private.can_write_attendance_session(uuid, uuid)
  to authenticated, service_role;

-- DELETE is granted at the table level so RLS can express the editable-session
-- rule explicitly. The policies below keep institutional roles read-only and
-- prevent deletion after a session is CLOSED.
grant delete on table public.attendance_sessions, public.attendance_records
  to authenticated;

create policy attendance_sessions_delete_policy
on public.attendance_sessions
for delete
to authenticated
using (
  private.is_teacher_for_offering(
    subject_offering_id,
    institution_id
  )
  and status <> 'CLOSED'
);

create policy attendance_records_delete_policy
on public.attendance_records
for delete
to authenticated
using (
  private.can_write_attendance_session(
    attendance_session_id,
    institution_id
  )
);

-- Only the assigned teacher writes attendance. Institutional roles retain
-- read access, but do not create or mutate diary sessions in this MVP.
alter policy attendance_sessions_insert_policy
  on public.attendance_sessions
  with check (
    private.offering_belongs_to_institution(
      subject_offering_id,
      institution_id
    )
    and private.is_teacher_for_offering(
      subject_offering_id,
      institution_id
    )
    and created_by = (select auth.uid())
  );

alter policy attendance_sessions_update_policy
  on public.attendance_sessions
  using (
    private.is_teacher_for_offering(subject_offering_id, institution_id)
    and status <> 'CLOSED'
  );

alter policy attendance_sessions_update_policy
  on public.attendance_sessions
  with check (
    private.offering_belongs_to_institution(
      subject_offering_id,
      institution_id
    )
    and private.is_teacher_for_offering(
      subject_offering_id,
      institution_id
    )
    and created_by = (select auth.uid())
  );

alter policy attendance_records_update_policy
  on public.attendance_records
  using (
    private.can_write_attendance_session(
      attendance_session_id,
      institution_id
    )
  )
  with check (
    private.can_write_attendance_session(
      attendance_session_id,
      institution_id
    )
    and private.is_student_enrolled_for_attendance_session(
      student_id,
      attendance_session_id,
      institution_id
    )
    and recorded_by = (select auth.uid())
  );

alter policy attendance_records_insert_policy
  on public.attendance_records
  with check (
    private.can_write_attendance_session(
      attendance_session_id,
      institution_id
    )
    and private.is_student_enrolled_for_attendance_session(
      student_id,
      attendance_session_id,
      institution_id
    )
    and recorded_by = (select auth.uid())
  );

create or replace function private.prevent_teacher_closed_attendance_session_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.status = 'CLOSED'
       and private.is_teacher_for_offering(
         old.subject_offering_id,
         old.institution_id
       ) then
      raise exception 'ATTENDANCE_SESSION_CLOSED' using errcode = '42501';
    end if;

    return old;
  end if;

  if old.status = 'CLOSED'
     and private.is_teacher_for_offering(
       old.subject_offering_id,
       old.institution_id
     )
     and (
       old.institution_id is distinct from new.institution_id
       or old.subject_offering_id is distinct from new.subject_offering_id
       or old.session_date is distinct from new.session_date
       or old.starts_at is distinct from new.starts_at
       or old.ends_at is distinct from new.ends_at
       or old.topic is distinct from new.topic
       or old.class_activity is distinct from new.class_activity
       or old.homework is distinct from new.homework
       or old.notes is distinct from new.notes
       or old.status is distinct from new.status
       or old.created_by is distinct from new.created_by
       or old.closed_at is distinct from new.closed_at
     ) then
    raise exception 'ATTENDANCE_SESSION_CLOSED' using errcode = '42501';
  end if;

  return new;
end;
$$;

alter function private.prevent_teacher_closed_attendance_session_mutation()
  owner to postgres;

revoke all on function private.prevent_teacher_closed_attendance_session_mutation()
  from public, anon, authenticated;

grant execute on function private.prevent_teacher_closed_attendance_session_mutation()
  to service_role;

drop trigger if exists attendance_sessions_prevent_closed_teacher_mutation
  on public.attendance_sessions;

create trigger attendance_sessions_prevent_closed_teacher_mutation
before update or delete on public.attendance_sessions
for each row
execute function private.prevent_teacher_closed_attendance_session_mutation();

create or replace function private.prevent_teacher_closed_attendance_record_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  attendance_session public.attendance_sessions%rowtype;
begin
  if tg_op = 'DELETE' then
    select *
      into attendance_session
    from public.attendance_sessions
    where id = old.attendance_session_id;
  else
    select *
      into attendance_session
    from public.attendance_sessions
    where id = new.attendance_session_id;
  end if;

  if attendance_session.status = 'CLOSED'
     and private.is_teacher_for_offering(
       attendance_session.subject_offering_id,
       attendance_session.institution_id
     ) then
    raise exception 'ATTENDANCE_SESSION_CLOSED' using errcode = '42501';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

alter function private.prevent_teacher_closed_attendance_record_mutation()
  owner to postgres;

revoke all on function private.prevent_teacher_closed_attendance_record_mutation()
  from public, anon, authenticated;

grant execute on function private.prevent_teacher_closed_attendance_record_mutation()
  to service_role;

drop trigger if exists attendance_records_prevent_closed_teacher_mutation
  on public.attendance_records;

create trigger attendance_records_prevent_closed_teacher_mutation
before insert or update or delete on public.attendance_records
for each row
execute function private.prevent_teacher_closed_attendance_record_mutation();

commit;
