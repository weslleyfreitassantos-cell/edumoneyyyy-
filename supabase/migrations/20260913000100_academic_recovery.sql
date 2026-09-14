begin;

alter table public.student_term_results
  add column if not exists recovery_percentage numeric(5, 2),
  add column if not exists final_grade_percentage numeric(5, 2),
  add column if not exists original_result_status text,
  add column if not exists composition_rule text;

alter table public.student_term_results
  drop constraint if exists student_term_results_recovery_percentage_valid,
  drop constraint if exists student_term_results_final_grade_percentage_valid,
  drop constraint if exists student_term_results_original_status_valid,
  drop constraint if exists student_term_results_composition_rule_valid;

alter table public.student_term_results
  add constraint student_term_results_recovery_percentage_valid
    check (
      recovery_percentage is null
      or (recovery_percentage >= 0 and recovery_percentage <= 100)
    ),
  add constraint student_term_results_final_grade_percentage_valid
    check (
      final_grade_percentage is null
      or (final_grade_percentage >= 0 and final_grade_percentage <= 100)
    ),
  add constraint student_term_results_original_status_valid
    check (
      original_result_status is null
      or original_result_status in (
        'PENDING',
        'APPROVED',
        'FAILED_BY_GRADE',
        'FAILED_BY_ATTENDANCE',
        'FAILED_BY_GRADE_AND_ATTENDANCE'
      )
    ),
  add constraint student_term_results_composition_rule_valid
    check (
      composition_rule is null
      or composition_rule = 'HIGHEST_SCORE_V1'
    );

update public.student_term_results
set
  final_grade_percentage = coalesce(final_grade_percentage, grade_percentage),
  original_result_status = coalesce(original_result_status, result_status)
where final_grade_percentage is null
   or original_result_status is null;

comment on column public.student_term_results.grade_percentage is
  'Original grade percentage calculated from ordinary assessments.';
comment on column public.student_term_results.recovery_percentage is
  'Published academic recovery percentage applied at term closing.';
comment on column public.student_term_results.final_grade_percentage is
  'Effective grade percentage after the recovery composition rule.';
comment on column public.student_term_results.original_result_status is
  'Result status before applying a published recovery.';
comment on column public.student_term_results.composition_rule is
  'Versioned rule used to compose the effective result.';

create table public.student_term_recoveries (
  id uuid primary key default extensions.uuid_generate_v4(),
  institution_id uuid not null
    references public.institutions(id)
    on delete cascade,
  academic_year_id uuid not null
    references public.academic_years(id)
    on delete restrict,
  term_id uuid not null
    references public.terms(id)
    on delete restrict,
  subject_offering_id uuid not null
    references public.subject_offerings(id)
    on delete restrict,
  student_id uuid not null
    references public.students(id)
    on delete restrict,
  status text not null default 'DRAFT',
  recovery_percentage numeric(5, 2) not null,
  composition_rule text not null default 'HIGHEST_SCORE_V1',
  notes text,
  recorded_by uuid not null
    references public.profiles(id)
    on delete restrict,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint student_term_recoveries_status_valid
    check (status in ('DRAFT', 'PUBLISHED', 'CANCELED')),
  constraint student_term_recoveries_percentage_valid
    check (recovery_percentage >= 0 and recovery_percentage <= 100),
  constraint student_term_recoveries_rule_valid
    check (composition_rule = 'HIGHEST_SCORE_V1'),
  constraint student_term_recoveries_published_at_valid
    check (status <> 'PUBLISHED' or published_at is not null),
  constraint student_term_recoveries_student_offering_term_unique
    unique (institution_id, student_id, subject_offering_id, term_id)
);

comment on table public.student_term_recoveries is
  'Versioned note recovery record for one student, offering and term.';

create index student_term_recoveries_institution_term_idx
  on public.student_term_recoveries (institution_id, term_id, status);
create index student_term_recoveries_offering_idx
  on public.student_term_recoveries (subject_offering_id, term_id, status);
create index student_term_recoveries_student_idx
  on public.student_term_recoveries (student_id, institution_id, status);

create trigger student_term_recoveries_touch_updated_at
before update on public.student_term_recoveries
for each row
execute function public.touch_academic_record_updated_at();

