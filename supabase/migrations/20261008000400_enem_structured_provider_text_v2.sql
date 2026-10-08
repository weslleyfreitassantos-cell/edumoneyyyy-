begin;

-- Provider-backed text is a first-class ENEM source. It is accepted by
-- structural integrity gates and does not pretend to be an official PDF
-- occurrence when the provider has no official mapping.
alter table public.learning_enem_structured_content
  add column if not exists source_kind text not null default 'OFFICIAL_OCCURRENCE',
  add column if not exists content_acceptance_status text not null default 'REVIEW_REQUIRED';

alter table public.learning_enem_structured_content
  drop constraint if exists learning_enem_structured_ready_consistency;

alter table public.learning_enem_structured_content
  drop constraint if exists learning_enem_structured_source_kind_check,
  drop constraint if exists learning_enem_structured_content_acceptance_status_check;

alter table public.learning_enem_structured_content
  add constraint learning_enem_structured_source_kind_check
    check (source_kind in ('OFFICIAL_OCCURRENCE', 'STRUCTURED_PROVIDER')),
  add constraint learning_enem_structured_content_acceptance_status_check
    check (content_acceptance_status in ('ACCEPTED', 'REVIEW_REQUIRED', 'REJECTED')),
  add constraint learning_enem_structured_ready_consistency check (
    verification_status <> 'VERIFIED'
    or (
      structured_content_integrity = 'VERIFIED'
      and statement_complete
      and five_alternatives_complete
      and no_control_chars
      and no_previous_question_contamination
      and no_next_question_contamination
      and (not required_media_present or required_media_validated)
      and (
        (
          source_kind = 'STRUCTURED_PROVIDER'
          and content_acceptance_status = 'ACCEPTED'
          and question_bank_id is not null
          and occurrence_id is null
          and provider_correct_alternative in ('A', 'B', 'C', 'D', 'E')
          and not required_media_present
        )
        or (
          source_kind = 'OFFICIAL_OCCURRENCE'
          and source_mapping_verified
          and answer_verified
        )
      )
    )
  );

create index if not exists learning_enem_structured_source_kind_revision_idx
  on public.learning_enem_structured_content(source_kind, content_revision, content_acceptance_status, question_bank_id);

create unique index if not exists learning_enem_structured_accepted_hash_unique_idx
  on public.learning_enem_structured_content(normalized_content_hash, content_revision)
  where content_acceptance_status = 'ACCEPTED';

create or replace function private.current_enem_content_revision()
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select 'structured-sources-v2'::text;
$$;

alter table public.learning_simulation_attempt_questions
  add column if not exists structured_content_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'learning_simulation_attempt_questions_structured_content_fk'
      and conrelid = 'public.learning_simulation_attempt_questions'::regclass
  ) then
    alter table public.learning_simulation_attempt_questions
      add constraint learning_simulation_attempt_questions_structured_content_fk
      foreign key (structured_content_id)
      references public.learning_enem_structured_content(id)
      on delete restrict;
  end if;
end;
$$;

create index if not exists learning_simulation_attempt_questions_structured_content_idx
  on public.learning_simulation_attempt_questions(structured_content_id, question_bank_id);

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
  select attempt.content_revision
    into attempt_revision
  from public.learning_simulation_attempts attempt
  where attempt.id = new.attempt_id;

  if attempt_revision = private.current_enem_content_revision()
     and new.occurrence_id is null
     and new.structured_content_id is null then
    raise exception 'ENEM_ATTEMPT_SNAPSHOT_SOURCE_REQUIRED';
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

  if new.structured_content_id is not null then
    select structured.question_bank_id
      into structured_question_id
    from public.learning_enem_structured_content structured
    where structured.id = new.structured_content_id
      and structured.content_revision = attempt_revision
      and structured.verification_status = 'VERIFIED'
      and (
        (
          structured.source_kind = 'STRUCTURED_PROVIDER'
          and structured.content_acceptance_status = 'ACCEPTED'
        )
        or structured.source_kind = 'OFFICIAL_OCCURRENCE'
      );

    if structured_question_id is null
       or structured_question_id <> new.question_bank_id then
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

