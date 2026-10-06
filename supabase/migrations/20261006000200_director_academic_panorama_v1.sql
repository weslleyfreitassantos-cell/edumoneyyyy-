begin;

create or replace function public.get_director_academic_panorama_v1(
  p_institution_id uuid,
  p_from_date date,
  p_to_date date,
  p_class_id uuid default null,
  p_term_id uuid default null,
  p_academic_year_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_pending_to_date date;
  v_result jsonb;
begin
  if p_institution_id is null
     or p_from_date is null
     or p_to_date is null
     or p_from_date > p_to_date then
    raise exception using
      errcode = '22023',
      message = 'Instituição e intervalo de datas válidos são obrigatórios.';
  end if;

  if not public.can_manage_institution_operations(p_institution_id) then
    raise exception using
      errcode = '42501',
      message = 'Sem permissão para consultar o panorama acadêmico da instituição.';
  end if;

  v_pending_to_date := least(
    p_to_date,
    (current_timestamp at time zone 'America/Sao_Paulo')::date
  );

  with
  selected_offerings as materialized (
    select
      offering.id,
      offering.active as offering_active,
      offering.class_id,
      school_class.name as class_name,
      offering.subject_id,
      offering.term_id,
      term.academic_year_id,
      term.start_date as term_start_date,
      term.end_date as term_end_date
    from public.subject_offerings as offering
    join public.classes as school_class
      on school_class.id = offering.class_id
     and school_class.institution_id = p_institution_id
     and school_class.active is not false
    join public.subjects as subject
      on subject.id = offering.subject_id
     and subject.institution_id = p_institution_id
     and subject.active is not false
    left join public.terms as term
      on term.id = offering.term_id
    where offering.active is not false
      and (p_class_id is null or offering.class_id = p_class_id)
      and (p_term_id is null or offering.term_id = p_term_id)
      and (p_academic_year_id is null or term.academic_year_id = p_academic_year_id)
  ),
  selected_sessions as materialized (
    select
      session_record.id,
      session_record.session_date,
      session_record.subject_offering_id,
      offering.class_id,
      offering.class_name
    from public.attendance_sessions as session_record
    join selected_offerings as offering
      on offering.id = session_record.subject_offering_id
    where session_record.institution_id = p_institution_id
      and session_record.session_date between p_from_date and p_to_date
      and session_record.status <> 'CANCELED'
  ),
  selected_attendance_records as materialized (
    select
      session_record.id as session_id,
      session_record.session_date,
      session_record.subject_offering_id,
      session_record.class_id,
      session_record.class_name,
      attendance_record.student_id,
      attendance_record.status
    from selected_sessions as session_record
    join public.attendance_records as attendance_record
      on attendance_record.attendance_session_id = session_record.id
     and attendance_record.institution_id = p_institution_id
  ),
  attendance_summary as (
    select
      count(*)::integer as total_records,
      count(*) filter (where upper(trim(status)) in ('PRESENT', 'LATE'))::integer as present_records,
      count(*) filter (where upper(trim(status)) = 'ABSENT')::integer as absent_records,
      count(*) filter (where upper(trim(status)) = 'LATE')::integer as late_records,
      count(*) filter (where upper(trim(status)) = 'EXCUSED')::integer as excused_records
    from selected_attendance_records
  ),
  attendance_weekly as (
    select
      date_trunc('week', session_date::timestamp)::date as week_start,
      count(*)::integer as total_records,
      count(*) filter (where upper(trim(status)) in ('PRESENT', 'LATE'))::integer as present_records
    from selected_attendance_records
    group by 1
    having count(*) > 0
  ),
  attendance_student_totals as (
    select
      student_id,
      count(*)::integer as total_records,
      count(*) filter (where upper(trim(status)) in ('PRESENT', 'LATE'))::integer as present_records
    from selected_attendance_records
    group by student_id
  ),
  attendance_student_context as (
    select distinct on (student_id)
      student_id,
      class_id,
      class_name
    from selected_attendance_records
    order by student_id, session_date desc, subject_offering_id desc, session_id desc
  ),
  attendance_students as (
    select
      totals.student_id,
      context.class_id,
      context.class_name,
      totals.total_records,
      totals.present_records
    from attendance_student_totals as totals
    left join attendance_student_context as context
      on context.student_id = totals.student_id
  ),
  selected_assessments as materialized (
    select
      assessment.id,
      assessment.subject_offering_id,
      assessment.assessment_date,
      assessment.max_score,
      assessment.weight,
      offering.class_id,
      offering.class_name
    from public.assessments as assessment
    join selected_offerings as offering
      on offering.id = assessment.subject_offering_id
    where assessment.institution_id = p_institution_id
      and assessment.assessment_date between p_from_date and p_to_date
      and assessment.status in ('PUBLISHED', 'CLOSED')
      and (p_term_id is null or assessment.term_id = p_term_id)
  ),
  selected_grades as materialized (
    select
      grade.assessment_id,
      grade.student_id,
      grade.status,
      grade.score,
      assessment.max_score,
      assessment.weight
    from public.grades as grade
    join selected_assessments as assessment
      on assessment.id = grade.assessment_id
    where grade.institution_id = p_institution_id
  ),
  expected_enrollments as (
    select distinct
      assessment.id as assessment_id,
      enrollment.student_id
    from selected_assessments as assessment
    join public.enrollments as enrollment
      on enrollment.class_id = assessment.class_id
     and enrollment.active is not false
     and coalesce(nullif(upper(trim(enrollment.status)), ''), 'ACTIVE') = 'ACTIVE'
     and (
       enrollment.enrolled_at is null
       or enrollment.enrolled_at < (assessment.assessment_date + 1)::timestamp
     )
    join public.students as student
      on student.id = enrollment.student_id
     and student.institution_id = p_institution_id
  ),
  expected_students as (
    select assessment_id, student_id from expected_enrollments
    union
    select assessment_id, student_id from selected_grades
  ),
  assessment_results as (
    select
      assessment.id,
      assessment.max_score,
      assessment.weight,
      count(expected.student_id)::integer as expected_student_count,
      count(*) filter (
        where upper(trim(grade.status)) = 'GRADED'
          and grade.score is not null
          and assessment.max_score > 0
      )::integer
       + count(*) filter (where upper(trim(grade.status)) = 'EXCUSED')::integer as launched_count,
      round(avg(
        case
          when upper(trim(grade.status)) = 'GRADED'
            and grade.score is not null
            and assessment.max_score > 0
          then grade.score
        end
      ), 2) as average_score,
      round(avg(
        case
          when upper(trim(grade.status)) = 'GRADED'
            and grade.score is not null
            and assessment.max_score > 0
          then (grade.score / assessment.max_score) * 100
        end
      ), 1) as average_percent,
      count(*) filter (where upper(trim(grade.status)) = 'EXCUSED')::integer as excused_count
    from selected_assessments as assessment
    left join expected_students as expected
      on expected.assessment_id = assessment.id
    left join selected_grades as grade
      on grade.assessment_id = assessment.id
     and grade.student_id = expected.student_id
    group by assessment.id, assessment.max_score, assessment.weight
  ),
  assessment_results_fixed as (
    select
      result.*,
      greatest(result.expected_student_count - result.launched_count, 0)::integer as missing_count
    from assessment_results as result
  ),
  student_assessment_scope as (
    select
      expected.assessment_id,
      expected.student_id,
      assessment.class_id,
      assessment.class_name
    from expected_students as expected
    join selected_assessments as assessment
      on assessment.id = expected.assessment_id
    union
    select distinct
      grade.assessment_id,
      grade.student_id,
      assessment.class_id,
      assessment.class_name
    from selected_grades as grade
    join selected_assessments as assessment
      on assessment.id = grade.assessment_id
    join public.students as student
      on student.id = grade.student_id
     and student.institution_id = p_institution_id
  ),
  student_performance as (
    select
      scope.student_id,
      scope.class_id,
      scope.class_name,
      round(avg(
        case
          when upper(trim(grade.status)) = 'GRADED'
            and grade.score is not null
            and grade.max_score > 0
          then (grade.score / grade.max_score) * 100
        end
      ), 1) as performance_percent
    from student_assessment_scope as scope
    left join selected_grades as grade
      on grade.assessment_id = scope.assessment_id
     and grade.student_id = scope.student_id
    group by scope.student_id, scope.class_id, scope.class_name
  ),
  student_performance_context as (
    select distinct on (student_id)
      student_id,
      class_id,
      class_name
    from student_assessment_scope
    order by student_id, class_name, class_id
  ),
  student_performance_overall as (
    select
      scope.student_id,
      context.class_id,
      context.class_name,
      round(avg(
        case
          when upper(trim(grade.status)) = 'GRADED'
            and grade.score is not null
            and grade.max_score > 0
          then (grade.score / grade.max_score) * 100
        end
      ), 1) as performance_percent
    from (
      select distinct student_id, assessment_id
      from student_assessment_scope
    ) as scope
    join student_performance_context as context
      on context.student_id = scope.student_id
    left join selected_grades as grade
      on grade.assessment_id = scope.assessment_id
     and grade.student_id = scope.student_id
    group by scope.student_id, context.class_id, context.class_name
  ),
  student_signals as (
    select
      coalesce(attendance.student_id, performance.student_id) as student_id,
      coalesce(attendance.class_id, performance.class_id) as class_id,
      coalesce(attendance.class_name, performance.class_name) as class_name,
      case
        when attendance.total_records is null then null::numeric
        else round((attendance.present_records::numeric / nullif(attendance.total_records, 0)) * 100, 1)
      end as attendance_rate,
      performance.performance_percent
    from attendance_students as attendance
    full join student_performance_overall as performance
      on performance.student_id = attendance.student_id
  ),
  student_situation_counts as (
    select
      case
        when attendance_rate is null and performance_percent is null then 'NO_DATA'
        when (attendance_rate is not null and attendance_rate < 75)
          or (performance_percent is not null and performance_percent < 50) then 'CRITICAL'
        when (attendance_rate is not null and attendance_rate < 85)
          or (performance_percent is not null and performance_percent < 70) then 'ATTENTION'
        else 'REGULAR'
      end as situation,
      count(*)::integer as count
    from student_signals
    group by 1
  ),
  class_performance as (
    select
      class_id,
      class_name,
      count(*) filter (where performance_percent >= 70)::integer as adequate,
      count(*) filter (where performance_percent >= 50 and performance_percent < 70)::integer as attention,
      count(*) filter (where performance_percent < 50)::integer as critical,
      count(*) filter (where performance_percent is not null)::integer as total,
      count(*) filter (where performance_percent is null)::integer as without_performance
    from student_performance
    group by class_id, class_name
  ),
  activity_performance as (
    select
      count(*)::integer as total_activities,
      count(*) filter (where average_percent >= 70)::integer as above_target,
      count(*) filter (where average_percent >= 50 and average_percent < 70)::integer as attention,
      count(*) filter (where average_percent < 50)::integer as critical,
      count(*) filter (where average_percent is null)::integer as without_average,
      count(*) filter (where launched_count > 0)::integer as launched_activities,
      coalesce(sum(missing_count), 0)::integer as pending_grades
    from assessment_results_fixed
  ),
  pending_attendance as (
    select count(*)::integer as pending_count
    from generate_series(p_from_date, v_pending_to_date, interval '1 day') as day_record(day)
    join public.timetable_entries as timetable
      on timetable.institution_id = p_institution_id
     and timetable.active is true
     and timetable.day_of_week = extract(isodow from day_record.day)::smallint
    join selected_offerings as offering
      on offering.id = timetable.subject_offering_id
     and offering.offering_active is true
     and (
       offering.term_start_date is null
       or offering.term_end_date is null
       or day_record.day::date between offering.term_start_date and offering.term_end_date
     )
      where (day_record.day::date + timetable.end_time)
      <= (current_timestamp at time zone 'America/Sao_Paulo')::timestamp
      and exists (
        select 1
        from public.enrollments as enrollment
        join public.students as student
          on student.id = enrollment.student_id
         and student.institution_id = p_institution_id
         and student.active is true
        where enrollment.class_id = offering.class_id
          and enrollment.active is true
          and coalesce(nullif(upper(trim(enrollment.status)), ''), 'ACTIVE') = 'ACTIVE'
          and (
            enrollment.enrolled_at is null
            or enrollment.enrolled_at < (day_record.day::date + 1)::timestamp
          )
      )
      and not exists (
        select 1
        from public.attendance_sessions as existing_session
        where existing_session.institution_id = p_institution_id
          and existing_session.subject_offering_id = offering.id
          and existing_session.session_date = day_record.day::date
          and existing_session.starts_at = timetable.start_time
      )
      and not exists (
        select 1
        from public.academic_calendar_events as calendar_event
        where calendar_event.institution_id = p_institution_id
          and calendar_event.active is true
          and calendar_event.all_day is true
          and calendar_event.event_type in (
            'HOLIDAY'::public.academic_calendar_event_type,
            'RECESS'::public.academic_calendar_event_type,
            'CLASS_SUSPENSION'::public.academic_calendar_event_type
          )
          and (calendar_event.starts_at at time zone 'UTC')::date <= day_record.day::date
          and (coalesce(calendar_event.ends_at, calendar_event.starts_at) at time zone 'UTC')::date >= day_record.day::date
          and (calendar_event.academic_year_id is null or calendar_event.academic_year_id = offering.academic_year_id)
          and (calendar_event.class_id is null or calendar_event.class_id = offering.class_id)
          and (calendar_event.subject_id is null or calendar_event.subject_id = offering.subject_id)
      )
  )
  select jsonb_build_object(
    'attendance', jsonb_build_object(
      'summary', jsonb_build_object(
        'totalRecords', summary.total_records,
        'presentRecords', summary.present_records,
        'absentRecords', summary.absent_records,
        'lateRecords', summary.late_records,
        'excusedRecords', summary.excused_records,
        'attendanceRate', case
          when summary.total_records = 0 then 0
          else round((summary.present_records::numeric / summary.total_records) * 100, 1)
        end
      ),
      'weekly', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'key', weekly.week_start,
            'totalRecords', weekly.total_records,
            'presentRecords', weekly.present_records,
            'attendanceRate', round((weekly.present_records::numeric / weekly.total_records) * 100, 1)
          ) order by weekly.week_start
        )
        from attendance_weekly as weekly
      ), '[]'::jsonb)
    ),
    'performance', jsonb_build_object(
      'summary', jsonb_build_object(
        'totalAssessments', coalesce((select count(*)::integer from assessment_results_fixed), 0),
        'gradedCount', coalesce((select count(*)::integer from assessment_results_fixed where average_percent is not null), 0),
        'pendingCount', coalesce((select count(*)::integer from assessment_results_fixed where average_percent is null), 0),
        'excusedCount', 0,
        'averageScore', (select round(avg(average_score), 2) from assessment_results_fixed where average_score is not null),
        'averagePercent', (select round(avg(average_percent), 1) from assessment_results_fixed where average_percent is not null),
        'weightedAveragePercent', (
          select case
            when sum(weight) filter (where weight > 0 and average_percent is not null) = 0 then null
            else round(
              sum(average_percent * weight) filter (where weight > 0 and average_percent is not null)
              / sum(weight) filter (where weight > 0 and average_percent is not null),
              1
            )
          end
          from assessment_results_fixed
        )
      ),
      'activities', jsonb_build_object(
        'totalActivities', activity.total_activities,
        'aboveTarget', activity.above_target,
        'attention', activity.attention,
        'critical', activity.critical,
        'withoutAverage', activity.without_average,
        'launchedActivities', activity.launched_activities,
        'pendingGrades', activity.pending_grades
      )
    ),
    'students', jsonb_build_object(
      'situations', jsonb_build_array(
        jsonb_build_object('situation', 'REGULAR', 'count', coalesce((select count from student_situation_counts where situation = 'REGULAR'), 0)),
        jsonb_build_object('situation', 'ATTENTION', 'count', coalesce((select count from student_situation_counts where situation = 'ATTENTION'), 0)),
        jsonb_build_object('situation', 'CRITICAL', 'count', coalesce((select count from student_situation_counts where situation = 'CRITICAL'), 0)),
        jsonb_build_object('situation', 'NO_DATA', 'count', coalesce((select count from student_situation_counts where situation = 'NO_DATA'), 0))
      )
    ),
    'classes', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'classId', performance.class_id,
          'className', performance.class_name,
          'adequate', performance.adequate,
          'attention', performance.attention,
          'critical', performance.critical,
          'total', performance.total,
          'withoutPerformance', performance.without_performance
        ) order by performance.class_name
      )
      from class_performance as performance
    ), '[]'::jsonb),
    'pending', jsonb_build_object(
      'attendancePending', (select pending_count from pending_attendance),
      'missingGrades', activity.pending_grades,
      'assessmentsWithoutLaunch', coalesce((select count(*)::integer from assessment_results_fixed where expected_student_count > 0 and launched_count = 0), 0)
    )
  )
  into v_result
  from attendance_summary as summary
  cross join activity_performance as activity;

  return v_result;
end;
$$;

revoke all on function public.get_director_academic_panorama_v1(uuid, date, date, uuid, uuid, uuid)
  from public, anon;

grant execute on function public.get_director_academic_panorama_v1(uuid, date, date, uuid, uuid, uuid)
  to authenticated;

commit;