create or replace function private.academic_recovery_context_is_valid(
  target_institution_id uuid,
  target_academic_year_id uuid,
  target_term_id uuid,
  target_subject_offering_id uuid,
  target_student_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.subject_offerings as offering
    join public.classes as class_record
      on class_record.id = offering.class_id
    join public.subjects as subject_record
      on subject_record.id = offering.subject_id
    join public.terms as term_record
      on term_record.id = offering.term_id
    join public.academic_years as year_record
      on year_record.id = term_record.academic_year_id
    join public.students as student
      on student.id = target_student_id
    join public.enrollments as enrollment
      on enrollment.student_id = student.id
     and enrollment.class_id = offering.class_id
     and enrollment.academic_year_id = target_academic_year_id
    where offering.id = target_subject_offering_id
      and offering.term_id = target_term_id
      and offering.active is true
      and class_record.institution_id = target_institution_id
      and class_record.academic_year_id = target_academic_year_id
      and class_record.active is true
      and subject_record.institution_id = target_institution_id
      and subject_record.active is true
      and term_record.academic_year_id = target_academic_year_id
      and term_record.active is true
      and year_record.institution_id = target_institution_id
      and year_record.active is true
      and student.institution_id = target_institution_id
      and student.active is true
      and enrollment.active is true
      and upper(enrollment.status) = 'ACTIVE'
  );
$$;

create or replace function private.can_write_academic_recovery(
  target_institution_id uuid,
  target_academic_year_id uuid,
  target_term_id uuid,
  target_subject_offering_id uuid,
  target_student_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    private.is_teacher_for_offering(
      target_subject_offering_id,
      target_institution_id
    )
    and private.academic_recovery_context_is_valid(
      target_institution_id,
      target_academic_year_id,
      target_term_id,
      target_subject_offering_id,
      target_student_id
    )
    and not exists (
      select 1
      from public.term_closures as closure
      where closure.institution_id = target_institution_id
        and closure.academic_year_id = target_academic_year_id
        and closure.term_id = target_term_id
        and closure.subject_offering_id = target_subject_offering_id
        and closure.status = 'CLOSED'
    );
$$;

create or replace function private.prevent_invalid_academic_recovery_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.term_closures as closure
    where closure.institution_id = coalesce(new.institution_id, old.institution_id)
      and closure.academic_year_id = coalesce(new.academic_year_id, old.academic_year_id)
      and closure.term_id = coalesce(new.term_id, old.term_id)
      and closure.subject_offering_id = coalesce(new.subject_offering_id, old.subject_offering_id)
      and closure.status = 'CLOSED'
  ) then
    raise exception
      'Recuperacao nao pode ser alterada enquanto o periodo estiver fechado.'
      using errcode = '23514';
  end if;

  if tg_op <> 'DELETE' and new.status = 'PUBLISHED'
      and new.published_at is null then
    raise exception
      'Recuperacao publicada exige data de publicacao.'
      using errcode = '23514';
  end if;

  if tg_op <> 'DELETE' and new.status in ('DRAFT', 'PUBLISHED')
      and not exists (
        select 1
        from public.student_term_results as result
        where result.institution_id = new.institution_id
          and result.academic_year_id = new.academic_year_id
          and result.term_id = new.term_id
          and result.subject_offering_id = new.subject_offering_id
          and result.student_id = new.student_id
          and coalesce(result.original_result_status, result.result_status)
            in ('FAILED_BY_GRADE', 'FAILED_BY_GRADE_AND_ATTENDANCE')
      ) then
    raise exception
      'Aluno nao esta elegivel para recuperacao de nota.'
      using errcode = '23514';
  end if;

  if tg_op = 'UPDATE'
      and old.status = 'PUBLISHED'
      and new.status = 'DRAFT' then
    raise exception
      'Recuperacao publicada nao pode voltar para rascunho.'
      using errcode = '23514';
  end if;

  return coalesce(new, old);
end;
$$;

create trigger student_term_recoveries_prevent_invalid_change
before insert or update or delete on public.student_term_recoveries
for each row
execute function private.prevent_invalid_academic_recovery_change();

create or replace function private.apply_published_academic_recovery()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  recovery_row public.student_term_recoveries;
  policy_row public.academic_policies;
  effective_grade numeric;
