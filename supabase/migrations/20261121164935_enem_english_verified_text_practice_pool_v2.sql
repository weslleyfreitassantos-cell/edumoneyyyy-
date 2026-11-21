begin;

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
  ), fallback_official_text_questions as (
    select
      ready.question_id,
      ready.occurrence_id,
      ready.structured_content_id,
      ready.language,
      ready.source_kind,
      2 as source_priority
    from ready_questions ready
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
      and occurrence.artifact_sha256 = question_bank.metadata->'source_provenance'->>'source_sha256'
      and nullif(btrim(question_bank.statement), '') is not null
      and question_bank.statement !~ '[[:cntrl:]]'
      and coalesce(question_bank.metadata->>'required_media_present', 'false') <> 'true'
      -- Use verified bank text only when an equivalent structured transcript is not available.
      and private.enem_english_verified_bank_options_v1(ready.question_id) is not null
  ), all_verified_text_questions as (
    select question_id, occurrence_id, structured_content_id, language, source_kind, source_priority
    from trusted_text_questions
    union all
    select question_id, occurrence_id, structured_content_id, language, source_kind, source_priority
    from fallback_official_text_questions
  )
  select distinct on (candidate.question_id)
    candidate.question_id,
    candidate.occurrence_id,
    candidate.structured_content_id,
    candidate.language,
    candidate.source_kind
  from all_verified_text_questions candidate
  order by candidate.question_id, candidate.source_priority, candidate.structured_content_id nulls last, candidate.occurrence_id nulls last;
$$;

revoke all on function private.enem_ready_english_practice_questions_v1() from public, anon, authenticated;
grant execute on function private.enem_ready_english_practice_questions_v1() to service_role;

commit;
