begin;

create or replace function private.enem_english_normalized_options_v1(p_options jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'letter', coalesce(option_item.value->>'letter', option_item.value->>'label', chr(64 + option_item.ordinality::integer)),
    'text', case
      when jsonb_typeof(option_item.value) = 'string' then option_item.value #>> '{}'
      else option_item.value->>'text'
    end,
    'assets', case
      when not (option_item.value ? 'assets') then '[]'::jsonb
      when jsonb_typeof(option_item.value->'assets') = 'array' then option_item.value->'assets'
      else jsonb_build_array(option_item.value->'assets')
    end
  ) order by option_item.ordinality), '[]'::jsonb)
  from jsonb_array_elements(case when jsonb_typeof(p_options) = 'array' then p_options else '[]'::jsonb end)
    with ordinality option_item(value, ordinality);
$$;

revoke all on function private.enem_english_normalized_options_v1(jsonb) from public, anon, authenticated;
grant execute on function private.enem_english_normalized_options_v1(jsonb) to postgres, supabase_admin, service_role;

-- Promote only parser-verified, text-only INEP occurrences into the existing
-- structured-content model. The official bank, answer key, assets and attempts
-- remain untouched; source hashes bind each addition to the exact PDF.
with approved_source(
  occurrence_id,
  question_bank_id,
  year,
  day,
  booklet,
  question_number,
  answer,
  source_sha256,
  statement_sha256,
  options_sha256,
  content_sha256
) as (
  values
    (
      '0893d147-1e92-4e04-a30d-33297280aba5'::uuid,
      '05db47d0-22b0-4328-b3d8-47317bfe7b99'::uuid,
      2024, 'D1', 'CD1', 1, 'C',
      'b0adc1dc79a002aba36f725f1ef792cf53e47ff75ee012638ef34a4e6fbb18f5',
      '66fce0420789057b6280c8aa294f0dd489edb92e34c5f35164115f3c9d909871',
      '566a9f037c4d0dff88da373a5b7758ca1d650ef1bd40821c2ea8824d702b72ea',
      '4d70df404e48879cab35409d232b3fbba6008223666b460a58a1001203345728'
    ),
    (
      '19cf509d-26a4-4cbc-b461-08d6abeb7d71'::uuid,
      '4db75a73-f90e-458a-8987-5100766a9515'::uuid,
      2025, 'D1', 'CD1', 1, 'D',
      'a0f19f878d4ef3ba94c3e0f5ef9e57c13fb046d4bb362f72651898b473ddb7c8',
      'e554b55006fe637bd2a787214a2aa18d78fa86de7fa48ef882cef9d9eb779be4',
      '8130047c0414d028f275a70c759e23468493bd8780bb28e76c94206d871d6677',
      '829c70900890d822046eb2b900f6490c1d3084377fb6494c96c2d6bb6c86f128'
    )
), verified_source as (
  select approved_source.*, question_bank.statement, question_bank.options, occurrence.exam_url,
         question_bank.metadata
  from approved_source
  join public.learning_enem_official_occurrences occurrence
    on occurrence.id = approved_source.occurrence_id
   and occurrence.question_bank_id = approved_source.question_bank_id
   and occurrence.year = approved_source.year
   and occurrence.exam = 'ENEM'
   and occurrence.application = 'REGULAR'
   and occurrence.day = approved_source.day
   and occurrence.booklet = approved_source.booklet
   and occurrence.question_number = approved_source.question_number
   and occurrence.language = 'ENGLISH'
   and occurrence.official_answer = approved_source.answer
   and occurrence.artifact_sha256 = approved_source.source_sha256
  join public.learning_question_bank question_bank
    on question_bank.id = occurrence.question_bank_id
   and question_bank.active
   and question_bank.package_type = 'ENEM'
   and question_bank.source_type = 'ENEM_OFFICIAL'
   and question_bank.metadata->>'source_integrity' = 'VERIFIED'
   and question_bank.metadata->>'statement_integrity' = 'VERIFIED'
   and question_bank.metadata->>'text_options_integrity' = 'VERIFIED'
   and question_bank.metadata->>'options_integrity' = 'VERIFIED'
   and question_bank.metadata->>'render_ready' = 'true'
   and question_bank.metadata->>'area_verified' = 'true'
   and question_bank.metadata->>'subject_verified' = 'true'
   and question_bank.metadata->>'official_answer_letter' = approved_source.answer
   and question_bank.metadata->'source_provenance'->>'source_sha256' = approved_source.source_sha256
   and (question_bank.metadata->>'control_char_count')::integer = 0
   and encode(extensions.digest(convert_to(question_bank.statement, 'UTF8'), 'sha256'), 'hex')
       = approved_source.statement_sha256
   and encode(extensions.digest(convert_to((
         select string_agg(
           (option_item.value->>'letter') || ':' || (option_item.value->>'text'),
           E'\n' order by option_item.ordinality
         )
         from jsonb_array_elements(private.enem_english_normalized_options_v1(question_bank.options))
           with ordinality option_item(value, ordinality)
       ), 'UTF8'), 'sha256'), 'hex') = approved_source.options_sha256
   and jsonb_typeof(question_bank.options) = 'array'
   and jsonb_array_length(question_bank.options) = 5
   and not exists (
     select 1
     from jsonb_array_elements(private.enem_english_normalized_options_v1(question_bank.options))
       with ordinality option_item(value, ordinality)
     where option_item.value->>'letter' <> chr(64 + option_item.ordinality::integer)
        or nullif(btrim(option_item.value->>'text'), '') is null
        or option_item.value->>'text' ~ '[[:cntrl:]]'
        or jsonb_array_length(option_item.value->'assets') > 0
   )
)
insert into public.learning_enem_structured_content(
  provider, provider_question_key, question_bank_id, occurrence_id, provider_year, provider_index,
  discipline, language, context_text, prompt_text, alternatives_json, provider_correct_alternative,
  essential_media_json, raw_hash, normalized_content_hash, match_method, match_level, match_confidence,
  verification_status, content_revision, render_mode, source_mapping_verified, answer_verified,
  structured_content_integrity, statement_complete, five_alternatives_complete, no_control_chars,
  no_previous_question_contamination, no_next_question_contamination, required_media_present,
  required_media_validated, source_metadata, content_blocks_json, source_exam, source_application,
  source_question_number, source_day, source_url, source_provider, rights_status, source_kind,
  content_acceptance_status
)
select
  'INEP_OFFICIAL_PDF_PARSE',
  'inep:' || verified_source.year || ':' || verified_source.day || ':' || verified_source.booklet || ':' || verified_source.question_number || ':ENGLISH',
  verified_source.question_bank_id,
  verified_source.occurrence_id,
  verified_source.year,
  verified_source.question_number,
  'linguagens',
  'ENGLISH',
  verified_source.statement,
  '',
  private.enem_english_normalized_options_v1(verified_source.options),
  verified_source.answer,
  '[]'::jsonb,
  verified_source.source_sha256,
  verified_source.content_sha256,
  'INEP_OFFICIAL_PDF_TEXT_PARSE',
  'EXACT',
  1.0,
  'VERIFIED',
  private.current_enem_content_revision(),
  'STRUCTURED_TEXT',
  true,
  true,
  'VERIFIED',
  true,
  true,
  true,
  true,
  true,
  false,
  false,
  jsonb_build_object(
    'evidence_method', 'INEP_OFFICIAL_PDF_PARSE',
    'evidence_revision', 'official-text-layout-v1',
    'source_sha256', verified_source.source_sha256,
    'statement_sha256', verified_source.statement_sha256,
    'options_sha256', verified_source.options_sha256,
    'media_status', 'NOT_DETECTED',
    'source_integrity', 'VERIFIED',
    'statement_integrity', 'VERIFIED',
    'options_integrity', 'VERIFIED',
    'text_options_integrity', 'VERIFIED',
    'official_answer', verified_source.answer
  ),
  '[]'::jsonb,
  'ENEM',
  'REGULAR',
  verified_source.question_number,
  verified_source.day,
  verified_source.exam_url,
  'INEP',
  'VERIFIED',
  'OFFICIAL_OCCURRENCE',
  'ACCEPTED'
