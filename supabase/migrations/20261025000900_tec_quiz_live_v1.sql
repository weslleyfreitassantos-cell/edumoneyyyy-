begin;

create table public.tec_quiz_games (
  id uuid primary key default extensions.uuid_generate_v4(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  activity_id uuid references public.learning_activities(id) on delete set null,
  class_id uuid not null references public.classes(id) on delete restrict,
  teacher_id uuid not null references public.profiles(id) on delete restrict,
  pin text not null check (pin ~ '^[0-9]{6}$'),
  status text not null default 'LOBBY'
    check (status in ('LOBBY', 'IN_PROGRESS', 'INTERMISSION', 'FINISHED', 'CANCELLED', 'EXPIRED')),
  question_index integer not null default 0 check (question_index >= 0),
  time_per_question_seconds integer not null check (time_per_question_seconds between 5 and 120),
  base_points integer not null check (base_points between 100 and 1000),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  round_started_at timestamptz,
  round_deadline_at timestamptz,
  ended_at timestamptz
);

create unique index tec_quiz_games_active_pin_key
  on public.tec_quiz_games(pin)
  where status in ('LOBBY', 'IN_PROGRESS', 'INTERMISSION');
create index tec_quiz_games_teacher_recent_idx
  on public.tec_quiz_games(institution_id, teacher_id, created_at desc);

create table public.tec_quiz_game_questions (
  game_id uuid not null references public.tec_quiz_games(id) on delete cascade,
  question_index integer not null check (question_index between 1 and 100),
  source_question_id uuid not null,
  question_text text not null,
  question_type text not null check (question_type in ('MULTIPLE_CHOICE', 'TRUE_FALSE')),
  options_json jsonb not null check (jsonb_typeof(options_json) = 'array'),
  correct_option_index integer not null check (correct_option_index between 0 and 7),
  explanation text,
  primary key (game_id, question_index),
  unique (game_id, source_question_id)
);

create table public.tec_quiz_participants (
  id uuid primary key default extensions.uuid_generate_v4(),
  game_id uuid not null references public.tec_quiz_games(id) on delete cascade,
  institution_id uuid not null references public.institutions(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete restrict,
  display_alias text not null,
  joined_at timestamptz not null default now(),
  score integer not null default 0 check (score >= 0),
  correct_count integer not null default 0 check (correct_count >= 0),
  unique (game_id, student_id),
  unique (game_id, display_alias)
);
create index tec_quiz_participants_student_recent_idx
  on public.tec_quiz_participants(student_id, joined_at desc);

create table public.tec_quiz_answers (
  id uuid primary key default extensions.uuid_generate_v4(),
  game_id uuid not null,
  question_index integer not null,
  participant_id uuid not null references public.tec_quiz_participants(id) on delete cascade,
  selected_option_index integer not null check (selected_option_index between 0 and 7),
  is_correct boolean not null,
  points_awarded integer not null check (points_awarded >= 0),
  elapsed_milliseconds integer not null check (elapsed_milliseconds >= 0),
  answered_at timestamptz not null default now(),
  foreign key (game_id, question_index)
    references public.tec_quiz_game_questions(game_id, question_index) on delete cascade,
  unique (game_id, question_index, participant_id)
);
create index tec_quiz_answers_game_question_idx
  on public.tec_quiz_answers(game_id, question_index, answered_at);

alter table public.tec_quiz_games enable row level security;
alter table public.tec_quiz_game_questions enable row level security;
alter table public.tec_quiz_participants enable row level security;
alter table public.tec_quiz_answers enable row level security;
revoke all on public.tec_quiz_games, public.tec_quiz_game_questions,
  public.tec_quiz_participants, public.tec_quiz_answers from public, anon, authenticated;

create or replace function private.tec_quiz_normalize_answer(value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case lower(trim(coalesce(value, '')))
    when 'verdadeiro' then 'true'
    when 'true' then 'true'
    when 't' then 'true'
    when 'sim' then 'true'
    when '1' then 'true'
    when 'falso' then 'false'
    when 'false' then 'false'
    when 'f' then 'false'
    when 'não' then 'false'
    when 'nao' then 'false'
    when '0' then 'false'
    else lower(trim(coalesce(value, '')))
  end;
$$;

create or replace function private.tec_quiz_options_are_valid(options jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  option_value jsonb;
begin
  if jsonb_typeof(options) is distinct from 'array' then
    return false;
  end if;
  if jsonb_array_length(options) not between 2 and 8 then
    return false;
  end if;
  for option_value in select value from jsonb_array_elements(options) loop
    if jsonb_typeof(option_value) is distinct from 'string'
       or nullif(trim(option_value #>> '{}'), '') is null then
      return false;
    end if;
  end loop;
  return true;
end;
$$;

create or replace function private.tec_quiz_correct_option_index(
  answer jsonb,
  options jsonb,
  question_type text
)
returns integer
language plpgsql
immutable
set search_path = ''
as $$
declare
  expected text;
  option_index integer;
begin
  if jsonb_typeof(options) is distinct from 'array' then
    return null;
  end if;
  if jsonb_array_length(options) < 2 then
    return null;
  end if;
  expected := case jsonb_typeof(answer)
    when 'string' then answer #>> '{}'
    when 'boolean' then answer #>> '{}'
    when 'number' then answer #>> '{}'
    else null
  end;
  if expected is null or trim(expected) = '' then return null; end if;

  for option_index in 0..jsonb_array_length(options) - 1 loop
    if jsonb_typeof(options -> option_index) = 'string'
       and private.tec_quiz_normalize_answer(options ->> option_index)
           = private.tec_quiz_normalize_answer(expected) then
      return option_index;
    end if;
  end loop;

  if question_type = 'TRUE_FALSE' then
    if private.tec_quiz_normalize_answer(expected) = 'true' then return 0; end if;
    if private.tec_quiz_normalize_answer(expected) = 'false' then return 1; end if;
  end if;
  return null;
end;
$$;

create or replace function private.tec_quiz_teacher_can_access(target_game_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and private.is_current_profile_active()
    and exists (
      select 1
        from public.tec_quiz_games game
        join public.memberships membership
          on membership.profile_id = auth.uid()
         and membership.institution_id = game.institution_id
         and membership.role = 'TEACHER'::public.user_role
         and membership.active is true
       where game.id = target_game_id
         and game.teacher_id = auth.uid()
    );
$$;

create or replace function private.tec_quiz_student_can_access(target_game_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and private.is_current_profile_active()
    and exists (
      select 1
        from public.tec_quiz_participants participant
        join public.tec_quiz_games game
          on game.id = participant.game_id
         and game.institution_id = participant.institution_id
        join public.students student
          on student.id = participant.student_id
         and student.institution_id = participant.institution_id
         and student.profile_id = auth.uid()
         and student.active is true
        join public.memberships membership
          on membership.profile_id = auth.uid()
         and membership.institution_id = participant.institution_id
         and membership.role = 'STUDENT'::public.user_role
         and membership.active is true
        join public.enrollments enrollment
          on enrollment.student_id = student.id
         and enrollment.class_id = game.class_id
         and enrollment.active is true
         and upper(enrollment.status) = 'ACTIVE'
       where participant.game_id = target_game_id
    );
$$;

create or replace function private.tec_quiz_can_access_realtime_topic(target_topic text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  game_text text;
begin
  if auth.uid() is null or not private.is_current_profile_active()
     or target_topic is null
     or split_part(target_topic, ':', 1) <> 'tec-quiz' then
    return false;
  end if;
  game_text := split_part(target_topic, ':', 2);
  if game_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     or target_topic <> 'tec-quiz:' || game_text then
    return false;
  end if;
  return private.tec_quiz_teacher_can_access(game_text::uuid)
      or private.tec_quiz_student_can_access(game_text::uuid);
end;
$$;

create or replace function private.tec_quiz_broadcast_state_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_game_id uuid;
begin
  if tg_table_name = 'tec_quiz_games' then
    target_game_id := new.id;
  else
    target_game_id := new.game_id;
  end if;
  perform realtime.send(
    jsonb_build_object('game_id', target_game_id),
    'tec_quiz_state_changed',
    'tec-quiz:' || target_game_id::text,
    true
  );
  return new;
end;
$$;

drop policy if exists tec_quiz_broadcast_read on realtime.messages;
create policy tec_quiz_broadcast_read on realtime.messages
  for select to authenticated
  using (
    extension = 'broadcast'
    and private.tec_quiz_can_access_realtime_topic(topic)
  );

create trigger tec_quiz_game_broadcast_after_update
  after update on public.tec_quiz_games
  for each row execute function private.tec_quiz_broadcast_state_change();
create trigger tec_quiz_participant_broadcast_after_insert
  after insert on public.tec_quiz_participants
  for each row execute function private.tec_quiz_broadcast_state_change();
create trigger tec_quiz_answer_broadcast_after_insert
  after insert on public.tec_quiz_answers
  for each row execute function private.tec_quiz_broadcast_state_change();

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
   where activity.teacher_id = auth.uid()
     and activity.status = 'PUBLISHED'
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
     and question.question_type in ('MULTIPLE_CHOICE', 'TRUE_FALSE')
   group by activity.id, activity.title, subject.name, classroom.id, classroom.name
  having count(question.id) >= 3
     and (select count(*)
            from public.learning_questions all_question
           where all_question.activity_id = activity.id
             and all_question.institution_id = activity.institution_id) = count(question.id)
      and count(question.id) = count(*) filter (
        where private.tec_quiz_options_are_valid(question.options_json)
         and private.tec_quiz_correct_option_index(
           question.correct_answer_json, question.options_json, question.question_type
         ) is not null
     )
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
     and activity.teacher_id = auth.uid()
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
     and question.institution_id = activity_row.institution_id;
  if question_count < 3 or question_count > 100 then
    raise exception 'TEC_QUIZ_QUESTION_COUNT_INVALID';
  end if;
  if exists (
    select 1
      from public.learning_questions question
     where question.activity_id = activity_row.id
       and question.institution_id = activity_row.institution_id
       and (question.question_type not in ('MULTIPLE_CHOICE', 'TRUE_FALSE')
        or nullif(trim(question.question_text), '') is null
        or not private.tec_quiz_options_are_valid(question.options_json)
         or private.tec_quiz_correct_option_index(
              question.correct_answer_json, question.options_json, question.question_type
            ) is null)
  ) then raise exception 'TEC_QUIZ_ACTIVITY_QUESTION_INVALID'; end if;

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
     and question.institution_id = activity_row.institution_id;

  return jsonb_build_object('game_id', game_id, 'pin', pin_value, 'status', 'LOBBY');
end;
$$;

create or replace function public.tec_quiz_join_v1(p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  game_row public.tec_quiz_games%rowtype;
  student_row public.students%rowtype;
  participant_row public.tec_quiz_participants%rowtype;
  alias_value text;
begin
  if auth.uid() is null or not private.is_current_profile_active() then
    raise exception 'TEC_QUIZ_AUTHENTICATION_REQUIRED';
  end if;
  if p_pin is null or p_pin !~ '^[0-9]{6}$' then
    raise exception 'TEC_QUIZ_PIN_INVALID';
  end if;

  select game.* into game_row
    from public.tec_quiz_games game
   where game.pin = p_pin
     and game.status in ('LOBBY', 'IN_PROGRESS', 'INTERMISSION', 'FINISHED')
   order by game.created_at desc
   limit 1
   for update;
  if not found then raise exception 'TEC_QUIZ_GAME_NOT_FOUND'; end if;

  select student.* into student_row
    from public.students student
    join public.memberships membership
      on membership.profile_id = student.profile_id
     and membership.institution_id = student.institution_id
     and membership.role = 'STUDENT'::public.user_role
     and membership.active is true
    join public.enrollments enrollment
      on enrollment.student_id = student.id
     and enrollment.class_id = game_row.class_id
     and enrollment.active is true
     and upper(enrollment.status) = 'ACTIVE'
    where student.profile_id = auth.uid()
     and student.institution_id = game_row.institution_id
     and student.active is true
   limit 1;
  if not found then raise exception 'TEC_QUIZ_STUDENT_CLASS_SCOPE_DENIED'; end if;

  select participant.* into participant_row
    from public.tec_quiz_participants participant
   where participant.game_id = game_row.id
     and participant.student_id = student_row.id;
  if found then
    return jsonb_build_object('game_id', game_row.id, 'status', game_row.status);
  end if;
  if game_row.status <> 'LOBBY'
     or game_row.created_at < now() - interval '2 hours' then
    raise exception 'TEC_QUIZ_JOIN_CLOSED';
  end if;

  alias_value := 'Jogador ' || lpad((
    (select count(*) + 1 from public.tec_quiz_participants participant
      where participant.game_id = game_row.id)::integer
  )::text, 2, '0');
  insert into public.tec_quiz_participants (
    game_id, institution_id, student_id, display_alias
  ) values (
    game_row.id, game_row.institution_id, student_row.id, alias_value
  ) returning * into participant_row;
  return jsonb_build_object('game_id', game_row.id, 'status', game_row.status);
end;
$$;

create or replace function public.tec_quiz_my_current_game_v1()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select game.id
    from public.tec_quiz_games game
    join public.tec_quiz_participants participant on participant.game_id = game.id
    join public.students student on student.id = participant.student_id
    join public.memberships membership
      on membership.profile_id = auth.uid()
     and membership.institution_id = game.institution_id
     and membership.role = 'STUDENT'::public.user_role
     and membership.active is true
    join public.enrollments enrollment
      on enrollment.student_id = student.id
     and enrollment.class_id = game.class_id
     and enrollment.active is true
     and upper(enrollment.status) = 'ACTIVE'
   where auth.uid() is not null
     and private.is_current_profile_active()
     and student.profile_id = auth.uid()
     and student.active is true
     and game.status in ('LOBBY', 'IN_PROGRESS', 'INTERMISSION')
     and game.created_at >= now() - interval '4 hours'
   order by participant.joined_at desc
   limit 1;
$$;

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

  update public.tec_quiz_games
     set status = 'IN_PROGRESS', question_index = 1,
         started_at = now(), round_started_at = now(),
         round_deadline_at = now() + make_interval(secs => game_row.time_per_question_seconds)
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
declare
  game_row public.tec_quiz_games%rowtype;
  participant_row public.tec_quiz_participants%rowtype;
  question_row public.tec_quiz_game_questions%rowtype;
  answer_row public.tec_quiz_answers%rowtype;
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

  select answer.* into answer_row
    from public.tec_quiz_answers answer
   where answer.game_id = p_game_id
     and answer.question_index = game_row.question_index
     and answer.participant_id = participant_row.id;
  if found then
    return jsonb_build_object('accepted', true, 'already_submitted', true);
  end if;
  if game_row.status <> 'IN_PROGRESS'
     or game_row.round_deadline_at is null
     or now() > game_row.round_deadline_at then
    raise exception 'TEC_QUIZ_ROUND_CLOSED';
  end if;
  select question.* into question_row
    from public.tec_quiz_game_questions question
   where question.game_id = p_game_id
     and question.question_index = game_row.question_index;
  if not found or p_selected_option_index is null
     or p_selected_option_index < 0
     or p_selected_option_index >= jsonb_array_length(question_row.options_json) then
    raise exception 'TEC_QUIZ_OPTION_INVALID';
  end if;

  correct_value := p_selected_option_index = question_row.correct_option_index;
  elapsed_ms := greatest(0, floor(extract(epoch from (now() - game_row.round_started_at)) * 1000)::integer);
  round_duration_ms := game_row.time_per_question_seconds * 1000;
  awarded_points := case when correct_value then
    game_row.base_points + floor(
      game_row.base_points * 0.5 * greatest(0, round_duration_ms - elapsed_ms)::numeric
      / round_duration_ms
    )::integer
    else 0 end;

  insert into public.tec_quiz_answers (
    game_id, question_index, participant_id, selected_option_index,
    is_correct, points_awarded, elapsed_milliseconds
  ) values (
    p_game_id, game_row.question_index, participant_row.id, p_selected_option_index,
    correct_value, awarded_points, elapsed_ms
  ) returning * into answer_row;

  update public.tec_quiz_participants
     set score = score + awarded_points,
         correct_count = correct_count + case when correct_value then 1 else 0 end
   where id = participant_row.id;
  return jsonb_build_object('accepted', true, 'already_submitted', false);
end;
$$;

create or replace function public.tec_quiz_advance_v1(p_game_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  game_row public.tec_quiz_games%rowtype;
  participant_count integer;
  answer_count integer;
  total_questions integer;
begin
  select game.* into game_row from public.tec_quiz_games game
   where game.id = p_game_id for update;
  if not found or not private.tec_quiz_teacher_can_access(p_game_id) then
    raise exception 'TEC_QUIZ_TEACHER_SCOPE_DENIED';
  end if;
  select count(*)::integer into total_questions
    from public.tec_quiz_game_questions question where question.game_id = p_game_id;

  if game_row.status = 'IN_PROGRESS' then
    select count(*)::integer into participant_count
      from public.tec_quiz_participants participant where participant.game_id = p_game_id;
    select count(*)::integer into answer_count
      from public.tec_quiz_answers answer
     where answer.game_id = p_game_id and answer.question_index = game_row.question_index;
    if now() < game_row.round_deadline_at and answer_count < participant_count then
      raise exception 'TEC_QUIZ_ROUND_STILL_OPEN';
    end if;
    update public.tec_quiz_games set status = 'INTERMISSION' where id = p_game_id;
    return jsonb_build_object('game_id', p_game_id, 'status', 'INTERMISSION');
  end if;

  if game_row.status = 'INTERMISSION' then
    if game_row.question_index >= total_questions then
      update public.tec_quiz_games set status = 'FINISHED', ended_at = now(),
        round_deadline_at = null where id = p_game_id;
      return jsonb_build_object('game_id', p_game_id, 'status', 'FINISHED');
    end if;
    update public.tec_quiz_games
       set status = 'IN_PROGRESS', question_index = question_index + 1,
           round_started_at = now(),
           round_deadline_at = now() + make_interval(secs => game_row.time_per_question_seconds)
     where id = p_game_id;
    return jsonb_build_object('game_id', p_game_id, 'status', 'IN_PROGRESS',
      'question_index', game_row.question_index + 1);
  end if;
  raise exception 'TEC_QUIZ_GAME_CANNOT_ADVANCE';
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

revoke all on function private.tec_quiz_normalize_answer(text) from public, anon, authenticated;
revoke all on function private.tec_quiz_options_are_valid(jsonb) from public, anon, authenticated;
revoke all on function private.tec_quiz_correct_option_index(jsonb, jsonb, text) from public, anon, authenticated;
revoke all on function private.tec_quiz_teacher_can_access(uuid) from public, anon, authenticated;
revoke all on function private.tec_quiz_student_can_access(uuid) from public, anon, authenticated;
revoke all on function private.tec_quiz_broadcast_state_change() from public, anon, authenticated;
revoke all on function private.tec_quiz_can_access_realtime_topic(text) from public, anon;
grant execute on function private.tec_quiz_can_access_realtime_topic(text) to authenticated, service_role;

revoke all on function public.tec_quiz_teacher_options_v1() from public, anon;
revoke all on function public.tec_quiz_create_game_v1(uuid, uuid, integer, integer) from public, anon;
revoke all on function public.tec_quiz_join_v1(text) from public, anon;
revoke all on function public.tec_quiz_my_current_game_v1() from public, anon;
revoke all on function public.tec_quiz_start_v1(uuid) from public, anon;
revoke all on function public.tec_quiz_submit_answer_v1(uuid, integer) from public, anon;
revoke all on function public.tec_quiz_advance_v1(uuid) from public, anon;
revoke all on function public.tec_quiz_state_v1(uuid) from public, anon;
grant execute on function public.tec_quiz_teacher_options_v1() to authenticated;
grant execute on function public.tec_quiz_create_game_v1(uuid, uuid, integer, integer) to authenticated;
grant execute on function public.tec_quiz_join_v1(text) to authenticated;
grant execute on function public.tec_quiz_my_current_game_v1() to authenticated;
grant execute on function public.tec_quiz_start_v1(uuid) to authenticated;
grant execute on function public.tec_quiz_submit_answer_v1(uuid, integer) to authenticated;
grant execute on function public.tec_quiz_advance_v1(uuid) to authenticated;
grant execute on function public.tec_quiz_state_v1(uuid) to authenticated;

notify pgrst, 'reload schema';
commit;
