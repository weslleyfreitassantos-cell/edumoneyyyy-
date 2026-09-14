-- Keep the administrative student list paginated and tenant-scoped in Postgres.
create or replace function public.list_students_page(
  p_institution_id uuid,
  p_search text default null,
  p_limit integer default 25,
  p_offset integer default 0
)
returns table (
  id uuid,
  profile_id uuid,
  institution_id uuid,
  registration_number text,
  active boolean,
  full_name text,
  email text,
  total_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with filtered_students as (
    select
      student.id,
      student.profile_id,
      student.institution_id,
      student.registration_number,
      student.active,
      profile.full_name,
      profile.email,
      count(*) over () as total_count
    from public.students as student
    join public.profiles as profile
      on profile.id = student.profile_id
    where student.institution_id = p_institution_id
      and (
        nullif(btrim(p_search), '') is null
        or student.registration_number ilike '%' || btrim(p_search) || '%'
        or profile.full_name ilike '%' || btrim(p_search) || '%'
        or profile.email ilike '%' || btrim(p_search) || '%'
      )
    order by student.created_at desc, student.id desc
    limit greatest(least(coalesce(p_limit, 25), 100), 1)
    offset greatest(coalesce(p_offset, 0), 0)
  )
  select
    filtered_students.id,
    filtered_students.profile_id,
    filtered_students.institution_id,
    filtered_students.registration_number,
    filtered_students.active,
    filtered_students.full_name,
    filtered_students.email,
    filtered_students.total_count
  from filtered_students;
$$;

revoke all on function public.list_students_page(uuid, text, integer, integer)
  from public, anon;
grant execute on function public.list_students_page(uuid, text, integer, integer)
  to authenticated;
