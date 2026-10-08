begin;

-- Source-faithful ENEM attempts are immutable snapshots.  A revision keeps a
-- new corpus from silently resuming an attempt created by an older corpus.
create or replace function private.current_enem_content_revision()
returns text
language sql
immutable
parallel safe
as $$
  select 'source-faithful-v3'::text;
$$;

alter table public.learning_simulation_attempts
  add column if not exists content_revision text;

update public.learning_simulation_attempts attempt
set content_revision = case
  when exists (
    select 1
    from public.learning_simulations simulation
    where simulation.id = attempt.simulation_id
      and simulation.metadata->>'dynamic_pool' = 'true'
  ) then 'legacy-pre-source-faithful-v2'
  else 'legacy-learning-v1'
end
where attempt.content_revision is null;

alter table public.learning_simulation_attempts
  alter column content_revision set default 'legacy-learning-v1',
  alter column content_revision set not null;

drop index if exists public.learning_simulation_one_open_attempt_idx;
create unique index if not exists learning_simulation_one_open_attempt_revision_idx
  on public.learning_simulation_attempts(simulation_id, student_id, content_revision)
  where status = 'IN_PROGRESS';

alter table public.learning_simulation_attempt_questions
  add column if not exists occurrence_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'learning_simulation_attempt_questions_occurrence_fk'
      and conrelid = 'public.learning_simulation_attempt_questions'::regclass
  ) then
    alter table public.learning_simulation_attempt_questions
      add constraint learning_simulation_attempt_questions_occurrence_fk
      foreign key (occurrence_id)
      references public.learning_enem_official_occurrences(id)
      on delete restrict;
  end if;
end;
$$;

create index if not exists learning_simulation_attempt_questions_occurrence_idx
  on public.learning_simulation_attempt_questions(occurrence_id, question_bank_id);

create or replace function private.validate_enem_attempt_question_snapshot()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  attempt_revision text;
  occurrence_question_id uuid;
begin
  select attempt.content_revision
    into attempt_revision
  from public.learning_simulation_attempts attempt
  where attempt.id = new.attempt_id;

  if attempt_revision = private.current_enem_content_revision()
     and new.occurrence_id is null then
    raise exception 'ENEM_ATTEMPT_SNAPSHOT_OCCURRENCE_REQUIRED';
  end if;

  if new.occurrence_id is not null then
    select occurrence.question_bank_id
      into occurrence_question_id
    from public.learning_enem_official_occurrences occurrence
    where occurrence.id = new.occurrence_id;

    if occurrence_question_id is null
       or occurrence_question_id <> new.question_bank_id then
      raise exception 'ENEM_ATTEMPT_SNAPSHOT_OCCURRENCE_MISMATCH';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_enem_attempt_question_snapshot
  on public.learning_simulation_attempt_questions;
create trigger validate_enem_attempt_question_snapshot
before insert or update on public.learning_simulation_attempt_questions
for each row execute function private.validate_enem_attempt_question_snapshot();