from verified_source
on conflict (provider, provider_question_key, content_revision) do nothing;

do $$
declare
  source_count integer;
  verified_count integer;
begin
  select count(*)::integer into source_count
  from public.learning_enem_official_occurrences occurrence
  where occurrence.id in (
    '0893d147-1e92-4e04-a30d-33297280aba5',
    '19cf509d-26a4-4cbc-b461-08d6abeb7d71'
  );

  if source_count not in (0, 2) then
    raise exception 'ENEM_ENGLISH_TEXT_SOURCE_SET_INCOMPLETE';
  end if;

  if source_count = 2 then
    with expected(occurrence_id, question_bank_id, provider_question_key, source_sha256, statement_sha256, options_sha256, content_sha256, answer) as (
      values
        (
          '0893d147-1e92-4e04-a30d-33297280aba5'::uuid,
          '05db47d0-22b0-4328-b3d8-47317bfe7b99'::uuid,
          'inep:2024:D1:CD1:1:ENGLISH',
          'b0adc1dc79a002aba36f725f1ef792cf53e47ff75ee012638ef34a4e6fbb18f5',
          '66fce0420789057b6280c8aa294f0dd489edb92e34c5f35164115f3c9d909871',
          '566a9f037c4d0dff88da373a5b7758ca1d650ef1bd40821c2ea8824d702b72ea',
          '4d70df404e48879cab35409d232b3fbba6008223666b460a58a1001203345728',
          'C'
        ),
        (
          '19cf509d-26a4-4cbc-b461-08d6abeb7d71'::uuid,
          '4db75a73-f90e-458a-8987-5100766a9515'::uuid,
          'inep:2025:D1:CD1:1:ENGLISH',
          'a0f19f878d4ef3ba94c3e0f5ef9e57c13fb046d4bb362f72651898b473ddb7c8',
          'e554b55006fe637bd2a787214a2aa18d78fa86de7fa48ef882cef9d9eb779be4',
          '8130047c0414d028f275a70c759e23468493bd8780bb28e76c94206d871d6677',
          '829c70900890d822046eb2b900f6490c1d3084377fb6494c96c2d6bb6c86f128',
          'D'
        )
    )
    select count(*)::integer into verified_count
    from expected
    join public.learning_enem_structured_content structured
      on structured.provider = 'INEP_OFFICIAL_PDF_PARSE'
     and structured.provider_question_key = expected.provider_question_key
     and structured.occurrence_id = expected.occurrence_id
     and structured.question_bank_id = expected.question_bank_id
    join public.learning_enem_official_occurrences occurrence
      on occurrence.id = expected.occurrence_id
     and occurrence.official_answer = expected.answer
    join public.learning_question_bank question_bank
      on question_bank.id = expected.question_bank_id
    where structured.content_revision = private.current_enem_content_revision()
      and structured.raw_hash = expected.source_sha256
      and structured.normalized_content_hash = expected.content_sha256
      and structured.source_kind = 'OFFICIAL_OCCURRENCE'
      and structured.content_acceptance_status = 'ACCEPTED'
      and structured.verification_status = 'VERIFIED'
      and structured.structured_content_integrity = 'VERIFIED'
      and structured.render_mode = 'STRUCTURED_TEXT'
      and structured.context_text = question_bank.statement
      and structured.prompt_text = ''
      and structured.alternatives_json = private.enem_english_normalized_options_v1(question_bank.options)
      and structured.source_metadata->>'source_sha256' = expected.source_sha256
      and structured.source_metadata->>'statement_sha256' = expected.statement_sha256
      and structured.source_metadata->>'options_sha256' = expected.options_sha256
      and structured.source_metadata->>'media_status' = 'NOT_DETECTED';

    if verified_count <> 2 then
      raise exception 'ENEM_ENGLISH_TEXT_SOURCE_VERIFICATION_FAILED';
    end if;
  end if;