-- One pool for both sources. Provider text wins by source kind when an
-- existing question has both a legacy occurrence and a structured provider row.
create or replace function private.enem_ready_questions(
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
  with candidates as (
    select
      question_bank.id as question_id,
      null::uuid as occurrence_id,
      structured.id as structured_content_id,
      structured.language,
      structured.source_kind,
      0 as source_priority
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
      and structured.structured_content_integrity = 'VERIFIED'
      and structured.statement_complete
      and structured.five_alternatives_complete
      and structured.no_control_chars
      and structured.no_previous_question_contamination
      and structured.no_next_question_contamination
      and not structured.required_media_present
      and not exists (
        select 1
        from jsonb_array_elements(structured.alternatives_json) option_item
        where jsonb_typeof(option_item) <> 'object'
          or btrim(option_item->>'text') = ''
          or option_item ? 'file'
          or option_item->>'text' ~ '[[:cntrl:]]'
      )
      and (p_area is null or question_bank.subject_area = p_area or question_bank.metadata->>'enem_area' = p_area)
      and (
        p_subject is null
        or (p_subject = 'INGLES' and structured.language = 'ENGLISH')
        or (p_subject = 'ESPANHOL' and structured.language = 'SPANISH')
      )
      and (
        (p_language is null and structured.language is null)
        or (p_language is not null and structured.language = p_language)
      )

    union all

    select
      question_bank.id as question_id,
      occurrence.id as occurrence_id,
      structured.id as structured_content_id,
      occurrence.language,
      'OFFICIAL_OCCURRENCE'::text as source_kind,
      1 as source_priority
    from public.learning_enem_official_occurrences occurrence
    join public.learning_question_bank question_bank
      on question_bank.id = occurrence.question_bank_id
    left join lateral (
      select structured_row.*
      from public.learning_enem_structured_content structured_row
      where structured_row.occurrence_id = occurrence.id
        and structured_row.question_bank_id = question_bank.id
        and structured_row.verification_status = 'VERIFIED'
        and structured_row.structured_content_integrity = 'VERIFIED'
        and structured_row.statement_complete
        and structured_row.five_alternatives_complete
        and structured_row.no_control_chars
        and structured_row.no_previous_question_contamination
        and structured_row.no_next_question_contamination
        and (
          structured_row.content_revision in ('structured-text-v1', private.current_enem_content_revision())
          or structured_row.content_revision = 'source-faithful-v3'
        )
      order by case when structured_row.content_revision = private.current_enem_content_revision() then 0 else 1 end, structured_row.updated_at desc
      limit 1
    ) structured on true
    where question_bank.active
      and question_bank.package_type = 'ENEM'
      and question_bank.source_type = 'ENEM_OFFICIAL'
      and not exists (
        select 1
        from public.learning_enem_structured_content replacement
        where replacement.source_kind = 'STRUCTURED_PROVIDER'
          and replacement.content_acceptance_status = 'ACCEPTED'
          and replacement.content_revision = private.current_enem_content_revision()
          and replacement.source_metadata->>'replaces_question_bank_id' = question_bank.id::text
      )
      and question_bank.metadata->>'source_integrity' = 'VERIFIED'
      and question_bank.metadata->>'statement_integrity' = 'VERIFIED'
      and question_bank.metadata->>'render_ready' = 'true'
      and question_bank.metadata->>'area_verified' = 'true'
      and (p_subject is null or question_bank.metadata->>'subject_verified' = 'true')
      and jsonb_typeof(question_bank.options) = 'array'
      and jsonb_array_length(question_bank.options) = 5
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
          structured.id is not null
          and not (structured.source_kind = 'STRUCTURED_PROVIDER' and structured.content_acceptance_status = 'ACCEPTED')
        )
        or (
          structured.id is null
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
        )
      )
  )
  select distinct on (candidates.question_id)
    candidates.question_id,
    candidates.occurrence_id,
    candidates.structured_content_id,
    candidates.language,
    candidates.source_kind
  from candidates
  order by candidates.question_id, candidates.source_priority, candidates.structured_content_id nulls last, candidates.occurrence_id nulls last;
