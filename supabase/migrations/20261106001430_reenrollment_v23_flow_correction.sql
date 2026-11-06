begin;

-- Return campaign visibility and eligibility per authorized dependent. Keep the
-- V2.1 RPC intact for already deployed clients while the V2.3 client rolls out.
create or replace function public.get_my_reenrollment_status_v23(
  p_institution_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  authorized_students_count integer;
  has_linked_campaign boolean;
  has_source_campaign_enrollment boolean;
  has_ended_campaign boolean;
  has_future_campaign boolean;
  has_ineligible_campaign boolean;
  campaigns_json jsonb;
  state_value text;
begin
  if auth.uid() is null then
    raise exception 'REENROLLMENT_AUTH_REQUIRED' using errcode = '42501';
  end if;
  if not public.can_access_institution(p_institution_id) then
    raise exception 'REENROLLMENT_INSTITUTION_FORBIDDEN' using errcode = '42501';
  end if;

  select count(*) into authorized_students_count
  from public.students student
  where student.institution_id = p_institution_id
    and student.active is true
    and (
      student.profile_id = auth.uid()
      or exists (
        select 1 from public.guardianships guardianship
        where guardianship.student_id = student.id
          and guardianship.guardian_profile_id = auth.uid()
          and guardianship.active is true
      )
    );

  if authorized_students_count = 0 then
    if exists (
      select 1 from public.memberships membership
      where membership.profile_id = auth.uid()
        and membership.institution_id = p_institution_id
        and membership.active is true
        and membership.role = 'GUARDIAN'::public.user_role
    ) then
      return jsonb_build_object('state', 'GUARDIANSHIP_INVALID', 'campaigns', '[]'::jsonb);
    end if;
    return jsonb_build_object('state', 'NO_AUTHORIZED_STUDENTS', 'campaigns', '[]'::jsonb);
  end if;

  select exists (
    select 1 from public.reenrollment_campaigns campaign
    where campaign.institution_id = p_institution_id
      and campaign.academic_calendar_event_id is not null
  ) into has_linked_campaign;

  select exists (
    select 1
    from public.reenrollment_campaigns campaign
    join public.students student
      on student.institution_id = campaign.institution_id
     and student.active is true
     and (
       student.profile_id = auth.uid()
       or exists (
         select 1 from public.guardianships guardianship
         where guardianship.student_id = student.id
           and guardianship.guardian_profile_id = auth.uid()
           and guardianship.active is true
       )
     )
    join public.enrollments enrollment
      on enrollment.student_id = student.id
     and enrollment.academic_year_id = campaign.source_academic_year_id
     and enrollment.active is true
    where campaign.institution_id = p_institution_id
      and campaign.academic_calendar_event_id is not null
  ) into has_source_campaign_enrollment;

  select exists (
    select 1
    from public.reenrollment_campaigns campaign
    join public.students student
      on student.institution_id = campaign.institution_id
     and student.active is true
     and (
       student.profile_id = auth.uid()
       or exists (
         select 1 from public.guardianships guardianship
         where guardianship.student_id = student.id
           and guardianship.guardian_profile_id = auth.uid()
           and guardianship.active is true
       )
     )
    join public.enrollments enrollment
      on enrollment.student_id = student.id
     and enrollment.academic_year_id = campaign.source_academic_year_id
     and enrollment.active is true
    join public.classes class_record
      on class_record.id = enrollment.class_id
     and class_record.institution_id = student.institution_id
     and class_record.active is true
    where campaign.institution_id = p_institution_id
      and coalesce(array_length(campaign.eligible_grade_levels, 1), 0) > 0
      and not (coalesce(class_record.grade_level, '') = any (campaign.eligible_grade_levels))
  ) into has_ineligible_campaign;

  select exists (
    select 1
    from public.reenrollment_campaigns campaign
    join public.students student
      on student.institution_id = campaign.institution_id
     and student.active is true
     and (
       student.profile_id = auth.uid()
       or exists (
         select 1 from public.guardianships guardianship
         where guardianship.student_id = student.id
           and guardianship.guardian_profile_id = auth.uid()
           and guardianship.active is true
       )
     )
    where campaign.institution_id = p_institution_id
      and campaign.status = 'OPEN'
      and campaign.opens_at > now()
  ) into has_future_campaign;

  select exists (
    select 1
    from public.reenrollment_campaigns campaign
    join public.students student
      on student.institution_id = campaign.institution_id
     and student.active is true
     and (
       student.profile_id = auth.uid()
       or exists (
         select 1 from public.guardianships guardianship
         where guardianship.student_id = student.id
           and guardianship.guardian_profile_id = auth.uid()
           and guardianship.active is true
       )
     )
    join public.enrollments enrollment
      on enrollment.student_id = student.id
     and enrollment.academic_year_id = campaign.source_academic_year_id
     and enrollment.active is true
    join public.classes class_record
      on class_record.id = enrollment.class_id
     and class_record.institution_id = student.institution_id
     and class_record.active is true
    where campaign.institution_id = p_institution_id
      and (
        campaign.status in ('CLOSED', 'CANCELLED', 'ARCHIVED')
        or (campaign.status = 'OPEN' and campaign.closes_at <= now())
      )
  ) into has_ended_campaign;

  select coalesce(jsonb_agg(jsonb_build_object(
    'campaign', to_jsonb(campaign),
    'state', case
      when campaign.status <> 'OPEN' or campaign.closes_at <= now() then 'CLOSED'
      when campaign.opens_at > now() then 'UPCOMING'
      else 'OPEN'
    end,
    'eligible_students', dependents.rows
  ) order by campaign.opens_at), '[]'::jsonb)
  into campaigns_json
  from public.reenrollment_campaigns campaign
  cross join lateral (
    select coalesce(jsonb_agg(jsonb_build_object(
      'student_id', student.id,
      'can_confirm', (
        exists (
          select 1 from public.guardianships guardianship
          where guardianship.student_id = student.id
            and guardianship.guardian_profile_id = auth.uid()
            and guardianship.active is true
        ) or (
          student.profile_id = auth.uid()
          and student.birth_date is not null
          and student.birth_date <= (current_date - interval '18 years')::date
        )
      ),
      'eligibility_state', case
        when exists (
          select 1 from public.reenrollment_requests request
          where request.campaign_id = campaign.id
            and request.student_id = student.id
        ) then 'REQUEST_EXISTS'
        when source_enrollment.id is null then 'SOURCE_ENROLLMENT_MISSING'
        when coalesce(array_length(campaign.eligible_grade_levels, 1), 0) > 0
          and not (coalesce(source_enrollment.grade_level, '') = any (campaign.eligible_grade_levels))
          then 'STUDENT_INELIGIBLE'
        else 'ELIGIBLE'
      end,
      'current_grade_level', source_enrollment.grade_level
    ) order by profile.full_name, student.id)), '[]'::jsonb) as rows
    from public.students student
    join public.profiles profile on profile.id = student.profile_id
    left join lateral (
      select enrollment.id, class_record.grade_level
      from public.enrollments enrollment
      join public.classes class_record
        on class_record.id = enrollment.class_id
       and class_record.institution_id = student.institution_id
       and class_record.active is true
      where enrollment.student_id = student.id
        and enrollment.academic_year_id = campaign.source_academic_year_id
        and enrollment.active is true
      order by enrollment.enrolled_at desc nulls last, enrollment.id
      limit 1
    ) source_enrollment on true
    where student.institution_id = p_institution_id
      and student.active is true
      and (
        student.profile_id = auth.uid()
        or exists (
          select 1 from public.guardianships guardianship
          where guardianship.student_id = student.id
            and guardianship.guardian_profile_id = auth.uid()
            and guardianship.active is true
        )
      )
  ) dependents
  where campaign.institution_id = p_institution_id
    and (
      (
        campaign.status = 'OPEN'
        and campaign.closes_at >= now()
        and (campaign.opens_at <= now() or campaign.show_future_notice is true)
      )
      or (
        (campaign.status <> 'OPEN' or campaign.closes_at < now())
        and (
          exists (
            select 1 from public.reenrollment_requests request
            join public.students student on student.id = request.student_id
            where request.campaign_id = campaign.id
              and student.institution_id = p_institution_id
              and (
                student.profile_id = auth.uid()
                or exists (
                  select 1 from public.guardianships guardianship
                  where guardianship.student_id = student.id
                    and guardianship.guardian_profile_id = auth.uid()
                    and guardianship.active is true
                )
              )
          )
          or exists (
            select 1
            from public.students student
            join public.enrollments enrollment
              on enrollment.student_id = student.id
             and enrollment.academic_year_id = campaign.source_academic_year_id
             and enrollment.active is true
            where student.institution_id = p_institution_id
              and student.active is true
              and (
                student.profile_id = auth.uid()
                or exists (
                  select 1 from public.guardianships guardianship
                  where guardianship.student_id = student.id
                    and guardianship.guardian_profile_id = auth.uid()
                    and guardianship.active is true
                )
              )
          )
        )
      )
    )
    and jsonb_array_length(dependents.rows) > 0;

  if jsonb_array_length(campaigns_json) > 0 then
    state_value := 'AVAILABLE';
  elsif has_future_campaign then
    state_value := 'CAMPAIGN_UPCOMING';
  elsif has_ended_campaign then
    state_value := 'CAMPAIGN_ENDED';
  elsif has_ineligible_campaign then
    state_value := 'STUDENT_INELIGIBLE';
  elsif has_linked_campaign and not has_source_campaign_enrollment then
    state_value := 'SOURCE_ENROLLMENT_MISSING';
  else
    state_value := 'NO_CAMPAIGN';
  end if;

  return jsonb_build_object('state', state_value, 'campaigns', campaigns_json);
end;
$$;

revoke all on function public.get_my_reenrollment_status_v23(uuid) from public, anon;
grant execute on function public.get_my_reenrollment_status_v23(uuid) to authenticated;

notify pgrst, 'reload schema';
commit;
