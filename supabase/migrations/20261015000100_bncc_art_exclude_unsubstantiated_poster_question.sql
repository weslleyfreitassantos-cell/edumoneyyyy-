begin;

do $exclude_unsubstantiated_art_question$
declare
  matching_rows integer;
begin
  update public.learning_question_bank
     set active = false,
         metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
           'future_selection_excluded', true,
           'future_selection_exclusion_reason', 'VISUAL_EVIDENCE_MISSING',
           'replacement_content_id', 'v5-art-compare-compositions-transfer-contrast-05-v2'
         ),
         updated_at = now()
   where source_type = 'TECESCOLA_CORE_V4'
     and metadata->>'content_id' = 'v4-authored-art-art_compare_compositions-transfer-05'
     and (active or metadata->>'future_selection_excluded' is distinct from 'true');

  select count(*) into matching_rows
    from public.learning_question_bank
   where source_type = 'TECESCOLA_CORE_V4'
     and metadata->>'content_id' = 'v4-authored-art-art_compare_compositions-transfer-05';

  if matching_rows = 0 then raise exception 'ART_UNSUPPORTED_POSTER_QUESTION_NOT_FOUND'; end if;
  if exists (
    select 1 from public.learning_question_bank
     where source_type = 'TECESCOLA_CORE_V4'
       and metadata->>'content_id' = 'v4-authored-art-art_compare_compositions-transfer-05'
       and (active or metadata->>'future_selection_excluded' is distinct from 'true')
  ) then raise exception 'ART_UNSUPPORTED_POSTER_QUESTION_STILL_SELECTABLE'; end if;
end;
$exclude_unsubstantiated_art_question$;

commit;
