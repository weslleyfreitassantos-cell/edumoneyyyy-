begin;

-- The teacher surface needs a scoped roster rather than a tenant-wide student
-- query.  Keep the authorization check inside the database so the UI cannot
-- broaden the scope by changing filters.
create or replace function private.learning_teacher_can_access_student_any(
  target_institution_id uuid,
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
      from public.memberships membership
      join public.enrollments enrollment
        on enrollment.student_id = target_student_id
       and enrollment.active
       and enrollment.status = 'active'
      join public.classes enrolled_class
        on enrolled_class.id = enrollment.class_id
       and enrolled_class.institution_id = target_institution_id
       and enrolled_class.active
      join public.subject_offerings offering
        on offering.class_id = enrollment.class_id
       and offering.teacher_profile_id = auth.uid()
       and offering.active
     where membership.profile_id = auth.uid()
       and membership.institution_id = target_institution_id
       and membership.role = 'TEACHER'::public.user_role
       and membership.active
  );
$$;

create or replace function public.list_teacher_learning_students(p_institution_id uuid)
returns table (
  student_id uuid,
  full_name text,
  class_id uuid,
  class_name text,
  open_error_count bigint,
  average_mastery numeric,
  active_session_status text,
  target_skill_title text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    student.id,
    coalesce(profile.full_name, 'Aluno'),
    enrolled_class.id,
    enrolled_class.name,
    count(distinct error_note.id),
    coalesce(round(avg(state_row.mastery_estimate), 0), 0),
    (
      select session.status
        from public.learning_guided_sessions session
       where session.institution_id = p_institution_id
         and session.student_id = student.id
       order by session.updated_at desc
       limit 1
    ),
    (
      select skill.title
        from public.learning_guided_sessions session
        join public.learning_curriculum_skills skill
          on skill.id = session.target_canonical_skill_id
       where session.institution_id = p_institution_id
         and session.student_id = student.id
       order by session.updated_at desc
       limit 1
    )
  from public.students student
  join public.profiles profile on profile.id = student.profile_id
  join public.enrollments enrollment
    on enrollment.student_id = student.id
   and enrollment.active
   and enrollment.status = 'active'
  join public.classes enrolled_class
    on enrolled_class.id = enrollment.class_id
   and enrolled_class.institution_id = p_institution_id
   and enrolled_class.active
  left join public.learning_error_notebook error_note
    on error_note.institution_id = p_institution_id
   and error_note.student_id = student.id
   and error_note.status = 'OPEN'
  left join public.learning_student_skill_state state_row
    on state_row.institution_id = p_institution_id
   and state_row.student_id = student.id
  where student.institution_id = p_institution_id
    and student.active
    and (
      public.can_manage_institution_operations(p_institution_id)
      or private.learning_teacher_can_access_student_any(p_institution_id, student.id)
    )
  group by student.id, profile.full_name, enrolled_class.id, enrolled_class.name
  order by enrolled_class.name, profile.full_name;
$$;

create or replace function public.get_teacher_learning_student_detail(
  p_institution_id uuid,
  p_student_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  student_row record;
begin
  if not exists (
    select 1
      from public.students student
     where student.id = p_student_id
       and student.institution_id = p_institution_id
       and student.active
       and (
         public.can_manage_institution_operations(p_institution_id)
         or private.learning_teacher_can_access_student_any(p_institution_id, p_student_id)
       )
  ) then
    raise exception 'LEARNING_TEACHER_STUDENT_SCOPE_DENIED';
  end if;

  select
    student.id,
    coalesce(profile.full_name, 'Aluno') as full_name,
    enrollment.class_id,
    enrolled_class.name as class_name
    into student_row
    from public.students student
    join public.profiles profile on profile.id = student.profile_id
    join public.enrollments enrollment
      on enrollment.student_id = student.id
     and enrollment.active
     and enrollment.status = 'active'
    join public.classes enrolled_class
      on enrolled_class.id = enrollment.class_id
     and enrolled_class.institution_id = p_institution_id
     and enrolled_class.active
   where student.id = p_student_id
     and student.institution_id = p_institution_id
   order by enrollment.enrolled_at desc nulls last
   limit 1;

  return jsonb_build_object(
    'student', jsonb_build_object(
      'id', student_row.id,
      'full_name', student_row.full_name,
      'class_id', student_row.class_id,
      'class_name', student_row.class_name
    ),
    'progress', coalesce((
      select jsonb_agg(jsonb_build_object(
        'canonical_skill_id', state_row.canonical_skill_id,
        'skill_title', skill.title,
        'state', state_row.state,
        'mastery_estimate', state_row.mastery_estimate,
        'evidence_count', state_row.evidence_count,
        'confidence', state_row.confidence,
        'updated_at', state_row.updated_at
      ) order by state_row.updated_at desc)
        from public.learning_student_skill_state state_row
        join public.learning_curriculum_skills skill on skill.id = state_row.canonical_skill_id
       where state_row.institution_id = p_institution_id
         and state_row.student_id = p_student_id
    ), '[]'::jsonb),
    'open_errors', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', error_note.id,
        'question_id', error_note.question_id,
        'question_bank_id', error_note.question_bank_id,
        'canonical_skill_id', error_note.canonical_skill_id,
        'error_count', error_note.error_count,
        'last_missed_at', error_note.last_missed_at,
        'last_reviewed_at', error_note.last_reviewed_at
      ) order by error_note.last_missed_at desc)
        from public.learning_error_notebook error_note
       where error_note.institution_id = p_institution_id
         and error_note.student_id = p_student_id
         and error_note.status = 'OPEN'
    ), '[]'::jsonb),
    'guided_sessions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', session.id,
        'target_canonical_skill_id', session.target_canonical_skill_id,
        'target_skill_title', target_skill.title,
        'status', session.status,
        'started_at', session.started_at,
        'completed_at', session.completed_at,
        'steps', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', step.id,
            'step_type', step.step_type,
            'position', step.position,
            'status', step.status,
            'attempts', step.attempts,
            'title', step_skill.title
          ) order by step.position)
            from public.learning_guided_steps step
            join public.learning_curriculum_skills step_skill on step_skill.id = step.canonical_skill_id
           where step.session_id = session.id
        ), '[]'::jsonb)
      ) order by session.updated_at desc)
        from public.learning_guided_sessions session
        join public.learning_curriculum_skills target_skill on target_skill.id = session.target_canonical_skill_id
       where session.institution_id = p_institution_id
         and session.student_id = p_student_id
    ), '[]'::jsonb),
    'recent_attempts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', attempt.id,
        'activity_id', attempt.activity_id,
        'activity_title', activity.title,
        'score', attempt.score,
        'total_points', attempt.total_points,
        'completed_at', attempt.completed_at
      ) order by attempt.completed_at desc)
        from public.learning_attempts attempt
        join public.learning_activities activity on activity.id = attempt.activity_id
       where attempt.institution_id = p_institution_id
         and attempt.student_id = p_student_id
         and attempt.completed_at is not null
         and (activity.teacher_id = auth.uid() or public.can_manage_institution_operations(p_institution_id))
       limit 10
    ), '[]'::jsonb)
  );
