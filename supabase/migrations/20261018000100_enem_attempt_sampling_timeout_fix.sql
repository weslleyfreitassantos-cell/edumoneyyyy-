begin;

-- Keep the ENEM attempt snapshot authoritative while avoiding a volatile full
-- random sort for every start request. The seed changes per student and day,
-- so retries are stable and different students still receive different sets.
create or replace function public.start_enem_simulation_attempt_v2(
  p_institution_id uuid,
  p_student_id uuid,
  p_simulation_id uuid,
  p_language_choice text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  simulation_row public.learning_simulations%rowtype;
  existing_attempt public.learning_simulation_attempts%rowtype;
  attempt_id uuid;
  question_row record;
  selected_questions uuid[] := '{}'::uuid[];
  selected_structured_content uuid[] := '{}'::uuid[];
  requested_count integer;
  selected_count integer;
  snapshot_count integer;
  subject_code text;
  area_code text;
  simulation_mode text;
  language_choice text := upper(nullif(trim(p_language_choice), ''));
  language_filter text;
  sampling_seed text := p_student_id::text || ':' || p_simulation_id::text || ':' || current_date::text;
begin
  if not exists (
    select 1
      from public.students student
     where student.id = p_student_id
       and student.institution_id = p_institution_id
       and student.profile_id = auth.uid()
       and student.active
  ) then
    raise exception 'LEARNING_STUDENT_SCOPE_DENIED';
  end if;

  select simulation.*
    into simulation_row
    from public.learning_simulations simulation
   where simulation.id = p_simulation_id
     and simulation.status = 'PUBLISHED'
     and simulation.metadata->>'dynamic_pool' = 'true'
     and (simulation.institution_id is null or simulation.institution_id = p_institution_id);
  if not found then
    raise exception 'ENEM_SIMULATION_NOT_FOUND';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    p_student_id::text || ':' || p_simulation_id::text || ':' || private.current_enem_content_revision(),
    0
  ));

  select attempt.*
    into existing_attempt
    from public.learning_simulation_attempts attempt
   where attempt.simulation_id = p_simulation_id
     and attempt.student_id = p_student_id
     and attempt.status = 'IN_PROGRESS'
     and attempt.content_revision = private.current_enem_content_revision()
   order by attempt.started_at desc
   limit 1;
  if found then
    select count(*)
      into snapshot_count
      from public.learning_simulation_attempt_questions attempt_question
     where attempt_question.attempt_id = existing_attempt.id
       and attempt_question.structured_content_id is not null
       and attempt_question.occurrence_id is null;
    if snapshot_count <> existing_attempt.total_questions then
      raise exception 'ENEM_ATTEMPT_SNAPSHOT_INCOMPLETE';
    end if;
    return jsonb_build_object(
      'attempt_id', existing_attempt.id,
      'created', false,
      'question_count', existing_attempt.total_questions,
      'language_choice', existing_attempt.answers->>'__language_choice',
      'content_revision', existing_attempt.content_revision
    );
  end if;

  simulation_mode := simulation_row.metadata->>'enem_mode';
  subject_code := simulation_row.metadata->>'enem_subject';
  area_code := coalesce(simulation_row.metadata->>'enem_area', simulation_row.area);
  requested_count := simulation_row.question_count;
  language_filter := case
    when subject_code = 'INGLES' then 'ENGLISH'
    when subject_code = 'ESPANHOL' then 'SPANISH'
    else null
  end;

  if simulation_mode = 'AREA' and area_code = 'LINGUAGENS' then
    if language_choice is null or language_choice not in ('ENGLISH', 'SPANISH') then
      raise exception 'ENEM_LANGUAGE_CHOICE_REQUIRED';
    end if;
    if (select count(*) from private.enem_ready_provider_text_questions(area_code, null, null)) < 40 then
      raise exception 'ENEM_COMMON_PROVIDER_TEXT_POOL_INSUFFICIENT';
    end if;
    if (select count(*) from private.enem_ready_provider_text_questions(area_code, null, language_choice)) < 5 then
      raise exception 'ENEM_LANGUAGE_PROVIDER_TEXT_POOL_INSUFFICIENT';
    end if;

    for question_row in
      select ready.*
        from private.enem_ready_provider_text_questions(area_code, null, null) ready
       where not exists (
         select 1
           from public.learning_simulation_attempt_questions previous_question
           join public.learning_simulation_attempts previous_attempt
             on previous_attempt.id = previous_question.attempt_id
          where previous_attempt.student_id = p_student_id
            and previous_attempt.status = 'COMPLETED'
            and previous_attempt.started_at > now() - interval '90 days'
            and previous_question.question_bank_id = ready.question_id
       )
       order by hashtextextended(ready.question_id::text || ':' || sampling_seed || ':common', 0), ready.question_id
       limit 40
    loop
      selected_questions := array_append(selected_questions, question_row.question_id);
      selected_structured_content := array_append(selected_structured_content, question_row.structured_content_id);
    end loop;

    if coalesce(array_length(selected_questions, 1), 0) < 40 then
      for question_row in
        select ready.*
          from private.enem_ready_provider_text_questions(area_code, null, null) ready
         where not (ready.question_id = any(selected_questions))
         order by hashtextextended(ready.question_id::text || ':' || sampling_seed || ':fallback', 0), ready.question_id
         limit (40 - coalesce(array_length(selected_questions, 1), 0))
      loop
        selected_questions := array_append(selected_questions, question_row.question_id);
        selected_structured_content := array_append(selected_structured_content, question_row.structured_content_id);
      end loop;
    end if;

    for question_row in
      select ready.*
        from private.enem_ready_provider_text_questions(area_code, null, language_choice) ready
       where not (ready.question_id = any(selected_questions))
       order by hashtextextended(ready.question_id::text || ':' || sampling_seed || ':' || language_choice, 0), ready.question_id
       limit 5
    loop
      selected_questions := array_append(selected_questions, question_row.question_id);
      selected_structured_content := array_append(selected_structured_content, question_row.structured_content_id);
    end loop;
  else
    if subject_code in ('INGLES', 'ESPANHOL')
       and (select count(*) from private.enem_ready_provider_text_questions(area_code, subject_code, language_filter)) < requested_count then
      raise exception 'ENEM_PROVIDER_TEXT_POOL_INSUFFICIENT';
    end if;
    for question_row in
      select ready.*
        from private.enem_ready_provider_text_questions(area_code, subject_code, language_filter) ready
       order by hashtextextended(ready.question_id::text || ':' || sampling_seed, 0), ready.question_id
       limit requested_count
    loop
      selected_questions := array_append(selected_questions, question_row.question_id);
      selected_structured_content := array_append(selected_structured_content, question_row.structured_content_id);
    end loop;
  end if;

  selected_count := coalesce(array_length(selected_questions, 1), 0);
  if selected_count <> requested_count then
    raise exception 'ENEM_PROVIDER_TEXT_POOL_INSUFFICIENT';
  end if;
  if coalesce(array_length(selected_structured_content, 1), 0) <> selected_count then
    raise exception 'ENEM_POOL_SNAPSHOT_INVALID';
  end if;

  insert into public.learning_simulation_attempts(
    institution_id, simulation_id, student_id, total_questions, content_revision, answers
  ) values (
    p_institution_id, p_simulation_id, p_student_id, requested_count,
    private.current_enem_content_revision(), jsonb_build_object('__language_choice', language_choice)
  ) returning id into attempt_id;

  for question_row in
    select selected.question_bank_id, selected.structured_content_id, selected.position
      from unnest(selected_questions, selected_structured_content)
           with ordinality selected(question_bank_id, structured_content_id, position)
  loop
    insert into public.learning_simulation_attempt_questions(
      attempt_id, position, question_bank_id, occurrence_id, structured_content_id
    ) values (
      attempt_id, question_row.position, question_row.question_bank_id, null, question_row.structured_content_id
    );
  end loop;

  return jsonb_build_object(
    'attempt_id', attempt_id,
    'created', true,
    'question_count', requested_count,
    'language_choice', language_choice,
    'content_revision', private.current_enem_content_revision()
  );
