begin;

-- V5 is a forward-only corpus revision. V4 rows and attempts remain immutable;
-- only newly created attempts resolve against this revision.
create or replace function private.enem_provider_semantic_rejection_reasons_v5(
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
  reasons text[] := '{}'::text[];
  embedded_passage boolean;
begin
  if prompt_text = '' and context_text = '' then
    reasons := array_append(reasons, 'MISSING_CONTEXT');
  end if;

  embedded_passage := prompt_text ~ E'\n\s*\n'
    or prompt_text ~* '(disponível em|disponivel em|acesso em|adaptado|fragmento|inédito|inedito)'
    or char_length(prompt_text) >= 250;

  if context_text = '' and not embedded_passage and prompt_text ~* '(^|[^[:alpha:]])(essa|esse|essas|esses|esta|este|estas|estes|tal|tais|referido|referida|referidos|referidas|mencionado|mencionada|descrita|descrito|apresentado|apresentada|demonstrado|demonstrada|considerando esse|considerando essa|após a análise|apos a analise|no caso apresentado|comparando-se|após as|apos as|nessa|nessas|neste|nesta|dessa|dessas|o professor|o arquiteto|o carpinteiro|o pedido)([^[:alpha:]]|$)' then
    reasons := array_append(reasons, 'MISSING_CONTEXT');
    reasons := array_append(reasons, 'UNRESOLVED_REFERENCE');
  end if;

  if lower(btrim(coalesce(p_discipline, ''))) = 'matematica'
     and context_text = ''
     and prompt_text ~* '(volume|área|area|perímetro|perimetro|escala|prestação|prestacao|juros|porcentagem|percentual|probabilidade|velocidade média|velocidade media|média|media|distância|distancia|comprimento|largura|altura|raio|diâmetro|diametro|ângulo|angulo|progressão|progressao|taxa|valor total|quantidade de|número de|numero de|razão entre|razao entre|expressão que|expressao que|entalpia|fluxo de|massa molar|temperatura)'
     and prompt_text !~* '([0-9]|R\$|%|(^|[^[:alpha:]])(um|uma|dois|duas|três|tres|quatro|cinco|seis|sete|oito|nove|dez|cem|mil)([^[:alpha:]]|$))' then
    reasons := array_append(reasons, 'MISSING_NUMERIC_DATA');
    reasons := array_append(reasons, 'MISSING_CONTEXT');
  end if;

  -- A multiple-choice stem may end in a preposition because an alternative
  -- completes it. Only short, single-block fragments are treated as truncated.
  if context_text = ''
     and prompt_text !~ E'\n'
     and prompt_text !~ '[?!]\s*$'
     and char_length(prompt_text) < 250
     and prompt_text ~* '(\.\.\.|(^|[^[:alpha:]])(e|ou|que|de|da|do|das|dos|em|no|na|nas|nos|para|por|com|considerando|de acordo com|a partir de|será|sera|serão|serao|é de|e de|é da|e da|é do|e do|corresponde a|resulta em)[.!?]?\s*)$' then
    reasons := array_append(reasons, 'TRUNCATED_STATEMENT');
  end if;

  if context_text = ''
     and prompt_text !~ '[?!]\s*$'
     and char_length(prompt_text) < 80
     and prompt_text !~ E'\n' then
    reasons := array_append(reasons, 'TRUNCATED_STATEMENT');
  end if;

  if exists (
    select paragraph_text
    from (
      select lower(regexp_replace(btrim(part), '\\s+', ' ', 'g')) as paragraph_text
      from regexp_split_to_table(statement_text, E'\n\\s*\n') as part
      where char_length(btrim(part)) >= 80
    ) paragraphs
    group by paragraph_text
    having count(*) > 1
  ) then
    reasons := array_append(reasons, 'DUPLICATE_CONTENT');
  end if;

  return (select array_agg(distinct reason order by reason) from unnest(reasons) as reason);
end;
$$;

create or replace function private.enem_provider_semantic_complete_v5(
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
  select coalesce(cardinality(private.enem_provider_semantic_rejection_reasons_v5(p_context, p_prompt, p_discipline)), 0) = 0;
$$;

with candidates as (
  select
    structured.*,
    private.enem_provider_semantic_rejection_reasons_v5(
      structured.context_text,
      structured.prompt_text,
      structured.discipline
    ) as semantic_rejection_reasons
  from public.learning_enem_structured_content structured
  where structured.content_revision = 'structured-text-only-v4'
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
  candidate.context_text,
  candidate.prompt_text,
  candidate.alternatives_json,
  candidate.provider_correct_alternative,
  '[]'::jsonb,
  candidate.raw_hash,
  candidate.normalized_content_hash,
  candidate.match_method,
  case when coalesce(cardinality(candidate.semantic_rejection_reasons), 0) = 0 then candidate.match_level else 'REJECTED' end,
  candidate.match_confidence,
  case when coalesce(cardinality(candidate.semantic_rejection_reasons), 0) = 0 then 'VERIFIED' else 'REVIEW_REQUIRED' end,
  'structured-text-only-v5',
  'STRUCTURED_TEXT',
  false,
  candidate.answer_verified,
  case when coalesce(cardinality(candidate.semantic_rejection_reasons), 0) = 0 then 'VERIFIED' else 'REVIEW_REQUIRED' end,
  coalesce(cardinality(candidate.semantic_rejection_reasons), 0) = 0,
  candidate.five_alternatives_complete,
  candidate.no_control_chars,
  true,
  true,
  false,
  false,
  candidate.source_metadata || jsonb_build_object(
    'content_revision', 'structured-text-only-v5',
    'previous_content_revision', 'structured-text-only-v4',
    'source_kind', 'STRUCTURED_PROVIDER',
    'semantic_gate', 'v5',
    'semantic_state', case when coalesce(cardinality(candidate.semantic_rejection_reasons), 0) = 0 then 'COMPLETE' else 'INCOMPLETE' end,
    'semantic_rejection_reasons', to_jsonb(coalesce(candidate.semantic_rejection_reasons, '{}'::text[]))
  ),
  'STRUCTURED_PROVIDER',
  case when coalesce(cardinality(candidate.semantic_rejection_reasons), 0) = 0 then 'ACCEPTED' else 'REJECTED' end
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

update public.learning_question_bank question_bank
set metadata = question_bank.metadata || jsonb_build_object(
  'content_revision', 'structured-text-only-v5',
  'source_kind', 'STRUCTURED_PROVIDER',
  'render_mode', 'STRUCTURED_TEXT',
  'semantic_gate', 'v5'
)
where question_bank.source_type = 'ENEM_STRUCTURED_PROVIDER'
  and exists (
    select 1
    from public.learning_enem_structured_content structured
    where structured.question_bank_id = question_bank.id
      and structured.content_revision = 'structured-text-only-v5'
      and structured.content_acceptance_status = 'ACCEPTED'
  );

create or replace function private.current_enem_content_revision()
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select 'structured-text-only-v5'::text;
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
    and private.enem_provider_semantic_complete_v5(structured.context_text, structured.prompt_text, structured.discipline)
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
            and private.enem_provider_semantic_complete_v5(structured.context_text, structured.prompt_text, structured.discipline)
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

drop trigger if exists validate_enem_attempt_question_snapshot on public.learning_simulation_attempt_questions;
create trigger validate_enem_attempt_question_snapshot
before insert or update on public.learning_simulation_attempt_questions
for each row execute function private.validate_enem_attempt_question_snapshot();

notify pgrst, 'reload schema';
commit;