begin
  new.original_result_status = new.result_status;
  new.final_grade_percentage = new.grade_percentage;
  new.recovery_percentage = null;
  new.composition_rule = null;

  select * into recovery_row
  from public.student_term_recoveries as recovery
  where recovery.institution_id = new.institution_id
    and recovery.academic_year_id = new.academic_year_id
    and recovery.term_id = new.term_id
    and recovery.subject_offering_id = new.subject_offering_id
    and recovery.student_id = new.student_id
    and recovery.status = 'PUBLISHED';

  if found and new.grade_percentage is not null then
    select * into policy_row
    from public.academic_policies as policy
    where policy.institution_id = new.institution_id
      and policy.academic_year_id = new.academic_year_id
      and policy.active is true
    limit 1;

    effective_grade := greatest(
      new.grade_percentage,
      recovery_row.recovery_percentage
    );

    if found then
      effective_grade := round(effective_grade, policy_row.decimal_places);
    end if;

    new.recovery_percentage = recovery_row.recovery_percentage;
    new.final_grade_percentage = effective_grade;
    new.composition_rule = recovery_row.composition_rule;

    if policy_row.id is not null and new.attendance_percentage is not null then
      if effective_grade >= policy_row.minimum_grade_percentage
          and new.attendance_percentage >= policy_row.minimum_attendance_percentage then
        new.result_status = 'APPROVED';
      elsif effective_grade < policy_row.minimum_grade_percentage
          and new.attendance_percentage < policy_row.minimum_attendance_percentage then
        new.result_status = 'FAILED_BY_GRADE_AND_ATTENDANCE';
      elsif effective_grade < policy_row.minimum_grade_percentage then
        new.result_status = 'FAILED_BY_GRADE';
      else
        new.result_status = 'FAILED_BY_ATTENDANCE';
      end if;
    end if;
  end if;

  return new;
end;
$$;

create trigger student_term_results_apply_recovery
before insert or update on public.student_term_results
for each row
when (new.finalized_at is not null)
execute function private.apply_published_academic_recovery();

create or replace function public.save_academic_recovery(
  p_institution_id uuid,
  p_academic_year_id uuid,
  p_term_id uuid,
  p_subject_offering_id uuid,
  p_student_id uuid,
  p_recovery_percentage numeric,
  p_status text default 'DRAFT',
  p_notes text default null
)
returns public.student_term_recoveries
language plpgsql
security definer
set search_path = ''
as $$
declare
  recovery_row public.student_term_recoveries;
  existing_status text;
begin
  if auth.uid() is null then
    raise exception 'Autenticacao necessaria.' using errcode = '42501';
  end if;

  if p_status not in ('DRAFT', 'PUBLISHED') then
    raise exception 'Status de recuperacao invalido.' using errcode = '23514';
  end if;

  if p_recovery_percentage is null
      or p_recovery_percentage < 0
      or p_recovery_percentage > 100 then
    raise exception 'A recuperacao deve estar entre 0 e 100.' using errcode = '23514';
  end if;

  if not private.can_write_academic_recovery(
    p_institution_id,
    p_academic_year_id,
    p_term_id,
    p_subject_offering_id,
    p_student_id
  ) then
    raise exception 'Usuario sem permissao para registrar esta recuperacao.' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.student_term_results as result
    where result.institution_id = p_institution_id
      and result.academic_year_id = p_academic_year_id
      and result.term_id = p_term_id
      and result.subject_offering_id = p_subject_offering_id
      and result.student_id = p_student_id
      and coalesce(result.original_result_status, result.result_status)
        in ('FAILED_BY_GRADE', 'FAILED_BY_GRADE_AND_ATTENDANCE')
  ) then
    raise exception 'Aluno nao esta elegivel para recuperacao de nota.' using errcode = '23514';
  end if;

  select status into existing_status
  from public.student_term_recoveries
  where institution_id = p_institution_id
    and student_id = p_student_id
    and subject_offering_id = p_subject_offering_id
    and term_id = p_term_id;

  if existing_status = 'PUBLISHED' and p_status = 'DRAFT' then
    raise exception 'Recuperacao publicada nao pode voltar para rascunho.' using errcode = '23514';
  end if;

  insert into public.student_term_recoveries (
    institution_id,
    academic_year_id,
    term_id,
    subject_offering_id,
    student_id,
    status,
    recovery_percentage,
    composition_rule,
    notes,
    recorded_by,
    published_at
  )
  values (
    p_institution_id,
    p_academic_year_id,
    p_term_id,
    p_subject_offering_id,
    p_student_id,
    p_status,
    round(p_recovery_percentage, 2),
    'HIGHEST_SCORE_V1',
    nullif(trim(p_notes), ''),
    auth.uid(),
    case when p_status = 'PUBLISHED' then coalesce(
      (select published_at from public.student_term_recoveries
       where institution_id = p_institution_id
         and student_id = p_student_id
         and subject_offering_id = p_subject_offering_id
         and term_id = p_term_id),
      now()
    ) else null end
  )
  on conflict (institution_id, student_id, subject_offering_id, term_id)
  do update set
    status = excluded.status,
    recovery_percentage = excluded.recovery_percentage,
    composition_rule = excluded.composition_rule,
    notes = excluded.notes,
    recorded_by = auth.uid(),
    published_at = excluded.published_at
  returning * into recovery_row;

  return recovery_row;
