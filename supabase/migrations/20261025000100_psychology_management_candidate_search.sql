create or replace function public.psychology_search_management_candidates(
  target_institution_id uuid,
  search_text text default null,
  class_filter_id uuid default null,
  grade_filter text default null,
  assignment_filter text default 'ALL',
  page_number integer default 1,
  page_size integer default 25
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_search text := nullif(btrim(coalesce(search_text, '')), '');
  v_assignment_filter text := upper(coalesce(assignment_filter, 'ALL'));
  v_page integer := greatest(1, least(coalesce(page_number, 1), 100000));
  v_page_size integer := greatest(1, least(coalesce(page_size, 25), 100));
  v_total integer := 0;
  v_total_pages integer := 1;
  v_professionals jsonb := '[]'::jsonb;
  v_students jsonb := '[]'::jsonb;
  v_classes jsonb := '[]'::jsonb;
  v_grades jsonb := '[]'::jsonb;
begin
  if not private.psychology_is_manager(target_institution_id) then
    raise exception using message = 'NOT_AUTHORIZED', errcode = 'P0001';
  end if;

  if v_assignment_filter not in ('ALL', 'ASSIGNED', 'UNASSIGNED') then
    raise exception using message = 'INVALID_FILTER', errcode = 'P0001';
  end if;

  with people as (
    select profile.id as profile_id, min(profile.full_name) as full_name
      from public.students student
      join public.profiles profile on profile.id = student.profile_id
     where student.institution_id = target_institution_id
       and student.active is true
       and profile.active is true
       and exists (
         select 1 from public.memberships membership
          where membership.profile_id = profile.id
            and membership.institution_id = target_institution_id
            and membership.role = 'STUDENT'::public.user_role
            and membership.active is true
       )
       and (
         v_search is null
         or profile.full_name ilike '%' || v_search || '%'
         or exists (
           select 1
             from public.students searched_student
             left join public.enrollments enrollment
               on enrollment.student_id = searched_student.id
              and enrollment.active is true
              and upper(enrollment.status) = 'ACTIVE'
             left join public.classes class
               on class.id = enrollment.class_id
              and class.institution_id = target_institution_id
              and class.active is true
             left join public.academic_years academic_year
               on academic_year.id = enrollment.academic_year_id
              and academic_year.institution_id = target_institution_id
              and academic_year.active is true
            where searched_student.profile_id = profile.id
              and searched_student.institution_id = target_institution_id
              and searched_student.active is true
              and (
                searched_student.registration_number ilike '%' || v_search || '%'
                or class.name ilike '%' || v_search || '%'
                or class.grade_level ilike '%' || v_search || '%'
                or academic_year.name ilike '%' || v_search || '%'
              )
         )
       )
       and (
         class_filter_id is null
         or exists (
           select 1
             from public.students filtered_student
             join public.enrollments enrollment
               on enrollment.student_id = filtered_student.id
              and enrollment.active is true
              and upper(enrollment.status) = 'ACTIVE'
             join public.classes class
               on class.id = enrollment.class_id
              and class.institution_id = target_institution_id
              and class.academic_year_id = enrollment.academic_year_id
              and class.active is true
             join public.academic_years academic_year
               on academic_year.id = enrollment.academic_year_id
              and academic_year.institution_id = target_institution_id
              and academic_year.active is true
            where filtered_student.profile_id = profile.id
              and filtered_student.institution_id = target_institution_id
              and filtered_student.active is true
              and class.id = class_filter_id
         )
       )
       and (
         nullif(btrim(coalesce(grade_filter, '')), '') is null
         or exists (
           select 1
             from public.students filtered_student
             join public.enrollments enrollment
               on enrollment.student_id = filtered_student.id
              and enrollment.active is true
              and upper(enrollment.status) = 'ACTIVE'
             join public.classes class
               on class.id = enrollment.class_id
              and class.institution_id = target_institution_id
              and class.academic_year_id = enrollment.academic_year_id
              and class.active is true
             join public.academic_years academic_year
               on academic_year.id = enrollment.academic_year_id
              and academic_year.institution_id = target_institution_id
              and academic_year.active is true
            where filtered_student.profile_id = profile.id
              and filtered_student.institution_id = target_institution_id
              and filtered_student.active is true
              and class.grade_level = btrim(grade_filter)
         )
       )
       and (
         v_assignment_filter = 'ALL'
         or (
           exists (
             select 1
               from public.students assigned_student
               join public.psychology_assignments assignment
                 on assignment.student_id = assigned_student.id
                and assignment.institution_id = target_institution_id
                and assignment.active is true
                and assignment.starts_on <= current_date
                and (assignment.ends_on is null or assignment.ends_on >= current_date)
              where assigned_student.profile_id = profile.id
                and assigned_student.institution_id = target_institution_id
                and assigned_student.active is true
           ) = (v_assignment_filter = 'ASSIGNED')
         )
       )
     group by profile.id
  )
  select count(*)::integer into v_total from people;

  v_total_pages := greatest(1, ceil(v_total::numeric / v_page_size)::integer);

  select coalesce(jsonb_agg(jsonb_build_object(
      'profile_id', candidate.profile_id,
      'full_name', candidate.full_name,
      'registrations', registration_rows.registrations
    ) order by candidate.full_name, candidate.profile_id), '[]'::jsonb)
    into v_students
    from (
      with people as (
        select profile.id as profile_id, min(profile.full_name) as full_name
          from public.students student
          join public.profiles profile on profile.id = student.profile_id
         where student.institution_id = target_institution_id
           and student.active is true
           and profile.active is true
           and exists (
             select 1 from public.memberships membership
              where membership.profile_id = profile.id
                and membership.institution_id = target_institution_id
                and membership.role = 'STUDENT'::public.user_role
                and membership.active is true
           )
           and (
             v_search is null
             or profile.full_name ilike '%' || v_search || '%'
             or exists (
               select 1 from public.students searched_student
               left join public.enrollments enrollment
                 on enrollment.student_id = searched_student.id
                and enrollment.active is true
                and upper(enrollment.status) = 'ACTIVE'
               left join public.classes class
                 on class.id = enrollment.class_id
                and class.institution_id = target_institution_id
                and class.active is true
               left join public.academic_years academic_year
                 on academic_year.id = enrollment.academic_year_id
                and academic_year.institution_id = target_institution_id
                and academic_year.active is true
              where searched_student.profile_id = profile.id
                and searched_student.institution_id = target_institution_id
                and searched_student.active is true
                and (searched_student.registration_number ilike '%' || v_search || '%'
                  or class.name ilike '%' || v_search || '%'
                  or class.grade_level ilike '%' || v_search || '%'
                  or academic_year.name ilike '%' || v_search || '%')
             )
           )
           and (
             class_filter_id is null
             or exists (
               select 1 from public.students filtered_student
               join public.enrollments enrollment
                 on enrollment.student_id = filtered_student.id
                and enrollment.active is true and upper(enrollment.status) = 'ACTIVE'
               join public.classes class
                 on class.id = enrollment.class_id
                and class.institution_id = target_institution_id
                and class.academic_year_id = enrollment.academic_year_id
                and class.active is true
               join public.academic_years academic_year
                 on academic_year.id = enrollment.academic_year_id
                and academic_year.institution_id = target_institution_id
                and academic_year.active is true
              where filtered_student.profile_id = profile.id
                and filtered_student.institution_id = target_institution_id
                and filtered_student.active is true
                and class.id = class_filter_id
             )
           )
           and (
             nullif(btrim(coalesce(grade_filter, '')), '') is null
             or exists (
               select 1 from public.students filtered_student
               join public.enrollments enrollment
                 on enrollment.student_id = filtered_student.id
                and enrollment.active is true and upper(enrollment.status) = 'ACTIVE'
               join public.classes class
                 on class.id = enrollment.class_id
                and class.institution_id = target_institution_id
                and class.academic_year_id = enrollment.academic_year_id
                and class.active is true
               join public.academic_years academic_year
                 on academic_year.id = enrollment.academic_year_id
                and academic_year.institution_id = target_institution_id
                and academic_year.active is true
              where filtered_student.profile_id = profile.id
                and filtered_student.institution_id = target_institution_id
                and filtered_student.active is true
                and class.grade_level = btrim(grade_filter)
             )
           )
           and (
             v_assignment_filter = 'ALL'
             or (
               exists (
                 select 1 from public.students assigned_student
                 join public.psychology_assignments assignment
                   on assignment.student_id = assigned_student.id
                  and assignment.institution_id = target_institution_id
                  and assignment.active is true
                  and assignment.starts_on <= current_date
                  and (assignment.ends_on is null or assignment.ends_on >= current_date)
                where assigned_student.profile_id = profile.id
                  and assigned_student.institution_id = target_institution_id
                  and assigned_student.active is true
               ) = (v_assignment_filter = 'ASSIGNED')
             )
           )
         group by profile.id
         order by min(profile.full_name), profile.id
         limit v_page_size offset ((v_page - 1) * v_page_size)
      )
      select * from people
    ) candidate
    cross join lateral (
      select coalesce(jsonb_agg(jsonb_build_object(
        'student_id', student.id,
        'registration_number', student.registration_number,
        'assigned', exists (
          select 1 from public.psychology_assignments assignment
           where assignment.institution_id = target_institution_id
             and assignment.student_id = student.id
             and assignment.active is true
             and assignment.starts_on <= current_date
             and (assignment.ends_on is null or assignment.ends_on >= current_date)
        ),
        'assigned_professionals', coalesce((
          select jsonb_agg(jsonb_build_object('profile_id', active_professional.profile_id,
                                               'full_name', active_professional.full_name)
                           order by active_professional.full_name)
            from (
              select distinct professional_profile.id as profile_id, professional_profile.full_name
                from public.psychology_assignments assignment
                join public.profiles professional_profile
                  on professional_profile.id = assignment.professional_profile_id
               where assignment.institution_id = target_institution_id
                 and assignment.student_id = student.id
                 and assignment.active is true
                 and assignment.starts_on <= current_date
                 and (assignment.ends_on is null or assignment.ends_on >= current_date)
            ) active_professional
        ), '[]'::jsonb),
        'authorization_status', consent.status,
        'enrollments', coalesce((
          select jsonb_agg(jsonb_build_object(
            'class_id', active_class.id,
            'class_name', active_class.name,
            'grade_level', active_class.grade_level,
            'academic_year_id', active_class.academic_year_id,
            'academic_year_name', active_class.academic_year_name
          ) order by active_class.academic_year_name desc, active_class.name)
            from (
              select distinct class.id, class.name, class.grade_level,
                     academic_year.id as academic_year_id, academic_year.name as academic_year_name
                from public.enrollments enrollment
                join public.classes class
                  on class.id = enrollment.class_id
                 and class.institution_id = target_institution_id
                 and class.academic_year_id = enrollment.academic_year_id
                 and class.active is true
                join public.academic_years academic_year
                  on academic_year.id = enrollment.academic_year_id
                 and academic_year.institution_id = target_institution_id
                 and academic_year.active is true
               where enrollment.student_id = student.id
                 and enrollment.active is true
                 and upper(enrollment.status) = 'ACTIVE'
            ) active_class
        ), '[]'::jsonb)
      ) order by student.registration_number, student.id), '[]'::jsonb) as registrations
        from public.students student
        left join public.psychology_authorizations consent
          on consent.institution_id = target_institution_id
         and consent.student_id = student.id
       where student.profile_id = candidate.profile_id
         and student.institution_id = target_institution_id
         and student.active is true
    ) registration_rows;

  select coalesce(jsonb_agg(jsonb_build_object(
      'profile_id', professional.profile_id,
      'full_name', professional.full_name,
      'email', professional.email,
      'registered', professional.registered,
      'verification_status', professional.verification_status,
      'crp_registration', professional.crp_registration,
      'crp_state', professional.crp_state,
      'linked', professional.linked
    ) order by professional.full_name, professional.profile_id), '[]'::jsonb)
    into v_professionals
    from (
      select distinct on (profile.id)
        profile.id as profile_id, profile.full_name, profile.email,
        psychology_professional.profile_id is not null as registered,
        psychology_professional.verification_status,
        psychology_professional.crp_registration,
        psychology_professional.crp_state,
        coalesce(professional_link.active, false) as linked
      from public.memberships membership
      join public.profiles profile on profile.id = membership.profile_id
      left join public.psychology_professionals psychology_professional
        on psychology_professional.profile_id = profile.id
      left join public.psychology_professional_institutions professional_link
        on professional_link.professional_profile_id = profile.id
       and professional_link.institution_id = target_institution_id
      where membership.institution_id = target_institution_id
        and membership.role = 'PSYCHOLOGIST'::public.user_role
        and membership.active is true
        and profile.active is true
      order by profile.id, membership.id
    ) professional;

  select coalesce(jsonb_agg(jsonb_build_object(
      'id', available_class.id,
      'name', available_class.name,
      'grade_level', available_class.grade_level,
      'academic_year_name', available_class.academic_year_name
    ) order by available_class.academic_year_name desc, available_class.name), '[]'::jsonb)
    into v_classes
    from (
      select distinct class.id, class.name, class.grade_level, academic_year.name as academic_year_name
        from public.classes class
        join public.academic_years academic_year
          on academic_year.id = class.academic_year_id
         and academic_year.institution_id = target_institution_id
         and academic_year.active is true
       where class.institution_id = target_institution_id
         and class.active is true
         and exists (
           select 1 from public.enrollments enrollment
           join public.students student on student.id = enrollment.student_id
            and student.institution_id = target_institution_id and student.active is true
           join public.profiles profile on profile.id = student.profile_id and profile.active is true
           where enrollment.class_id = class.id
             and enrollment.academic_year_id = academic_year.id
             and enrollment.active is true
             and upper(enrollment.status) = 'ACTIVE'
             and exists (select 1 from public.memberships membership
                          where membership.profile_id = profile.id
                            and membership.institution_id = target_institution_id
                            and membership.role = 'STUDENT'::public.user_role
                            and membership.active is true)
         )
    ) available_class;

  select coalesce(jsonb_agg(grade.grade_level order by grade.grade_level), '[]'::jsonb)
    into v_grades
    from (
      select distinct class.grade_level
        from public.classes class
        join public.academic_years academic_year
          on academic_year.id = class.academic_year_id
         and academic_year.institution_id = target_institution_id
         and academic_year.active is true
       where class.institution_id = target_institution_id
         and class.active is true
         and class.grade_level is not null
         and exists (
           select 1 from public.enrollments enrollment
           join public.students student on student.id = enrollment.student_id
            and student.institution_id = target_institution_id and student.active is true
           join public.profiles profile on profile.id = student.profile_id and profile.active is true
           where enrollment.class_id = class.id
             and enrollment.academic_year_id = academic_year.id
             and enrollment.active is true
             and upper(enrollment.status) = 'ACTIVE'
             and exists (select 1 from public.memberships membership
                          where membership.profile_id = profile.id
                            and membership.institution_id = target_institution_id
                            and membership.role = 'STUDENT'::public.user_role
                            and membership.active is true)
         )
    ) grade;

  return jsonb_build_object(
    'professionals', v_professionals,
    'students', v_students,
    'page', v_page,
    'page_size', v_page_size,
    'total', v_total,
    'total_pages', v_total_pages,
    'filters', jsonb_build_object('classes', v_classes, 'grades', v_grades)
  );
end;
$$;

revoke all on function public.psychology_search_management_candidates(uuid, text, uuid, text, text, integer, integer)
  from public, anon;
grant execute on function public.psychology_search_management_candidates(uuid, text, uuid, text, text, integer, integer)
  to authenticated;
