begin;

do $exclude_misclassified_computing_question$
declare
  matching_rows integer;
begin
  update public.learning_question_bank
     set active = false,
         metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
           'future_selection_excluded', true,
           'future_selection_exclusion_reason', 'OUT_OF_SCOPE_FOR_TABLE_READING'
         ),
         updated_at = now()
   where source_type = 'TECESCOLA_CORE_V4'
     and metadata->>'content_id' = 'v3-computing-computing_algorithms-10'
     and (active or metadata->>'future_selection_excluded' is distinct from 'true');

  select count(*) into matching_rows
    from public.learning_question_bank
   where source_type = 'TECESCOLA_CORE_V4'
     and metadata->>'content_id' = 'v3-computing-computing_algorithms-10';

  if matching_rows = 0 then raise exception 'COMPUTING_OUT_OF_SCOPE_QUESTION_NOT_FOUND'; end if;
  if exists (
    select 1 from public.learning_question_bank
     where source_type = 'TECESCOLA_CORE_V4'
       and metadata->>'content_id' = 'v3-computing-computing_algorithms-10'
       and (active or metadata->>'future_selection_excluded' is distinct from 'true')
  ) then raise exception 'COMPUTING_OUT_OF_SCOPE_QUESTION_STILL_SELECTABLE'; end if;
end;
$exclude_misclassified_computing_question$;

commit;
