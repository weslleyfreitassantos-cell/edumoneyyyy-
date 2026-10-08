begin;

-- Rows with control characters in an option are not eligible for the v5
-- structured-text pool, even when their legacy structural flag is stale.
with affected as (
  select structured.id
  from public.learning_enem_structured_content structured
  where structured.content_revision = 'structured-text-only-v5'
    and structured.content_acceptance_status = 'ACCEPTED'
    and exists (
      select 1
      from jsonb_array_elements(structured.alternatives_json) option_item
      where option_item->>'text' ~ '[[:cntrl:]]'
    )
)
update public.learning_enem_structured_content structured
set match_level = 'REJECTED',
    verification_status = 'REVIEW_REQUIRED',
    structured_content_integrity = 'REVIEW_REQUIRED',
    statement_complete = false,
    source_metadata = structured.source_metadata || jsonb_build_object(
      'semantic_gate', 'v5-runtime-structural-parity',
      'semantic_state', 'INCOMPLETE',
      'semantic_rejection_reasons', jsonb_build_array('CONTROL_CHARACTERS')
    ),
    content_acceptance_status = 'REJECTED',
    updated_at = now()
from affected
where structured.id = affected.id;

commit;