end;
$$;

create or replace function public.cancel_academic_recovery(
  p_institution_id uuid,
  p_recovery_id uuid
)
returns public.student_term_recoveries
language plpgsql
security definer
set search_path = ''
as $$
declare
  recovery_row public.student_term_recoveries;
begin
  select * into recovery_row
  from public.student_term_recoveries
  where id = p_recovery_id
    and institution_id = p_institution_id;

  if not found or not private.can_write_academic_recovery(
    recovery_row.institution_id,
    recovery_row.academic_year_id,
    recovery_row.term_id,
    recovery_row.subject_offering_id,
    recovery_row.student_id
  ) then
    raise exception 'Usuario sem permissao para cancelar esta recuperacao.' using errcode = '42501';
  end if;

  update public.student_term_recoveries
  set status = 'CANCELED', recorded_by = auth.uid()
  where id = p_recovery_id
  returning * into recovery_row;

  return recovery_row;
end;
$$;

alter function private.academic_recovery_context_is_valid(uuid, uuid, uuid, uuid, uuid) owner to postgres;
alter function private.can_write_academic_recovery(uuid, uuid, uuid, uuid, uuid) owner to postgres;
alter function private.prevent_invalid_academic_recovery_change() owner to postgres;
alter function private.apply_published_academic_recovery() owner to postgres;
alter function public.save_academic_recovery(uuid, uuid, uuid, uuid, uuid, numeric, text, text) owner to postgres;
alter function public.cancel_academic_recovery(uuid, uuid) owner to postgres;

revoke all on function private.academic_recovery_context_is_valid(uuid, uuid, uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function private.can_write_academic_recovery(uuid, uuid, uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function private.prevent_invalid_academic_recovery_change() from public, anon, authenticated;
revoke all on function private.apply_published_academic_recovery() from public, anon, authenticated;
revoke all on function public.save_academic_recovery(uuid, uuid, uuid, uuid, uuid, numeric, text, text) from public, anon;
revoke all on function public.cancel_academic_recovery(uuid, uuid) from public, anon;
grant execute on function public.save_academic_recovery(uuid, uuid, uuid, uuid, uuid, numeric, text, text) to authenticated, service_role;
grant execute on function public.cancel_academic_recovery(uuid, uuid) to authenticated, service_role;

alter table public.student_term_recoveries enable row level security;
revoke all on table public.student_term_recoveries from anon, authenticated;
grant select, insert, update on table public.student_term_recoveries to authenticated;
grant all on table public.student_term_recoveries to service_role;

drop policy if exists student_term_recoveries_select_policy on public.student_term_recoveries;
create policy student_term_recoveries_select_policy
on public.student_term_recoveries
for select
to authenticated
using (
  public.can_manage_institution_operations(institution_id)
  or private.is_teacher_for_offering(subject_offering_id, institution_id)
  or (
    status = 'PUBLISHED'
    and (
      private.is_student_owner(student_id, institution_id)
      or exists (
        select 1
        from public.guardianships as guardianship
        where guardianship.student_id = student_term_recoveries.student_id
          and guardianship.guardian_profile_id = auth.uid()
          and guardianship.active is true
      )
    )
  )
);

drop policy if exists student_term_recoveries_insert_policy on public.student_term_recoveries;
create policy student_term_recoveries_insert_policy
on public.student_term_recoveries
for insert
to authenticated
with check (
  status = 'DRAFT'
  and private.can_write_academic_recovery(
    institution_id,
    academic_year_id,
    term_id,
    subject_offering_id,
    student_id
  )
);

drop policy if exists student_term_recoveries_update_policy on public.student_term_recoveries;
create policy student_term_recoveries_update_policy
on public.student_term_recoveries
for update
to authenticated
using (
  private.can_write_academic_recovery(
    institution_id,
    academic_year_id,
    term_id,
    subject_offering_id,
    student_id
  )
)
with check (
  private.can_write_academic_recovery(
    institution_id,
    academic_year_id,
    term_id,
    subject_offering_id,
    student_id
  )
);

drop policy if exists student_term_recoveries_delete_policy on public.student_term_recoveries;
create policy student_term_recoveries_delete_policy
on public.student_term_recoveries
for delete
to authenticated
using (
  status <> 'PUBLISHED'
  and private.can_write_academic_recovery(
    institution_id,
    academic_year_id,
    term_id,
    subject_offering_id,
    student_id
  )
);

notify pgrst, 'reload schema';
commit;
