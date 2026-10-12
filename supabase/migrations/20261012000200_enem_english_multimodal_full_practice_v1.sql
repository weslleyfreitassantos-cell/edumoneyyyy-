begin;

-- Use the existing, verified official-occurrence pool alongside verified
-- text-only provider items for the English subject practice.
create or replace function private.enem_ready_english_practice_questions_v1()
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
      ready.question_id,
      null::uuid as occurrence_id,
      ready.structured_content_id,
      ready.language,
      ready.source_kind,
      jsonb_build_array(
        structured.source_exam,
        structured.source_application,
        structured.provider_year,
        structured.source_day,
        structured.source_booklet,
        structured.source_booklet_color,
        structured.source_question_number
      )::text as source_identity,
      nullif(structured.normalized_content_hash, '') as content_fingerprint,
      0 as source_priority
    from private.enem_ready_questions(null, 'INGLES', 'ENGLISH') ready
    join public.learning_enem_structured_content structured
      on structured.id = ready.structured_content_id
    where ready.source_kind = 'STRUCTURED_PROVIDER'
      and ready.occurrence_id is null
      and structured.source_kind = 'STRUCTURED_PROVIDER'
      and structured.content_acceptance_status = 'ACCEPTED'
      and structured.verification_status = 'VERIFIED'
      and structured.content_revision = private.current_enem_content_revision()
      and structured.source_exam = 'ENEM'
      and structured.source_application in ('REGULAR', 'PPL')
      and structured.source_question_number is not null
      and structured.source_provider = 'xequemat'
      and structured.rights_status = 'VERIFIED'
      and not structured.required_media_present
      and not exists (
        select 1
        from jsonb_array_elements(structured.content_blocks_json) block
        where block->>'kind' = 'IMAGE'
          and jsonb_typeof(block->'media') = 'array'
          and jsonb_array_length(block->'media') > 0
      )

    union all

    select
      ready.question_id,
      occurrence.id,
      null::uuid as structured_content_id,
      occurrence.language,
      ready.source_kind,
      jsonb_build_array(
        occurrence.exam,
        occurrence.application,
        occurrence.year,
        occurrence.day,
        occurrence.booklet,
        occurrence.metadata->>'booklet_color',
        occurrence.question_number
      )::text as source_identity,
      nullif(occurrence.canonical_fingerprint, '') as content_fingerprint,
      1 as source_priority
    from private.enem_ready_questions(null, 'INGLES', 'ENGLISH') ready
    join public.learning_enem_official_occurrences occurrence
      on occurrence.id = ready.occurrence_id
    join public.learning_question_bank question_bank
      on question_bank.id = ready.question_id
    where ready.source_kind = 'OFFICIAL_OCCURRENCE'
      and ready.occurrence_id is not null
      and ready.structured_content_id is null
      and occurrence.language = 'ENGLISH'
      and occurrence.exam = 'ENEM'
      and occurrence.application in ('REGULAR', 'PPL')
      and occurrence.year between 2009 and 2025
      and occurrence.question_number is not null
      and occurrence.exam_url is not null
      and occurrence.official_answer in ('A', 'B', 'C', 'D', 'E')
      and question_bank.metadata->>'official_answer_letter' = occurrence.official_answer
      and question_bank.metadata->>'render_mode' = 'VISUAL_OPTIONS'
      and exists (
        select 1
        from public.learning_enem_media_assets statement_asset
        where statement_asset.occurrence_id = occurrence.id
          and statement_asset.quality_state = 'VALIDATED'
          and coalesce(statement_asset.metadata->>'asset_role', 'STATEMENT') = 'STATEMENT'
          and (
            (statement_asset.storage_path ~* '^https?://')
            or (
              statement_asset.storage_path is not null
              and exists (
                select 1
                from storage.objects object
                where object.bucket_id = 'enem-question-assets'
                  and object.name = statement_asset.storage_path
              )
            )
            or (
              statement_asset.storage_path is null
              and statement_asset.metadata->>'public_url' ~* '^https?://'
            )
          )
      )
      and (
        select count(distinct option_asset.metadata->>'option_label')
        from public.learning_enem_media_assets option_asset
        where option_asset.occurrence_id = occurrence.id
          and option_asset.quality_state = 'VALIDATED'
          and option_asset.metadata->>'asset_role' in ('OPTION_A', 'OPTION_B', 'OPTION_C', 'OPTION_D', 'OPTION_E')
          and option_asset.metadata->>'option_label' in ('A', 'B', 'C', 'D', 'E')
          and option_asset.metadata->>'asset_role' = 'OPTION_' || (option_asset.metadata->>'option_label')
          and (
            option_asset.storage_path ~* '^https?://'
            or (
              option_asset.storage_path is not null
              and exists (
                select 1
                from storage.objects object
                where object.bucket_id = 'enem-question-assets'
                  and object.name = option_asset.storage_path
              )
            )
            or (
              option_asset.storage_path is null
              and option_asset.metadata->>'public_url' ~* '^https?://'
            )
          )
      ) = 5
      and not exists (
        select 1
        from public.learning_enem_media_assets required_asset
        where required_asset.occurrence_id = occurrence.id
          and required_asset.quality_state = 'VALIDATED'
          and (
            coalesce(required_asset.metadata->>'asset_role', 'STATEMENT') = 'STATEMENT'
            or required_asset.metadata->>'asset_role' in ('OPTION_A', 'OPTION_B', 'OPTION_C', 'OPTION_D', 'OPTION_E')
          )
          and not (
            required_asset.storage_path ~* '^https?://'
            or (
              required_asset.storage_path is not null
              and exists (
                select 1
                from storage.objects object
                where object.bucket_id = 'enem-question-assets'
                  and object.name = required_asset.storage_path
              )
            )
            or (
              required_asset.storage_path is null
              and required_asset.metadata->>'public_url' ~* '^https?://'
            )
          )
      )
  )
  select
    candidate.question_id,
    candidate.occurrence_id,
    candidate.structured_content_id,
    candidate.language,
    candidate.source_kind
  from candidates candidate
  where not exists (
    select 1
    from candidates earlier
    where (
       earlier.question_id = candidate.question_id
       or earlier.source_identity = candidate.source_identity
      or (
        earlier.content_fingerprint is not null
        and earlier.content_fingerprint = candidate.content_fingerprint
      )
    )
       and (
         earlier.source_priority,
         earlier.question_id,
         earlier.source_identity,
         coalesce(earlier.occurrence_id::text, ''),
         coalesce(earlier.structured_content_id::text, '')
       ) < (
         candidate.source_priority,
         candidate.question_id,
         candidate.source_identity,
         coalesce(candidate.occurrence_id::text, ''),
         coalesce(candidate.structured_content_id::text, '')
       )
  )
  order by candidate.question_id;
