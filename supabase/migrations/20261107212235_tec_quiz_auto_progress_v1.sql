begin;

alter table public.tec_quiz_games
  add column if not exists reveal_started_at timestamptz,
  add column if not exists reveal_paused_at timestamptz;

create or replace function public.tec_quiz_tick_v1(p_game_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  game_row public.tec_quiz_games%rowtype;
  total_questions integer;
begin
  if auth.uid() is null or not private.is_current_profile_active() then
    raise exception 'TEC_QUIZ_AUTHENTICATION_REQUIRED';
  end if;

  if not private.tec_quiz_teacher_can_access(p_game_id)
     and not private.tec_quiz_student_can_access(p_game_id) then
    raise exception 'TEC_QUIZ_ACCESS_DENIED';
  end if;

  select game.* into game_row
    from public.tec_quiz_games game
   where game.id = p_game_id
   for update;
  if not found then raise exception 'TEC_QUIZ_GAME_NOT_FOUND'; end if;
  if not private.tec_quiz_teacher_can_access(p_game_id)
     and not private.tec_quiz_student_can_access(p_game_id) then
    raise exception 'TEC_QUIZ_ACCESS_DENIED';
  end if;

  if game_row.status = 'IN_PROGRESS' then
    if game_row.round_deadline_at is null then
      update public.tec_quiz_games
         set round_started_at = now(),
             round_deadline_at = now() + make_interval(secs => game_row.time_per_question_seconds),
             reveal_started_at = null,
             reveal_paused_at = null
       where id = p_game_id;
    elsif now() >= game_row.round_deadline_at then
      update public.tec_quiz_games
         set status = 'INTERMISSION',
             round_deadline_at = now() + interval '15 seconds',
             reveal_started_at = now(),
             reveal_paused_at = null
       where id = p_game_id;
    end if;
  elsif game_row.status = 'INTERMISSION' then
    if game_row.reveal_started_at is null then
      update public.tec_quiz_games
         set reveal_started_at = now(),
             round_deadline_at = now() + interval '15 seconds',
             reveal_paused_at = null
       where id = p_game_id;
    elsif game_row.reveal_paused_at is not null then
      null;
    elsif game_row.round_deadline_at is null or now() >= game_row.round_deadline_at then
      select count(*)::integer into total_questions
        from public.tec_quiz_game_questions question
       where question.game_id = p_game_id;

      if game_row.question_index >= total_questions then
        update public.tec_quiz_games
           set status = 'FINISHED',
               ended_at = now(),
               round_deadline_at = null,
               reveal_started_at = null,
               reveal_paused_at = null
         where id = p_game_id;
      else
        update public.tec_quiz_games
           set status = 'IN_PROGRESS',
               question_index = question_index + 1,
               round_started_at = now(),
               round_deadline_at = now() + make_interval(secs => game_row.time_per_question_seconds),
               reveal_started_at = null,
               reveal_paused_at = null
         where id = p_game_id;
      end if;
    end if;
  end if;

  select game.* into game_row
    from public.tec_quiz_games game
   where game.id = p_game_id;

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
  total_questions integer;
begin
  if auth.uid() is null or not private.is_current_profile_active() then
    raise exception 'TEC_QUIZ_AUTHENTICATION_REQUIRED';
  end if;
  if not private.tec_quiz_teacher_can_access(p_game_id) then
    raise exception 'TEC_QUIZ_TEACHER_SCOPE_DENIED';
  end if;

  select game.* into game_row
    from public.tec_quiz_games game
   where game.id = p_game_id
   for update;
  if not found then raise exception 'TEC_QUIZ_GAME_NOT_FOUND'; end if;
  if not private.tec_quiz_teacher_can_access(p_game_id) then
    raise exception 'TEC_QUIZ_TEACHER_SCOPE_DENIED';
  end if;
  if game_row.status <> 'INTERMISSION' then
    raise exception 'TEC_QUIZ_REVEAL_NOT_ACTIVE';
  end if;

  if action_name = 'PAUSE' then
    if game_row.reveal_paused_at is null then
      update public.tec_quiz_games
         set reveal_started_at = coalesce(reveal_started_at, now()),
             round_deadline_at = case
               when reveal_started_at is null
                 or round_deadline_at is null
                 or now() >= round_deadline_at
               then now() + interval '15 seconds'
               else round_deadline_at
             end,
             reveal_paused_at = now()
       where id = p_game_id;
    end if;
  elsif action_name = 'RESUME' then
    if game_row.reveal_paused_at is not null then
      update public.tec_quiz_games
         set round_deadline_at = coalesce(
               round_deadline_at,
               reveal_paused_at + interval '15 seconds'
             ) + (now() - reveal_paused_at),
             reveal_paused_at = null
       where id = p_game_id;
    end if;
  elsif action_name = 'ADVANCE' then
    select count(*)::integer into total_questions
      from public.tec_quiz_game_questions question
     where question.game_id = p_game_id;

    if game_row.question_index >= total_questions then
      update public.tec_quiz_games
         set status = 'FINISHED',
             ended_at = now(),
             round_deadline_at = null,
             reveal_started_at = null,
             reveal_paused_at = null
       where id = p_game_id;
    else
      update public.tec_quiz_games
         set status = 'IN_PROGRESS',
             question_index = question_index + 1,
             round_started_at = now(),
             round_deadline_at = now() + make_interval(secs => game_row.time_per_question_seconds),
             reveal_started_at = null,
             reveal_paused_at = null
       where id = p_game_id;
    end if;
  else
    raise exception 'TEC_QUIZ_REVEAL_ACTION_INVALID';
  end if;

  select game.* into game_row
    from public.tec_quiz_games game
   where game.id = p_game_id;

  return jsonb_build_object(
    'game_id', game_row.id,
    'status', game_row.status,
    'question_index', game_row.question_index,
    'round_deadline_at', game_row.round_deadline_at,
    'reveal_paused_at', game_row.reveal_paused_at
  );
end;
$$;

create or replace function public.tec_quiz_state_v1(p_game_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  game_row public.tec_quiz_games%rowtype;
  question_row public.tec_quiz_game_questions%rowtype;
  viewer_is_teacher boolean;
  viewer_participant_id uuid;
  current_question jsonb;
  scoreboard jsonb;
  participant_list jsonb;
  my_answer jsonb;
  response_count integer := 0;
  participant_count integer := 0;
  can_advance boolean := false;
  total_questions integer := 0;
  reveal boolean;
begin
  if auth.uid() is null or not private.is_current_profile_active() then
    raise exception 'TEC_QUIZ_AUTHENTICATION_REQUIRED';
  end if;
  select game.* into game_row from public.tec_quiz_games game where game.id = p_game_id;
  if not found then raise exception 'TEC_QUIZ_GAME_NOT_FOUND'; end if;
  viewer_is_teacher := private.tec_quiz_teacher_can_access(p_game_id);
  if not viewer_is_teacher and not private.tec_quiz_student_can_access(p_game_id) then
    raise exception 'TEC_QUIZ_ACCESS_DENIED';
  end if;
  select participant.id into viewer_participant_id
    from public.tec_quiz_participants participant
    join public.students student on student.id = participant.student_id
   where participant.game_id = p_game_id and student.profile_id = auth.uid();
  select count(*)::integer into total_questions
    from public.tec_quiz_game_questions question where question.game_id = p_game_id;
  select count(*)::integer into participant_count
    from public.tec_quiz_participants participant where participant.game_id = p_game_id;

  reveal := game_row.status in ('INTERMISSION', 'FINISHED');
  if game_row.question_index > 0 then
    select question.* into question_row
      from public.tec_quiz_game_questions question
     where question.game_id = p_game_id
       and question.question_index = game_row.question_index;
    current_question := jsonb_build_object(
      'index', question_row.question_index,
      'total', total_questions,
      'text', question_row.question_text,
      'type', question_row.question_type,
      'options', question_row.options_json,
      'deadline_at', game_row.round_deadline_at
    );
    if reveal then
      current_question := current_question || jsonb_build_object(
        'correct_option_index', question_row.correct_option_index,
        'explanation', question_row.explanation
      );
    end if;
    select count(*)::integer into response_count from public.tec_quiz_answers answer
     where answer.game_id = p_game_id and answer.question_index = game_row.question_index;
    if viewer_is_teacher then
      can_advance := game_row.status = 'IN_PROGRESS'
        and (now() >= game_row.round_deadline_at or response_count >= participant_count);
    end if;
    if viewer_participant_id is not null then
      select jsonb_build_object(
        'submitted', true,
        'is_correct', case when reveal then answer.is_correct else null end,
        'points_awarded', case when reveal then answer.points_awarded else null end
      ) into my_answer from public.tec_quiz_answers answer
       where answer.game_id = p_game_id
         and answer.question_index = game_row.question_index
         and answer.participant_id = viewer_participant_id;
    end if;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'rank', ranked.rank,
    'alias', ranked.display_alias,
    'score', case when reveal then ranked.score else null end,
    'correct_count', case when reveal then ranked.correct_count else null end
  ) order by ranked.rank, ranked.joined_at), '[]'::jsonb)
    into scoreboard
    from (
      select participant.display_alias, participant.score, participant.correct_count,
             participant.joined_at,
             dense_rank() over (order by participant.score desc) as rank
        from public.tec_quiz_participants participant
       where participant.game_id = p_game_id
     ) ranked;

  select coalesce(jsonb_agg(jsonb_build_object('alias', participant.display_alias)
                            order by participant.joined_at), '[]'::jsonb)
    into participant_list
    from public.tec_quiz_participants participant
   where participant.game_id = p_game_id;

  return jsonb_build_object(
    'game_id', game_row.id,
    'pin', case when viewer_is_teacher then game_row.pin else null end,
    'status', game_row.status,
    'viewer_role', case when viewer_is_teacher then 'TEACHER' else 'STUDENT' end,
    'activity_title', (select activity.title from public.learning_activities activity where activity.id = game_row.activity_id),
    'question_index', game_row.question_index,
    'total_questions', total_questions,
    'time_per_question_seconds', game_row.time_per_question_seconds,
    'round_deadline_at', game_row.round_deadline_at,
    'reveal_paused_at', game_row.reveal_paused_at,
    'round_response_count', case when viewer_is_teacher then response_count else null end,
    'participant_count', participant_count,
    'can_advance', can_advance,
    'question', current_question,
    'my_answer', my_answer,
    'participants', participant_list,
    'leaderboard', case when reveal then scoreboard else '[]'::jsonb end,
    'report', case when game_row.status = 'FINISHED' then scoreboard else null end
  );
end;
$$;

revoke all on function public.tec_quiz_tick_v1(uuid) from public, anon;
grant execute on function public.tec_quiz_tick_v1(uuid) to authenticated;
revoke all on function public.tec_quiz_control_reveal_v1(uuid, text) from public, anon;
grant execute on function public.tec_quiz_control_reveal_v1(uuid, text) to authenticated;
revoke all on function public.tec_quiz_state_v1(uuid) from public, anon;
grant execute on function public.tec_quiz_state_v1(uuid) to authenticated;

notify pgrst, 'reload schema';
commit;
