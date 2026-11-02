begin;

-- Restore the optional image prompt contract from the historical BNCC tutor
-- without changing answer selection, scoring, publication state, or progress.
-- Keep both the V9 getter and its preserved legacy getter on the same payload.
do $patch_guided_step_visual_stimulus_v1$
declare
  target_function regprocedure;
  function_definition text;
  original_definition text;
  old_clause text;
  new_clause text;
  replacement_count integer;
begin
  foreach target_function in array array[
    'public.get_guided_learning_step_v4(uuid)'::regprocedure,
    'public.get_guided_learning_step_v4_legacy_v9(uuid)'::regprocedure
  ] loop
    select pg_get_functiondef(target_function) into function_definition;
    if function_definition is null then
      raise exception 'BNCC_GUIDED_VISUAL_STIMULUS_FUNCTION_MISSING';
    end if;
    if position('visual_stimulus' in function_definition) > 0 then
      continue;
    end if;

    original_definition := function_definition;
    foreach old_clause in array array[
      $old$'position', item.position$old$,
      $old$'position',item.position$old$
    ] loop
      replacement_count := (length(function_definition) - length(replace(function_definition, old_clause, ''))) / length(old_clause);
      if replacement_count > 0 then
        new_clause := case
          when old_clause = $old$'position', item.position$old$ then
            $new$'position', item.position, 'visual_stimulus', question.metadata->'visual_stimulus'$new$
          else
            $new$'position',item.position,'visual_stimulus',question.metadata->'visual_stimulus'$new$
        end;
        function_definition := replace(function_definition, old_clause, new_clause);
      end if;
    end loop;
    if function_definition = original_definition then
      raise exception 'BNCC_GUIDED_VISUAL_STIMULUS_PATCH_MISMATCH';
    end if;
    execute function_definition;
  end loop;
end;
$patch_guided_step_visual_stimulus_v1$;

commit;
