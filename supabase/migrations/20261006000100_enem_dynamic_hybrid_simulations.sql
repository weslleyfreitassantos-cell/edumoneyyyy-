begin;

-- Dynamic ENEM simulations keep the template stable while the question set is
-- snapshotted per attempt.  The question bank remains the source of truth;
-- this table only records the immutable selection made for an attempt.
create table if not exists public.learning_simulation_attempt_questions (
  id uuid primary key default extensions.uuid_generate_v4(),
  attempt_id uuid not null references public.learning_simulation_attempts(id) on delete cascade,
  position integer not null check (position > 0),
  question_bank_id uuid not null references public.learning_question_bank(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (attempt_id, position),
  unique (attempt_id, question_bank_id)
);

create index if not exists learning_simulation_attempt_questions_attempt_idx
  on public.learning_simulation_attempt_questions(attempt_id, position);

create index if not exists learning_simulation_attempt_questions_question_idx
  on public.learning_simulation_attempt_questions(question_bank_id);

alter table public.learning_simulation_attempt_questions enable row level security;

drop policy if exists learning_simulation_attempt_questions_select on public.learning_simulation_attempt_questions;
create policy learning_simulation_attempt_questions_select
  on public.learning_simulation_attempt_questions
  for select to authenticated
  using (
    exists (
      select 1
      from public.learning_simulation_attempts attempt
      where attempt.id = learning_simulation_attempt_questions.attempt_id
        and (
          private.learning_student_owns_state(attempt.institution_id, attempt.student_id)
          or public.can_manage_institution_operations(attempt.institution_id)
        )
    )
  );

revoke all on table public.learning_simulation_attempt_questions from public, anon;
grant select on table public.learning_simulation_attempt_questions to authenticated;
grant all on table public.learning_simulation_attempt_questions to service_role;

-- Statement crops are uploaded by the local/CI ingestion pipeline with the
-- service role. Students only need public read access to already validated
-- official assets; no browser write path is exposed.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'enem-question-assets',
  'enem-question-assets',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists enem_question_assets_public_select on storage.objects;
create policy enem_question_assets_public_select
  on storage.objects
  for select to public
  using (bucket_id = 'enem-question-assets');

-- Dynamic templates are intentionally generic. The availability RPC below
-- hides any template whose verified pool is not ready yet.
do $$
declare
  template_row record;
begin
  for template_row in
    select * from (values
      ('SUBJECT', 'Matemática', 'MATEMATICA', null, 10, 20, 'SUBJECT:MATEMATICA'),
      ('SUBJECT', 'Língua Portuguesa', 'LINGUA_PORTUGUESA', null, 10, 20, 'SUBJECT:LINGUA_PORTUGUESA'),
      ('SUBJECT', 'História', 'HISTORIA', null, 10, 20, 'SUBJECT:HISTORIA'),
      ('SUBJECT', 'Geografia', 'GEOGRAFIA', null, 10, 20, 'SUBJECT:GEOGRAFIA'),
      ('SUBJECT', 'Filosofia', 'FILOSOFIA', null, 10, 20, 'SUBJECT:FILOSOFIA'),
      ('SUBJECT', 'Sociologia', 'SOCIOLOGIA', null, 10, 20, 'SUBJECT:SOCIOLOGIA'),
      ('SUBJECT', 'Biologia', 'BIOLOGIA', null, 10, 20, 'SUBJECT:BIOLOGIA'),
      ('SUBJECT', 'Química', 'QUIMICA', null, 10, 20, 'SUBJECT:QUIMICA'),
      ('SUBJECT', 'Física', 'FISICA', null, 10, 20, 'SUBJECT:FISICA'),
      ('SUBJECT', 'Inglês', 'INGLES', null, 10, 20, 'SUBJECT:INGLES'),
      ('SUBJECT', 'Espanhol', 'ESPANHOL', null, 10, 20, 'SUBJECT:ESPANHOL'),
      ('AREA', 'Linguagens, Códigos e suas Tecnologias', null, 'LINGUAGENS', 45, 90, 'AREA:LINGUAGENS'),
      ('AREA', 'Ciências Humanas e suas Tecnologias', null, 'CIENCIAS_HUMANAS', 45, 90, 'AREA:CIENCIAS_HUMANAS'),
      ('AREA', 'Ciências da Natureza e suas Tecnologias', null, 'CIENCIAS_NATUREZA', 45, 90, 'AREA:CIENCIAS_NATUREZA'),
      ('AREA', 'Matemática e suas Tecnologias', null, 'MATEMATICA', 45, 90, 'AREA:MATEMATICA')
    ) as templates(simulation_type, title, subject_code, area_code, question_count, duration_minutes, template_key)
  loop
    if not exists (
      select 1
      from public.learning_simulations simulation
      where simulation.institution_id is null
        and simulation.metadata->>'dynamic_key' = template_row.template_key
    ) then
      insert into public.learning_simulations(
        institution_id,
        title,
        simulation_type,
        area,
        source_year,
        question_count,
        duration_minutes,
        status,
        metadata
      )
      values (
        null,
        template_row.title,
        template_row.simulation_type,
        template_row.area_code,
        null,
        template_row.question_count,
        template_row.duration_minutes,
        'PUBLISHED',
        jsonb_build_object(
          'dynamic_pool', true,
          'dynamic_key', template_row.template_key,
          'enem_mode', template_row.simulation_type,
          'enem_subject', template_row.subject_code,
          'enem_area', template_row.area_code,
          'display_title', template_row.title,
          'source_integrity', 'VERIFIED'
        )
      );
    end if;
  end loop;
end;
$$;

create or replace function private.enem_ready_question_ids(
  p_area text default null,
  p_subject text default null,
  p_language text default null
)
returns table(question_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct question_bank.id
  from public.learning_question_bank question_bank
  join public.learning_enem_official_occurrences occurrence
    on occurrence.question_bank_id = question_bank.id
  join public.learning_enem_media_assets media_asset
    on media_asset.occurrence_id = occurrence.id
  where question_bank.active
    and question_bank.package_type = 'ENEM'
    and question_bank.source_type = 'ENEM_OFFICIAL'
    and coalesce(question_bank.metadata->>'source_integrity', '') = 'VERIFIED'
    and coalesce(question_bank.metadata->>'render_ready', 'false') = 'true'
    and question_bank.metadata->>'area_verified' = 'true'
    and (p_subject is null or question_bank.metadata->>'subject_verified' = 'true')
    and jsonb_typeof(question_bank.options) = 'array'
    and jsonb_array_length(question_bank.options) = 5
    and question_bank.correct_answer is not null
    and question_bank.metadata->>'official_answer_letter' in ('A', 'B', 'C', 'D', 'E')
    and (p_area is null or question_bank.metadata->>'enem_area' = p_area)
    and (p_subject is null or question_bank.metadata->>'enem_subject' = p_subject)
    and occurrence.language is not distinct from p_language
    and media_asset.quality_state = 'VALIDATED'
    and coalesce(media_asset.metadata->>'asset_role', 'STATEMENT') = 'STATEMENT'
    and (media_asset.storage_path is not null or media_asset.metadata ? 'public_url')
  order by question_bank.id;
$$;

revoke all on function private.enem_ready_question_ids(text, text, text) from public, anon, authenticated;
grant execute on function private.enem_ready_question_ids(text, text, text) to service_role;

create or replace function public.list_enem_simulation_templates_v2(p_institution_id uuid)
returns table(
  id uuid,
  title text,
  simulation_type text,
  area text,
  subject text,
  question_count integer,
  duration_minutes integer,
  available_count integer,
  language_options jsonb,
  metadata jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  with templates as (
    select simulation.id, simulation.title, simulation.simulation_type, simulation.area,
           simulation.question_count, simulation.duration_minutes, simulation.metadata
    from public.learning_simulations simulation
    where simulation.status = 'PUBLISHED'
      and simulation.metadata->>'dynamic_pool' = 'true'
      and (simulation.institution_id is null or simulation.institution_id = p_institution_id)
  ),
  counts as (
    select
      template.*,
      case
        when template.metadata->>'enem_mode' = 'AREA' and template.area = 'LINGUAGENS' then
          case when (select count(*) from private.enem_ready_question_ids(template.area, null, null)) >= 40
                    and (select count(*) from private.enem_ready_question_ids(template.area, null, 'ENGLISH')) >= 5
                    and (select count(*) from private.enem_ready_question_ids(template.area, null, 'SPANISH')) >= 5
               then 45 else 0 end
        when template.metadata->>'enem_mode' = 'SUBJECT' and template.metadata->>'enem_subject' = 'INGLES' then
          (select count(*)::integer from private.enem_ready_question_ids(null, template.metadata->>'enem_subject', 'ENGLISH'))
        when template.metadata->>'enem_mode' = 'SUBJECT' and template.metadata->>'enem_subject' = 'ESPANHOL' then
          (select count(*)::integer from private.enem_ready_question_ids(null, template.metadata->>'enem_subject', 'SPANISH'))
        else (select count(*)::integer from private.enem_ready_question_ids(template.area, template.metadata->>'enem_subject', null))
      end as pool_count,
      case
        when template.metadata->>'enem_mode' = 'AREA' and template.area = 'LINGUAGENS'
          then jsonb_build_array('ENGLISH', 'SPANISH')
        else '[]'::jsonb
      end as available_languages
    from templates template
  )
  select
    counts.id,
    counts.title,
    counts.simulation_type,
    counts.area,
    counts.metadata->>'enem_subject' as subject,
    counts.question_count,
    counts.duration_minutes,
    counts.pool_count,
    counts.available_languages,
    counts.metadata
  from counts
  where counts.pool_count >= counts.question_count
  order by case when counts.metadata->>'enem_mode' = 'AREA' then 0 else 1 end, counts.title;
$$;

revoke all on function public.list_enem_simulation_templates_v2(uuid) from public, anon;
grant execute on function public.list_enem_simulation_templates_v2(uuid) to authenticated;

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
  requested_count integer;
  selected_count integer;
  subject_code text;
  area_code text;
  simulation_mode text;
  language_choice text := upper(nullif(trim(p_language_choice), ''));
begin
  if not exists (
    select 1 from public.students student
    where student.id = p_student_id
      and student.institution_id = p_institution_id
      and student.profile_id = auth.uid()
      and student.active
  ) then
    raise exception 'LEARNING_STUDENT_SCOPE_DENIED';
  end if;

  select simulation.* into simulation_row
  from public.learning_simulations simulation
  where simulation.id = p_simulation_id
    and simulation.status = 'PUBLISHED'
    and simulation.metadata->>'dynamic_pool' = 'true'
    and (simulation.institution_id is null or simulation.institution_id = p_institution_id);
  if not found then raise exception 'ENEM_SIMULATION_NOT_FOUND'; end if;

  select attempt.* into existing_attempt
  from public.learning_simulation_attempts attempt
  where attempt.simulation_id = p_simulation_id
    and attempt.student_id = p_student_id
    and attempt.status = 'IN_PROGRESS'
  order by attempt.started_at desc
  limit 1;
  if found then
    return jsonb_build_object(
      'attempt_id', existing_attempt.id,
      'created', false,
      'question_count', existing_attempt.total_questions,
      'language_choice', existing_attempt.answers->>'__language_choice'
    );
  end if;

  simulation_mode := simulation_row.metadata->>'enem_mode';
  subject_code := simulation_row.metadata->>'enem_subject';
  area_code := coalesce(simulation_row.metadata->>'enem_area', simulation_row.area);
  requested_count := simulation_row.question_count;

  if simulation_mode = 'AREA' and area_code = 'LINGUAGENS' then
    if language_choice is null or language_choice not in ('ENGLISH', 'SPANISH') then raise exception 'ENEM_LANGUAGE_CHOICE_REQUIRED'; end if;
    for question_row in
      select ready.question_id
      from private.enem_ready_question_ids(area_code, null, null) ready
      where not exists (
        select 1
        from public.learning_simulation_attempt_questions previous_question
        join public.learning_simulation_attempts previous_attempt on previous_attempt.id = previous_question.attempt_id
        where previous_attempt.student_id = p_student_id
          and previous_attempt.status = 'COMPLETED'
          and previous_attempt.started_at > now() - interval '90 days'
          and previous_question.question_bank_id = ready.question_id
      )
      order by random()
      limit 40
    loop
      selected_questions := array_append(selected_questions, question_row.question_id);
    end loop;
    if coalesce(array_length(selected_questions, 1), 0) < 40 then
      for question_row in
        select ready.question_id
        from private.enem_ready_question_ids(area_code, null, null) ready
        where not ready.question_id = any(selected_questions)
        order by random()
        limit (40 - coalesce(array_length(selected_questions, 1), 0))
      loop selected_questions := array_append(selected_questions, question_row.question_id); end loop;
    end if;
    for question_row in
      select ready.question_id
      from private.enem_ready_question_ids(area_code, null, language_choice) ready
      where not ready.question_id = any(selected_questions)
        and not exists (
          select 1
          from public.learning_simulation_attempt_questions previous_question
          join public.learning_simulation_attempts previous_attempt on previous_attempt.id = previous_question.attempt_id
          where previous_attempt.student_id = p_student_id
            and previous_attempt.status = 'COMPLETED'
            and previous_attempt.started_at > now() - interval '90 days'
            and previous_question.question_bank_id = ready.question_id
        )
      order by random()
      limit 5
    loop selected_questions := array_append(selected_questions, question_row.question_id); end loop;
    if coalesce(array_length(selected_questions, 1), 0) < requested_count then
      for question_row in
        select ready.question_id
        from private.enem_ready_question_ids(area_code, null, language_choice) ready
        where not ready.question_id = any(selected_questions)
        order by random()
        limit (requested_count - coalesce(array_length(selected_questions, 1), 0))
      loop selected_questions := array_append(selected_questions, question_row.question_id); end loop;
    end if;
  else
    for question_row in
      select ready.question_id
      from private.enem_ready_question_ids(
        area_code,
        subject_code,
        case when subject_code = 'INGLES' then 'ENGLISH' when subject_code = 'ESPANHOL' then 'SPANISH' else null end
      ) ready
      where not exists (
        select 1
        from public.learning_simulation_attempt_questions previous_question
        join public.learning_simulation_attempts previous_attempt on previous_attempt.id = previous_question.attempt_id
        where previous_attempt.student_id = p_student_id
          and previous_attempt.status = 'COMPLETED'
          and previous_attempt.started_at > now() - interval '90 days'
          and previous_question.question_bank_id = ready.question_id
      )
      order by random()
      limit requested_count
    loop selected_questions := array_append(selected_questions, question_row.question_id); end loop;
    if coalesce(array_length(selected_questions, 1), 0) < requested_count then
      for question_row in
        select ready.question_id
        from private.enem_ready_question_ids(
          area_code,
          subject_code,
          case when subject_code = 'INGLES' then 'ENGLISH' when subject_code = 'ESPANHOL' then 'SPANISH' else null end
        ) ready
        where not ready.question_id = any(selected_questions)
        order by random()
        limit (requested_count - coalesce(array_length(selected_questions, 1), 0))
      loop selected_questions := array_append(selected_questions, question_row.question_id); end loop;
    end if;
  end if;

  selected_count := coalesce(array_length(selected_questions, 1), 0);
  if selected_count <> requested_count then raise exception 'ENEM_POOL_INSUFFICIENT'; end if;

  begin
    insert into public.learning_simulation_attempts(institution_id, simulation_id, student_id, total_questions, answers)
    values (
      p_institution_id,
      p_simulation_id,
      p_student_id,
      requested_count,
      jsonb_build_object('__language_choice', language_choice)
    )
    returning id into attempt_id;
  exception when unique_violation then
    select attempt.id into attempt_id
    from public.learning_simulation_attempts attempt
    where attempt.simulation_id = p_simulation_id
      and attempt.student_id = p_student_id
      and attempt.status = 'IN_PROGRESS'
    order by attempt.started_at desc
    limit 1;
    if attempt_id is null then raise; end if;
    return jsonb_build_object('attempt_id', attempt_id, 'created', false, 'question_count', requested_count, 'language_choice', language_choice);
  end;

  for question_row in select * from unnest(selected_questions) with ordinality as selected(question_bank_id, position)
  loop
    insert into public.learning_simulation_attempt_questions(attempt_id, position, question_bank_id)
    values (attempt_id, question_row.position, question_row.question_bank_id);
  end loop;

  return jsonb_build_object(
    'attempt_id', attempt_id,
    'created', true,
    'question_count', requested_count,
    'language_choice', language_choice
  );
end;
$$;

create or replace function public.get_enem_simulation_attempt_v2(p_attempt_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  attempt_row public.learning_simulation_attempts%rowtype;
begin
  select attempt.* into attempt_row
  from public.learning_simulation_attempts attempt
  where attempt.id = p_attempt_id
    and exists (
      select 1 from public.students student
      where student.id = attempt.student_id
        and student.profile_id = auth.uid()
        and student.active
    );
  if not found then raise exception 'ENEM_SIMULATION_ATTEMPT_SCOPE_DENIED'; end if;

  return jsonb_build_object(
    'attempt_id', attempt_row.id,
    'simulation_id', attempt_row.simulation_id,
    'status', attempt_row.status,
    'started_at', attempt_row.started_at,
    'completed_at', attempt_row.completed_at,
    'duration_seconds', attempt_row.duration_seconds,
    'total_questions', attempt_row.total_questions,
    'score', attempt_row.score,
    'correct_count', attempt_row.correct_count,
    'answers', attempt_row.answers - '__language_choice',
    'navigation_state', attempt_row.navigation_state,
    'simulation', (
      select jsonb_build_object(
        'id', simulation.id,
        'title', simulation.title,
        'simulation_type', simulation.simulation_type,
        'area', simulation.area,
        'question_count', simulation.question_count,
        'duration_minutes', simulation.duration_minutes,
        'metadata', simulation.metadata
      )
      from public.learning_simulations simulation
      where simulation.id = attempt_row.simulation_id
    ),
    'questions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'position', attempt_question.position,
        'question_bank_id', question_bank.id,
        'statement', question_bank.statement,
        'options', question_bank.options,
        'source_year', question_bank.source_year,
        'question_number', question_bank.source_number,
        'metadata', question_bank.metadata - 'official_answer_letter' - 'correct_answer',
        'statement_assets', coalesce((
          select jsonb_agg(jsonb_build_object(
            'media_type', media_asset.media_type,
            'storage_path', media_asset.storage_path,
            'public_url', media_asset.metadata->>'public_url',
            'metadata', media_asset.metadata
          ) order by media_asset.source_page, media_asset.id)
          from public.learning_enem_official_occurrences occurrence
          join public.learning_enem_media_assets media_asset on media_asset.occurrence_id = occurrence.id
          where occurrence.question_bank_id = question_bank.id
            and media_asset.quality_state = 'VALIDATED'
            and coalesce(media_asset.metadata->>'asset_role', 'STATEMENT') = 'STATEMENT'
        ), '[]'::jsonb)
      ) order by attempt_question.position)
      from public.learning_simulation_attempt_questions attempt_question
      join public.learning_question_bank question_bank on question_bank.id = attempt_question.question_bank_id
      where attempt_question.attempt_id = attempt_row.id
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.save_enem_simulation_attempt_answers_v2(p_attempt_id uuid, p_answers jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  attempt_row public.learning_simulation_attempts%rowtype;
  answer_item jsonb;
  answer_map jsonb := '{}'::jsonb;
begin
  select attempt.* into attempt_row
  from public.learning_simulation_attempts attempt
  where attempt.id = p_attempt_id
    and exists (select 1 from public.students student where student.id = attempt.student_id and student.profile_id = auth.uid() and student.active);
  if not found then raise exception 'ENEM_SIMULATION_ATTEMPT_SCOPE_DENIED'; end if;
  if attempt_row.status <> 'IN_PROGRESS' then raise exception 'ENEM_SIMULATION_ATTEMPT_NOT_OPEN'; end if;
  if jsonb_typeof(coalesce(p_answers, '[]'::jsonb)) <> 'array' then raise exception 'ENEM_SIMULATION_ANSWERS_INVALID'; end if;

  for answer_item in select item from jsonb_array_elements(p_answers) item
  loop
    if answer_item->>'question_bank_id' is null
       or not exists (select 1 from public.learning_simulation_attempt_questions item_question where item_question.attempt_id = attempt_row.id and item_question.question_bank_id = (answer_item->>'question_bank_id')::uuid)
       or answer_item->>'answer' not in ('A', 'B', 'C', 'D', 'E') then
      raise exception 'ENEM_SIMULATION_ANSWERS_INVALID';
    end if;
    answer_map := answer_map || jsonb_build_object(answer_item->>'question_bank_id', jsonb_build_object('answer', answer_item->'answer'));
  end loop;

  update public.learning_simulation_attempts
  set answers = coalesce(attempt_row.answers, '{}'::jsonb) - '__language_choice' || answer_map,
      updated_at = now()
  where id = attempt_row.id;
  return jsonb_build_object('attempt_id', attempt_row.id, 'answers', answer_map);
end;
$$;

create or replace function public.submit_enem_simulation_attempt_v2(p_attempt_id uuid, p_answers jsonb, p_duration_seconds integer default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  attempt_row public.learning_simulation_attempts%rowtype;
  question_row record;
  answer_item jsonb;
  answer_map jsonb := '{}'::jsonb;
  v_area_breakdown jsonb := '{}'::jsonb;
  v_skill_breakdown jsonb := '{}'::jsonb;
  v_correct_count integer := 0;
  v_total_count integer := 0;
  v_score integer := 0;
  v_correct boolean;
  v_area text;
  v_skill text;
  v_area_current jsonb;
  v_skill_current jsonb;
begin
  select attempt.* into attempt_row
  from public.learning_simulation_attempts attempt
  where attempt.id = p_attempt_id
    and exists (select 1 from public.students student where student.id = attempt.student_id and student.profile_id = auth.uid() and student.active);
  if not found then raise exception 'ENEM_SIMULATION_ATTEMPT_SCOPE_DENIED'; end if;
  if attempt_row.status = 'COMPLETED' then
    return jsonb_build_object('attempt_id', attempt_row.id, 'score', attempt_row.score, 'correct_count', attempt_row.correct_count, 'total_questions', attempt_row.total_questions, 'answers', attempt_row.answers - '__language_choice', 'area_breakdown', attempt_row.area_breakdown, 'skill_breakdown', attempt_row.skill_breakdown);
  end if;
  if jsonb_typeof(coalesce(p_answers, '[]'::jsonb)) <> 'array' then raise exception 'ENEM_SIMULATION_ANSWERS_INVALID'; end if;
  for answer_item in select item from jsonb_array_elements(p_answers) item
  loop
    if answer_item->>'question_bank_id' is null
       or not exists (select 1 from public.learning_simulation_attempt_questions item_question where item_question.attempt_id = attempt_row.id and item_question.question_bank_id = (answer_item->>'question_bank_id')::uuid)
       or answer_item->>'answer' not in ('A', 'B', 'C', 'D', 'E') then
      raise exception 'ENEM_SIMULATION_ANSWERS_INVALID';
    end if;
  end loop;

  for question_row in
    select attempt_question.position, question_bank.id, question_bank.metadata->>'official_answer_letter' as official_answer_letter, question_bank.subject_area,
           question_bank.metadata, link.canonical_skill_id
    from public.learning_simulation_attempt_questions attempt_question
    join public.learning_question_bank question_bank on question_bank.id = attempt_question.question_bank_id
    left join public.learning_question_bank_skill_links link on link.question_bank_id = question_bank.id and link.skill_role = 'PRIMARY'
    where attempt_question.attempt_id = attempt_row.id
    order by attempt_question.position
  loop
    v_total_count := v_total_count + 1;
    select item into answer_item from jsonb_array_elements(p_answers) item where item->>'question_bank_id' = question_row.id::text limit 1;
    v_correct := answer_item is not null and question_row.official_answer_letter = answer_item->>'answer';
    if v_correct then v_correct_count := v_correct_count + 1; end if;
    answer_map := answer_map || jsonb_build_object(question_row.id::text, jsonb_build_object('answer', coalesce(answer_item->'answer', 'null'::jsonb), 'is_correct', v_correct));

    v_area := coalesce(question_row.metadata->>'enem_area', question_row.subject_area, 'ENEM');
    v_area_current := coalesce(v_area_breakdown->v_area, '{"correct":0,"total":0}'::jsonb);
    v_area_breakdown := jsonb_set(v_area_breakdown, array[v_area], jsonb_build_object('correct', (v_area_current->>'correct')::integer + case when v_correct then 1 else 0 end, 'total', (v_area_current->>'total')::integer + 1), true);
    v_skill := question_row.canonical_skill_id::text;
    if question_row.canonical_skill_id is not null then
      v_skill_current := coalesce(v_skill_breakdown->v_skill, '{"correct":0,"total":0}'::jsonb);
      v_skill_breakdown := jsonb_set(v_skill_breakdown, array[v_skill], jsonb_build_object('correct', (v_skill_current->>'correct')::integer + case when v_correct then 1 else 0 end, 'total', (v_skill_current->>'total')::integer + 1), true);
      insert into public.learning_skill_evidence(institution_id, student_id, canonical_skill_id, source, correct, score, metadata)
      values (attempt_row.institution_id, attempt_row.student_id, question_row.canonical_skill_id, 'SIMULATION', v_correct, case when v_correct then 100 else 0 end, jsonb_build_object('simulation_attempt_id', attempt_row.id, 'question_bank_id', question_row.id));
      perform private.refresh_learning_student_skill_state(attempt_row.institution_id, attempt_row.student_id, question_row.canonical_skill_id);
    end if;
    if not v_correct then
      insert into public.learning_error_notebook(institution_id, student_id, question_bank_id, canonical_skill_id)
      values (attempt_row.institution_id, attempt_row.student_id, question_row.id, question_row.canonical_skill_id)
      on conflict (student_id, question_bank_id) where question_bank_id is not null do update set error_count = public.learning_error_notebook.error_count + 1, last_missed_at = now(), status = 'OPEN', canonical_skill_id = coalesce(public.learning_error_notebook.canonical_skill_id, excluded.canonical_skill_id);
    end if;
  end loop;

  v_score := case when v_total_count = 0 then 0 else round(v_correct_count * 100.0 / v_total_count)::integer end;
  update public.learning_simulation_attempts
  set status = 'COMPLETED', completed_at = now(), duration_seconds = coalesce(p_duration_seconds, duration_seconds), score = v_score, correct_count = v_correct_count, total_questions = v_total_count, area_breakdown = v_area_breakdown, skill_breakdown = v_skill_breakdown, answers = answer_map, updated_at = now()
  where id = attempt_row.id;
  perform private.award_learning_xp(attempt_row.institution_id, attempt_row.student_id, 'simulation:' || attempt_row.id::text, 'SIMULATION', 20);
  return jsonb_build_object('attempt_id', attempt_row.id, 'score', v_score, 'correct_count', v_correct_count, 'total_questions', v_total_count, 'answers', answer_map, 'area_breakdown', v_area_breakdown, 'skill_breakdown', v_skill_breakdown);
end;
$$;

revoke all on function public.start_enem_simulation_attempt_v2(uuid, uuid, uuid, text) from public, anon;
revoke all on function public.get_enem_simulation_attempt_v2(uuid) from public, anon;
revoke all on function public.save_enem_simulation_attempt_answers_v2(uuid, jsonb) from public, anon;
revoke all on function public.submit_enem_simulation_attempt_v2(uuid, jsonb, integer) from public, anon;
grant execute on function public.start_enem_simulation_attempt_v2(uuid, uuid, uuid, text) to authenticated;
grant execute on function public.get_enem_simulation_attempt_v2(uuid) to authenticated;
grant execute on function public.save_enem_simulation_attempt_answers_v2(uuid, jsonb) to authenticated;
grant execute on function public.submit_enem_simulation_attempt_v2(uuid, jsonb, integer) to authenticated;

notify pgrst, 'reload schema';
commit;