exception
  when unique_violation then
    select attempt.*
      into existing_attempt
      from public.learning_simulation_attempts attempt
     where attempt.simulation_id = p_simulation_id
       and attempt.student_id = p_student_id
       and attempt.status = 'IN_PROGRESS'
       and attempt.content_revision = private.current_enem_content_revision()
     order by attempt.started_at desc
     limit 1;
    if existing_attempt.id is null then
      raise;
    end if;
    return jsonb_build_object(
      'attempt_id', existing_attempt.id,
      'created', false,
      'question_count', existing_attempt.total_questions,
      'language_choice', existing_attempt.answers->>'__language_choice',
      'content_revision', existing_attempt.content_revision
    );
end;
$$;

revoke all on function public.start_enem_simulation_attempt_v2(uuid, uuid, uuid, text) from public, anon;
grant execute on function public.start_enem_simulation_attempt_v2(uuid, uuid, uuid, text) to authenticated;

create or replace function public.start_enem_simulation_attempt_v3(
  p_institution_id uuid,
  p_student_id uuid,
  p_simulation_id uuid,
  p_language_choice text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  simulation_row public.learning_simulations%rowtype;
  existing_attempt public.learning_simulation_attempts%rowtype;
  attempt_id uuid;
  question_row record;
  selected_questions uuid[] := '{}'::uuid[];
  selected_occurrences uuid[] := '{}'::uuid[];
  selected_structured_content uuid[] := '{}'::uuid[];
  requested_count integer;
  available_count integer;
  snapshot_count integer;
  snapshot_unique_count integer;
  snapshot_source_count integer;
  language_choice text := upper(nullif(trim(p_language_choice), ''));
  sampling_seed text := p_student_id::text || ':' || p_simulation_id::text || ':' || current_date::text;
begin
  select simulation.*
    into simulation_row
    from public.learning_simulations simulation
   where simulation.id = p_simulation_id
     and simulation.status = 'PUBLISHED'
     and simulation.metadata->>'dynamic_pool' = 'true'
     and simulation.metadata->>'enem_mode' = 'SUBJECT'
     and simulation.metadata->>'enem_subject' = 'INGLES'
     and (simulation.institution_id is null or simulation.institution_id = p_institution_id);
  if not found then
    return public.start_enem_simulation_attempt_v2(
      p_institution_id, p_student_id, p_simulation_id, p_language_choice
    );
  end if;

  if language_choice is not null and language_choice <> 'ENGLISH' then
    raise exception 'ENEM_LANGUAGE_CHOICE_INVALID';
  end if;

  if not exists (
    select 1
      from public.students student
     where student.id = p_student_id
       and student.institution_id = p_institution_id
       and student.profile_id = auth.uid()
       and student.active
  ) then
    raise exception 'LEARNING_STUDENT_SCOPE_DENIED';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    p_student_id::text || ':' || p_simulation_id::text || ':' || private.current_enem_content_revision(),
    0
  ));

  select attempt.*
    into existing_attempt
    from public.learning_simulation_attempts attempt
   where attempt.simulation_id = p_simulation_id
     and attempt.student_id = p_student_id
     and attempt.status = 'IN_PROGRESS'
     and attempt.content_revision = private.current_enem_content_revision()
   order by attempt.started_at desc
   limit 1;
  if found then
    select
      count(*)::integer,
      count(distinct attempt_question.question_bank_id)::integer,
      count(*) filter (
        where (attempt_question.occurrence_id is not null)
          <> (attempt_question.structured_content_id is not null)
      )::integer
      into snapshot_count, snapshot_unique_count, snapshot_source_count
      from public.learning_simulation_attempt_questions attempt_question
     where attempt_question.attempt_id = existing_attempt.id;
    if snapshot_count <> existing_attempt.total_questions
       or snapshot_unique_count <> existing_attempt.total_questions
       or snapshot_source_count <> existing_attempt.total_questions then
      raise exception 'ENEM_ATTEMPT_SNAPSHOT_INCOMPLETE';
    end if;
    return jsonb_build_object(
      'attempt_id', existing_attempt.id,
      'created', false,
      'question_count', existing_attempt.total_questions,
      'language_choice', existing_attempt.answers->>'__language_choice',
      'content_revision', existing_attempt.content_revision
    );
  end if;

  select count(distinct question_id)::integer
    into available_count
    from private.enem_ready_english_practice_questions_v1();
  requested_count := least(simulation_row.question_count, available_count);
  if requested_count < 1 then
    raise exception 'ENEM_PROVIDER_TEXT_POOL_INSUFFICIENT';
  end if;

  for question_row in
    select ready.*
      from private.enem_ready_english_practice_questions_v1() ready
     order by hashtextextended(ready.question_id::text || ':' || sampling_seed, 0), ready.question_id
     limit requested_count
  loop
    selected_questions := array_append(selected_questions, question_row.question_id);
    selected_occurrences := array_append(selected_occurrences, question_row.occurrence_id);
    selected_structured_content := array_append(selected_structured_content, question_row.structured_content_id);
  end loop;

  if coalesce(array_length(selected_questions, 1), 0) <> requested_count
     or coalesce(array_length(selected_occurrences, 1), 0) <> requested_count
     or coalesce(array_length(selected_structured_content, 1), 0) <> requested_count then
    raise exception 'ENEM_PROVIDER_TEXT_POOL_INSUFFICIENT';
  end if;

  insert into public.learning_simulation_attempts(
    institution_id, simulation_id, student_id, total_questions, content_revision, answers
  ) values (
    p_institution_id, p_simulation_id, p_student_id, requested_count,
    private.current_enem_content_revision(), jsonb_build_object('__language_choice', language_choice)
  ) returning id into attempt_id;

  for question_row in
    select selected.question_bank_id, selected.occurrence_id, selected.structured_content_id, selected.position
      from unnest(selected_questions, selected_occurrences, selected_structured_content)
           with ordinality selected(question_bank_id, occurrence_id, structured_content_id, position)
  loop
    insert into public.learning_simulation_attempt_questions(
      attempt_id, position, question_bank_id, occurrence_id, structured_content_id
    ) values (
      attempt_id, question_row.position, question_row.question_bank_id,
      question_row.occurrence_id, question_row.structured_content_id
    );
  end loop;

  return jsonb_build_object(
    'attempt_id', attempt_id,
    'created', true,
    'question_count', requested_count,
    'language_choice', language_choice,
    'content_revision', private.current_enem_content_revision()
  );
exception
  when unique_violation then
    select attempt.*
      into existing_attempt
      from public.learning_simulation_attempts attempt
     where attempt.simulation_id = p_simulation_id
       and attempt.student_id = p_student_id
       and attempt.status = 'IN_PROGRESS'
       and attempt.content_revision = private.current_enem_content_revision()
     order by attempt.started_at desc
     limit 1;
    if existing_attempt.id is null then
      raise;
    end if;
    return jsonb_build_object(
      'attempt_id', existing_attempt.id,
      'created', false,
      'question_count', existing_attempt.total_questions,
      'language_choice', existing_attempt.answers->>'__language_choice',
      'content_revision', existing_attempt.content_revision
    );
end;
$$;

revoke all on function public.start_enem_simulation_attempt_v3(uuid, uuid, uuid, text) from public, anon;
grant execute on function public.start_enem_simulation_attempt_v3(uuid, uuid, uuid, text) to authenticated;

notify pgrst, 'reload schema';
commit;