$$;

revoke all on function private.enem_ready_english_practice_questions_v1() from public, anon, authenticated;
grant execute on function private.enem_ready_english_practice_questions_v1() to service_role;

create or replace function public.list_enem_simulation_templates_v2(p_institution_id uuid)
returns table(
  id uuid,
  title text,
  simulation_type text,
  area text,
  subject text,
  subject_code text,
  question_count integer,
  duration_minutes integer,
  available_count integer,
  ready_count integer,
  availability_status text,
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
          (select count(*)::integer from private.enem_ready_english_practice_questions_v1())
        when template.metadata->>'enem_mode' = 'SUBJECT' and template.metadata->>'enem_subject' = 'ESPANHOL' then
          (select count(*)::integer from private.enem_ready_provider_text_questions(null, 'ESPANHOL', 'SPANISH'))
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
  select counts.id,
         counts.title,
         counts.simulation_type,
         counts.area,
         counts.metadata->>'enem_subject',
         counts.metadata->>'enem_subject',
         case
           when counts.metadata->>'enem_mode' = 'SUBJECT'
            and counts.metadata->>'enem_subject' = 'INGLES'
            and counts.pool_count > 0
             then least(counts.question_count, counts.pool_count)
           else counts.question_count
         end::integer,
         counts.duration_minutes,
         counts.pool_count,
         counts.pool_count,
         case
           when counts.metadata->>'enem_mode' = 'SUBJECT'
            and counts.metadata->>'enem_subject' = 'INGLES'
            and counts.pool_count > 0 then 'AVAILABLE'
           when counts.pool_count >= counts.question_count then 'AVAILABLE'
           else 'INSUFFICIENT'
         end,
         counts.available_languages,
         case
           when counts.metadata->>'enem_mode' = 'SUBJECT'
            and counts.metadata->>'enem_subject' = 'INGLES'
             then counts.metadata || jsonb_build_object(
               'planned_question_count', counts.question_count,
               'reduced_practice', counts.pool_count > 0 and counts.pool_count < counts.question_count
             )
           else counts.metadata
         end
    from counts
   where (counts.metadata->>'enem_mode' = 'SUBJECT'
          and counts.metadata->>'enem_subject' = 'INGLES')
      or counts.pool_count >= counts.question_count
   order by case when counts.metadata->>'enem_mode' = 'AREA' then 0 else 1 end, counts.title;
$$;

revoke all on function public.list_enem_simulation_templates_v2(uuid) from public, anon;
grant execute on function public.list_enem_simulation_templates_v2(uuid) to authenticated;

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
begin
  select simulation.* into simulation_row
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
    select 1 from public.students student
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

  select attempt.* into existing_attempt
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

  select count(distinct question_id)::integer into available_count
    from private.enem_ready_english_practice_questions_v1();
  requested_count := least(simulation_row.question_count, available_count);
  if requested_count < 1 then
    raise exception 'ENEM_PROVIDER_TEXT_POOL_INSUFFICIENT';
  end if;

  for question_row in
    select ready.*
      from private.enem_ready_english_practice_questions_v1() ready
     order by random()
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
    select attempt.* into existing_attempt
      from public.learning_simulation_attempts attempt
     where attempt.simulation_id = p_simulation_id
       and attempt.student_id = p_student_id
       and attempt.status = 'IN_PROGRESS'
       and attempt.content_revision = private.current_enem_content_revision()
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

revoke all on function public.start_enem_simulation_attempt_v3(uuid, uuid, uuid, text)
  from public, anon;
grant execute on function public.start_enem_simulation_attempt_v3(uuid, uuid, uuid, text)
  to authenticated;

create or replace function private.validate_enem_attempt_question_snapshot()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  attempt_revision text;
  attempt_enem_mode text;
  attempt_enem_subject text;
  occurrence_question_id uuid;
  structured_question_id uuid;
begin
  select attempt.content_revision,
         simulation.metadata->>'enem_mode',
         simulation.metadata->>'enem_subject'
    into attempt_revision, attempt_enem_mode, attempt_enem_subject
    from public.learning_simulation_attempts attempt
    join public.learning_simulations simulation on simulation.id = attempt.simulation_id
   where attempt.id = new.attempt_id;

  if attempt_revision is null then
    raise exception 'ENEM_ATTEMPT_SNAPSHOT_SOURCE_REQUIRED';
  end if;

  if attempt_revision = private.current_enem_content_revision() then
    if attempt_enem_mode = 'SUBJECT' and attempt_enem_subject = 'INGLES' then
      if not exists (
        select 1
        from private.enem_ready_english_practice_questions_v1() ready
        where ready.question_id = new.question_bank_id
          and ready.occurrence_id is not distinct from new.occurrence_id
          and ready.structured_content_id is not distinct from new.structured_content_id
      ) then
        raise exception 'ENEM_ATTEMPT_SNAPSHOT_STRUCTURED_CONTENT_MISMATCH';
      end if;
    else
      if new.occurrence_id is not null or new.structured_content_id is null then
        raise exception 'ENEM_ATTEMPT_SNAPSHOT_SOURCE_REQUIRED';
      end if;

      select ready.question_id
        into structured_question_id
        from private.enem_ready_provider_text_questions(null, null, null) ready
       where ready.question_id = new.question_bank_id
         and ready.structured_content_id = new.structured_content_id
         and ready.source_kind = 'STRUCTURED_PROVIDER';

      if structured_question_id is null then
        raise exception 'ENEM_ATTEMPT_SNAPSHOT_STRUCTURED_CONTENT_MISMATCH';
      end if;
    end if;
  else
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
  end if;

  return new;
end;
$$;

create or replace function private.snapshot_enem_question_source_reference()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(new.source_reference_snapshot, '{}'::jsonb) = '{}'::jsonb then
    select jsonb_build_object(
      'source_year', coalesce(occurrence.year, structured.provider_year, question_bank.source_year),
      'source_exam', coalesce(occurrence.exam, structured.source_exam, question_bank.source_exam),
      'source_application', coalesce(occurrence.application, structured.source_application, question_bank.source_application),
      'source_question_number', coalesce(occurrence.question_number, structured.source_question_number, question_bank.source_question_number, question_bank.source_number),
      'source_day', coalesce(occurrence.day, structured.source_day, question_bank.source_day),
      'source_booklet', coalesce(occurrence.booklet, structured.source_booklet),
      'source_booklet_color', coalesce(occurrence.metadata->>'booklet_color', occurrence.metadata->>'source_booklet_color', structured.source_booklet_color),
      'source_url', coalesce(occurrence.exam_url, structured.source_url, question_bank.source_url, question_bank.source_reference),
      'source_provider', coalesce(occurrence.metadata->>'source_provider', structured.source_provider, question_bank.source_provider, question_bank.source_name)
    )
      into new.source_reference_snapshot
      from public.learning_question_bank question_bank
      left join public.learning_enem_structured_content structured
        on structured.id = new.structured_content_id
      left join public.learning_enem_official_occurrences occurrence
        on occurrence.id = new.occurrence_id
     where question_bank.id = new.question_bank_id;
  end if;
  return new;
end;
$$;

notify pgrst, 'reload schema';
commit;
