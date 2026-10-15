begin;

-- Pool queries are also used for availability counts. Keep this shared helper
-- unordered; randomization belongs only to the callers that select questions.
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
    and structured.render_mode in ('STRUCTURED_TEXT', 'STRUCTURED_TEXT_WITH_MEDIA')
    and structured.structured_content_integrity = 'VERIFIED'
    and structured.statement_complete
    and private.enem_provider_statement_complete_v4(structured.context_text, structured.prompt_text)
    and structured.five_alternatives_complete
    and structured.no_control_chars
    and structured.no_previous_question_contamination
    and structured.no_next_question_contamination
     and (not structured.required_media_present or structured.required_media_validated)
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
      or upper(coalesce(question_bank.metadata->>'enem_subject', '')) = upper(p_subject)
      or question_bank.subject_area = p_subject
    )
    and (
      (p_language is null and structured.language is null)
      or (p_language is not null and structured.language = upper(p_language))
    );
$$;

revoke all on function private.enem_ready_provider_text_questions(text, text, text)
  from public, anon, authenticated;
grant execute on function private.enem_ready_provider_text_questions(text, text, text)
  to service_role;

commit;
