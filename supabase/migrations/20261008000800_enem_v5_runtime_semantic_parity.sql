begin;

-- Keep the production SQL gate aligned with the v5 semantic evaluator. These
-- stems depend on source context even when they contain non-empty text.
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

  if context_text = '' and not embedded_passage and prompt_text ~* '(^|[^[:alpha:]])(essa|esse|essas|esses|esta|este|estas|estes|tal|tais|referido|referida|referidos|referidas|mencionado|mencionada|descrita|descrito|apresentado|apresentada|demonstrado|demonstrada|considerando esse|considerando essa|após a análise|apos a analise|no caso apresentado|comparando-se|após as|apos as|nessa|nessas|neste|nesta|dessa|dessas|o professor|o arquiteto|o carpinteiro|o pedido|o aluno que|respectivamente)([^[:alpha:]]|$)' then
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
      from regexp_split_to_table(statement_text, E'\n\\s*\\n') as part
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

-- Reclassify every affected v5 row, rather than naming only the two audited
-- examples, so the correction remains closed under the semantic gate.
with affected as (
  select
    structured.id,
    private.enem_provider_semantic_rejection_reasons_v5(
      structured.context_text,
      structured.prompt_text,
      structured.discipline
    ) as reasons
  from public.learning_enem_structured_content structured
  where structured.content_revision = 'structured-text-only-v5'
    and structured.content_acceptance_status = 'ACCEPTED'
),
rejected as (
  select id, reasons
  from affected
  where coalesce(cardinality(reasons), 0) > 0
)
update public.learning_enem_structured_content structured
set match_level = 'REJECTED',
    verification_status = 'REVIEW_REQUIRED',
    structured_content_integrity = 'REVIEW_REQUIRED',
    statement_complete = false,
    source_metadata = structured.source_metadata || jsonb_build_object(
      'semantic_gate', 'v5-runtime-parity',
      'semantic_state', 'INCOMPLETE',
      'semantic_rejection_reasons', to_jsonb(rejected.reasons)
    ),
    content_acceptance_status = 'REJECTED',
    updated_at = now()
from rejected
where structured.id = rejected.id;

commit;