end;
$$;

-- Error review intentionally returns no answer or explanation.  The answer is
-- only returned by the submit RPC, after the learner has committed a choice.
create or replace function public.get_learning_error_review(p_error_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  error_row public.learning_error_notebook%rowtype;
  question_row record;
begin
  select error_note.* into error_row
    from public.learning_error_notebook error_note
   where error_note.id = p_error_id
     and private.learning_student_owns_state(error_note.institution_id, error_note.student_id);
  if not found then raise exception 'LEARNING_ERROR_SCOPE_DENIED'; end if;

  if error_row.question_id is not null then
    select
      question.id,
      question.activity_id,
      question.question_type,
      question.question_text,
      question.options_json
      into question_row
      from public.learning_questions question
     where question.id = error_row.question_id;
    if not found then raise exception 'LEARNING_ERROR_QUESTION_NOT_FOUND'; end if;
    return jsonb_build_object(
      'error_id', error_row.id,
      'source', 'ACTIVITY',
      'question_id', question_row.id,
      'activity_id', question_row.activity_id,
      'canonical_skill_id', error_row.canonical_skill_id,
      'question_type', question_row.question_type,
      'statement', question_row.question_text,
      'options', question_row.options_json,
      'error_count', error_row.error_count
    );
  end if;

  select
    question.id,
    question.subject_area,
    question.topic,
    question.statement,
    question.options
    into question_row
    from public.learning_question_bank question
   where question.id = error_row.question_bank_id
     and question.active;
  if not found then raise exception 'LEARNING_ERROR_QUESTION_NOT_FOUND'; end if;
  return jsonb_build_object(
    'error_id', error_row.id,
    'source', 'QUESTION_BANK',
    'question_bank_id', question_row.id,
    'canonical_skill_id', error_row.canonical_skill_id,
    'question_type', 'MULTIPLE_CHOICE',
    'statement', question_row.statement,
    'options', question_row.options,
    'subject_area', question_row.subject_area,
    'topic', question_row.topic,
    'error_count', error_row.error_count
  );
end;
$$;

create or replace function public.submit_learning_error_review(
  p_error_id uuid,
  p_answer jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  error_row public.learning_error_notebook%rowtype;
  expected_answer jsonb;
  explanation text;
  question_id uuid;
  is_correct boolean;
begin
  select error_note.* into error_row
    from public.learning_error_notebook error_note
   where error_note.id = p_error_id
     and private.learning_student_owns_state(error_note.institution_id, error_note.student_id);
  if not found then raise exception 'LEARNING_ERROR_SCOPE_DENIED'; end if;

  if error_row.question_id is not null then
    select question.id, question.correct_answer_json, question.explanation
      into question_id, expected_answer, explanation
      from public.learning_questions question
     where question.id = error_row.question_id;
  else
    select question.id, question.correct_answer, question.explanation
      into question_id, expected_answer, explanation
      from public.learning_question_bank question
     where question.id = error_row.question_bank_id
       and question.active;
  end if;
  if question_id is null then raise exception 'LEARNING_ERROR_QUESTION_NOT_FOUND'; end if;

  is_correct := expected_answer = p_answer;
  update public.learning_error_notebook
     set status = case when is_correct then 'RESOLVED' else 'OPEN' end,
         last_reviewed_at = now()
   where id = error_row.id;

  if error_row.canonical_skill_id is not null then
    insert into public.learning_skill_evidence(
      institution_id, student_id, canonical_skill_id, source, correct, score, metadata
    ) values (
      error_row.institution_id,
      error_row.student_id,
      error_row.canonical_skill_id,
      'REVIEW',
      is_correct,
      case when is_correct then 100 else 0 end,
      jsonb_build_object('error_notebook_id', error_row.id, 'question_id', question_id)
    );
    perform private.refresh_learning_student_skill_state(
      error_row.institution_id,
      error_row.student_id,
      error_row.canonical_skill_id
    );
  end if;

  return jsonb_build_object(
    'error_id', error_row.id,
    'is_correct', is_correct,
    'correct_answer', expected_answer,
    'explanation', explanation,
    'status', case when is_correct then 'RESOLVED' else 'OPEN' end
  );
end;
$$;

-- Persist area/skill breakdowns while keeping the existing idempotent submit
-- behavior and answer privacy contract.
create or replace function public.submit_learning_simulation_attempt(
  p_attempt_id uuid,
  p_answers jsonb,
  p_duration_seconds integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  attempt_row public.learning_simulation_attempts%rowtype;
  question_row record;
  answer_item jsonb;
  v_correct_count integer := 0;
  v_total_count integer := 0;
  score_percent integer := 0;
  answer_map jsonb := '{}'::jsonb;
  area_breakdown jsonb := '{}'::jsonb;
  skill_breakdown jsonb := '{}'::jsonb;
begin
  select attempt.* into attempt_row
    from public.learning_simulation_attempts attempt
   where attempt.id = p_attempt_id
     and attempt.student_id in (
       select student.id from public.students student
        where student.profile_id = auth.uid() and student.active
     );
  if not found then raise exception 'LEARNING_SIMULATION_ATTEMPT_SCOPE_DENIED'; end if;
  if attempt_row.status = 'COMPLETED' then
    return jsonb_build_object(
      'attempt_id', attempt_row.id,
      'score', attempt_row.score,
      'correct_count', attempt_row.correct_count,
      'total_questions', attempt_row.total_questions,
      'answers', attempt_row.answers,
      'area_breakdown', attempt_row.area_breakdown,
      'skill_breakdown', attempt_row.skill_breakdown
    );
  end if;
  if jsonb_typeof(coalesce(p_answers, '[]'::jsonb)) <> 'array' then
    raise exception 'LEARNING_SIMULATION_ANSWERS_INVALID';
  end if;

  for question_row in
    select question_bank.id, question_bank.correct_answer, question_bank.subject_area, link.canonical_skill_id
      from public.learning_simulation_questions simulation_question
      join public.learning_question_bank question_bank
        on question_bank.id = simulation_question.question_bank_id
      left join lateral (
        select skill_link.canonical_skill_id
          from public.learning_question_bank_skill_links skill_link
         where skill_link.question_bank_id = question_bank.id
           and skill_link.skill_role = 'PRIMARY'
         order by skill_link.id
         limit 1
      ) link on true
     where simulation_question.simulation_id = attempt_row.simulation_id
     order by simulation_question.position
  loop
    v_total_count := v_total_count + 1;
    select item into answer_item
      from jsonb_array_elements(p_answers) item
     where item->>'question_bank_id' = question_row.id::text
     limit 1;
    if answer_item is not null and question_row.correct_answer = answer_item->'answer' then
      v_correct_count := v_correct_count + 1;
    end if;
    answer_map := answer_map || jsonb_build_object(
      question_row.id::text,
      jsonb_build_object(
        'answer', coalesce(answer_item->'answer', 'null'::jsonb),
        'is_correct', answer_item is not null and question_row.correct_answer = answer_item->'answer'
      )
    );
    if question_row.canonical_skill_id is not null then
      insert into public.learning_skill_evidence(
        institution_id, student_id, canonical_skill_id, source, correct, score, metadata
      ) values (
        attempt_row.institution_id,
        attempt_row.student_id,
        question_row.canonical_skill_id,
        'SIMULATION',
        answer_item is not null and question_row.correct_answer = answer_item->'answer',
        case when answer_item is not null and question_row.correct_answer = answer_item->'answer' then 100 else 0 end,
        jsonb_build_object('simulation_attempt_id', attempt_row.id, 'question_bank_id', question_row.id)
      );
      perform private.refresh_learning_student_skill_state(
        attempt_row.institution_id,
        attempt_row.student_id,
        question_row.canonical_skill_id
      );
    end if;
    if answer_item is null or question_row.correct_answer <> answer_item->'answer' then
      insert into public.learning_error_notebook(
        institution_id, student_id, question_bank_id, canonical_skill_id
      ) values (
        attempt_row.institution_id, attempt_row.student_id, question_row.id, question_row.canonical_skill_id
      )
      on conflict (student_id, question_bank_id) where question_bank_id is not null do update set
        error_count = public.learning_error_notebook.error_count + 1,
        last_missed_at = now(),
        status = 'OPEN',
        canonical_skill_id = coalesce(public.learning_error_notebook.canonical_skill_id, excluded.canonical_skill_id);
    end if;
  end loop;

  score_percent := case when v_total_count = 0 then 0 else round(v_correct_count * 100.0 / v_total_count)::integer end;

  select coalesce(jsonb_object_agg(grouped.area_key, jsonb_build_object('correct', grouped.correct_count, 'total', grouped.total_count)), '{}'::jsonb)
    into area_breakdown
    from (
      select coalesce(question_bank.subject_area, 'Geral') as area_key,
             count(*)::integer as total_count,
             count(*) filter (where coalesce(answer_map -> simulation_question.question_bank_id::text ->> 'is_correct', 'false') = 'true')::integer as correct_count
        from public.learning_simulation_questions simulation_question
        join public.learning_question_bank question_bank on question_bank.id = simulation_question.question_bank_id
       where simulation_question.simulation_id = attempt_row.simulation_id
       group by coalesce(question_bank.subject_area, 'Geral')
    ) grouped;

  select coalesce(jsonb_object_agg(grouped.skill_key, jsonb_build_object('correct', grouped.correct_count, 'total', grouped.total_count)), '{}'::jsonb)
    into skill_breakdown
    from (
      select coalesce(skill_link.canonical_skill_id::text, 'unmapped') as skill_key,
             count(*)::integer as total_count,
             count(*) filter (where coalesce(answer_map -> simulation_question.question_bank_id::text ->> 'is_correct', 'false') = 'true')::integer as correct_count
        from public.learning_simulation_questions simulation_question
        left join lateral (
          select link.canonical_skill_id
            from public.learning_question_bank_skill_links link
           where link.question_bank_id = simulation_question.question_bank_id
             and link.skill_role = 'PRIMARY'
           order by link.id
           limit 1
        ) skill_link on true
       where simulation_question.simulation_id = attempt_row.simulation_id
       group by coalesce(skill_link.canonical_skill_id::text, 'unmapped')
    ) grouped;

  update public.learning_simulation_attempts
     set status = 'COMPLETED',
         completed_at = now(),
         duration_seconds = coalesce(p_duration_seconds, duration_seconds),
         score = score_percent,
         correct_count = v_correct_count,
         total_questions = v_total_count,
         area_breakdown = area_breakdown,
         skill_breakdown = skill_breakdown,
         answers = answer_map,
         updated_at = now()
   where id = attempt_row.id;
  perform private.award_learning_xp(
    attempt_row.institution_id,
    attempt_row.student_id,
    'simulation:' || attempt_row.id::text,
    'SIMULATION',
    20
  );
  return jsonb_build_object(
    'attempt_id', attempt_row.id,
    'score', score_percent,
    'correct_count', v_correct_count,
    'total_questions', v_total_count,
    'answers', answer_map,
    'area_breakdown', area_breakdown,
    'skill_breakdown', skill_breakdown
  );
end;
$$;

revoke all on function private.learning_teacher_can_access_student_any(uuid, uuid) from public, anon, authenticated;
revoke all on function public.list_teacher_learning_students(uuid) from public, anon;
revoke all on function public.get_teacher_learning_student_detail(uuid, uuid) from public, anon;
revoke all on function public.get_learning_error_review(uuid) from public, anon;
revoke all on function public.submit_learning_error_review(uuid, jsonb) from public, anon;
revoke all on function public.submit_learning_simulation_attempt(uuid, jsonb, integer) from public, anon;
grant execute on function public.list_teacher_learning_students(uuid) to authenticated;
grant execute on function public.get_teacher_learning_student_detail(uuid, uuid) to authenticated;
grant execute on function public.get_learning_error_review(uuid) to authenticated;
grant execute on function public.submit_learning_error_review(uuid, jsonb) to authenticated;
grant execute on function public.submit_learning_simulation_attempt(uuid, jsonb, integer) to authenticated;

commit;