end;
$$;

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
  with ready_questions as materialized (
    select ready.*
    from private.enem_ready_questions(null, 'INGLES', 'ENGLISH') ready
  ), trusted_text_questions as (
    select ready.*,
      case when ready.source_kind = 'STRUCTURED_PROVIDER' then 0 else 1 end as source_priority
    from ready_questions ready
    where ready.structured_content_id is not null
      and (
        (
          ready.source_kind = 'STRUCTURED_PROVIDER'
          and ready.occurrence_id is null
        )
        or (
          ready.source_kind = 'OFFICIAL_OCCURRENCE'
          and ready.occurrence_id is not null
          and exists (
            select 1
            from public.learning_enem_structured_content structured_row
            join public.learning_enem_official_occurrences occurrence
              on occurrence.id = structured_row.occurrence_id
            join public.learning_question_bank question_bank
              on question_bank.id = structured_row.question_bank_id
            where structured_row.id = ready.structured_content_id
              and structured_row.occurrence_id = ready.occurrence_id
              and structured_row.question_bank_id = ready.question_id
              and structured_row.source_kind = 'OFFICIAL_OCCURRENCE'
              and structured_row.content_acceptance_status = 'ACCEPTED'
              and structured_row.content_revision = private.current_enem_content_revision()
              and structured_row.verification_status = 'VERIFIED'
              and structured_row.structured_content_integrity = 'VERIFIED'
              and structured_row.statement_complete
              and structured_row.five_alternatives_complete
              and structured_row.no_control_chars
              and structured_row.no_previous_question_contamination
              and structured_row.no_next_question_contamination
              and not structured_row.required_media_present
              and structured_row.required_media_validated = false
              and structured_row.render_mode = 'STRUCTURED_TEXT'
              and structured_row.source_mapping_verified
              and structured_row.answer_verified
              and structured_row.language = 'ENGLISH'
              and structured_row.context_text = question_bank.statement
              and structured_row.prompt_text = ''
              and structured_row.provider_correct_alternative = occurrence.official_answer
              and structured_row.source_metadata->>'evidence_method' = 'INEP_OFFICIAL_PDF_PARSE'
              and structured_row.source_metadata->>'media_status' = 'NOT_DETECTED'
              and structured_row.source_metadata->>'source_sha256' = occurrence.artifact_sha256
              and structured_row.source_metadata->>'source_sha256' = question_bank.metadata->'source_provenance'->>'source_sha256'
              and structured_row.source_metadata->>'statement_sha256' = encode(extensions.digest(convert_to(question_bank.statement, 'UTF8'), 'sha256'), 'hex')
              and structured_row.normalized_content_hash = encode(extensions.digest(convert_to(question_bank.statement || E'\n' || (
                select string_agg(
                  (option_item.value->>'letter') || ':' || (option_item.value->>'text'),
                  E'\n' order by option_item.ordinality
                )
                from jsonb_array_elements(private.enem_english_normalized_options_v1(question_bank.options))
                  with ordinality option_item(value, ordinality)
              ), 'UTF8'), 'sha256'), 'hex')
              and structured_row.source_metadata->>'options_sha256' = encode(extensions.digest(convert_to((
                select string_agg(
                  (option_item.value->>'letter') || ':' || (option_item.value->>'text'),
                  E'\n' order by option_item.ordinality
                )
                from jsonb_array_elements(private.enem_english_normalized_options_v1(question_bank.options))
                  with ordinality option_item(value, ordinality)
              ), 'UTF8'), 'sha256'), 'hex')
              and jsonb_array_length(structured_row.alternatives_json) = 5
              and structured_row.alternatives_json = private.enem_english_normalized_options_v1(question_bank.options)
              and not exists (
                select 1
                from jsonb_array_elements(structured_row.alternatives_json) with ordinality option_item(value, ordinality)
                where option_item.value->>'letter' <> chr(64 + option_item.ordinality::integer)
                  or nullif(btrim(option_item.value->>'text'), '') is null
                  or option_item.value->>'text' ~ '[[:cntrl:]]'
                  or coalesce(jsonb_array_length(option_item.value->'assets'), 0) > 0
              )
              and not exists (
                select 1
                from jsonb_array_elements(structured_row.content_blocks_json) block
                where block->>'kind' = 'IMAGE'
                  and jsonb_typeof(block->'media') = 'array'
                  and jsonb_array_length(block->'media') > 0
              )
          )
        )
      )
  )
  select distinct on (trusted.question_id)
    trusted.question_id,
    trusted.occurrence_id,
    trusted.structured_content_id,
    trusted.language,
    trusted.source_kind
  from trusted_text_questions trusted
  order by trusted.question_id, trusted.source_priority, trusted.structured_content_id nulls last, trusted.occurrence_id nulls last;
