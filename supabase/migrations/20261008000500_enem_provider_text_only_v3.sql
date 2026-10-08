begin;

-- Forward-only revision. The v2 rows remain available for historical attempts;
-- current attempts receive an immutable v3 snapshot instead.
insert into public.learning_enem_structured_content(
  provider,
  provider_question_key,
  question_bank_id,
  occurrence_id,
  provider_year,
  provider_index,
  discipline,
  language,
  context_text,
  prompt_text,
  alternatives_json,
  provider_correct_alternative,
  essential_media_json,
  raw_hash,
  normalized_content_hash,
  match_method,
  match_level,
  match_confidence,
  verification_status,
  content_revision,
  render_mode,
  source_mapping_verified,
  answer_verified,
  structured_content_integrity,
  statement_complete,
  five_alternatives_complete,
  no_control_chars,
  no_previous_question_contamination,
  no_next_question_contamination,
  required_media_present,
  required_media_validated,
  source_metadata,
  source_kind,
  content_acceptance_status
)
select
  structured.provider,
  structured.provider_question_key,
  structured.question_bank_id,
  null,
  structured.provider_year,
  structured.provider_index,
  structured.discipline,
  structured.language,
  structured.context_text,
  structured.prompt_text,
  structured.alternatives_json,
  structured.provider_correct_alternative,
  '[]'::jsonb,
  structured.raw_hash,
  structured.normalized_content_hash,
  structured.match_method,
  structured.match_level,
  structured.match_confidence,
  'VERIFIED',
  'structured-text-only-v3',
  'STRUCTURED_TEXT',
  false,
  structured.answer_verified,
  'VERIFIED',
  true,
  true,
  structured.no_control_chars,
  true,
  true,
  false,
  false,
  structured.source_metadata || jsonb_build_object(
    'content_revision', 'structured-text-only-v3',
    'source_kind', 'STRUCTURED_PROVIDER',
    'legacy_assets_preserved', true
  ),
  'STRUCTURED_PROVIDER',
  'ACCEPTED'
from public.learning_enem_structured_content structured
where structured.content_revision = 'structured-sources-v2'
  and structured.source_kind = 'STRUCTURED_PROVIDER'
  and structured.content_acceptance_status = 'ACCEPTED'
  and structured.verification_status = 'VERIFIED'
  and structured.question_bank_id is not null
  and structured.occurrence_id is null
  and structured.render_mode = 'STRUCTURED_TEXT'
  and structured.statement_complete
  and structured.five_alternatives_complete
  and structured.no_control_chars
  and not structured.required_media_present
  and structured.provider_correct_alternative in ('A', 'B', 'C', 'D', 'E')
on conflict (provider, provider_question_key, content_revision) do update
set question_bank_id = excluded.question_bank_id,
    occurrence_id = null,
    context_text = excluded.context_text,
    prompt_text = excluded.prompt_text,
    alternatives_json = excluded.alternatives_json,
    provider_correct_alternative = excluded.provider_correct_alternative,
    essential_media_json = excluded.essential_media_json,
    raw_hash = excluded.raw_hash,
    normalized_content_hash = excluded.normalized_content_hash,
    match_method = excluded.match_method,
    match_level = excluded.match_level,
    match_confidence = excluded.match_confidence,
    verification_status = excluded.verification_status,
    render_mode = excluded.render_mode,
    source_mapping_verified = excluded.source_mapping_verified,
    answer_verified = excluded.answer_verified,
    structured_content_integrity = excluded.structured_content_integrity,
    statement_complete = excluded.statement_complete,
    five_alternatives_complete = excluded.five_alternatives_complete,
    no_control_chars = excluded.no_control_chars,
    no_previous_question_contamination = excluded.no_previous_question_contamination,
    no_next_question_contamination = excluded.no_next_question_contamination,
    required_media_present = excluded.required_media_present,
    required_media_validated = excluded.required_media_validated,
    source_metadata = excluded.source_metadata,
    source_kind = excluded.source_kind,
    content_acceptance_status = excluded.content_acceptance_status,
    updated_at = now();