$$;

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
  select ready.occurrence_id, ready.question_id, ready.language
  from private.enem_ready_questions(p_area, p_subject, p_language) ready
  where ready.occurrence_id is not null
  order by ready.question_id;
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
  select ready.question_id
  from private.enem_ready_questions(p_area, p_subject, p_language) ready
  order by ready.question_id;
$$;

revoke all on function private.enem_ready_questions(text, text, text) from public, anon, authenticated;
revoke all on function private.enem_ready_occurrences(text, text, text) from public, anon, authenticated;
revoke all on function private.enem_ready_question_ids(text, text, text) from public, anon, authenticated;
grant execute on function private.enem_ready_questions(text, text, text) to service_role;
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
  ), counts as (
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
      case when template.metadata->>'enem_mode' = 'AREA' and template.area = 'LINGUAGENS'
        then jsonb_build_array('ENGLISH', 'SPANISH') else '[]'::jsonb end as available_languages
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
  v_current_revision text := private.current_enem_content_revision();
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

  perform pg_advisory_xact_lock(hashtextextended(p_student_id::text || ':' || p_simulation_id::text || ':' || v_current_revision, 0));

  select attempt.* into existing_attempt
  from public.learning_simulation_attempts attempt
  where attempt.simulation_id = p_simulation_id
    and attempt.student_id = p_student_id
    and attempt.status = 'IN_PROGRESS'
    and attempt.content_revision = v_current_revision
  order by attempt.started_at desc limit 1;
  if found then
    select count(*) into snapshot_count
    from public.learning_simulation_attempt_questions attempt_question
    where attempt_question.attempt_id = existing_attempt.id
      and (attempt_question.occurrence_id is not null or attempt_question.structured_content_id is not null);
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
    for question_row in
      select ready.* from private.enem_ready_questions(area_code, null, null) ready
      where not exists (select 1 from public.learning_simulation_attempt_questions previous_question join public.learning_simulation_attempts previous_attempt on previous_attempt.id = previous_question.attempt_id where previous_attempt.student_id = p_student_id and previous_attempt.status = 'COMPLETED' and previous_attempt.started_at > now() - interval '90 days' and previous_question.question_bank_id = ready.question_id)
      order by random() limit 40
    loop
      selected_questions := array_append(selected_questions, question_row.question_id); selected_occurrences := array_append(selected_occurrences, question_row.occurrence_id); selected_structured_content := array_append(selected_structured_content, question_row.structured_content_id);
    end loop;
    if coalesce(array_length(selected_questions, 1), 0) < 40 then
      for question_row in select ready.* from private.enem_ready_questions(area_code, null, null) ready where not (ready.question_id = any(selected_questions)) order by random() limit (40 - coalesce(array_length(selected_questions, 1), 0))
      loop
        selected_questions := array_append(selected_questions, question_row.question_id); selected_occurrences := array_append(selected_occurrences, question_row.occurrence_id); selected_structured_content := array_append(selected_structured_content, question_row.structured_content_id);
      end loop;
    end if;
    for question_row in
      select ready.* from private.enem_ready_questions(area_code, null, language_choice) ready
      where not (ready.question_id = any(selected_questions))
        and not exists (select 1 from public.learning_simulation_attempt_questions previous_question join public.learning_simulation_attempts previous_attempt on previous_attempt.id = previous_question.attempt_id where previous_attempt.student_id = p_student_id and previous_attempt.status = 'COMPLETED' and previous_attempt.started_at > now() - interval '90 days' and previous_question.question_bank_id = ready.question_id)
      order by random() limit 5
    loop
      selected_questions := array_append(selected_questions, question_row.question_id); selected_occurrences := array_append(selected_occurrences, question_row.occurrence_id); selected_structured_content := array_append(selected_structured_content, question_row.structured_content_id);
    end loop;
    if coalesce(array_length(selected_questions, 1), 0) < requested_count then
      for question_row in select ready.* from private.enem_ready_questions(area_code, null, language_choice) ready where not (ready.question_id = any(selected_questions)) order by random() limit (requested_count - coalesce(array_length(selected_questions, 1), 0))
      loop
        selected_questions := array_append(selected_questions, question_row.question_id); selected_occurrences := array_append(selected_occurrences, question_row.occurrence_id); selected_structured_content := array_append(selected_structured_content, question_row.structured_content_id);
      end loop;
    end if;
  else
    for question_row in
      select ready.* from private.enem_ready_questions(area_code, subject_code, language_filter) ready
      where not exists (select 1 from public.learning_simulation_attempt_questions previous_question join public.learning_simulation_attempts previous_attempt on previous_attempt.id = previous_question.attempt_id where previous_attempt.student_id = p_student_id and previous_attempt.status = 'COMPLETED' and previous_attempt.started_at > now() - interval '90 days' and previous_question.question_bank_id = ready.question_id)
      order by random() limit requested_count
    loop
      selected_questions := array_append(selected_questions, question_row.question_id); selected_occurrences := array_append(selected_occurrences, question_row.occurrence_id); selected_structured_content := array_append(selected_structured_content, question_row.structured_content_id);
    end loop;
    if coalesce(array_length(selected_questions, 1), 0) < requested_count then
      for question_row in select ready.* from private.enem_ready_questions(area_code, subject_code, language_filter) ready where not (ready.question_id = any(selected_questions)) order by random() limit (requested_count - coalesce(array_length(selected_questions, 1), 0))
      loop
        selected_questions := array_append(selected_questions, question_row.question_id); selected_occurrences := array_append(selected_occurrences, question_row.occurrence_id); selected_structured_content := array_append(selected_structured_content, question_row.structured_content_id);
      end loop;
    end if;
  end if;

  selected_count := coalesce(array_length(selected_questions, 1), 0);
  if selected_count <> requested_count then raise exception 'ENEM_POOL_INSUFFICIENT'; end if;
  if coalesce(array_length(selected_occurrences, 1), 0) <> selected_count or coalesce(array_length(selected_structured_content, 1), 0) <> selected_count then raise exception 'ENEM_POOL_SNAPSHOT_INVALID'; end if;

  insert into public.learning_simulation_attempts(institution_id, simulation_id, student_id, total_questions, content_revision, answers)
  values (p_institution_id, p_simulation_id, p_student_id, requested_count, v_current_revision, jsonb_build_object('__language_choice', language_choice))
  returning id into attempt_id;

  for question_row in
    select selected.question_bank_id, selected.occurrence_id, selected.structured_content_id, selected.position
    from unnest(selected_questions, selected_occurrences, selected_structured_content) with ordinality selected(question_bank_id, occurrence_id, structured_content_id, position)
  loop
    insert into public.learning_simulation_attempt_questions(attempt_id, position, question_bank_id, occurrence_id, structured_content_id)
    values (attempt_id, question_row.position, question_row.question_bank_id, question_row.occurrence_id, question_row.structured_content_id);
  end loop;

  return jsonb_build_object('attempt_id', attempt_id, 'created', true, 'question_count', requested_count, 'language_choice', language_choice, 'content_revision', v_current_revision);
exception
  when unique_violation then
    select attempt.* into existing_attempt from public.learning_simulation_attempts attempt where attempt.simulation_id = p_simulation_id and attempt.student_id = p_student_id and attempt.status = 'IN_PROGRESS' and attempt.content_revision = v_current_revision order by attempt.started_at desc limit 1;
    if existing_attempt.id is null then raise; end if;
    return jsonb_build_object('attempt_id', existing_attempt.id, 'created', false, 'question_count', existing_attempt.total_questions, 'language_choice', existing_attempt.answers->>'__language_choice', 'content_revision', existing_attempt.content_revision);
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
    and exists (select 1 from public.students student where student.id = attempt.student_id and student.profile_id = auth.uid() and student.active);
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
    'simulation', (select jsonb_build_object('id', simulation.id, 'title', simulation.title, 'simulation_type', simulation.simulation_type, 'area', simulation.area, 'question_count', simulation.question_count, 'duration_minutes', simulation.duration_minutes, 'metadata', simulation.metadata) from public.learning_simulations simulation where simulation.id = attempt_row.simulation_id),
    'questions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'position', attempt_question.position,
        'question_bank_id', question_bank.id,
        'occurrence_id', attempt_question.occurrence_id,
        'structured_content_id', attempt_question.structured_content_id,
        'source_kind', coalesce(structured.source_kind, 'OFFICIAL_OCCURRENCE'),
        'statement', question_bank.statement,
        'structured_content', case when structured.id is null then null else jsonb_build_object(
          'context', structured.context_text,
          'prompt', structured.prompt_text,
          'alternatives', coalesce((select jsonb_agg(jsonb_build_object('letter', option_item.option_value->>'letter', 'text', option_item.option_value->>'text', 'assets', case when structured.source_kind = 'STRUCTURED_PROVIDER' then '[]'::jsonb else coalesce(option_item.option_value->'assets', '[]'::jsonb) end) order by option_item.ordinality) from jsonb_array_elements(structured.alternatives_json) with ordinality option_item(option_value, ordinality)), '[]'::jsonb),
          'render_mode', structured.render_mode,
          'essential_media', case when structured.source_kind = 'STRUCTURED_PROVIDER' then '[]'::jsonb else structured.essential_media_json end
        ) end,
        'options', coalesce((select jsonb_agg(jsonb_build_object(
          'label', coalesce(option_item.option_value->>'letter', chr(64 + option_item.ordinality::integer)),
          'text', case when structured.id is not null then option_item.option_value->>'text' when exists (select 1 from public.learning_enem_media_assets option_asset where option_asset.occurrence_id = attempt_question.occurrence_id and option_asset.quality_state = 'VALIDATED' and option_asset.metadata->>'asset_role' = 'OPTION_' || chr(64 + option_item.ordinality::integer)) then null when jsonb_typeof(option_item.option_value) = 'string' then option_item.option_value #>> '{}' else option_item.option_value->>'text' end,
          'assets', case when structured.id is not null then case when structured.source_kind = 'STRUCTURED_PROVIDER' then '[]'::jsonb else coalesce(option_item.option_value->'assets', '[]'::jsonb) end else coalesce((select jsonb_agg(jsonb_build_object('media_type', option_asset.media_type, 'storage_path', option_asset.storage_path, 'public_url', option_asset.metadata->>'public_url', 'metadata', option_asset.metadata) order by option_asset.source_page, option_asset.id) from public.learning_enem_media_assets option_asset where option_asset.occurrence_id = attempt_question.occurrence_id and option_asset.quality_state = 'VALIDATED' and option_asset.metadata->>'asset_role' = 'OPTION_' || chr(64 + option_item.ordinality::integer)), '[]'::jsonb) end
        ) order by option_item.ordinality) from jsonb_array_elements(coalesce(structured.alternatives_json, question_bank.options)) with ordinality option_item(option_value, ordinality)), '[]'::jsonb),
        'source_year', question_bank.source_year,
        'question_number', case when question_bank.source_type = 'ENEM_STRUCTURED_PROVIDER' then null else question_bank.source_number end,
        'metadata', question_bank.metadata - 'official_answer_letter' - 'correct_answer' - 'provider_answer_letter',
        'statement_assets', case when structured.id is not null then '[]'::jsonb else coalesce((select jsonb_agg(jsonb_build_object('media_type', statement_asset.media_type, 'storage_path', statement_asset.storage_path, 'public_url', statement_asset.metadata->>'public_url', 'metadata', statement_asset.metadata) order by statement_asset.source_page, statement_asset.id) from public.learning_enem_media_assets statement_asset where statement_asset.occurrence_id = attempt_question.occurrence_id and statement_asset.quality_state = 'VALIDATED' and coalesce(statement_asset.metadata->>'asset_role', 'STATEMENT') = 'STATEMENT'), '[]'::jsonb) end
      ) order by attempt_question.position)
      from public.learning_simulation_attempt_questions attempt_question
      join public.learning_question_bank question_bank on question_bank.id = attempt_question.question_bank_id
      left join lateral (
        select structured_row.*
        from public.learning_enem_structured_content structured_row
        where structured_row.content_revision = attempt_row.content_revision
          and (
            structured_row.id = attempt_question.structured_content_id
            or (attempt_question.structured_content_id is null and structured_row.occurrence_id = attempt_question.occurrence_id)
          )
          and structured_row.verification_status = 'VERIFIED'
        order by case when structured_row.id = attempt_question.structured_content_id then 0 else 1 end, structured_row.updated_at desc
        limit 1
      ) structured on true
      where attempt_question.attempt_id = attempt_row.id
    ), '[]'::jsonb)
  );
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
  select attempt.* into attempt_row from public.learning_simulation_attempts attempt where attempt.id = p_attempt_id and exists (select 1 from public.students student where student.id = attempt.student_id and student.profile_id = auth.uid() and student.active);
  if not found then raise exception 'ENEM_SIMULATION_ATTEMPT_SCOPE_DENIED'; end if;
  if attempt_row.status = 'COMPLETED' then return jsonb_build_object('attempt_id', attempt_row.id, 'score', attempt_row.score, 'correct_count', attempt_row.correct_count, 'total_questions', attempt_row.total_questions, 'answers', attempt_row.answers - '__language_choice', 'area_breakdown', attempt_row.area_breakdown, 'skill_breakdown', attempt_row.skill_breakdown); end if;
  if jsonb_typeof(coalesce(p_answers, '[]'::jsonb)) <> 'array' then raise exception 'ENEM_SIMULATION_ANSWERS_INVALID'; end if;
  for answer_item in select item from jsonb_array_elements(p_answers) item loop
    if answer_item->>'question_bank_id' is null or not exists (select 1 from public.learning_simulation_attempt_questions item_question where item_question.attempt_id = attempt_row.id and item_question.question_bank_id = (answer_item->>'question_bank_id')::uuid) or answer_item->>'answer' not in ('A', 'B', 'C', 'D', 'E') then raise exception 'ENEM_SIMULATION_ANSWERS_INVALID'; end if;
  end loop;

  for question_row in
    select attempt_question.position, question_bank.id, coalesce(structured.provider_correct_alternative, question_bank.metadata->>'official_answer_letter') as expected_answer, question_bank.subject_area, question_bank.metadata, link.canonical_skill_id
    from public.learning_simulation_attempt_questions attempt_question
    join public.learning_question_bank question_bank on question_bank.id = attempt_question.question_bank_id
    left join public.learning_enem_structured_content structured on structured.id = attempt_question.structured_content_id
    left join public.learning_question_bank_skill_links link on link.question_bank_id = question_bank.id and link.skill_role = 'PRIMARY'
    where attempt_question.attempt_id = attempt_row.id
    order by attempt_question.position
  loop
    v_total_count := v_total_count + 1;
    select item into answer_item from jsonb_array_elements(p_answers) item where item->>'question_bank_id' = question_row.id::text limit 1;
    v_correct := answer_item is not null and question_row.expected_answer = answer_item->>'answer';
    if v_correct then v_correct_count := v_correct_count + 1; end if;
    answer_map := answer_map || jsonb_build_object(question_row.id::text, jsonb_build_object('answer', coalesce(answer_item->'answer', 'null'::jsonb), 'is_correct', v_correct));
    v_area := coalesce(question_row.metadata->>'enem_area', question_row.subject_area, 'ENEM');
    v_area_current := coalesce(v_area_breakdown->v_area, '{"correct":0,"total":0}'::jsonb);
    v_area_breakdown := jsonb_set(v_area_breakdown, array[v_area], jsonb_build_object('correct', (v_area_current->>'correct')::integer + case when v_correct then 1 else 0 end, 'total', (v_area_current->>'total')::integer + 1), true);
    v_skill := question_row.canonical_skill_id::text;
    if question_row.canonical_skill_id is not null then
      v_skill_current := coalesce(v_skill_breakdown->v_skill, '{"correct":0,"total":0}'::jsonb);
      v_skill_breakdown := jsonb_set(v_skill_breakdown, array[v_skill], jsonb_build_object('correct', (v_skill_current->>'correct')::integer + case when v_correct then 1 else 0 end, 'total', (v_skill_current->>'total')::integer + 1), true);
      insert into public.learning_skill_evidence(institution_id, student_id, canonical_skill_id, source, correct, score, metadata) values (attempt_row.institution_id, attempt_row.student_id, question_row.canonical_skill_id, 'SIMULATION', v_correct, case when v_correct then 100 else 0 end, jsonb_build_object('simulation_attempt_id', attempt_row.id, 'question_bank_id', question_row.id));
      perform private.refresh_learning_student_skill_state(attempt_row.institution_id, attempt_row.student_id, question_row.canonical_skill_id);
    end if;
    if not v_correct then
      insert into public.learning_error_notebook(institution_id, student_id, question_bank_id, canonical_skill_id) values (attempt_row.institution_id, attempt_row.student_id, question_row.id, question_row.canonical_skill_id)
      on conflict (student_id, question_bank_id) where question_bank_id is not null do update set error_count = public.learning_error_notebook.error_count + 1, last_missed_at = now(), status = 'OPEN', canonical_skill_id = coalesce(public.learning_error_notebook.canonical_skill_id, excluded.canonical_skill_id);
    end if;
  end loop;

  v_score := case when v_total_count = 0 then 0 else round(v_correct_count * 100.0 / v_total_count)::integer end;
  update public.learning_simulation_attempts set status = 'COMPLETED', completed_at = now(), duration_seconds = coalesce(p_duration_seconds, duration_seconds), score = v_score, correct_count = v_correct_count, total_questions = v_total_count, area_breakdown = v_area_breakdown, skill_breakdown = v_skill_breakdown, answers = answer_map, updated_at = now() where id = attempt_row.id;
  perform private.award_learning_xp(attempt_row.institution_id, attempt_row.student_id, 'simulation:' || attempt_row.id::text, 'SIMULATION', 20);
  return jsonb_build_object('attempt_id', attempt_row.id, 'score', v_score, 'correct_count', v_correct_count, 'total_questions', v_total_count, 'answers', answer_map, 'area_breakdown', v_area_breakdown, 'skill_breakdown', v_skill_breakdown);
end;
$$;

revoke all on function public.start_enem_simulation_attempt_v2(uuid, uuid, uuid, text) from public, anon;
revoke all on function public.get_enem_simulation_attempt_v2(uuid) from public, anon;
revoke all on function public.submit_enem_simulation_attempt_v2(uuid, jsonb, integer) from public, anon;
grant execute on function public.start_enem_simulation_attempt_v2(uuid, uuid, uuid, text) to authenticated;
grant execute on function public.get_enem_simulation_attempt_v2(uuid) to authenticated, service_role;
grant execute on function public.submit_enem_simulation_attempt_v2(uuid, jsonb, integer) to authenticated;

notify pgrst, 'reload schema';
commit;
