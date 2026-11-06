begin;

create or replace function public.tec_quiz_teacher_options_v1()
returns table (
  activity_id uuid,
  activity_title text,
  subject_name text,
  class_id uuid,
  class_name text,
  question_count integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not private.is_current_profile_active() then
    raise exception 'TEC_QUIZ_AUTHENTICATION_REQUIRED';
  end if;

  return query
  select activity.id, activity.title, subject.name, classroom.id, classroom.name,
         count(question.id)::integer
    from public.learning_activities activity
    join public.subjects subject
      on subject.id = activity.subject_id
     and subject.institution_id = activity.institution_id
     and subject.active is true
    join public.learning_assignments assignment
      on assignment.activity_id = activity.id
     and assignment.institution_id = activity.institution_id
     and (assignment.available_at is null or assignment.available_at <= now())
     and (assignment.due_at is null or assignment.due_at >= now())
    join public.classes classroom
      on classroom.id = assignment.class_id
     and classroom.institution_id = activity.institution_id
     and classroom.active is true
    join public.learning_questions question
      on question.activity_id = activity.id
     and question.institution_id = activity.institution_id
     and question.question_type in ('MULTIPLE_CHOICE', 'TRUE_FALSE')
     and nullif(trim(question.question_text), '') is not null
     and private.tec_quiz_options_are_valid(question.options_json)
     and private.tec_quiz_correct_option_index(
       question.correct_answer_json, question.options_json, question.question_type
     ) is not null
   where activity.status = 'PUBLISHED'
     and exists (
       select 1 from public.memberships membership
        where membership.profile_id = auth.uid()
          and membership.institution_id = activity.institution_id
          and membership.role = 'TEACHER'::public.user_role
          and membership.active is true
     )
     and exists (
       select 1 from public.subject_offerings offering
        where offering.subject_id = activity.subject_id
          and offering.class_id = classroom.id
          and offering.teacher_profile_id = auth.uid()
          and offering.active is true
     )
   group by activity.id, activity.title, subject.name, classroom.id, classroom.name
  having count(question.id) between 3 and 100
   order by subject.name, activity.title, classroom.name;
end;
$$;

create or replace function public.tec_quiz_create_game_v1(
  p_activity_id uuid,
  p_class_id uuid,
  p_time_per_question_seconds integer default 20,
  p_base_points integer default 500
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  activity_row public.learning_activities%rowtype;
  pin_value text;
  game_id uuid;
  question_count integer;
  attempts integer := 0;
begin
  if auth.uid() is null or not private.is_current_profile_active() then
    raise exception 'TEC_QUIZ_AUTHENTICATION_REQUIRED';
  end if;
  if p_time_per_question_seconds is null or p_time_per_question_seconds not between 5 and 120
     or p_base_points is null or p_base_points not between 100 and 1000 then
    raise exception 'TEC_QUIZ_SETTINGS_INVALID';
  end if;

  select activity.* into activity_row
    from public.learning_activities activity
   where activity.id = p_activity_id
     and activity.status = 'PUBLISHED'
   for share;
  if not found then raise exception 'TEC_QUIZ_ACTIVITY_SCOPE_DENIED'; end if;

  if not exists (
    select 1 from public.memberships membership
     where membership.profile_id = auth.uid()
       and membership.institution_id = activity_row.institution_id
       and membership.role = 'TEACHER'::public.user_role
       and membership.active is true
  ) then raise exception 'TEC_QUIZ_TEACHER_SCOPE_DENIED'; end if;

  if not exists (
    select 1
      from public.learning_assignments assignment
      join public.classes classroom
        on classroom.id = assignment.class_id
       and classroom.institution_id = activity_row.institution_id
       and classroom.active is true
      join public.subject_offerings offering
        on offering.subject_id = activity_row.subject_id
       and offering.class_id = classroom.id
       and offering.teacher_profile_id = auth.uid()
       and offering.active is true
     where assignment.activity_id = activity_row.id
       and assignment.class_id = p_class_id
       and assignment.institution_id = activity_row.institution_id
       and (assignment.available_at is null or assignment.available_at <= now())
       and (assignment.due_at is null or assignment.due_at >= now())
  ) then raise exception 'TEC_QUIZ_CLASS_SCOPE_DENIED'; end if;

  select count(*)::integer into question_count
    from public.learning_questions question
   where question.activity_id = activity_row.id
     and question.institution_id = activity_row.institution_id
     and question.question_type in ('MULTIPLE_CHOICE', 'TRUE_FALSE')
     and nullif(trim(question.question_text), '') is not null
     and private.tec_quiz_options_are_valid(question.options_json)
     and private.tec_quiz_correct_option_index(
       question.correct_answer_json, question.options_json, question.question_type
     ) is not null;
  if question_count not between 3 and 100 then
    raise exception 'TEC_QUIZ_QUESTION_COUNT_INVALID';
  end if;

  update public.tec_quiz_games game
     set status = 'EXPIRED', ended_at = now()
   where game.status in ('LOBBY', 'IN_PROGRESS', 'INTERMISSION')
     and game.created_at < now() - interval '4 hours';

  loop
    attempts := attempts + 1;
    if attempts > 10 then raise exception 'TEC_QUIZ_PIN_ALLOCATION_FAILED'; end if;
    pin_value := lpad(floor(random() * 1000000)::integer::text, 6, '0');
    begin
      insert into public.tec_quiz_games (
        institution_id, activity_id, class_id, teacher_id, pin,
        time_per_question_seconds, base_points
      ) values (
        activity_row.institution_id, activity_row.id, p_class_id, auth.uid(), pin_value,
        p_time_per_question_seconds, p_base_points
      ) returning id into game_id;
      exit;
    exception when unique_violation then
      game_id := null;
    end;
  end loop;

  insert into public.tec_quiz_game_questions (
    game_id, question_index, source_question_id, question_text, question_type,
    options_json, correct_option_index, explanation
  )
  select game_id, row_number() over (order by question.sort_order, question.id)::integer,
         question.id, question.question_text, question.question_type,
         question.options_json,
         private.tec_quiz_correct_option_index(
           question.correct_answer_json, question.options_json, question.question_type
         ),
         question.explanation
    from public.learning_questions question
   where question.activity_id = activity_row.id
     and question.institution_id = activity_row.institution_id
     and question.question_type in ('MULTIPLE_CHOICE', 'TRUE_FALSE')
     and nullif(trim(question.question_text), '') is not null
     and private.tec_quiz_options_are_valid(question.options_json)
     and private.tec_quiz_correct_option_index(
       question.correct_answer_json, question.options_json, question.question_type
     ) is not null;

  return jsonb_build_object('game_id', game_id, 'pin', pin_value, 'status', 'LOBBY');
end;
$$;

notify pgrst, 'reload schema';
commit;
