-- Keep the stricter integrity contract for visual alternatives without hiding
-- the existing hybrid corpus, which uses the official statement asset and
-- verified textual alternatives.

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
  select distinct question_bank.id
  from public.learning_question_bank question_bank
  join public.learning_enem_official_occurrences occurrence
    on occurrence.question_bank_id = question_bank.id
  join public.learning_enem_media_assets statement_asset
    on statement_asset.occurrence_id = occurrence.id
   and coalesce(statement_asset.metadata->>'asset_role', 'STATEMENT') = 'STATEMENT'
   and statement_asset.quality_state = 'VALIDATED'
   and (statement_asset.storage_path is not null or statement_asset.metadata ? 'public_url')
  where question_bank.active
    and question_bank.package_type = 'ENEM'
    and question_bank.source_type = 'ENEM_OFFICIAL'
    and question_bank.metadata->>'source_integrity' = 'VERIFIED'
    and question_bank.metadata->>'render_mode' in ('HYBRID', 'VISUAL_OPTIONS')
    and question_bank.metadata->>'render_ready' = 'true'
    and question_bank.metadata->>'area_verified' = 'true'
    and (p_subject is null or question_bank.metadata->>'subject_verified' = 'true')
    and jsonb_typeof(question_bank.options) = 'array'
    and jsonb_array_length(question_bank.options) = 5
    and question_bank.correct_answer is not null
    and question_bank.metadata->>'official_answer_letter' in ('A', 'B', 'C', 'D', 'E')
    and (p_area is null or question_bank.metadata->>'enem_area' = p_area)
    and (p_subject is null or question_bank.metadata->>'enem_subject' = p_subject)
    and (p_language is null or occurrence.language = p_language)
    and (
      question_bank.metadata->>'render_mode' = 'HYBRID'
      or (
        question_bank.metadata->>'render_mode' = 'VISUAL_OPTIONS'
        and question_bank.metadata->>'statement_integrity' = 'VERIFIED'
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
  order by question_bank.id;
$$;

revoke all on function private.enem_ready_question_ids(text, text, text) from public, anon, authenticated;
grant execute on function private.enem_ready_question_ids(text, text, text) to service_role;
