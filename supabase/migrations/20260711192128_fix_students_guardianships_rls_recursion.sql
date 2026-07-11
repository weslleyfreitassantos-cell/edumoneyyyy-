begin;

create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

-- Consulta guardianships sem disparar novamente as policies da tabela.
create or replace function private.is_guardian_of_student(
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
    from public.guardianships as guardianship
    where guardianship.student_id = target_student_id
      and guardianship.guardian_profile_id = auth.uid()
      and guardianship.active is true
  );
$$;

-- Consulta o aluno sem disparar novamente a policy de students.
create or replace function private.can_manage_student(
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
    from public.students as student
    where student.id = target_student_id
      and public.can_manage_institution_operations(
        student.institution_id
      )
  );
$$;

alter function private.is_guardian_of_student(uuid)
  owner to postgres;

alter function private.can_manage_student(uuid)
  owner to postgres;

drop policy if exists students_select_policy
  on public.students;

create policy students_select_policy
on public.students
for select
to authenticated
using (
  public.can_manage_institution_operations(institution_id)
  or profile_id = auth.uid()
  or private.is_guardian_of_student(id)
);

drop policy if exists guardianships_select_policy
  on public.guardianships;

create policy guardianships_select_policy
on public.guardianships
for select
to authenticated
using (
  guardian_profile_id = auth.uid()
  or private.can_manage_student(student_id)
);

drop policy if exists guardianships_update_policy
  on public.guardianships;

create policy guardianships_update_policy
on public.guardianships
for update
to authenticated
using (
  private.can_manage_student(student_id)
)
with check (
  private.can_manage_student(student_id)
);

revoke all
on function private.is_guardian_of_student(uuid)
from public, anon, authenticated;

revoke all
on function private.can_manage_student(uuid)
from public, anon, authenticated;

grant execute
on function private.is_guardian_of_student(uuid)
to authenticated, service_role;

grant execute
on function private.can_manage_student(uuid)
to authenticated, service_role;

commit;