create or replace function private.enem_ready_occurrences(
  p_area text default null,
  p_subject text default null,
  p_language text default null
)
returns table(occurrence_id uuid, question_id uuid, language text)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct on (question_bank.id)
    occurrence.id, question_bank.id, occurrence.language
  from public.learning_enem_official_occurrences occurrence
  join public.learning_question_bank question_bank
    on question_bank.id = occurrence.question_bank_id
  where question_bank.active
    and question_bank.package_type = 'ENEM'
    and question_bank.source_type = 'ENEM_OFFICIAL'
    and question_bank.metadata->>'content_revision' = private.current_enem_content_revision()
    and question_bank.metadata->>'source_integrity' = 'VERIFIED'
    and question_bank.metadata->>'statement_integrity' = 'VERIFIED'
    and question_bank.metadata->>'render_ready' = 'true'
    and question_bank.metadata->>'area_verified' = 'true'
    and (p_subject is null or question_bank.metadata->>'subject_verified' = 'true')
    and jsonb_typeof(question_bank.options) = 'array'
    and jsonb_array_length(question_bank.options) = 5
    and question_bank.correct_answer is not null
    and question_bank.metadata->>'official_answer_letter' in ('A', 'B', 'C', 'D', 'E')
    and (p_area is null or question_bank.metadata->>'enem_area' = p_area)
    and (p_subject is null or question_bank.metadata->>'enem_subject' = p_subject)
    and (
      (p_language is null and occurrence.language is null)
      or (p_language is not null and occurrence.language = p_language)
    )
    and exists (
      select 1
      from public.learning_enem_media_assets statement_asset
      where statement_asset.occurrence_id = occurrence.id
        and statement_asset.quality_state = 'VALIDATED'
        and coalesce(statement_asset.metadata->>'asset_role', 'STATEMENT') = 'STATEMENT'
        and (statement_asset.storage_path is not null or statement_asset.metadata ? 'public_url')
    )
    and (
      (
        question_bank.metadata->>'render_mode' = 'HYBRID'
        and question_bank.metadata->>'options_integrity' = 'VERIFIED'
        and question_bank.metadata->>'text_options_integrity' = 'VERIFIED'
        and not exists (
          select 1
          from jsonb_array_elements(question_bank.options) option_item
          where jsonb_typeof(option_item) <> 'string'
             or btrim(option_item #>> '{}') = ''
             or option_item #>> '{}' ~ '[[:cntrl:]]'
        )
      )
      or (
        question_bank.metadata->>'render_mode' = 'VISUAL_OPTIONS'
        and question_bank.metadata->>'options_integrity' = 'VERIFIED'
        and (
          select count(distinct option_asset.metadata->>'option_label')
          from public.learning_enem_media_assets option_asset
          where option_asset.occurrence_id = occurrence.id
            and option_asset.quality_state = 'VALIDATED'
            and option_asset.metadata->>'asset_role' in ('OPTION_A', 'OPTION_B', 'OPTION_C', 'OPTION_D', 'OPTION_E')
            and option_asset.metadata->>'option_label' in ('A', 'B', 'C', 'D', 'E')
            and option_asset.metadata->>'asset_role' = 'OPTION_' || (option_asset.metadata->>'option_label')
            and (option_asset.storage_path is not null or option_asset.metadata ? 'public_url')
        ) = 5
      )
    )
  order by question_bank.id, occurrence.id;
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
  select distinct ready.question_id
  from private.enem_ready_occurrences(p_area, p_subject, p_language) ready
  order by ready.question_id;
$$;

revoke all on function private.enem_ready_occurrences(text, text, text) from public, anon, authenticated;
revoke all on function private.enem_ready_question_ids(text, text, text) from public, anon, authenticated;
grant execute on function private.enem_ready_occurrences(text, text, text) to service_role;
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
    select template.*,
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
  select counts.id, counts.title, counts.simulation_type, counts.area,
         counts.metadata->>'enem_subject', counts.question_count,
         counts.duration_minutes, counts.pool_count, counts.available_languages,
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
  selected_occurrences uuid[] := '{}'::uuid[];
  requested_count integer;
  selected_count integer;
  snapshot_count integer;
  subject_code text;
  area_code text;
  simulation_mode text;
  language_choice text := upper(nullif(trim(p_language_choice), ''));
  content_revision text := private.current_enem_content_revision();
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

  perform pg_advisory_xact_lock(hashtextextended(p_student_id::text || ':' || p_simulation_id::text || ':' || content_revision, 0));

  select attempt.* into existing_attempt
  from public.learning_simulation_attempts attempt
  where attempt.simulation_id = p_simulation_id
    and attempt.student_id = p_student_id
    and attempt.status = 'IN_PROGRESS'
    and attempt.content_revision = content_revision
  order by attempt.started_at desc
  limit 1;
  if found then
    select count(*) into snapshot_count
    from public.learning_simulation_attempt_questions attempt_question
    where attempt_question.attempt_id = existing_attempt.id
      and attempt_question.occurrence_id is not null;
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

  if simulation_mode = 'AREA' and area_code = 'LINGUAGENS' then
    if language_choice is null or language_choice not in ('ENGLISH', 'SPANISH') then raise exception 'ENEM_LANGUAGE_CHOICE_REQUIRED'; end if;
    for question_row in
      select ready.question_id, ready.occurrence_id
      from private.enem_ready_occurrences(area_code, null, null) ready
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
      selected_occurrences := array_append(selected_occurrences, question_row.occurrence_id);
    end loop;
    if coalesce(array_length(selected_questions, 1), 0) < 40 then
      for question_row in
        select ready.question_id, ready.occurrence_id
        from private.enem_ready_occurrences(area_code, null, null) ready
        where not (ready.question_id = any(selected_questions))
        order by random()
        limit (40 - coalesce(array_length(selected_questions, 1), 0))
      loop
        selected_questions := array_append(selected_questions, question_row.question_id);
        selected_occurrences := array_append(selected_occurrences, question_row.occurrence_id);
      end loop;
    end if;
    for question_row in
      select ready.question_id, ready.occurrence_id
      from private.enem_ready_occurrences(area_code, null, language_choice) ready
      where not (ready.question_id = any(selected_questions))
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
    loop
      selected_questions := array_append(selected_questions, question_row.question_id);
      selected_occurrences := array_append(selected_occurrences, question_row.occurrence_id);
    end loop;
    if coalesce(array_length(selected_questions, 1), 0) < requested_count then
      for question_row in
        select ready.question_id, ready.occurrence_id
        from private.enem_ready_occurrences(area_code, null, language_choice) ready
        where not (ready.question_id = any(selected_questions))
        order by random()
        limit (requested_count - coalesce(array_length(selected_questions, 1), 0))
      loop
        selected_questions := array_append(selected_questions, question_row.question_id);
        selected_occurrences := array_append(selected_occurrences, question_row.occurrence_id);
      end loop;
    end if;
  else
    for question_row in
      select ready.question_id, ready.occurrence_id
      from private.enem_ready_occurrences(
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
    loop
      selected_questions := array_append(selected_questions, question_row.question_id);
      selected_occurrences := array_append(selected_occurrences, question_row.occurrence_id);
    end loop;
    if coalesce(array_length(selected_questions, 1), 0) < requested_count then
      for question_row in
        select ready.question_id, ready.occurrence_id
        from private.enem_ready_occurrences(
          area_code,
          subject_code,
          case when subject_code = 'INGLES' then 'ENGLISH' when subject_code = 'ESPANHOL' then 'SPANISH' else null end
        ) ready
        where not (ready.question_id = any(selected_questions))
        order by random()
        limit (requested_count - coalesce(array_length(selected_questions, 1), 0))
      loop
        selected_questions := array_append(selected_questions, question_row.question_id);
        selected_occurrences := array_append(selected_occurrences, question_row.occurrence_id);
      end loop;
    end if;
  end if;

  selected_count := coalesce(array_length(selected_questions, 1), 0);
  if selected_count <> requested_count then raise exception 'ENEM_POOL_INSUFFICIENT'; end if;
  if coalesce(array_length(selected_occurrences, 1), 0) <> selected_count then raise exception 'ENEM_POOL_OCCURRENCE_SNAPSHOT_INVALID'; end if;

  insert into public.learning_simulation_attempts(institution_id, simulation_id, student_id, total_questions, content_revision, answers)
  values (
    p_institution_id,
    p_simulation_id,
    p_student_id,
    requested_count,
    content_revision,
    jsonb_build_object('__language_choice', language_choice)
  )
  returning id into attempt_id;

  for question_row in
    select selected.question_bank_id, selected.occurrence_id, selected.position
    from unnest(selected_questions, selected_occurrences) with ordinality selected(question_bank_id, occurrence_id, position)
  loop
    insert into public.learning_simulation_attempt_questions(attempt_id, position, question_bank_id, occurrence_id)
    values (attempt_id, question_row.position, question_row.question_bank_id, question_row.occurrence_id);
  end loop;

  return jsonb_build_object(
    'attempt_id', attempt_id,
    'created', true,
    'question_count', requested_count,
    'language_choice', language_choice,
    'content_revision', content_revision
  );
exception
  when unique_violation then
    select attempt.* into existing_attempt
    from public.learning_simulation_attempts attempt
    where attempt.simulation_id = p_simulation_id
      and attempt.student_id = p_student_id
      and attempt.status = 'IN_PROGRESS'
      and attempt.content_revision = content_revision
    order by attempt.started_at desc
    limit 1;
    if existing_attempt.id is null then raise; end if;
    return jsonb_build_object(
      'attempt_id', existing_attempt.id,
      'created', false,
      'question_count', existing_attempt.total_questions,
      'language_choice', existing_attempt.answers->>'__language_choice',
      'content_revision', existing_attempt.content_revision
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
    'content_revision', attempt_row.content_revision,
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
        'occurrence_id', attempt_question.occurrence_id,
        'statement', question_bank.statement,
        'options', coalesce((
          select jsonb_agg(jsonb_build_object(
            'label', chr(64 + option_item.ordinality::integer),
            'text', case
              when exists (
                select 1
                from public.learning_enem_media_assets option_asset
                where option_asset.occurrence_id = attempt_question.occurrence_id
                  and option_asset.quality_state = 'VALIDATED'
                  and option_asset.metadata->>'asset_role' = 'OPTION_' || chr(64 + option_item.ordinality::integer)
              ) then null
              when jsonb_typeof(option_item.option_value) = 'string' then option_item.option_value #>> '{}'
              else option_item.option_value->>'text'
            end,
            'assets', coalesce((
              select jsonb_agg(jsonb_build_object(
                'media_type', option_asset.media_type,
                'storage_path', option_asset.storage_path,
                'public_url', option_asset.metadata->>'public_url',
                'metadata', option_asset.metadata
              ) order by option_asset.source_page, option_asset.id)
              from public.learning_enem_media_assets option_asset
              where option_asset.occurrence_id = attempt_question.occurrence_id
                and option_asset.quality_state = 'VALIDATED'
                and option_asset.metadata->>'asset_role' = 'OPTION_' || chr(64 + option_item.ordinality::integer)
            ), '[]'::jsonb)
          ) order by option_item.ordinality)
          from jsonb_array_elements(question_bank.options) with ordinality option_item(option_value, ordinality)
        ), '[]'::jsonb),
        'source_year', question_bank.source_year,
        'question_number', question_bank.source_number,
        'metadata', question_bank.metadata - 'official_answer_letter' - 'correct_answer',
        'statement_assets', coalesce((
          select jsonb_agg(jsonb_build_object(
            'media_type', statement_asset.media_type,
            'storage_path', statement_asset.storage_path,
            'public_url', statement_asset.metadata->>'public_url',
            'metadata', statement_asset.metadata
          ) order by statement_asset.source_page, statement_asset.id)
          from public.learning_enem_media_assets statement_asset
          where statement_asset.occurrence_id = attempt_question.occurrence_id
            and statement_asset.quality_state = 'VALIDATED'
            and coalesce(statement_asset.metadata->>'asset_role', 'STATEMENT') = 'STATEMENT'
        ), '[]'::jsonb)
      ) order by attempt_question.position)
      from public.learning_simulation_attempt_questions attempt_question
      join public.learning_question_bank question_bank
        on question_bank.id = attempt_question.question_bank_id
      where attempt_question.attempt_id = attempt_row.id
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.start_enem_simulation_attempt_v2(uuid, uuid, uuid, text) from public, anon;
revoke all on function public.get_enem_simulation_attempt_v2(uuid) from public, anon;
grant execute on function public.start_enem_simulation_attempt_v2(uuid, uuid, uuid, text) to authenticated;
grant execute on function public.get_enem_simulation_attempt_v2(uuid) to authenticated, service_role;

notify pgrst, 'reload schema';
commit;
