create or replace function public.generate_student_registration_number(
  target_institution_id uuid
)
returns text
language plpgsql
security definer
set search_path to ''
as $$
declare
  current_year integer;
  next_value integer;
begin
  if target_institution_id is null then
    raise exception 'A instituição é obrigatória para gerar o RA.';
  end if;

  current_year := extract(year from current_date)::integer;

  insert into public.student_registration_counters (
    institution_id,
    registration_year,
    last_value
  )
  values (
    target_institution_id,
    current_year,
    1
  )
  on conflict (
    institution_id,
    registration_year
  )
  do update
  set last_value =
    public.student_registration_counters.last_value + 1
  returning last_value
  into next_value;

  if next_value > 9999 then
    raise exception
      'O limite anual de RAs foi atingido para esta instituição.';
  end if;

  return current_year::text ||
    lpad(next_value::text, 4, '0');
end;
$$;

create or replace function public.set_student_registration_number()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  if new.registration_number is null
     or btrim(new.registration_number) = '' then

    new.registration_number :=
      public.generate_student_registration_number(
        new.institution_id
      );
  end if;

  return new;
end;
$$;

revoke all on function public.generate_student_registration_number(uuid) from public;
revoke all on function public.set_student_registration_number() from public;
grant execute on function public.generate_student_registration_number(uuid) to service_role;
grant execute on function public.set_student_registration_number() to service_role;

drop trigger if exists students_generate_registration_number on public.students;

create trigger students_generate_registration_number
before insert on public.students
for each row
execute function public.set_student_registration_number();