update public.learning_question_bank question_bank
set metadata = question_bank.metadata || jsonb_build_object(
  'content_revision', 'structured-text-only-v3',
  'source_kind', 'STRUCTURED_PROVIDER',
  'render_mode', 'STRUCTURED_TEXT'
)
where question_bank.source_type = 'ENEM_STRUCTURED_PROVIDER'
  and exists (
    select 1
    from public.learning_enem_structured_content structured
    where structured.question_bank_id = question_bank.id
      and structured.content_revision = 'structured-text-only-v3'
      and structured.source_kind = 'STRUCTURED_PROVIDER'
      and structured.content_acceptance_status = 'ACCEPTED'
  );

create or replace function private.current_enem_content_revision()
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select 'structured-text-only-v3'::text;
$$;

create or replace function private.enem_ready_provider_text_questions(
  p_area text default null,
  p_subject text default null,
  p_language text default null
)
returns table(
  question_id uuid,
  occurrence_id uuid,
  structured_content_id uuid,
  language text,
  source_kind text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    question_bank.id,
    null::uuid,
    structured.id,
    structured.language,
    structured.source_kind
  from public.learning_enem_structured_content structured
  join public.learning_question_bank question_bank
    on question_bank.id = structured.question_bank_id
  where question_bank.active
    and question_bank.package_type = 'ENEM'
    and question_bank.source_type = 'ENEM_STRUCTURED_PROVIDER'
    and structured.source_kind = 'STRUCTURED_PROVIDER'
    and structured.content_acceptance_status = 'ACCEPTED'
    and structured.verification_status = 'VERIFIED'
    and structured.content_revision = private.current_enem_content_revision()
    and structured.question_bank_id is not null
    and structured.occurrence_id is null
    and structured.render_mode = 'STRUCTURED_TEXT'
    and structured.structured_content_integrity = 'VERIFIED'
    and structured.statement_complete
    and structured.five_alternatives_complete
    and structured.no_control_chars
    and structured.no_previous_question_contamination
    and structured.no_next_question_contamination
    and not structured.required_media_present
    and not structured.required_media_validated
    and structured.provider_correct_alternative in ('A', 'B', 'C', 'D', 'E')
    and jsonb_typeof(structured.alternatives_json) = 'array'
    and jsonb_array_length(structured.alternatives_json) = 5
    and not exists (
      select 1
      from jsonb_array_elements(structured.alternatives_json) option_item
      where jsonb_typeof(option_item) <> 'object'
        or btrim(option_item->>'text') = ''
        or option_item ? 'file'
        or option_item->>'text' ~ '[[:cntrl:]]'
    )
    and (
      p_area is null
      or question_bank.subject_area = p_area
      or case structured.discipline
           when 'linguagens' then 'LINGUAGENS'
           when 'ciencias-humanas' then 'CIENCIAS_HUMANAS'
           when 'ciencias-natureza' then 'CIENCIAS_NATUREZA'
           when 'matematica' then 'MATEMATICA'
           else null
         end = p_area
    )
    and (
      p_subject is null
      or (p_subject = 'INGLES' and structured.language = 'ENGLISH')
      or (p_subject = 'ESPANHOL' and structured.language = 'SPANISH')
      or question_bank.subject_area = p_subject
    )
    and (
      (p_language is null and structured.language is null)
      or (p_language is not null and structured.language = upper(p_language))
    )
  order by random();
$$;

revoke all on function private.enem_ready_provider_text_questions(text, text, text) from public, anon, authenticated;
grant execute on function private.enem_ready_provider_text_questions(text, text, text) to service_role;

create or replace function private.validate_enem_attempt_question_snapshot()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  attempt_revision text;
  occurrence_question_id uuid;
  structured_question_id uuid;
begin
  select attempt.content_revision into attempt_revision
  from public.learning_simulation_attempts attempt
  where attempt.id = new.attempt_id;

  if attempt_revision = private.current_enem_content_revision() then
    if new.occurrence_id is not null or new.structured_content_id is null then
      raise exception 'ENEM_ATTEMPT_SNAPSHOT_SOURCE_REQUIRED';
    end if;
  end if;

  if new.occurrence_id is not null then
    select occurrence.question_bank_id into occurrence_question_id
    from public.learning_enem_official_occurrences occurrence
    where occurrence.id = new.occurrence_id;
    if occurrence_question_id is null or occurrence_question_id <> new.question_bank_id then
      raise exception 'ENEM_ATTEMPT_SNAPSHOT_OCCURRENCE_MISMATCH';
    end if;
  end if;

  if new.structured_content_id is not null then
    select structured.question_bank_id into structured_question_id
    from public.learning_enem_structured_content structured
    where structured.id = new.structured_content_id
      and structured.content_revision = attempt_revision
      and structured.verification_status = 'VERIFIED'
      and (
        case
          when attempt_revision = private.current_enem_content_revision() then
            structured.source_kind = 'STRUCTURED_PROVIDER'
            and structured.content_acceptance_status = 'ACCEPTED'
            and structured.question_bank_id is not null
            and structured.occurrence_id is null
            and structured.render_mode = 'STRUCTURED_TEXT'
            and structured.structured_content_integrity = 'VERIFIED'
            and structured.statement_complete
            and structured.five_alternatives_complete
            and structured.no_control_chars
            and not structured.required_media_present
            and not structured.required_media_validated
            and structured.provider_correct_alternative in ('A', 'B', 'C', 'D', 'E')
          else
            (
              structured.source_kind = 'STRUCTURED_PROVIDER'
              and structured.content_acceptance_status = 'ACCEPTED'
            )
            or structured.source_kind = 'OFFICIAL_OCCURRENCE'
        end
      );
    if structured_question_id is null or structured_question_id <> new.question_bank_id then
      raise exception 'ENEM_ATTEMPT_SNAPSHOT_STRUCTURED_CONTENT_MISMATCH';
    end if;
  end if;

  if new.occurrence_id is not null
     and new.structured_content_id is not null
     and not exists (
       select 1
       from public.learning_enem_structured_content structured
       where structured.id = new.structured_content_id
         and structured.occurrence_id = new.occurrence_id
     ) then
    raise exception 'ENEM_ATTEMPT_SNAPSHOT_SOURCE_MISMATCH';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_enem_attempt_question_snapshot
  on public.learning_simulation_attempt_questions;
create trigger validate_enem_attempt_question_snapshot
before insert or update on public.learning_simulation_attempt_questions
for each row execute function private.validate_enem_attempt_question_snapshot();

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
  ), counts as (
    select template.*,
      case
        when template.metadata->>'enem_mode' = 'AREA' and template.area = 'LINGUAGENS' then
          case when (select count(*) from private.enem_ready_provider_text_questions(template.area, null, null)) >= 40
                    and ((select count(*) from private.enem_ready_provider_text_questions(template.area, null, 'ENGLISH')) >= 5
                      or (select count(*) from private.enem_ready_provider_text_questions(template.area, null, 'SPANISH')) >= 5)
               then 45 else 0 end
        when template.metadata->>'enem_mode' = 'SUBJECT' and template.metadata->>'enem_subject' = 'INGLES' then
          (select count(*)::integer from private.enem_ready_provider_text_questions(null, template.metadata->>'enem_subject', 'ENGLISH'))
        when template.metadata->>'enem_mode' = 'SUBJECT' and template.metadata->>'enem_subject' = 'ESPANHOL' then
          (select count(*)::integer from private.enem_ready_provider_text_questions(null, template.metadata->>'enem_subject', 'SPANISH'))
        else (select count(*)::integer from private.enem_ready_provider_text_questions(template.area, template.metadata->>'enem_subject', null))
      end as pool_count,
      case
        when template.metadata->>'enem_mode' = 'AREA' and template.area = 'LINGUAGENS' then
          case
            when (select count(*) from private.enem_ready_provider_text_questions(template.area, null, 'ENGLISH')) >= 5
             and (select count(*) from private.enem_ready_provider_text_questions(template.area, null, 'SPANISH')) >= 5 then '["ENGLISH", "SPANISH"]'::jsonb
            when (select count(*) from private.enem_ready_provider_text_questions(template.area, null, 'ENGLISH')) >= 5 then '["ENGLISH"]'::jsonb
            when (select count(*) from private.enem_ready_provider_text_questions(template.area, null, 'SPANISH')) >= 5 then '["SPANISH"]'::jsonb
            else '[]'::jsonb
          end
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
  selected_structured_content uuid[] := '{}'::uuid[];
  requested_count integer;
  selected_count integer;
  snapshot_count integer;
  subject_code text;
  area_code text;
  simulation_mode text;
  language_choice text := upper(nullif(trim(p_language_choice), ''));
  language_filter text;
begin
  if not exists (
    select 1 from public.students student
    where student.id = p_student_id
      and student.institution_id = p_institution_id
      and student.profile_id = auth.uid()
      and student.active
  ) then raise exception 'LEARNING_STUDENT_SCOPE_DENIED'; end if;

  select simulation.* into simulation_row
  from public.learning_simulations simulation
  where simulation.id = p_simulation_id
    and simulation.status = 'PUBLISHED'
    and simulation.metadata->>'dynamic_pool' = 'true'
    and (simulation.institution_id is null or simulation.institution_id = p_institution_id);
  if not found then raise exception 'ENEM_SIMULATION_NOT_FOUND'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_student_id::text || ':' || p_simulation_id::text || ':' || private.current_enem_content_revision(), 0));

  select attempt.* into existing_attempt
  from public.learning_simulation_attempts attempt
  where attempt.simulation_id = p_simulation_id
    and attempt.student_id = p_student_id
    and attempt.status = 'IN_PROGRESS'
    and attempt.content_revision = private.current_enem_content_revision()
  order by attempt.started_at desc limit 1;
  if found then
    select count(*) into snapshot_count
    from public.learning_simulation_attempt_questions attempt_question
    where attempt_question.attempt_id = existing_attempt.id
      and attempt_question.structured_content_id is not null
      and attempt_question.occurrence_id is null;
    if snapshot_count <> existing_attempt.total_questions then raise exception 'ENEM_ATTEMPT_SNAPSHOT_INCOMPLETE'; end if;
    return jsonb_build_object('attempt_id', existing_attempt.id, 'created', false, 'question_count', existing_attempt.total_questions, 'language_choice', existing_attempt.answers->>'__language_choice', 'content_revision', existing_attempt.content_revision);
  end if;

  simulation_mode := simulation_row.metadata->>'enem_mode';
  subject_code := simulation_row.metadata->>'enem_subject';
  area_code := coalesce(simulation_row.metadata->>'enem_area', simulation_row.area);
  requested_count := simulation_row.question_count;
  language_filter := case when subject_code = 'INGLES' then 'ENGLISH' when subject_code = 'ESPANHOL' then 'SPANISH' else null end;

  if simulation_mode = 'AREA' and area_code = 'LINGUAGENS' then
    if language_choice is null or language_choice not in ('ENGLISH', 'SPANISH') then raise exception 'ENEM_LANGUAGE_CHOICE_REQUIRED'; end if;
    if (select count(*) from private.enem_ready_provider_text_questions(area_code, null, null)) < 40 then
      raise exception 'ENEM_COMMON_PROVIDER_TEXT_POOL_INSUFFICIENT';
    end if;
    if (select count(*) from private.enem_ready_provider_text_questions(area_code, null, language_choice)) < 5 then
      raise exception 'ENEM_LANGUAGE_PROVIDER_TEXT_POOL_INSUFFICIENT';
    end if;
    for question_row in
      select ready.* from private.enem_ready_provider_text_questions(area_code, null, null) ready
      where not exists (
        select 1
        from public.learning_simulation_attempt_questions previous_question
        join public.learning_simulation_attempts previous_attempt on previous_attempt.id = previous_question.attempt_id
        where previous_attempt.student_id = p_student_id
          and previous_attempt.status = 'COMPLETED'
          and previous_attempt.started_at > now() - interval '90 days'
          and previous_question.question_bank_id = ready.question_id
      )
      order by random() limit 40
    loop
      selected_questions := array_append(selected_questions, question_row.question_id);
      selected_occurrences := array_append(selected_occurrences, null::uuid);
      selected_structured_content := array_append(selected_structured_content, question_row.structured_content_id);
    end loop;
    if coalesce(array_length(selected_questions, 1), 0) < 40 then
      for question_row in
        select ready.* from private.enem_ready_provider_text_questions(area_code, null, null) ready
        where not (ready.question_id = any(selected_questions))
        order by random() limit (40 - coalesce(array_length(selected_questions, 1), 0))
      loop
        selected_questions := array_append(selected_questions, question_row.question_id);
        selected_occurrences := array_append(selected_occurrences, null::uuid);
        selected_structured_content := array_append(selected_structured_content, question_row.structured_content_id);
      end loop;
    end if;
    for question_row in
      select ready.* from private.enem_ready_provider_text_questions(area_code, null, language_choice) ready
      where not (ready.question_id = any(selected_questions))
      order by random() limit 5
    loop
      selected_questions := array_append(selected_questions, question_row.question_id);
      selected_occurrences := array_append(selected_occurrences, null::uuid);
      selected_structured_content := array_append(selected_structured_content, question_row.structured_content_id);
    end loop;
  else
    if subject_code in ('INGLES', 'ESPANHOL')
       and (select count(*) from private.enem_ready_provider_text_questions(area_code, subject_code, language_filter)) < requested_count then
      raise exception 'ENEM_PROVIDER_TEXT_POOL_INSUFFICIENT';
    end if;
    for question_row in
      select ready.* from private.enem_ready_provider_text_questions(area_code, subject_code, language_filter) ready
      order by random() limit requested_count
    loop
      selected_questions := array_append(selected_questions, question_row.question_id);
      selected_occurrences := array_append(selected_occurrences, null::uuid);
      selected_structured_content := array_append(selected_structured_content, question_row.structured_content_id);
    end loop;
  end if;

  selected_count := coalesce(array_length(selected_questions, 1), 0);
  if selected_count <> requested_count then raise exception 'ENEM_PROVIDER_TEXT_POOL_INSUFFICIENT'; end if;
  if coalesce(array_length(selected_structured_content, 1), 0) <> selected_count then raise exception 'ENEM_POOL_SNAPSHOT_INVALID'; end if;

  insert into public.learning_simulation_attempts(institution_id, simulation_id, student_id, total_questions, content_revision, answers)
  values (p_institution_id, p_simulation_id, p_student_id, requested_count, private.current_enem_content_revision(), jsonb_build_object('__language_choice', language_choice))
  returning id into attempt_id;

  for question_row in
    select selected.question_bank_id, selected.structured_content_id, selected.position
    from unnest(selected_questions, selected_structured_content) with ordinality selected(question_bank_id, structured_content_id, position)
  loop
    insert into public.learning_simulation_attempt_questions(attempt_id, position, question_bank_id, occurrence_id, structured_content_id)
    values (attempt_id, question_row.position, question_row.question_bank_id, null, question_row.structured_content_id);
  end loop;

  return jsonb_build_object('attempt_id', attempt_id, 'created', true, 'question_count', requested_count, 'language_choice', language_choice, 'content_revision', private.current_enem_content_revision());
exception
  when unique_violation then
    select attempt.* into existing_attempt
    from public.learning_simulation_attempts attempt
    where attempt.simulation_id = p_simulation_id
      and attempt.student_id = p_student_id
      and attempt.status = 'IN_PROGRESS'
      and attempt.content_revision = private.current_enem_content_revision()
    order by attempt.started_at desc limit 1;
    if existing_attempt.id is null then raise; end if;
    return jsonb_build_object('attempt_id', existing_attempt.id, 'created', false, 'question_count', existing_attempt.total_questions, 'language_choice', existing_attempt.answers->>'__language_choice', 'content_revision', existing_attempt.content_revision);
end;
$$;

revoke all on function public.start_enem_simulation_attempt_v2(uuid, uuid, uuid, text) from public, anon;
grant execute on function public.start_enem_simulation_attempt_v2(uuid, uuid, uuid, text) to authenticated;

notify pgrst, 'reload schema';
commit;
