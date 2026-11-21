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
      and structured.provider_year between 2009 and 2025
      and structured.source_question_number is not null
      and nullif(btrim(structured.source_url), '') is not null
      and structured.source_provider = 'xequemat'
      and structured.rights_status = 'VERIFIED'
      and structured.provider_correct_alternative in ('A', 'B', 'C', 'D', 'E')
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
      and occurrence.artifact_sha256 = question_bank.metadata->'source_provenance'->>'source_sha256'
      and nullif(btrim(question_bank.statement), '') is not null
      and question_bank.statement !~ '[[:cntrl:]]'
      and coalesce(question_bank.metadata->>'required_media_present', 'false') <> 'true'
      -- Text evidence is authoritative here; broken PDF crops do not remove a verified question.
      and private.enem_english_verified_bank_options_v1(ready.question_id) is not null
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

commit;