$$;

revoke all on function private.enem_ready_english_practice_questions_v1() from public, anon, authenticated;
grant execute on function private.enem_ready_english_practice_questions_v1() to service_role;

create or replace function private.validate_enem_english_text_snapshot_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  attempt_revision text;
  attempt_subject text;
begin
  select attempt.content_revision, simulation.metadata->>'enem_subject'
    into attempt_revision, attempt_subject
  from public.learning_simulation_attempts attempt
  join public.learning_simulations simulation on simulation.id = attempt.simulation_id
  where attempt.id = new.attempt_id;

  if attempt_revision <> private.current_enem_content_revision()
     or attempt_subject <> 'INGLES'
     or new.occurrence_id is null
     or new.structured_content_id is null then
    return new;
  end if;

  if not exists (
    select 1
    from public.learning_enem_structured_content structured
    join public.learning_enem_official_occurrences occurrence
      on occurrence.id = structured.occurrence_id
    join public.learning_question_bank question_bank
      on question_bank.id = structured.question_bank_id
    where structured.id = new.structured_content_id
      and structured.occurrence_id = new.occurrence_id
      and structured.question_bank_id = new.question_bank_id
      and structured.content_revision = attempt_revision
      and structured.source_kind = 'OFFICIAL_OCCURRENCE'
      and structured.content_acceptance_status = 'ACCEPTED'
      and structured.verification_status = 'VERIFIED'
      and structured.structured_content_integrity = 'VERIFIED'
      and structured.render_mode = 'STRUCTURED_TEXT'
      and structured.language = 'ENGLISH'
      and structured.source_mapping_verified
      and structured.answer_verified
      and structured.statement_complete
      and structured.five_alternatives_complete
      and structured.no_control_chars
      and structured.no_previous_question_contamination
      and structured.no_next_question_contamination
      and not structured.required_media_present
      and structured.context_text = question_bank.statement
      and structured.prompt_text = ''
      and structured.provider_correct_alternative = occurrence.official_answer
      and structured.source_metadata->>'evidence_method' = 'INEP_OFFICIAL_PDF_PARSE'
      and structured.source_metadata->>'media_status' = 'NOT_DETECTED'
      and structured.source_metadata->>'source_sha256' = occurrence.artifact_sha256
      and structured.source_metadata->>'source_sha256' = question_bank.metadata->'source_provenance'->>'source_sha256'
      and structured.source_metadata->>'statement_sha256' = encode(extensions.digest(convert_to(question_bank.statement, 'UTF8'), 'sha256'), 'hex')
      and structured.normalized_content_hash = encode(extensions.digest(convert_to(question_bank.statement || E'\n' || (
        select string_agg(
          (option_item.value->>'letter') || ':' || (option_item.value->>'text'),
          E'\n' order by option_item.ordinality
        )
        from jsonb_array_elements(private.enem_english_normalized_options_v1(question_bank.options))
          with ordinality option_item(value, ordinality)
      ), 'UTF8'), 'sha256'), 'hex')
      and structured.source_metadata->>'options_sha256' = encode(extensions.digest(convert_to((
        select string_agg(
          (option_item.value->>'letter') || ':' || (option_item.value->>'text'),
          E'\n' order by option_item.ordinality
        )
        from jsonb_array_elements(private.enem_english_normalized_options_v1(question_bank.options))
          with ordinality option_item(value, ordinality)
      ), 'UTF8'), 'sha256'), 'hex')
      and jsonb_array_length(structured.alternatives_json) = 5
      and structured.alternatives_json = private.enem_english_normalized_options_v1(question_bank.options)
      and not exists (
        select 1
        from jsonb_array_elements(structured.alternatives_json) with ordinality option_item(value, ordinality)
        where option_item.value->>'letter' <> chr(64 + option_item.ordinality::integer)
          or nullif(btrim(option_item.value->>'text'), '') is null
          or option_item.value->>'text' ~ '[[:cntrl:]]'
          or coalesce(jsonb_array_length(option_item.value->'assets'), 0) > 0
      )
  ) then
    raise exception 'ENEM_ATTEMPT_SNAPSHOT_STRUCTURED_CONTENT_MISMATCH';
  end if;

  return new;
end;
$$;

revoke all on function private.validate_enem_english_text_snapshot_v1() from public, anon, authenticated;
drop trigger if exists validate_enem_english_text_snapshot_v1 on public.learning_simulation_attempt_questions;
create trigger validate_enem_english_text_snapshot_v1
before insert or update on public.learning_simulation_attempt_questions
for each row execute function private.validate_enem_english_text_snapshot_v1();

notify pgrst, 'reload schema';
commit;
