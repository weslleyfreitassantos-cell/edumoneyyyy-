begin;

-- Keep the source of a copied bank question explicit.  The activity remains
-- tenant-owned while the original TecEscola/ENEM question stays global.
alter table public.learning_questions
  add column if not exists question_bank_id uuid
  references public.learning_question_bank(id) on delete set null;

create index if not exists learning_questions_question_bank_idx
  on public.learning_questions(question_bank_id)
  where question_bank_id is not null;

-- Guided diagnostic and lock-in activities are first-class activity kinds. The
-- old PRACTICE/REINFORCEMENT values remain valid for existing schools.
alter table public.learning_activities
  drop constraint if exists learning_activities_activity_type_check;

alter table public.learning_activities
  add constraint learning_activities_activity_type_check
  check (activity_type in ('PRACTICE', 'REINFORCEMENT', 'DIAGNOSTIC', 'LOCK_IN'));

-- A single server-side copier keeps teacher-created questions and reused bank
-- questions on the same validation path.  Correct answers never leave this
-- function through a student-facing read contract.
create or replace function private.add_learning_activity_question(
  p_institution_id uuid,
  p_activity_id uuid,
  p_item jsonb,
  p_position integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_question_bank_id uuid;
  v_bank public.learning_question_bank%rowtype;
  v_question_id uuid;
  v_text text;
  v_options jsonb;
  v_correct jsonb;
  v_explanation text;
  v_type text;
  v_points integer;
begin
  v_question_bank_id := nullif(p_item->>'question_bank_id', '')::uuid;

  if v_question_bank_id is not null then
    select bank.*
      into v_bank
      from public.learning_question_bank bank
     where bank.id = v_question_bank_id
       and bank.active
       and (
         (bank.institution_id is null and bank.package_type in ('TECESCOLA', 'ENEM'))
         or bank.institution_id = p_institution_id
       );
    if not found then
      raise exception 'LEARNING_QUESTION_BANK_SCOPE_DENIED';
    end if;
    v_text := v_bank.statement;
    v_options := coalesce(v_bank.options, '[]'::jsonb);
    v_correct := coalesce(v_bank.correct_answer, 'null'::jsonb);
    v_explanation := v_bank.explanation;
  else
    v_text := nullif(trim(coalesce(p_item->>'question_text', '')), '');
    v_options := coalesce(p_item->'options_json', '[]'::jsonb);
    v_correct := coalesce(p_item->'correct_answer_json', 'null'::jsonb);
    v_explanation := nullif(trim(coalesce(p_item->>'explanation', '')), '');
  end if;

  if v_text is null then
    raise exception 'LEARNING_QUESTION_TEXT_REQUIRED';
  end if;

  v_type := coalesce(nullif(p_item->>'question_type', ''), 'MULTIPLE_CHOICE');
  if v_type not in ('MULTIPLE_CHOICE', 'TRUE_FALSE', 'SHORT_ANSWER') then
    raise exception 'LEARNING_QUESTION_TYPE_INVALID';
  end if;
  v_points := greatest(1, coalesce((p_item->>'points')::integer, 1));

  insert into public.learning_questions(
    institution_id,
    activity_id,
    question_bank_id,
    question_text,
    question_type,
    options_json,
    correct_answer_json,
    explanation,
    points,
    sort_order
  )
  values (
    p_institution_id,
    p_activity_id,
    v_question_bank_id,
    v_text,
    v_type,
    v_options,
    v_correct,
    v_explanation,
    v_points,
    coalesce((p_item->>'sort_order')::integer, p_position)
  )
  returning id into v_question_id;

  if v_question_bank_id is not null then
    insert into public.learning_question_skill_links(
      institution_id,
      question_id,
      canonical_skill_id,
      skill_role
    )
    select p_institution_id, v_question_id, link.canonical_skill_id, link.skill_role
      from public.learning_question_bank_skill_links link
     where link.question_bank_id = v_question_bank_id
    on conflict (question_id, canonical_skill_id) do nothing;
  end if;

  return v_question_id;
end;
$$;

create or replace function public.create_learning_activity_with_questions(
  p_institution_id uuid,
  p_subject_id uuid,
  p_unit_id uuid,
  p_skill_id uuid,
  p_teacher_id uuid,
  p_title text,
  p_description text,
  p_activity_type text,
  p_questions jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_activity_id uuid;
  v_item jsonb;
  v_position integer := 0;
begin
  if auth.uid() is null or auth.uid() <> p_teacher_id then
    raise exception 'LEARNING_ACTIVITY_TEACHER_SCOPE_DENIED';
  end if;
  if not exists (
    select 1 from public.memberships membership
     where membership.profile_id = auth.uid()
       and membership.institution_id = p_institution_id
       and membership.role = 'TEACHER'::public.user_role
       and membership.active
  ) then
    raise exception 'LEARNING_ACTIVITY_TEACHER_SCOPE_DENIED';
  end if;
  if not exists (
    select 1 from public.subjects subject
     where subject.id = p_subject_id
       and subject.institution_id = p_institution_id
       and subject.active
  ) then
    raise exception 'LEARNING_ACTIVITY_SUBJECT_SCOPE_DENIED';
  end if;
  if not private.learning_teacher_owns_subject(p_institution_id, p_subject_id) then
    raise exception 'LEARNING_TEACHER_SUBJECT_SCOPE_DENIED';
  end if;
  if p_unit_id is not null and not exists (
    select 1 from public.learning_units unit
     where unit.id = p_unit_id
       and unit.institution_id = p_institution_id
       and unit.subject_id = p_subject_id
       and unit.active
  ) then
    raise exception 'LEARNING_ACTIVITY_UNIT_SCOPE_DENIED';
  end if;
  if p_skill_id is not null and not exists (
    select 1
      from public.learning_skills skill
      join public.learning_units unit on unit.id = skill.unit_id
     where skill.id = p_skill_id
       and skill.institution_id = p_institution_id
       and unit.subject_id = p_subject_id
       and skill.active
       and unit.active
  ) then
    raise exception 'LEARNING_ACTIVITY_SKILL_SCOPE_DENIED';
  end if;
  if coalesce(nullif(p_activity_type, ''), 'PRACTICE') not in ('PRACTICE', 'REINFORCEMENT', 'DIAGNOSTIC', 'LOCK_IN') then
    raise exception 'LEARNING_ACTIVITY_TYPE_INVALID';
  end if;
  if jsonb_typeof(coalesce(p_questions, '[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(p_questions, '[]'::jsonb)) = 0 then
    raise exception 'LEARNING_ACTIVITY_QUESTIONS_REQUIRED';
  end if;

  insert into public.learning_activities(
    institution_id, subject_id, unit_id, skill_id, teacher_id,
    title, description, activity_type, status
  )
  values (
    p_institution_id, p_subject_id, p_unit_id, p_skill_id, p_teacher_id,
    trim(p_title), nullif(trim(coalesce(p_description, '')), ''),
    coalesce(nullif(p_activity_type, ''), 'PRACTICE'), 'DRAFT'
  )
  returning id into v_activity_id;

  for v_item in select value from jsonb_array_elements(p_questions)
  loop
    perform private.add_learning_activity_question(
      p_institution_id, v_activity_id, v_item, v_position
    );
    v_position := v_position + 1;
  end loop;

  return v_activity_id;
end;
$$;

-- Prefer first-class diagnostic/lock-in activities when a school has them,
-- while retaining the previous practice fallback for legacy data.
create or replace function public.start_guided_learning_session(
  p_institution_id uuid,
  p_student_id uuid,
  p_target_canonical_skill_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_session public.learning_guided_sessions%rowtype;
  new_session public.learning_guided_sessions%rowtype;
  target_institution_skill_id uuid;
  subject_id uuid;
  class_id uuid;
  position_index integer := 0;
  gap_count integer := 0;
  skill_row record;
begin
  if not exists (
    select 1 from public.students student
    where student.id = p_student_id
      and student.institution_id = p_institution_id
      and student.active
      and (student.profile_id = auth.uid() or public.can_manage_institution_operations(p_institution_id))
  ) then raise exception 'LEARNING_STUDENT_SCOPE_DENIED'; end if;
  if not exists (
    select 1
      from public.learning_curriculum_skills skill
      join public.learning_curriculum_catalogs catalog on catalog.id = skill.catalog_id and catalog.active
     where skill.id = p_target_canonical_skill_id and skill.active
  ) then raise exception 'LEARNING_TARGET_NOT_FOUND'; end if;

  select * into existing_session
    from public.learning_guided_sessions session
   where session.institution_id = p_institution_id
     and session.student_id = p_student_id
     and session.target_canonical_skill_id = p_target_canonical_skill_id
     and session.status in ('ACTIVE', 'PAUSED')
   order by session.created_at desc
   limit 1;
  if found then return jsonb_build_object('session_id', existing_session.id, 'created', false); end if;

  select link.learning_skill_id, unit.subject_id
    into target_institution_skill_id, subject_id
    from public.learning_skill_canonical_links link
    join public.learning_skills institution_skill on institution_skill.id = link.learning_skill_id and institution_skill.active
    join public.learning_units unit on unit.id = institution_skill.unit_id and unit.active
   where link.institution_id = p_institution_id
     and link.canonical_skill_id = p_target_canonical_skill_id
     and link.active
   order by link.created_at
   limit 1;
  select enrollment.class_id into class_id
    from public.enrollments enrollment
   where enrollment.student_id = p_student_id
     and enrollment.active
     and enrollment.status = 'active'
   order by enrollment.created_at desc
   limit 1;

  insert into public.learning_guided_sessions(institution_id, student_id, target_canonical_skill_id, target_institution_skill_id, subject_id, class_id)
  values (p_institution_id, p_student_id, p_target_canonical_skill_id, target_institution_skill_id, subject_id, class_id)
  returning * into new_session;

  for skill_row in
    with recursive required(skill_id, depth) as (
      select p_target_canonical_skill_id, 0
      union
      select prerequisite.prerequisite_skill_id, required.depth + 1
        from required
        join public.learning_skill_prerequisites prerequisite on prerequisite.skill_id = required.skill_id
    )
    select distinct on (required.skill_id)
      required.skill_id,
      required.depth,
      coalesce(state.state, 'UNKNOWN') as learner_state
      from required
      left join public.learning_student_skill_state state
        on state.institution_id = p_institution_id
       and state.student_id = p_student_id
       and state.canonical_skill_id = required.skill_id
     order by required.skill_id, required.depth desc
  loop
    if skill_row.skill_id <> p_target_canonical_skill_id and skill_row.learner_state = 'MASTERED' then continue; end if;
    if skill_row.skill_id <> p_target_canonical_skill_id then gap_count := gap_count + 1; end if;

    insert into public.learning_guided_steps(institution_id, session_id, canonical_skill_id, step_type, position, activity_id)
    values (
      p_institution_id,
      new_session.id,
      skill_row.skill_id,
      'DIAGNOSTIC',
      position_index,
      coalesce(
        (select activity.id
           from public.learning_activities activity
           join public.learning_skill_canonical_links link on link.learning_skill_id = activity.skill_id and link.canonical_skill_id = skill_row.skill_id and link.institution_id = p_institution_id and link.active
          where activity.institution_id = p_institution_id and activity.status = 'PUBLISHED' and activity.activity_type = 'DIAGNOSTIC'
          order by activity.created_at desc limit 1),
        (select activity.id
           from public.learning_activities activity
           join public.learning_skill_canonical_links link on link.learning_skill_id = activity.skill_id and link.canonical_skill_id = skill_row.skill_id and link.institution_id = p_institution_id and link.active
          where activity.institution_id = p_institution_id and activity.status = 'PUBLISHED' and activity.activity_type = 'PRACTICE'
          order by activity.created_at desc limit 1)
      )
    );
    position_index := position_index + 1;

    insert into public.learning_guided_steps(institution_id, session_id, canonical_skill_id, step_type, position, lesson_id)
    values (
      p_institution_id,
      new_session.id,
      skill_row.skill_id,
      'LESSON',
      position_index,
      (select lesson.id from public.learning_skill_lessons lesson where lesson.canonical_skill_id = skill_row.skill_id and lesson.active order by lesson.version desc limit 1)
    );
    position_index := position_index + 1;

    insert into public.learning_guided_steps(institution_id, session_id, canonical_skill_id, step_type, position, activity_id)
    values (
      p_institution_id,
      new_session.id,
      skill_row.skill_id,
      'PRACTICE',
      position_index,
      coalesce(
        (select activity.id
           from public.learning_activities activity
           join public.learning_skill_canonical_links link on link.learning_skill_id = activity.skill_id and link.canonical_skill_id = skill_row.skill_id and link.institution_id = p_institution_id and link.active
          where activity.institution_id = p_institution_id and activity.status = 'PUBLISHED' and activity.activity_type = 'PRACTICE'
          order by activity.created_at desc limit 1),
        (select activity.id
           from public.learning_activities activity
           join public.learning_skill_canonical_links link on link.learning_skill_id = activity.skill_id and link.canonical_skill_id = skill_row.skill_id and link.institution_id = p_institution_id and link.active
          where activity.institution_id = p_institution_id and activity.status = 'PUBLISHED'
          order by activity.created_at desc limit 1)
      )
    );
    position_index := position_index + 1;

    insert into public.learning_guided_steps(institution_id, session_id, canonical_skill_id, step_type, position, activity_id)
    values (
      p_institution_id,
      new_session.id,
      skill_row.skill_id,
      'LOCK_IN',
      position_index,
      coalesce(
        (select activity.id
           from public.learning_activities activity
           join public.learning_skill_canonical_links link on link.learning_skill_id = activity.skill_id and link.canonical_skill_id = skill_row.skill_id and link.institution_id = p_institution_id and link.active
          where activity.institution_id = p_institution_id and activity.status = 'PUBLISHED' and activity.activity_type = 'LOCK_IN'
          order by activity.created_at desc limit 1),
        (select activity.id
           from public.learning_activities activity
           join public.learning_skill_canonical_links link on link.learning_skill_id = activity.skill_id and link.canonical_skill_id = skill_row.skill_id and link.institution_id = p_institution_id and link.active
          where activity.institution_id = p_institution_id and activity.status = 'PUBLISHED'
          order by activity.created_at desc limit 1)
      )
    );
    position_index := position_index + 1;
  end loop;

  if gap_count > 0 then
    insert into public.learning_guided_steps(institution_id, session_id, canonical_skill_id, step_type, position)
    values (p_institution_id, new_session.id, p_target_canonical_skill_id, 'RETURN_TO_TARGET', position_index);
  end if;

  update public.learning_guided_steps step
     set status = 'ACTIVE', started_at = now(), updated_at = now()
   where step.session_id = new_session.id
     and step.position = (select min(first_step.position) from public.learning_guided_steps first_step where first_step.session_id = new_session.id and first_step.status = 'PENDING');
  return jsonb_build_object('session_id', new_session.id, 'created', true, 'target_canonical_skill_id', p_target_canonical_skill_id, 'gap_count', gap_count);
end;
$$;

-- Drafts can be edited as a whole while they are still private to the
-- teacher. Published activities keep their immutable answer history.
create or replace function public.update_learning_activity_with_questions(
  p_activity_id uuid,
  p_title text,
  p_description text,
  p_activity_type text,
  p_questions jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_activity public.learning_activities%rowtype;
  v_item jsonb;
  v_position integer := 0;
begin
  select activity.* into v_activity
    from public.learning_activities activity
   where activity.id = p_activity_id
     and activity.teacher_id = auth.uid()
   for update;
  if not found then raise exception 'LEARNING_ACTIVITY_SCOPE_DENIED'; end if;
  if v_activity.status <> 'DRAFT' then
    raise exception 'LEARNING_ACTIVITY_DRAFT_REQUIRED';
  end if;
  if jsonb_typeof(coalesce(p_questions, '[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(p_questions, '[]'::jsonb)) = 0 then
    raise exception 'LEARNING_ACTIVITY_QUESTIONS_REQUIRED';
  end if;

  update public.learning_activities
     set title = trim(p_title),
         description = nullif(trim(coalesce(p_description, '')), ''),
         activity_type = coalesce(nullif(p_activity_type, ''), activity_type),
         updated_at = now()
   where id = p_activity_id;
  delete from public.learning_questions where activity_id = p_activity_id;

  for v_item in select value from jsonb_array_elements(p_questions)
  loop
    perform private.add_learning_activity_question(
      v_activity.institution_id, p_activity_id, v_item, v_position
    );
    v_position := v_position + 1;
  end loop;
  return p_activity_id;
end;
$$;

create or replace function public.complete_learning_daily_plan_item(
  p_item_id uuid,
  p_status text default 'COMPLETED'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.learning_daily_plan_items%rowtype;
  v_plan public.learning_daily_plans%rowtype;
  v_next_status text;
begin
  if p_status not in ('COMPLETED', 'SKIPPED') then
    raise exception 'LEARNING_PLAN_ITEM_STATUS_INVALID';
  end if;
  select item.* into v_item
    from public.learning_daily_plan_items item
    join public.learning_daily_plans plan on plan.id = item.plan_id
    join public.students student on student.id = plan.student_id
   where item.id = p_item_id
     and student.profile_id = auth.uid()
     and student.active;
  if not found then raise exception 'LEARNING_PLAN_ITEM_SCOPE_DENIED'; end if;
  if v_item.status in ('COMPLETED', 'SKIPPED') then
    return jsonb_build_object('item_id', v_item.id, 'idempotent', true, 'status', v_item.status);
  end if;

  update public.learning_daily_plan_items
     set status = p_status, completed_at = now()
   where id = p_item_id;
  select plan.* into v_plan from public.learning_daily_plans plan where plan.id = v_item.plan_id;
  select case when not exists (
    select 1 from public.learning_daily_plan_items item
     where item.plan_id = v_plan.id and item.status not in ('COMPLETED', 'SKIPPED')
  ) then 'COMPLETED' else 'OPEN' end into v_next_status;
  update public.learning_daily_plans set status = v_next_status, updated_at = now() where id = v_plan.id;
  return jsonb_build_object('item_id', p_item_id, 'idempotent', false, 'status', p_status, 'plan_status', v_next_status);
end;
$$;

create or replace function public.complete_learning_skill_review(
  p_review_id uuid,
  p_score integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_review public.learning_skill_reviews%rowtype;
  v_interval integer;
begin
  if p_score < 0 or p_score > 100 then raise exception 'LEARNING_REVIEW_SCORE_INVALID'; end if;
  select review.* into v_review
    from public.learning_skill_reviews review
    join public.students student on student.id = review.student_id
   where review.id = p_review_id
     and student.profile_id = auth.uid()
     and student.active;
  if not found then raise exception 'LEARNING_REVIEW_SCOPE_DENIED'; end if;
  if v_review.completed_at is not null then
    return jsonb_build_object('review_id', v_review.id, 'idempotent', true, 'score', v_review.result_score);
  end if;

  update public.learning_skill_reviews
     set completed_at = now(), result_score = p_score
   where id = p_review_id;
  insert into public.learning_skill_evidence(
    institution_id, student_id, canonical_skill_id, source, correct, score, metadata
  ) values (
    v_review.institution_id, v_review.student_id, v_review.canonical_skill_id,
    'REVIEW', p_score >= 80, p_score,
    jsonb_build_object('review_id', p_review_id)
  );
  perform private.refresh_learning_student_skill_state(
    v_review.institution_id, v_review.student_id, v_review.canonical_skill_id
  );
  v_interval := case when p_score >= 90 then 30 when p_score >= 80 then 14 when p_score >= 60 then 3 else 1 end;
  insert into public.learning_skill_reviews(
    institution_id, student_id, canonical_skill_id, source, interval_days, review_due_at, result_score
  ) values (
    v_review.institution_id, v_review.student_id, v_review.canonical_skill_id,
    'REVIEW', v_interval, now() + (v_interval || ' days')::interval, p_score
  );
  perform private.award_learning_xp(
    v_review.institution_id, v_review.student_id, 'review:' || v_review.id::text, 'REVIEW', 8
  );
  return jsonb_build_object('review_id', v_review.id, 'idempotent', false, 'score', p_score, 'next_interval_days', v_interval);
end;
$$;

create or replace function public.get_teacher_learning_class_gaps(
  p_institution_id uuid,
  p_class_id uuid
)
returns table(
  canonical_skill_id uuid,
  skill_title text,
  needs_review_count bigint,
  learning_count bigint,
  diagnostic_needed_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    skill.id,
    skill.title,
    count(*) filter (where coalesce(state.state, 'UNKNOWN') = 'NEEDS_REVIEW'),
    count(*) filter (where coalesce(state.state, 'UNKNOWN') in ('LEARNING', 'PRACTICING', 'INTRODUCED')),
    count(*) filter (where coalesce(state.state, 'UNKNOWN') = 'UNKNOWN')
  from public.students student
  join public.enrollments enrollment
    on enrollment.student_id = student.id
   and enrollment.class_id = p_class_id
   and enrollment.active
   and enrollment.status = 'active'
  join public.classes school_class
    on school_class.id = enrollment.class_id
   and school_class.institution_id = p_institution_id
   and school_class.active
  cross join public.learning_curriculum_skills skill
  left join public.learning_student_skill_state state
    on state.institution_id = p_institution_id
   and state.student_id = student.id
   and state.canonical_skill_id = skill.id
  where student.institution_id = p_institution_id
    and student.active
    and (
      public.can_manage_institution_operations(p_institution_id)
      or private.learning_teacher_can_access_student_any(p_institution_id, student.id)
    )
  group by skill.id, skill.title
  having count(*) filter (where coalesce(state.state, 'UNKNOWN') <> 'MASTERED') > 0
  order by skill.title;
$$;

-- A repeated update of the legacy attempt must not mint a second practice XP
-- event. Intentional retries still create append-only runs/evidence.
create or replace function private.sync_learning_attempt_reward()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.completed_at is not null
     and (old.completed_at is null or old.completed_at <> new.completed_at)
     and not exists (
       select 1 from public.learning_gamification_events event
        where event.student_id = new.student_id
          and event.event_key like 'attempt:' || new.id::text || '%'
     ) then
    perform private.award_learning_xp(
      new.institution_id, new.student_id, 'attempt:' || new.id::text, 'PRACTICE', 10
    );
  end if;
  return new;
end;
$$;

revoke all on function private.add_learning_activity_question(uuid, uuid, jsonb, integer) from public, anon, authenticated;
revoke all on function public.create_learning_activity_with_questions(uuid, uuid, uuid, uuid, uuid, text, text, text, jsonb) from public, anon;
revoke all on function public.update_learning_activity_with_questions(uuid, text, text, text, jsonb) from public, anon;
revoke all on function public.complete_learning_daily_plan_item(uuid, text) from public, anon;
revoke all on function public.complete_learning_skill_review(uuid, integer) from public, anon;
revoke all on function public.get_teacher_learning_class_gaps(uuid, uuid) from public, anon;
grant execute on function public.create_learning_activity_with_questions(uuid, uuid, uuid, uuid, uuid, text, text, text, jsonb) to authenticated;
grant execute on function public.update_learning_activity_with_questions(uuid, text, text, text, jsonb) to authenticated;
grant execute on function public.complete_learning_daily_plan_item(uuid, text) to authenticated;
grant execute on function public.complete_learning_skill_review(uuid, integer) to authenticated;
grant execute on function public.get_teacher_learning_class_gaps(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';
commit;
