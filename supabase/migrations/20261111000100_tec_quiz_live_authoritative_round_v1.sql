begin;

create or replace function public.tec_quiz_start_v1(p_game_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  game_row public.tec_quiz_games%rowtype;
  participant_count integer;
  total_questions integer;
  action_now timestamptz;
begin
  select game.* into game_row
    from public.tec_quiz_games game
   where game.id = p_game_id
   for update;
  if not found or not private.tec_quiz_teacher_can_access(p_game_id) then
    raise exception 'TEC_QUIZ_TEACHER_SCOPE_DENIED';
  end if;
  if game_row.status <> 'LOBBY' then raise exception 'TEC_QUIZ_GAME_NOT_IN_LOBBY'; end if;

  select count(*)::integer into participant_count
    from public.tec_quiz_participants participant where participant.game_id = p_game_id;
  if participant_count < 2 then raise exception 'TEC_QUIZ_REQUIRES_TWO_STUDENTS'; end if;
  select count(*)::integer into total_questions
    from public.tec_quiz_game_questions question where question.game_id = p_game_id;
  if total_questions < 3 then raise exception 'TEC_QUIZ_QUESTION_COUNT_INVALID'; end if;

  action_now := clock_timestamp();
  update public.tec_quiz_games
     set status = 'IN_PROGRESS', question_index = 1,
         started_at = action_now, round_started_at = action_now,
         round_deadline_at = action_now + make_interval(secs => game_row.time_per_question_seconds)
   where id = p_game_id;
  return jsonb_build_object('game_id', p_game_id, 'status', 'IN_PROGRESS', 'question_index', 1);
end;
$$;

create or replace function public.tec_quiz_submit_answer_v1(
  p_game_id uuid,
  p_selected_option_index integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'TEC_QUIZ_CLIENT_UPDATE_REQUIRED';
end;
$$;

create or replace function public.tec_quiz_submit_answer_v2(
  p_game_id uuid,
  p_expected_question_index integer,
  p_selected_option_index integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  game_row public.tec_quiz_games%rowtype;
  participant_row public.tec_quiz_participants%rowtype;
  question_row public.tec_quiz_game_questions%rowtype;
  answer_row public.tec_quiz_answers%rowtype;
  action_now timestamptz;
  correct_value boolean;
  elapsed_ms integer;
  awarded_points integer;
  round_duration_ms integer;
begin
  if auth.uid() is null or not private.is_current_profile_active() then
    raise exception 'TEC_QUIZ_AUTHENTICATION_REQUIRED';
  end if;

  select game.* into game_row from public.tec_quiz_games game
   where game.id = p_game_id for update;
  if not found or not private.tec_quiz_student_can_access(p_game_id) then
    raise exception 'TEC_QUIZ_STUDENT_SCOPE_DENIED';
  end if;
  select participant.* into participant_row
    from public.tec_quiz_participants participant
    join public.students student on student.id = participant.student_id
   where participant.game_id = p_game_id and student.profile_id = auth.uid()
   for update of participant;
  if not found then raise exception 'TEC_QUIZ_PARTICIPANT_NOT_FOUND'; end if;

  if p_expected_question_index is null
     or game_row.question_index <> p_expected_question_index then
    raise exception 'TEC_QUIZ_QUESTION_CHANGED';
  end if;
  select answer.* into answer_row
    from public.tec_quiz_answers answer
   where answer.game_id = p_game_id
     and answer.question_index = p_expected_question_index
     and answer.participant_id = participant_row.id;
  if found then
    return jsonb_build_object('accepted', true, 'already_submitted', true);
  end if;

  action_now := clock_timestamp();
  if game_row.status <> 'IN_PROGRESS'
     or game_row.round_deadline_at is null
     or game_row.round_started_at is null
     or action_now >= game_row.round_deadline_at then
    raise exception 'TEC_QUIZ_ROUND_CLOSED';
  end if;
  select question.* into question_row
    from public.tec_quiz_game_questions question
   where question.game_id = p_game_id
     and question.question_index = p_expected_question_index;
  if not found or p_selected_option_index is null
     or p_selected_option_index < 0
     or p_selected_option_index >= jsonb_array_length(question_row.options_json) then
    raise exception 'TEC_QUIZ_OPTION_INVALID';
  end if;

  correct_value := p_selected_option_index = question_row.correct_option_index;
  elapsed_ms := greatest(0, floor(extract(epoch from (action_now - game_row.round_started_at)) * 1000)::integer);
  round_duration_ms := game_row.time_per_question_seconds * 1000;
  awarded_points := case when correct_value then
    game_row.base_points + floor(
      game_row.base_points * 0.5 * greatest(0, round_duration_ms - elapsed_ms)::numeric
      / round_duration_ms
    )::integer
    else 0 end;

  insert into public.tec_quiz_answers (
    game_id, question_index, participant_id, selected_option_index,
    is_correct, points_awarded, elapsed_milliseconds, answered_at
  ) values (
    p_game_id, p_expected_question_index, participant_row.id, p_selected_option_index,
    correct_value, awarded_points, elapsed_ms, action_now
  ) returning * into answer_row;

  update public.tec_quiz_participants
     set score = score + awarded_points,
         correct_count = correct_count + case when correct_value then 1 else 0 end
   where id = participant_row.id;
  return jsonb_build_object('accepted', true, 'already_submitted', false);
end;
$$;

create or replace function public.tec_quiz_tick_v1(p_game_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  game_row public.tec_quiz_games%rowtype;
  total_questions integer;
  action_now timestamptz;
begin
  if auth.uid() is null or not private.is_current_profile_active() then
    raise exception 'TEC_QUIZ_AUTHENTICATION_REQUIRED';
  end if;
  if not private.tec_quiz_teacher_can_access(p_game_id)
     and not private.tec_quiz_student_can_access(p_game_id) then
    raise exception 'TEC_QUIZ_ACCESS_DENIED';
  end if;
  select game.* into game_row from public.tec_quiz_games game
   where game.id = p_game_id for update;
  if not found then raise exception 'TEC_QUIZ_GAME_NOT_FOUND'; end if;
  if not private.tec_quiz_teacher_can_access(p_game_id)
     and not private.tec_quiz_student_can_access(p_game_id) then
    raise exception 'TEC_QUIZ_ACCESS_DENIED';
  end if;
  action_now := clock_timestamp();

  if game_row.status = 'IN_PROGRESS' then
    if game_row.round_deadline_at is null then
      update public.tec_quiz_games
         set round_started_at = action_now,
             round_deadline_at = action_now + make_interval(secs => game_row.time_per_question_seconds),
             reveal_started_at = null,
             reveal_paused_at = null
       where id = p_game_id;
    elsif action_now >= game_row.round_deadline_at then
      update public.tec_quiz_games
         set status = 'INTERMISSION',
             round_deadline_at = action_now + interval '15 seconds',
             reveal_started_at = action_now,
             reveal_paused_at = null
       where id = p_game_id;
    end if;
  elsif game_row.status = 'INTERMISSION' then
    if game_row.reveal_paused_at is not null then
      null;
    elsif game_row.reveal_started_at is null or game_row.round_deadline_at is null then
      update public.tec_quiz_games
         set reveal_started_at = coalesce(reveal_started_at, action_now),
             round_deadline_at = action_now + interval '15 seconds'
       where id = p_game_id;
    elsif action_now >= game_row.round_deadline_at then
      select count(*)::integer into total_questions
        from public.tec_quiz_game_questions question where question.game_id = p_game_id;
      if game_row.question_index >= total_questions then
        update public.tec_quiz_games
           set status = 'FINISHED', ended_at = action_now,
               round_deadline_at = null, reveal_started_at = null, reveal_paused_at = null
         where id = p_game_id;
      else
        update public.tec_quiz_games
           set status = 'IN_PROGRESS', question_index = question_index + 1,
               round_started_at = action_now,
               round_deadline_at = action_now + make_interval(secs => game_row.time_per_question_seconds),
               reveal_started_at = null, reveal_paused_at = null
         where id = p_game_id;
      end if;
    end if;
  end if;

  select game.* into game_row from public.tec_quiz_games game where game.id = p_game_id;
  return jsonb_build_object(
    'game_id', game_row.id,
    'status', game_row.status,
    'question_index', game_row.question_index,
    'round_deadline_at', game_row.round_deadline_at,
    'reveal_started_at', game_row.reveal_started_at,
    'reveal_paused_at', game_row.reveal_paused_at
  );
end;
$$;

create or replace function public.tec_quiz_control_reveal_v1(
  p_game_id uuid,
  p_action text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  game_row public.tec_quiz_games%rowtype;
  action_name text := upper(trim(coalesce(p_action, '')));
  action_now timestamptz;
  total_questions integer;
begin
  if auth.uid() is null or not private.is_current_profile_active() then
    raise exception 'TEC_QUIZ_AUTHENTICATION_REQUIRED';
  end if;
  if not private.tec_quiz_teacher_can_access(p_game_id) then
    raise exception 'TEC_QUIZ_TEACHER_SCOPE_DENIED';
  end if;
  select game.* into game_row from public.tec_quiz_games game
   where game.id = p_game_id for update;
  if not found then raise exception 'TEC_QUIZ_GAME_NOT_FOUND'; end if;
  if not private.tec_quiz_teacher_can_access(p_game_id) then
    raise exception 'TEC_QUIZ_TEACHER_SCOPE_DENIED';
  end if;
  if game_row.status <> 'INTERMISSION' then
    raise exception 'TEC_QUIZ_REVEAL_NOT_ACTIVE';
  end if;
  action_now := clock_timestamp();

  if action_name = 'PAUSE' then
    if game_row.reveal_paused_at is null then
      update public.tec_quiz_games
         set reveal_started_at = coalesce(reveal_started_at, action_now),
             round_deadline_at = case
               when reveal_started_at is null or round_deadline_at is null
                 or action_now >= round_deadline_at
               then action_now + interval '15 seconds'
               else round_deadline_at
             end,
             reveal_paused_at = action_now
       where id = p_game_id;
    end if;
  elsif action_name = 'RESUME' then
    if game_row.reveal_paused_at is not null then
      update public.tec_quiz_games
         set round_deadline_at = coalesce(
               round_deadline_at,
               reveal_paused_at + interval '15 seconds'
             ) + (action_now - reveal_paused_at),
             reveal_paused_at = null
       where id = p_game_id;
    end if;
  elsif action_name = 'ADVANCE' then
    select count(*)::integer into total_questions
      from public.tec_quiz_game_questions question where question.game_id = p_game_id;
    if game_row.question_index >= total_questions then
      update public.tec_quiz_games
         set status = 'FINISHED', ended_at = action_now,
             round_deadline_at = null, reveal_started_at = null, reveal_paused_at = null
       where id = p_game_id;
    else
      update public.tec_quiz_games
         set status = 'IN_PROGRESS', question_index = question_index + 1,
             round_started_at = action_now,
             round_deadline_at = action_now + make_interval(secs => game_row.time_per_question_seconds),
             reveal_started_at = null, reveal_paused_at = null
       where id = p_game_id;
    end if;
  else
    raise exception 'TEC_QUIZ_REVEAL_ACTION_INVALID';
  end if;

  select game.* into game_row from public.tec_quiz_games game where game.id = p_game_id;
  return jsonb_build_object(
    'game_id', game_row.id,
    'status', game_row.status,
    'question_index', game_row.question_index,
    'round_deadline_at', game_row.round_deadline_at,
    'reveal_paused_at', game_row.reveal_paused_at
  );
end;
$$;

revoke all on function public.tec_quiz_submit_answer_v1(uuid, integer) from public, anon;
grant execute on function public.tec_quiz_submit_answer_v1(uuid, integer) to authenticated;
revoke all on function public.tec_quiz_submit_answer_v2(uuid, integer, integer) from public, anon;
grant execute on function public.tec_quiz_submit_answer_v2(uuid, integer, integer) to authenticated;
revoke all on function public.tec_quiz_tick_v1(uuid) from public, anon;
grant execute on function public.tec_quiz_tick_v1(uuid) to authenticated;
revoke all on function public.tec_quiz_control_reveal_v1(uuid, text) from public, anon;
grant execute on function public.tec_quiz_control_reveal_v1(uuid, text) to authenticated;

notify pgrst, 'reload schema';
commit;
