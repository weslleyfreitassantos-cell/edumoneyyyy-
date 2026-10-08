begin;

-- V6 is forward-only. Existing v3/v4/v5 rows and attempts remain immutable.
-- The provider's padaria record starts at the equation, so this revision uses
-- the verified canary text supplied for that exact year/index/booklet match.
create or replace function private.enem_provider_semantic_rejection_reasons_v6(
  p_context text,
  p_prompt text,
  p_discipline text
)
returns text[]
language plpgsql
immutable
parallel safe
set search_path = ''
as $$
declare
  context_text text := btrim(coalesce(p_context, ''));
  prompt_text text := btrim(coalesce(p_prompt, ''));
  statement_text text := btrim(concat_ws(E'\n\n', nullif(context_text, ''), nullif(prompt_text, '')));
  reasons text[] := coalesce(private.enem_provider_semantic_rejection_reasons_v5(p_context, p_prompt, p_discipline), '{}'::text[]);
begin
  -- An equation and alternatives do not prove that the reference revenue is
  -- present. Keep this class out of the pool unless both facts are textual.
  if lower(btrim(coalesce(p_discipline, ''))) = 'matematica'
     and statement_text ~* 'p[ãa]es especiais'
     and statement_text ~* 'q[[:space:]]*=[[:space:]]*400[[:space:]]*[-–−][[:space:]]*100[_[:space:]]*p'
     and (statement_text !~* 'arrecada' or statement_text !~ '(^|[^0-9])300([,.]00)?([^0-9]|$)') then
    if not ('MISSING_REQUIRED_CONDITION' = any(reasons)) then
      reasons := array_append(reasons, 'MISSING_REQUIRED_CONDITION');
    end if;
    if not ('MISSING_CONTEXT' = any(reasons)) then
      reasons := array_append(reasons, 'MISSING_CONTEXT');
    end if;
  end if;

  return (select array_agg(distinct reason order by reason) from unnest(reasons) as reason);
end;
$$;

create or replace function private.enem_provider_semantic_complete_v6(
  p_context text,
  p_prompt text,
  p_discipline text
)
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  select coalesce(cardinality(private.enem_provider_semantic_rejection_reasons_v6(p_context, p_prompt, p_discipline)), 0) = 0;
$$;

with candidates as (
  select
    structured.*,
    case
      when structured.provider_question_key = '2015:150:matematica:COMMON' then
        'Uma padaria vende, em média, 100 pães especiais por dia e arrecada com essas vendas, em média, R$ 300,00. Constatou-se que a quantidade de pães especiais vendidos diariamente aumenta, caso o preço seja reduzido, de acordo com a equação\n\nq = 400 – 100p,\n\nna qual q representa a quantidade de pães especiais vendidos diariamente e p, o seu preço em reais.\n\nA fim de aumentar o fluxo de clientes, o gerente da padaria decidiu fazer uma promoção. Para tanto, modificará o preço do pão especial de modo que a quantidade a ser vendida diariamente seja a maior possível, sem diminuir a média de arrecadação diária na venda desse produto.'
      else structured.context_text
    end as effective_context
  from public.learning_enem_structured_content structured
  where structured.content_revision = 'structured-text-only-v5'
    and structured.source_kind = 'STRUCTURED_PROVIDER'
    and structured.content_acceptance_status = 'ACCEPTED'
    and structured.verification_status = 'VERIFIED'
    and structured.question_bank_id is not null
    and structured.occurrence_id is null
    and structured.render_mode = 'STRUCTURED_TEXT'
    and structured.question_bank_id is not null
)
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
  candidate.provider,
  candidate.provider_question_key,
  candidate.question_bank_id,
  null,
  candidate.provider_year,
  candidate.provider_index,
  candidate.discipline,
  candidate.language,
  candidate.effective_context,
  candidate.prompt_text,
  candidate.alternatives_json,
  candidate.provider_correct_alternative,
  candidate.essential_media_json,
  candidate.raw_hash,
  md5(concat_ws(E'\n\n', candidate.effective_context, candidate.prompt_text, candidate.alternatives_json::text)),
  candidate.match_method,
  case when private.enem_provider_semantic_complete_v6(candidate.effective_context, candidate.prompt_text, candidate.discipline) then candidate.match_level else 'REJECTED' end,
  candidate.match_confidence,
  case when private.enem_provider_semantic_complete_v6(candidate.effective_context, candidate.prompt_text, candidate.discipline) then 'VERIFIED' else 'REVIEW_REQUIRED' end,
  'structured-text-only-v6',
  'STRUCTURED_TEXT',
  candidate.source_mapping_verified,
  candidate.answer_verified,
  case when private.enem_provider_semantic_complete_v6(candidate.effective_context, candidate.prompt_text, candidate.discipline) then 'VERIFIED' else 'REVIEW_REQUIRED' end,
  private.enem_provider_semantic_complete_v6(candidate.effective_context, candidate.prompt_text, candidate.discipline),
  candidate.five_alternatives_complete,
  candidate.no_control_chars,
  candidate.no_previous_question_contamination,
  candidate.no_next_question_contamination,
  candidate.required_media_present,
  candidate.required_media_validated,
  candidate.source_metadata || jsonb_build_object(
    'content_revision', 'structured-text-only-v6',
    'previous_content_revision', 'structured-text-only-v5',
    'semantic_gate', 'v6',
    'recovery_origin', case when candidate.provider_question_key = '2015:150:matematica:COMMON' then 'user_verified_canary_reference' else null end,
    'semantic_rejection_reasons', to_jsonb(coalesce(private.enem_provider_semantic_rejection_reasons_v6(candidate.effective_context, candidate.prompt_text, candidate.discipline), '{}'::text[]))
  ),
  'STRUCTURED_PROVIDER',
  case when private.enem_provider_semantic_complete_v6(candidate.effective_context, candidate.prompt_text, candidate.discipline) then 'ACCEPTED' else 'REJECTED' end
from candidates candidate
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

create or replace function private.current_enem_content_revision()
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select 'structured-text-only-v6'::text;
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
  join public.learning_question_bank question_bank on question_bank.id = structured.question_bank_id
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
    and private.enem_provider_semantic_complete_v6(structured.context_text, structured.prompt_text, structured.discipline)
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

notify pgrst, 'reload schema';
commit;
